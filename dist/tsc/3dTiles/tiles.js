"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toZUpTransform = exports.uri = exports.forEachTile = void 0;
const cesium_1 = require("cesium");
function forEachTile(tileset, iterFn) {
    const root = tileset.root;
    if (root === undefined) {
        return;
    }
    const iterTile = (tile, parentTransform) => {
        const computedTransform = tile.transform !== undefined
            ? cesium_1.Matrix4.multiply(parentTransform, cesium_1.Matrix4.unpack(tile.transform), new cesium_1.Matrix4())
            : parentTransform;
        iterFn({ tile, computedTransform });
        if (Array.isArray(tile.children)) {
            tile.children.forEach((child) => iterTile(child, computedTransform));
        }
    };
    iterTile(root, cesium_1.Matrix4.IDENTITY.clone());
}
exports.forEachTile = forEachTile;
function uri(tile) {
    var _a, _b, _c;
    // older formats use url
    return (_b = (_a = tile.content) === null || _a === void 0 ? void 0 : _a.uri) !== null && _b !== void 0 ? _b : (_c = tile.content) === null || _c === void 0 ? void 0 : _c.url;
}
exports.uri = uri;
function toZUpTransform(tileset) {
    var _a, _b;
    const upAxis = (_b = (_a = tileset.asset) === null || _a === void 0 ? void 0 : _a.gltfUpAxis) !== null && _b !== void 0 ? _b : cesium_1.Axis.Y;
    const transform = upAxis === cesium_1.Axis.Y
        ? cesium_1.Axis.Y_UP_TO_Z_UP.clone()
        : upAxis === cesium_1.Axis.X
            ? cesium_1.Axis.X_UP_TO_Z_UP.clone()
            : cesium_1.Matrix4.IDENTITY.clone();
    return transform;
}
exports.toZUpTransform = toZUpTransform;
//# sourceMappingURL=tiles.js.map