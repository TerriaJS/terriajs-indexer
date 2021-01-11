import MiniSearch from "minisearch";
import * as path from "path";
import * as fse from "fs-extra";
import { Index, NumericIndex, EnumIndex, TextIndex, EnumValue } from "./Index";
import writeCsv from "../writeCsv";
import { IndexConfig } from "./Config";

export type IndexBuilder =
  | NumericIndexBuilder
  | TextIndexBuilder
  | EnumIndexBuilder;

// Return a new type having the same shape as the index T minus the methods
export type IndexDefinition<T extends Index> = Omit<T, "load" | "search">;

export class NumericIndexBuilder {
  readonly idValuePairs: { dataRowId: number; value: number }[] = [];
  range?: { min: number; max: number };

  constructor(readonly property: string, readonly config: IndexConfig) {}

  addIndexValue(dataRowId: number, value: any) {
    if (typeof value === "number") {
      this.range = {
        min: this.range === undefined ? value : Math.min(value, this.range.min),
        max: this.range === undefined ? value : Math.max(value, this.range.max),
      };
    }
    this.idValuePairs.push({ dataRowId, value });
  }

  writeIndex(fileId: number, outDir: string): NumericIndex {
    if (!this.range)
      throw new Error(`Index for property "${this.property}" is empty`);

    this.idValuePairs.sort((a, b) => a.value - b.value);
    const fileName = `${fileId}.csv`;
    const filePath = path.join(outDir, fileName);
    writeCsv(filePath, this.idValuePairs);

    return {
      type: "numeric",
      url: fileName,
      range: this.range,
    };
  }
}

export class TextIndexBuilder {
  miniSearchIndex: MiniSearch;

  constructor(readonly property: string, readonly config: IndexConfig) {
    this.miniSearchIndex = new MiniSearch({ fields: [property] });
  }

  addIndexValue(dataRowId: number, value: any) {
    this.miniSearchIndex.add({ id: dataRowId, [this.property]: value });
  }

  writeIndex(fileId: number, outDir: string): TextIndex {
    const index = this.miniSearchIndex;
    const fileName = `${fileId}.json`;
    const filePath = path.join(outDir, fileName);
    fse.writeFileSync(
      filePath,
      JSON.stringify({ index, options: (index as any)._options })
    );
    return {
      type: "text",
      url: fileName,
    };
  }
}

export class EnumIndexBuilder {
  readonly valueIds: Record<string, { dataRowId: number }[]> = {};

  constructor(readonly property: string, readonly config: IndexConfig) {}

  addIndexValue(dataRowId: number, value: any) {
    this.valueIds[value] = this.valueIds[value] || [];
    this.valueIds[value].push({ dataRowId });
  }

  writeIndex(fileId: number, outDir: string): EnumIndex {
    const values: Record<string, EnumValue> = Object.entries(
      this.valueIds
    ).reduce((values, [value, ids], i) => {
      values[value] = this.writeValueIndex(fileId, i, ids, outDir);
      return values;
    }, {} as Record<string, EnumValue>);
    return {
      type: "enum",
      values,
    };
  }

  writeValueIndex(
    fileId: number,
    valueId: number,
    ids: { dataRowId: number }[],
    outDir: string
  ): EnumValue {
    const fileName = `${fileId}-${valueId}.csv`;
    const filePath = path.join(outDir, fileName);
    writeCsv(filePath, ids);
    return {
      count: ids.length,
      url: fileName,
    };
  }
}

export function createIndexBuilder(
  property: string,
  indexConfig: IndexConfig
): IndexBuilder {
  switch (indexConfig.type) {
    case "numeric":
      return new NumericIndexBuilder(property, indexConfig);
    case "text":
      return new TextIndexBuilder(property, indexConfig);
    case "enum":
      return new EnumIndexBuilder(property, indexConfig);
  }
}
