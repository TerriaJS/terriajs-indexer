// See: https://github.com/CesiumGS/3d-tiles/blob/master/specification/TileFormats/Batched3DModel/README.md#feature-table

export type FeatureTable = {
  json: any;
  binary: Buffer;
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

export function getFeatureTableJSON(b3dm: Buffer): any {
  const start = getBodyStart();
  const end = start + getFeatureTableJSONByteLength(b3dm);
  const buf = b3dm.subarray(start, end);
  return JSON.parse(buf.toString());
}

export function getFeatureTableBinary(b3dm: Buffer): Buffer {
  const start = getBodyStart() + getFeatureTableJSONByteLength(b3dm);
  const end = start + getFeatureTableBinaryByteLength(b3dm);
  return b3dm.subarray(start, end);
}

export function getFeatureTable(b3dm: Buffer): FeatureTable {
  return {
    json: getFeatureTableJSON(b3dm),
    binary: getFeatureTableBinary(b3dm),
  };
}

export function getFeatureTableGlobalProperty(
  featureTable: FeatureTable,
  name: string,
  componentSize: number,
  componentLength: number
): any {
  const jsonValue = featureTable.json[name];
  if (jsonValue === undefined) {
    return;
  }

  const valueOrBuffer =
    jsonValue.byteOffset === undefined
      ? jsonValue
      : featureTable.binary.subarray(
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
