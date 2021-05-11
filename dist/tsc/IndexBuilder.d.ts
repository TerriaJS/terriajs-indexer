import MiniSearch from "minisearch";
import { Index, NumericIndex, EnumIndex, TextIndex, EnumValue } from "./Index";
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
    addIndexValue(dataRowId: number, value: any): void;
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
