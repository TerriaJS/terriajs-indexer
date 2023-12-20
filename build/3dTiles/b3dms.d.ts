/// <reference types="node" />
export type FeatureTable = {
    jsonFeatureTable: any;
    binaryFeatureTable: Buffer;
};
export type BatchTable = {
    jsonBatchTable: any;
    binaryBatchTable: Buffer;
};
export declare function getGlb(b3dm: Buffer): Buffer;
export declare function getJSONFeatureTable(b3dm: Buffer): any;
export declare function getBinaryFeatureTable(b3dm: Buffer): Buffer;
export declare function getFeatureTable(b3dm: Buffer): FeatureTable;
export declare function getJSONBatchTable(b3dm: Buffer): any;
export declare function getBinaryBatchTable(b3dm: Buffer): Buffer;
export declare function getBatchTable(b3dm: Buffer): BatchTable;
export declare function getBatchTableProperties(batchTable: BatchTable, batchLength: number): Record<string, any[]>;
export declare function getFeatureTableGlobalProperty(featureTable: FeatureTable, name: string, componentSize: number, componentLength: number): any;
export declare function readRtcCenter(featureTable: FeatureTable): number[] | Float32Array | undefined;
