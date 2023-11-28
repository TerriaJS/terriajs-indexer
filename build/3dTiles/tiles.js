"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toZUpTransform = exports.uri = exports.forEachTile = void 0;
const cesium_1 = require("cesium");
async function forEachTile(tileset, iterFn) {
    const root = tileset.root;
    if (root === undefined) {
        return;
    }
    const iterTile = async (tile, parentTransform) => {
        const computedTransform = tile.transform !== undefined
            ? cesium_1.Matrix4.multiply(parentTransform, cesium_1.Matrix4.unpack(tile.transform), new cesium_1.Matrix4())
            : parentTransform;
        await iterFn({ tile, computedTransform });
        if (Array.isArray(tile.children)) {
            await Promise.all(tile.children.map((child) => iterTile(child, computedTransform)));
        }
    };
    return iterTile(root, cesium_1.Matrix4.IDENTITY.clone());
}
exports.forEachTile = forEachTile;
function uri(tile) {
    // older formats use url
    return tile.content?.uri ?? tile.content?.url;
}
exports.uri = uri;
function toZUpTransform(tileset) {
    const upAxis = tileset.asset?.gltfUpAxis ?? cesium_1.Axis.Y;
    const transform = upAxis === cesium_1.Axis.Y
        ? cesium_1.Axis.Y_UP_TO_Z_UP.clone()
        : upAxis === cesium_1.Axis.X
            ? cesium_1.Axis.X_UP_TO_Z_UP.clone()
            : cesium_1.Matrix4.IDENTITY.clone();
    return transform;
}
exports.toZUpTransform = toZUpTransform;
