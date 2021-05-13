"use strict";
// Various utility functions for working with GLTFs
// See: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFeaturePositionsFromGltfVertices = exports.numberOfComponentsForType = exports.sizeOfComponentType = exports.setVertexFromCartesian3 = exports.getCartesian3FromVertex = exports.readValueAt = exports.getBufferForValueAt = exports.parseGlb = exports.asComponentType = exports.isValidComponentType = void 0;
const cesium_1 = require("cesium");
const sizeOfUint32 = 4;
const jsonChunkType = 0x4e4f534a;
const binaryChunkType = 0x004e4942;
// Add more types here as required from https://github.com/CesiumGS/cesium/blob/master/Source/Core/ComponentDatatype.js#L12
var ComponentType;
(function (ComponentType) {
    ComponentType[ComponentType["UNSIGNED_BYTE"] = 5121] = "UNSIGNED_BYTE";
    ComponentType[ComponentType["SHORT"] = 5123] = "SHORT";
    ComponentType[ComponentType["FLOAT"] = 5126] = "FLOAT";
})(ComponentType || (ComponentType = {}));
function isValidComponentType(value) {
    return value in ComponentType;
}
exports.isValidComponentType = isValidComponentType;
function asComponentType(value) {
    if (isValidComponentType(value))
        return value;
    throw new Error(`Unhandled component type: ${value}`);
}
exports.asComponentType = asComponentType;
function parseGlb(glb) {
    if (glb.slice(0, 4).toString() !== "glTF") {
        return;
    }
    const version = glb.readUInt32LE(4);
    if (version === 2) {
        return parseGlbVersion2(glb);
    }
    throw new Error(`Unhandled gltf version: ${version}`);
}
exports.parseGlb = parseGlb;
function parseGlbVersion2(glb) {
    const length = readHeader(glb, 0, 12)[2];
    let byteOffset = 12;
    let json;
    let binaryBuffer = Buffer.from([]);
    while (byteOffset < length) {
        const [chunkLength, chunkType] = readHeader(glb, byteOffset, 2);
        byteOffset += 8;
        const chunkBuffer = glb.subarray(byteOffset, byteOffset + chunkLength);
        byteOffset += chunkLength;
        if (chunkType === jsonChunkType) {
            json = JSON.parse(chunkBuffer.toString("utf-8"));
        }
        else if (chunkType === binaryChunkType) {
            binaryBuffer = chunkBuffer;
        }
    }
    return { json, buffers: [binaryBuffer] };
}
function readHeader(glb, byteOffset, count) {
    const header = [];
    for (let i = 0; i < count; i++) {
        header.push(glb.readUInt32LE(byteOffset + i * sizeOfUint32));
    }
    return header;
}
/**
 * Get the nth value in the buffer described by an accessor with accessorId
 */
function getBufferForValueAt(gltf, accessorId, n) {
    var _a;
    const accessor = gltf.json.accessors[accessorId];
    const bufferView = gltf.json.bufferViews[accessor.bufferView];
    const bufferId = bufferView.buffer;
    const buffer = gltf.buffers[bufferId].slice(bufferView.byteOffset, bufferView.byteOffset + bufferView.byteLength);
    const valueSize = sizeOfComponentType(accessor.componentType) *
        numberOfComponentsForType(accessor.type);
    // if no byteStride specified, the buffer is tightly packed
    const byteStride = (_a = bufferView.byteStride) !== null && _a !== void 0 ? _a : valueSize;
    const pos = accessor.byteOffset + n * byteStride;
    const valueBuffer = buffer.slice(pos, pos + valueSize);
    return valueBuffer;
}
exports.getBufferForValueAt = getBufferForValueAt;
function readValueAt(gltf, accessorId, n) {
    const buffer = getBufferForValueAt(gltf, accessorId, n);
    const accessor = gltf.json.accessors[accessorId];
    const numberOfComponents = numberOfComponentsForType(accessor.type);
    const valueComponents = [];
    const componentType = asComponentType(accessor.componentType);
    for (let i = 0; i < numberOfComponents; i++) {
        valueComponents[i] = readComponent(buffer, componentType, i);
    }
    return valueComponents;
}
exports.readValueAt = readValueAt;
function readComponent(valueBuffer, componentType, n) {
    switch (componentType) {
        case ComponentType.UNSIGNED_BYTE:
            return valueBuffer.readUInt8(n * sizeOfComponentType(componentType));
        case ComponentType.SHORT:
            return valueBuffer.readUInt16LE(n * sizeOfComponentType(componentType));
        case ComponentType.FLOAT:
            return valueBuffer.readFloatLE(n * sizeOfComponentType(componentType));
    }
}
function getCartesian3FromVertex(vertex) {
    const x = vertex.readFloatLE(0);
    const y = vertex.readFloatLE(4);
    const z = vertex.readFloatLE(8);
    const position = new cesium_1.Cartesian3(x, y, z);
    return position;
}
exports.getCartesian3FromVertex = getCartesian3FromVertex;
function setVertexFromCartesian3(vertex, position) {
    vertex.writeFloatLE(position.x, 0);
    vertex.writeFloatLE(position.y, 4);
    vertex.writeFloatLE(position.z, 8);
}
exports.setVertexFromCartesian3 = setVertexFromCartesian3;
function sizeOfComponentType(componentType) {
    switch (componentType) {
        case ComponentType.UNSIGNED_BYTE:
            return Uint8Array.BYTES_PER_ELEMENT;
        case ComponentType.SHORT:
            return Int16Array.BYTES_PER_ELEMENT;
        case ComponentType.FLOAT:
            return Float32Array.BYTES_PER_ELEMENT;
    }
}
exports.sizeOfComponentType = sizeOfComponentType;
function numberOfComponentsForType(accessorType) {
    switch (accessorType) {
        case "VEC3":
            return 3;
        case "SCALAR":
            return 1;
        default:
            throw new Error(`Unhandled accessor type: ${accessorType}`);
    }
}
exports.numberOfComponentsForType = numberOfComponentsForType;
/**
 * Compute position for each feature from the vertex data
 *
 * @returns An array of Cartographic positions one for each feature. The array
 * can be indexed by the batchId for the feature.
 */
