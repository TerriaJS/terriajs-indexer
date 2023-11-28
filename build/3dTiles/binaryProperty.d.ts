type BinaryProperty = {
    byteOffset: number;
    componentType: number;
    type: BinaryPropertyType;
};
type BinaryPropertyType = "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT2" | "MAT3" | "MAT4";
export declare function parse(json: any): BinaryProperty;
export declare function read(binaryProperty: BinaryProperty, binaryBody: Uint8Array, batchLength: number): any[];
export {};
