/// <reference types="node" />
import { Cartesian3 } from "cesium";
export declare type Gltf = {
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
export declare function parseGlb(glb: Buffer): Gltf | undefined;
/**
 * Get the nth value in the buffer described by an accessor with accessorId
 */
export declare function getBufferForValueAt(gltf: Gltf, accessorId: number, n: number): Buffer;
export declare function readValueAt(gltf: Gltf, accessorId: number, n: number): number[];
export declare function getCartesian3FromVertex(vertex: Buffer): Cartesian3;
export declare function setVertexFromCartesian3(vertex: Buffer, position: Cartesian3): void;
export declare function sizeOfComponentType(componentType: ComponentType): number;
export declare function numberOfComponentsForType(accessorType: string): 1 | 3;
export {};
