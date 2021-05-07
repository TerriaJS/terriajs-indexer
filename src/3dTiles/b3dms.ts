// See: https://github.com/CesiumGS/3d-tiles/blob/master/specification/TileFormats/Batched3DModel/README.md#feature-table

import * as binaryProperty from "./BinaryProperty";

export type FeatureTable = {
  jsonFeatureTable: any;
  binaryFeatureTable: Buffer;
};

export type BatchTable = {
  jsonBatchTable: any;
  binaryBatchTable: Buffer;
};

export function getGlb(b3dm: Buffer): Buffer {
  const glbStart =
    getBodyStart() +
    getFeatureTableJSONByteLength(b3dm) +
    getFeatureTableBinaryByteLength(b3dm) +
    getBatchTableJSONByteLength(b3dm) +
    getBatchTableBinaryByteLength(b3dm);
  return b3dm.subarray(glbStart);
}

export function getJSONFeatureTable(b3dm: Buffer): any {
  const start = getBodyStart();
  const end = start + getFeatureTableJSONByteLength(b3dm);
  const buf = b3dm.subarray(start, end);
  return JSON.parse(buf.toString());
}

export function getBinaryFeatureTable(b3dm: Buffer): Buffer {
  const start = getBodyStart() + getFeatureTableJSONByteLength(b3dm);
  const end = start + getFeatureTableBinaryByteLength(b3dm);
  return b3dm.subarray(start, end);
}

export function getFeatureTable(b3dm: Buffer): FeatureTable {
  return {
    jsonFeatureTable: getJSONFeatureTable(b3dm),
    binaryFeatureTable: getBinaryFeatureTable(b3dm),
  };
}

export function getJSONBatchTable(b3dm: Buffer): any {
  const start =
    getBodyStart() +
    getFeatureTableJSONByteLength(b3dm) +
    getFeatureTableBinaryByteLength(b3dm);
  const end = start + getBatchTableJSONByteLength(b3dm);
  const json = JSON.parse(b3dm.slice(start, end).toString());
  return json;
}

export function getBinaryBatchTable(b3dm: Buffer): Buffer {
  const start =
    getBodyStart() +
    getFeatureTableJSONByteLength(b3dm) +
    getFeatureTableBinaryByteLength(b3dm) +
    getBatchTableJSONByteLength(b3dm);
  const end = start + getBatchTableBinaryByteLength(b3dm);
  const binaryBuffer = b3dm.slice(start, end);
  return binaryBuffer;
}

export function getBatchTable(b3dm: Buffer): BatchTable {
  return {
    jsonBatchTable: getJSONBatchTable(b3dm),
    binaryBatchTable: getBinaryBatchTable(b3dm),
  };
}

export function getBatchTableProperties(
  batchTable: BatchTable,
  batchLength: number
): Record<string, any[]> {
  const properties: Record<string, any[]> = {};
  Object.entries(batchTable.jsonBatchTable).forEach(([name, entry]) => {
    if (Array.isArray(entry)) {
      // entry is an array of values one for each batchId
      properties[name] = entry;
    } else {
      // entry points to a buffer which we need to parse as an array
      const propertyReference = binaryProperty.parse(entry);
      const property = binaryProperty.read(
        propertyReference,
        batchTable.binaryBatchTable,
        batchLength
      );
      properties[name] = property;
    }
  });
  return properties;
}

export function getFeatureTableGlobalProperty(
  featureTable: FeatureTable,
  name: string,
  componentSize: number,
  componentLength: number
): any {
  const jsonValue = featureTable.jsonFeatureTable[name];
  if (jsonValue === undefined) {
    return;
  }

  const valueOrBuffer =
    jsonValue.byteOffset === undefined
      ? jsonValue
      : featureTable.binaryFeatureTable.subarray(
          jsonValue.byteOffset,
          jsonValue.byteOffset + componentSize * componentLength
        );
  return valueOrBuffer;
}

export function readRtcCenter(
  featureTable: FeatureTable
): number[] | Float32Array | undefined {
  const rtcCenterRaw = getFeatureTableGlobalProperty(
    featureTable,
    "RTC_CENTER",
    Float32Array.BYTES_PER_ELEMENT,
    3
  );
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

function getBodyStart() {
  return 28;
}

function getFeatureTableJSONByteLength(b3dm: Buffer): number {
  return b3dm.readUInt32LE(12);
}

function getFeatureTableBinaryByteLength(b3dm: Buffer): number {
  return b3dm.readUInt32LE(16);
}

function getBatchTableJSONByteLength(b3dm: Buffer): number {
  return b3dm.readUInt32LE(20);
}

function getBatchTableBinaryByteLength(b3dm: Buffer): number {
  return b3dm.readUInt32LE(24);
}
