export interface IndexRoot {
    resultsDataUrl: string;
    idProperty: string;
    indexes: Record<string, Index>;
}
export declare type Index = NumericIndex | EnumIndex | TextIndex;
export declare type IndexType = Index["type"];
export declare const indexTypes: string[];
export declare type NumericIndex = {
    type: "numeric";
    url: string;
    range: NumericRange;
};
export declare type NumericRange = {
    min: number;
    max: number;
};
export declare type EnumIndex = {
    type: "enum";
    values: Record<string, EnumValue>;
};
export declare type EnumValue = {
    count: number;
    url: string;
    dataRowIds?: number[];
};
export declare type TextIndex = {
    type: "text";
    url: string;
};
