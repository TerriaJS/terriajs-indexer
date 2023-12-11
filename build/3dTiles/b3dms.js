"use strict";
// Various utility functions for working with B3DMs
// See: https://github.com/CesiumGS/3d-tiles/blob/master/specification/TileFormats/Batched3DModel/README.md#feature-table
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRtcCenter = exports.getFeatureTableGlobalProperty = exports.getBatchTableProperties = exports.getBatchTable = exports.getBinaryBatchTable = exports.getJSONBatchTable = exports.getFeatureTable = exports.getBinaryFeatureTable = exports.getJSONFeatureTable = exports.getGlb = void 0;
const binaryProperty = __importStar(require("./binaryProperty"));
function getGlb(b3dm) {
    const glbStart = getBodyStart() +
        getFeatureTableJSONByteLength(b3dm) +
        getFeatureTableBinaryByteLength(b3dm) +
        getBatchTableJSONByteLength(b3dm) +
        getBatchTableBinaryByteLength(b3dm);
    return b3dm.subarray(glbStart);
}
exports.getGlb = getGlb;
function getJSONFeatureTable(b3dm) {
    const start = getBodyStart();
    const end = start + getFeatureTableJSONByteLength(b3dm);
    const buf = b3dm.subarray(start, end);
    return JSON.parse(buf.toString());
}
exports.getJSONFeatureTable = getJSONFeatureTable;
function getBinaryFeatureTable(b3dm) {
    const start = getBodyStart() + getFeatureTableJSONByteLength(b3dm);
    const end = start + getFeatureTableBinaryByteLength(b3dm);
    return b3dm.subarray(start, end);
}
exports.getBinaryFeatureTable = getBinaryFeatureTable;
function getFeatureTable(b3dm) {
    return {
        jsonFeatureTable: getJSONFeatureTable(b3dm),
        binaryFeatureTable: getBinaryFeatureTable(b3dm),
    };
}
exports.getFeatureTable = getFeatureTable;
function getJSONBatchTable(b3dm) {
    const start = getBodyStart() +
        getFeatureTableJSONByteLength(b3dm) +
        getFeatureTableBinaryByteLength(b3dm);
    const end = start + getBatchTableJSONByteLength(b3dm);
    const json = JSON.parse(b3dm.slice(start, end).toString());
    return json;
}
exports.getJSONBatchTable = getJSONBatchTable;
function getBinaryBatchTable(b3dm) {
    const start = getBodyStart() +
        getFeatureTableJSONByteLength(b3dm) +
        getFeatureTableBinaryByteLength(b3dm) +
        getBatchTableJSONByteLength(b3dm);
    const end = start + getBatchTableBinaryByteLength(b3dm);
    const binaryBuffer = Buffer.from(b3dm.slice(start, end));
    return binaryBuffer;
}
exports.getBinaryBatchTable = getBinaryBatchTable;
function getBatchTable(b3dm) {
    return {
        jsonBatchTable: getJSONBatchTable(b3dm),
        binaryBatchTable: getBinaryBatchTable(b3dm),
    };
}
exports.getBatchTable = getBatchTable;
function getBatchTableProperties(batchTable, batchLength) {
    const properties = {};
    Object.entries(batchTable.jsonBatchTable).forEach(([name, entry]) => {
        if (Array.isArray(entry)) {
            // entry is an array of values one for each batchId
            properties[name] = entry;
        }
        else {
            // entry points to a buffer which we need to parse as an array
            const propertyReference = binaryProperty.parse(entry);
            const property = binaryProperty.read(propertyReference, batchTable.binaryBatchTable, batchLength);
            properties[name] = property;
        }
    });
    return properties;
}
exports.getBatchTableProperties = getBatchTableProperties;
function getFeatureTableGlobalProperty(featureTable, name, componentSize, componentLength) {
    const jsonValue = featureTable.jsonFeatureTable[name];
    if (jsonValue === undefined) {
        return;
    }
    const valueOrBuffer = jsonValue.byteOffset === undefined
        ? jsonValue
        : featureTable.binaryFeatureTable.subarray(jsonValue.byteOffset, jsonValue.byteOffset + componentSize * componentLength);
    return valueOrBuffer;
}
exports.getFeatureTableGlobalProperty = getFeatureTableGlobalProperty;
function readRtcCenter(featureTable) {
    const rtcCenterRaw = getFeatureTableGlobalProperty(featureTable, "RTC_CENTER", Float32Array.BYTES_PER_ELEMENT, 3);
    if (rtcCenterRaw === undefined) {
        return;
    }
    const b3dmRtcCenter = Array.isArray(rtcCenterRaw)
        ? rtcCenterRaw
        : rtcCenterRaw instanceof Buffer
            ? new Float32Array(rtcCenterRaw)
            : undefined;
    return b3dmRtcCenter;
}
exports.readRtcCenter = readRtcCenter;
function getBodyStart() {
    return 28;
}
function getFeatureTableJSONByteLength(b3dm) {
    return b3dm.readUInt32LE(12);
}
function getFeatureTableBinaryByteLength(b3dm) {
    return b3dm.readUInt32LE(16);
}
function getBatchTableJSONByteLength(b3dm) {
    return b3dm.readUInt32LE(20);
}
function getBatchTableBinaryByteLength(b3dm) {
    return b3dm.readUInt32LE(24);
}
