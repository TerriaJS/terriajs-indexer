import { IndexType } from "./Index";
export type IndexesConfig = {
    idProperty: string;
    indexes: Record<string, IndexConfig>;
    extraProperties: string[];
};
export type IndexConfig = {
    type: IndexType;
};
export declare function parseIndexesConfig(json: any): IndexesConfig;
