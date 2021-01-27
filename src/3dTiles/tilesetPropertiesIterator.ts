import { Matrix4, ComponentDatatype } from "cesium";
import * as fse from "fs-extra";
import * as path from "path";
import { assertNumber, assertObject, assertString } from "../Json";
import {
  parseBinaryProperty,
  readPropertyValuesFromBinaryBatchTable,
} from "./BinaryProperty";
import getTilePosition, { TilePosition } from "./getTilePosition";

/**
 * The value returned by tilesetPropertiesIterator
 */
export type Value = {
  b3dmPath: string; // Path of the b3dm file relative to tileset root directory
  tile: any; // Tile object
  tilePosition: TilePosition; // The lat,lon,radius of the tile
  properties: Record<string, string | number>; // Properties
};

/**
 * Returns an iterator for iterating the properties of a 3d tile.
 *
 * @param tile              The tile object
 * @param tilesetDir        The tileset root directory
 * @param parentTransform   The transformation matrix of the parent tile
 * @returns                 An iterator which returns the {@link Value} object for each property in the tile.
 */
function* tilePropertiesIterator(
  tile: any,
  tilesetDir: string,
  parentTransform: Matrix4
): Generator<Value> {
  const uri = tile.content?.uri || tile.content?.url;
  if (typeof uri !== "string") {
    console.error(`Missing or invalid uri`);
    return;
  }

  const b3dmPath = path.join(tilesetDir, uri);
  const b3dmBuffer = fse.readFileSync(b3dmPath);
  const featureTable = JSON.parse(readFeatureTable(b3dmBuffer).toString());

  const batchLength = featureTable.BATCH_LENGTH;
  if (typeof batchLength !== "number") {
    console.error("Missing or invalid batchLength: ${batchLength}");
    return;
  }

  const { json, binary } = readBatchTable(b3dmBuffer);

  const jsonBatchTable = JSON.parse(json.toString());
  const binaryBatchTable = binary;

  const batchTable = Object.entries(jsonBatchTable).reduce(
    (acc: Record<string, any[]>, [key, entry]) => {
      let values;
      if (Array.isArray(entry)) {
        values = entry;
      } else {
        const binaryProperty = parseBinaryProperty(entry);
        values = readPropertyValuesFromBinaryBatchTable(
          binaryProperty,
          binaryBatchTable,
          batchLength
        );
      }
      acc[key] = values;
      return acc;
    },
    {}
  );

  const tileTransform =
    tile.transform !== undefined
      ? Matrix4.unpack(tile.transform)
      : Matrix4.clone(Matrix4.IDENTITY);

  const transform = Matrix4.multiply(
    parentTransform,
    tileTransform,
    new Matrix4()
  );

  const isLeafNode =
    !tile.children ||
    (Array.isArray(tile.children) && tile.children.length === 0);

  if (isLeafNode) {
    console.log(`dumping properties for leaf node ${b3dmPath}`);
    const tilePosition = getTilePosition(tile, transform);
    for (let batchId = 0; batchId < batchLength; batchId++) {
      const properties = Object.entries(batchTable).reduce(
        (acc: any, [key, vals]) => {
          acc[key] = Array.isArray(vals) ? vals[batchId] : null;
          return acc;
        },
        {}
      );
      yield {
        b3dmPath,
        properties,
        tile,
        tilePosition,
      };
    }
  }

  if (Array.isArray(tile.children)) {
    for (const child of tile.children) {
      for (const row of tilePropertiesIterator(child, tilesetDir, transform)) {
        yield row;
      }
    }
  }
}

function readFeatureTable(b3dmBuffer: Buffer): Buffer {
  const featureTableJSONByteLength = readFeatureTableJSONByteLength(b3dmBuffer);
  return b3dmBuffer.subarray(28, 28 + featureTableJSONByteLength);
}

function readBatchTable(
  b3dmBuffer: Buffer
): { json: Buffer; binary: Uint8Array } {
  const featureTableJSONByteLength = readFeatureTableJSONByteLength(b3dmBuffer);
  const featureTableBinaryByteLength = readFeatureTableBinaryByteLength(
    b3dmBuffer
  );
  const batchTableJSONByteLength = readBatchTableJSONByteLength(b3dmBuffer);
  const batchTableBinaryByteLength = readBatchTableBinaryByteLength(b3dmBuffer);

  const jsonStart =
    28 + featureTableJSONByteLength + featureTableBinaryByteLength;
  const jsonEnd =
    28 +
    featureTableJSONByteLength +
    featureTableBinaryByteLength +
    batchTableJSONByteLength;
  const binaryEnd = jsonEnd + batchTableBinaryByteLength;

  const json = b3dmBuffer.subarray(jsonStart, jsonEnd);
  const binary = new Uint8Array(b3dmBuffer.subarray(jsonEnd, binaryEnd));
  return { json, binary };
}

function readBinaryBatchTable(b3dmBuffer: Buffer): Buffer {
  return b3dmBuffer.subarray();
}

function readFeatureTableJSONByteLength(b3dmBuffer: Buffer): number {
  return b3dmBuffer.readUInt32LE(12);
}

function readFeatureTableBinaryByteLength(b3dmBuffer: Buffer): number {
  return b3dmBuffer.readUInt32LE(16);
}

function readBatchTableJSONByteLength(b3dmBuffer: Buffer): number {
  return b3dmBuffer.readUInt32LE(20);
}

function readBatchTableBinaryByteLength(b3dmBuffer: Buffer): number {
  return b3dmBuffer.readUInt32LE(24);
}

/**
 * Returns an iterator for iterating the feature properties of a 3d tileset.
 *
 * @param tileset    The tileset JSON object
 * @param tilesetDir The tileset root directory
 */
export default function* tilesetPropertiesIterator(
  tileset: any,
  tilesetDir: string
): Generator<Value> {
  if (!Array.isArray(tileset.root?.children)) {
    return;
  }

  const rootTransform = tileset.root.transform
    ? Matrix4.unpack(tileset.root.transform)
    : Matrix4.clone(Matrix4.IDENTITY);

  for (let tile of tileset.root.children) {
    for (const entry of tilePropertiesIterator(
      tile,
      tilesetDir,
      rootTransform
    )) {
      yield entry;
    }
  }
}
