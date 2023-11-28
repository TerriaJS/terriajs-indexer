type JsonValue = boolean | number | string | null | JsonArray | JsonObject;
export interface JsonObject {
    [key: string]: JsonValue;
}
export interface JsonArray extends Array<JsonValue> {
}
export default JsonValue;
export declare function isJsonObject(value: JsonValue | undefined): value is JsonObject;
export declare function isJsonBoolean(value: JsonValue | undefined): value is boolean;
export declare function isJsonNumber(value: JsonValue | undefined): value is number;
export declare function isJsonString(value: JsonValue | undefined): value is string;
export declare function assertObject(value: any, name?: string): asserts value is JsonObject;
export declare function assertString(value: any, name?: string): asserts value is string;
export declare function assertNumber(value: any, name?: string): asserts value is number;
export declare function assertArray(value: any, name?: string): asserts value is any[];
