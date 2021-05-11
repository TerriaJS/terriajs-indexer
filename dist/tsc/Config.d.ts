import { IndexType } from "./Index";
export declare type IndexesConfig = {
    idProperty: string;
    indexes: Record<string, IndexConfig>;
};
export declare type IndexConfig = {
    type: IndexType;
};
export declare function parseIndexesConfig(json: any): IndexesConfig;
