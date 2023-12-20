/// <reference types="node" />
import { Accessor, Document } from "@gltf-transform/core";
import { Cartographic, Matrix4 } from "cesium";
export type Gltf = {
    json: any;
    buffers: Buffer[];
};
declare enum ComponentType {
    UNSIGNED_BYTE = 5121,
    SHORT = 5123,
    FLOAT = 5126
}
export declare function isValidComponentType(value: number): value is ComponentType;
export declare function asComponentType(value: number): ComponentType;
export declare function parseGlb(glb: Buffer): Promise<Document>;
export declare function parseGltf(gltfJson: any): Promise<Document>;
export declare function readValueAt(accessor: Accessor, n: number): number[];
/**
 * Compute position for each feature from the vertex data
 *
 * @returns An array of Cartographic positions one for each feature. The array
 * can be indexed by the batchId for the feature.
 */
export declare function computeFeaturePositionsFromGltfVertices(gltf: Document, tileTransform: Matrix4, toZUpTransform: Matrix4): Cartographic[] | undefined;
export {};
