"use strict";
// TODO: To simplify build, this duplicates the type definitions in terriajs/lib/ItemSearchProviders/Index.ts
// Figure out a build strategy that avoids this duplication.
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexTypes = void 0;
const _indexTypes = {
    numeric: true,
    enum: true,
    text: true,
};
exports.indexTypes = Object.keys(_indexTypes);