function computeFeaturePositionsFromGltfVertices(gltf, tileTransform, rtcTransform, toZUpTransform) {
    const nodes = gltf === null || gltf === void 0 ? void 0 : gltf.json.nodes;
    const meshes = gltf === null || gltf === void 0 ? void 0 : gltf.json.meshes;
    const accessors = gltf === null || gltf === void 0 ? void 0 : gltf.json.accessors;
    const bufferViews = gltf === null || gltf === void 0 ? void 0 : gltf.json.bufferViews;
    if (!Array.isArray(nodes) ||
        !Array.isArray(meshes) ||
        !Array.isArray(accessors) ||
        !Array.isArray(bufferViews)) {
        return;
    }
    const batchIdPositions = [];
    nodes.forEach((node) => {
        const mesh = meshes[node.mesh];
        const primitives = mesh.primitives;
        const nodeMatrix = Array.isArray(node.matrix)
            ? cesium_1.Matrix4.fromColumnMajorArray(node.matrix)
            : cesium_1.Matrix4.IDENTITY.clone();
        const modelMatrix = cesium_1.Matrix4.IDENTITY.clone();
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, tileTransform, modelMatrix);
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, rtcTransform, modelMatrix);
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, toZUpTransform, modelMatrix);
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, nodeMatrix, modelMatrix);
        primitives.forEach((primitive) => {
            var _a;
            const attributes = primitive.attributes;
            const _BATCHID = attributes._BATCHID;
            const POSITION = attributes.POSITION;
            if (POSITION === undefined) {
                return;
            }
            const count = accessors[POSITION].count;
            for (let i = 0; i < count; i++) {
                // If the gltf vertices are tagged with BATCHID, store the positions at
                // the respective BATCHID. Otherwise store everything under a single
                // BATCHID=0
                const [batchId] = _BATCHID !== undefined ? readValueAt(gltf, _BATCHID, i) : [0];
                const [x, y, z] = readValueAt(gltf, POSITION, i);
                const localPosition = new cesium_1.Cartesian3(x, y, z);
                const worldPosition = cesium_1.Matrix4.multiplyByPoint(modelMatrix, localPosition, new cesium_1.Cartesian3());
                const cartographic = cesium_1.Cartographic.fromCartesian(worldPosition);
                batchIdPositions[batchId] = (_a = batchIdPositions[batchId]) !== null && _a !== void 0 ? _a : [];
                if (cartographic !== undefined) {
                    batchIdPositions[batchId].push(cartographic);
                }
            }
        });
    });
    const featurePositions = batchIdPositions.map((positions) => {
        // From all the positions for the feature
        // 1. compute a center point
        // 2. compute the feature height
        const heights = positions.map((carto) => carto.height);
        const maxHeight = Math.max(...heights);
        const minHeight = Math.min(...heights);
        const featureHeight = maxHeight - minHeight;
        const rectangle = cesium_1.Rectangle.fromCartographicArray(positions);
        const position = cesium_1.Rectangle.center(rectangle);
        position.height = featureHeight;
        return position;
    });
    return featurePositions;
}
exports.computeFeaturePositionsFromGltfVertices = computeFeaturePositionsFromGltfVertices;
//# sourceMappingURL=gltfs.js.map