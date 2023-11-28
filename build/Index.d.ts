export interface IndexRoot {
    resultsDataUrl: string;
    idProperty: string;
    indexes: Record<string, Index>;
}
export type Index = NumericIndex | EnumIndex | TextIndex;
export type IndexType = Index["type"];
export declare const indexTypes: string[];
export type NumericIndex = {
    type: "numeric";
    url: string;
    range: NumericRange;
};
export type NumericRange = {
    min: number;
    max: number;
};
export type EnumIndex = {
    type: "enum";
    values: Record<string, EnumValue>;
};
export type EnumValue = {
    count: number;
    url: string;
    dataRowIds?: number[];
};
export type TextIndex = {
    type: "text";
    url: string;
};
