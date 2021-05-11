"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIndexesConfig = void 0;
const Index_1 = require("./Index");
const Json_1 = require("./Json");
function parseIndexesConfig(json) {
    Json_1.assertObject(json, "IndexesConfig");
    Json_1.assertString(json.idProperty, "idProperty");
    const indexes = parseIndexes(json.indexes);
    return {
        idProperty: json.idProperty,
        indexes,
    };
}
exports.parseIndexesConfig = parseIndexesConfig;
function parseIndexes(json) {
    Json_1.assertObject(json, "IndexesConfig.indexes");
    return Object.entries(json).reduce((indexes, [property, indexConfigJson]) => {
        indexes[property] = parseIndexConfig(indexConfigJson);
        return indexes;
    }, {});
}
function parseIndexConfig(json) {
    Json_1.assertObject(json, "IndexConfig");
    return {
        type: parseIndexType(json.type),
    };
}
function parseIndexType(json) {
    Json_1.assertString(json, "IndexType");
    if (Index_1.indexTypes.includes(json))
        return json;
    throw new Error(`Expected index type to be ${Index_1.indexTypes.join("|")}, got ${json}`);
}
//# sourceMappingURL=Config.js.map