"use strict";
// Various utility functions for working with GLTFs
// See: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeFeaturePositionsFromGltfVertices = exports.readValueAt = exports.parseGltf = exports.parseGlb = exports.asComponentType = exports.isValidComponentType = void 0;
const _3d_tiles_tools_1 = require("3d-tiles-tools");
const core_1 = require("@gltf-transform/core");
const extensions_1 = require("@gltf-transform/extensions");
const cesium_1 = require("cesium");
const draco3dgltf_1 = __importDefault(require("draco3dgltf"));
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
async function parseGlb(glb) {
    const io = new core_1.NodeIO();
    io.registerExtensions(extensions_1.ALL_EXTENSIONS) // pass through extensions we do not handle explicitly
        .registerDependencies({
        "draco3d.decoder": await draco3dgltf_1.default.createDecoderModule(),
    });
    // Replaces CESIUM_RTC by inserting new nodes that wrap existing nodes inside
    // a transform
    const modernGlb = await _3d_tiles_tools_1.GltfUtilities.replaceCesiumRtcExtension(glb);
    const document = await io.readBinary(new Uint8Array(modernGlb));
    return document;
}
exports.parseGlb = parseGlb;
async function parseGltf(gltfJson) {
    const io = new core_1.NodeIO();
    io.registerExtensions(extensions_1.ALL_EXTENSIONS) // pass through extensions we do not handle explicitly
        .registerDependencies({
        "draco3d.decoder": await draco3dgltf_1.default.createDecoderModule(),
    });
    const document = await io.readJSON(gltfJson);
    return document;
}
exports.parseGltf = parseGltf;
function readValueAt(accessor, n) {
    const elements = accessor.getElementSize();
    const start = n * elements;
    const valueComponents = Array.from(accessor.getArray()?.slice(start, start + elements) ?? []);
    return valueComponents;
}
exports.readValueAt = readValueAt;
/**
 * Compute position for each feature from the vertex data
 *
 * @returns An array of Cartographic positions one for each feature. The array
 * can be indexed by the batchId for the feature.
 */
function computeFeaturePositionsFromGltfVertices(gltf, tileTransform, toZUpTransform) {
    const root = gltf.getRoot();
    const nodes = root.listNodes();
    const batchIdPositions = [];
    nodes.forEach((node) => {
        const mesh = node.getMesh();
        if (mesh === null) {
            return;
        }
        const nodeMatrix = getCompoundMatrix(node);
        const primitives = mesh.listPrimitives();
        // worldMatrix = tileTransform * toZUpTransform * nodeMatrix
        const worldMatrix = cesium_1.Matrix4.IDENTITY.clone();
        cesium_1.Matrix4.multiplyTransformation(worldMatrix, tileTransform, worldMatrix);
        cesium_1.Matrix4.multiplyTransformation(worldMatrix, toZUpTransform, worldMatrix);
        cesium_1.Matrix4.multiplyTransformation(worldMatrix, nodeMatrix, worldMatrix);
        primitives.forEach((primitive) => {
            const attributes = primitive.listAttributes();
            const accessors = Object.fromEntries(primitive
                .listSemantics()
                .map((semantic, i) => [semantic, attributes[i]]));
            if (accessors.POSITION === undefined) {
                return;
            }
            const count = accessors.POSITION.getCount();
            for (let i = 0; i < count; i++) {
                // If the gltf vertices are tagged with BATCHID, store the positions at
                // the respective BATCHID. Otherwise store everything under a single
                // BATCHID=0
                const [batchId] = accessors._BATCHID !== undefined
                    ? readValueAt(accessors._BATCHID, i)
                    : [0];
                const [x, y, z] = readValueAt(accessors.POSITION, i);
                const localPosition = new cesium_1.Cartesian3(x, y, z);
                const worldPosition = cesium_1.Matrix4.multiplyByPoint(worldMatrix, localPosition, new cesium_1.Cartesian3());
                const cartographic = cesium_1.Cartographic.fromCartesian(worldPosition);
                batchIdPositions[batchId] = batchIdPositions[batchId] ?? [];
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
/**
 * Get the compound matrix for the given node.
 * This is the cumulative product of the matrices of the current node and all its parents.
 */
function getCompoundMatrix(node) {
    const parentNode = node.getParentNode();
    const matrix = parentNode
        ? getCompoundMatrix(parentNode)
        : cesium_1.Matrix4.IDENTITY.clone();
    cesium_1.Matrix4.multiply(matrix, cesium_1.Matrix4.fromArray(node.getMatrix()), matrix);
    return matrix;
}
