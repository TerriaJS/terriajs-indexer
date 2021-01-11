// TODO: To simplify build, this duplicates the type definitions in terriajs/lib/ItemSearchProviders/Index.ts
// Figure out a build strategy that avoids this duplication.

export interface IndexRoot {
  dataUrl: string;
  idProperty: string;
  indexes: Record<string, Index>;
}

export type Index = NumericIndex | EnumIndex | TextIndex;

export type IndexType = Index["type"];

const _indexTypes: Record<IndexType, boolean> = {
  numeric: true,
  enum: true,
  text: true,
};

export const indexTypes: string[] = Object.keys(_indexTypes);

export type NumericIndex = {
  type: "numeric";
  url: string;
  range: NumericRange;
};

export type NumericRange = { min: number; max: number };

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
