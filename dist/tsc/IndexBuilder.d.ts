import MiniSearch from "minisearch";
import { Index, NumericIndex, EnumIndex, TextIndex, EnumValue, IndexRoot } from "./Index";
import { IndexConfig } from "./Config";
export declare type IndexBuilder = NumericIndexBuilder | TextIndexBuilder | EnumIndexBuilder;
export declare type IndexDefinition<T extends Index> = Omit<T, "load" | "search">;
export declare class NumericIndexBuilder {
    readonly property: string;
    readonly config: IndexConfig;
    readonly idValuePairs: {
        dataRowId: number;
        value: number;
    }[];
    range?: {
        min: number;
        max: number;
    };
    constructor(property: string, config: IndexConfig);
    addIndexValue(dataRowId: number, indexValue: any): void;
    writeIndex(fileId: number, outDir: string): NumericIndex;
}
export declare class TextIndexBuilder {
    readonly property: string;
    readonly config: IndexConfig;
    miniSearchIndex: MiniSearch;
    constructor(property: string, config: IndexConfig);
    addIndexValue(dataRowId: number, value: any): void;
    writeIndex(fileId: number, outDir: string): TextIndex;
}
export declare class EnumIndexBuilder {
    readonly property: string;
    readonly config: IndexConfig;
    readonly valueIds: Record<string, {
        dataRowId: number;
    }[]>;
    constructor(property: string, config: IndexConfig);
    addIndexValue(dataRowId: number, value: any): void;
    writeIndex(fileId: number, outDir: string): EnumIndex;
    writeValueIndex(fileId: number, valueId: number, ids: {
        dataRowId: number;
    }[], outDir: string): EnumValue;
}
export declare function createIndexBuilder(property: string, indexConfig: IndexConfig): IndexBuilder;
/**
 * Write indexes using the index builders and returns a `IndexRoot.indexes` map
 */
export declare function writeIndexes(indexBuilders: IndexBuilder[], outDir: string): Record<string, Index>;
/**
 * Writes the data.csv file under `outDir` and returns its path.
 */
export declare function writeResultsData(data: Record<string, any>[], outDir: string): string;
/**
 *  Writes the index root file under `outDir`.
 */
export declare function writeIndexRoot(indexRoot: IndexRoot, outDir: string): void;
