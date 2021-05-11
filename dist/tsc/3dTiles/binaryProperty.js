"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.read = exports.parse = void 0;
const cesium_1 = require("cesium");
const Json_1 = require("../Json");
const ComponentsPerAttribute = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
    MAT2: 4,
    MAT3: 9,
    MAT4: 16,
};
const ClassTypes = {
    SCALAR: undefined,
    VEC2: cesium_1.Cartesian2,
    VEC3: cesium_1.Cartesian3,
    VEC4: cesium_1.Cartesian4,
    MAT2: cesium_1.Matrix2,
    MAT3: cesium_1.Matrix3,
    MAT4: cesium_1.Matrix4,
};
const binaryPropertyTypes = Object.keys(ComponentsPerAttribute);
function parse(json) {
    Json_1.assertObject(json, "Object");
    Json_1.assertNumber(json.byteOffset, "byteOffset");
    const type = parseBinaryPropertyType(json.type);
    const componentType = parseComponentType(json.componentType);
    return {
        byteOffset: json.byteOffset,
        type,
        componentType,
    };
}
exports.parse = parse;
function parseBinaryPropertyType(json) {
    Json_1.assertString(json, "type");
    if (binaryPropertyTypes.includes(json))
        return json;
    throw new Error(`Expected type to be ${binaryPropertyTypes.join("|")}, got ${json}`);
}
function parseComponentType(json) {
    if (typeof json === "string")
        return cesium_1.ComponentDatatype.fromName(json);
    Json_1.assertNumber(json, "componentType");
    return json;
}
function read(binaryProperty, binaryBody, batchLength) {
    const componentsPerAttribute = ComponentsPerAttribute[binaryProperty.type];
    const typedArray = cesium_1.ComponentDatatype.createArrayBufferView(binaryProperty.componentType, binaryBody.buffer, binaryBody.byteOffset + binaryProperty.byteOffset, componentsPerAttribute * batchLength);
    const classType = ClassTypes[binaryProperty.type];
    const values = [];
    for (let i = 0; i < batchLength; i++) {
        if (classType === undefined)
            values.push(typedArray[i]);
        else
            values.push(classType.unpack(typedArray, i * componentsPerAttribute));
    }
    return values;
}
exports.read = read;
//# sourceMappingURL=binaryProperty.js.map