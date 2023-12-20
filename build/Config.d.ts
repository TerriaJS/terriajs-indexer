import { IndexType } from "./Index";
export type IndexesConfig = {
    idProperty: string;
    indexes: Record<string, IndexConfig>;
};
export type IndexConfig = {
    type: IndexType;
};
export declare function parseIndexesConfig(json: any): IndexesConfig;
