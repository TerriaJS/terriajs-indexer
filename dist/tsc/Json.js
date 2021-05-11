"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertArray = exports.assertNumber = exports.assertString = exports.assertObject = exports.isJsonString = exports.isJsonNumber = exports.isJsonBoolean = exports.isJsonObject = void 0;
function isJsonObject(value) {
    return (value !== undefined &&
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value));
}
exports.isJsonObject = isJsonObject;
function isJsonBoolean(value) {
    return typeof value === "boolean";
}
exports.isJsonBoolean = isJsonBoolean;
function isJsonNumber(value) {
    return typeof value === "number";
}
exports.isJsonNumber = isJsonNumber;
function isJsonString(value) {
    return typeof value === "string";
}
exports.isJsonString = isJsonString;
function assertObject(value, name) {
    if (isJsonObject(value))
        return;
    throwUnexpectedError("JsonObject", typeof value, name);
}
exports.assertObject = assertObject;
function assertString(value, name) {
    if (typeof value === "string")
        return;
    throwUnexpectedError("string", typeof value, name);
}
exports.assertString = assertString;
function assertNumber(value, name) {
    if (typeof value === "number")
        return;
    throwUnexpectedError("number", typeof value, name);
}
exports.assertNumber = assertNumber;
function assertArray(value, name) {
    if (Array.isArray(value))
        return;
    throwUnexpectedError("Array", typeof value, name);
}
exports.assertArray = assertArray;
function throwUnexpectedError(expectedType, actualType, name) {
    const nameToBe = name ? ` ${name} to be` : "";
    throw new Error(`Expected${nameToBe} ${expectedType}, got ${actualType}`);
}
//# sourceMappingURL=Json.js.map