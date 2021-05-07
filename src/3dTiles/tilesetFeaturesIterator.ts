import { Cartesian3, Cartographic, Matrix4, Rectangle } from "cesium";
import * as fse from "fs-extra";
import * as path from "path";
import * as b3dms from "./b3dms";
import {
  parseBinaryProperty,
  readPropertyValuesFromBinaryBatchTable,
} from "./BinaryProperty";
import * as gltfs from "./gltfs";
import { Gltf } from "./gltfs";
import * as tiles from "./tiles";

/**
 * The value returned by tilesetFeaturesIterator
 */
export type Value = {
  b3dmPath: string; // Path of the b3dm file relative to tileset root directory
  tile: any; // Tile object
  featurePosition: Cartographic; // The lat,lon,radius of the tile containing the feature
  properties: Record<string, string | number>; // Properties of the feature
};

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

function* tileFeaturesIterator(
  tile: any,
  tilesetDir: string,
  modelMatrixForNode: (rtcTransform: Matrix4, nodeMatrix: Matrix4) => Matrix4
) {
  const uri = tile.content?.uri || tile.content?.url;
  if (typeof uri !== "string") {
    return;
  }
  const b3dmPath = path.join(tilesetDir, uri);
  const b3dmBuffer = fse.readFileSync(b3dmPath);
  const featureTable = b3dms.getFeatureTable(b3dmBuffer);

  const batchLength = featureTable.json.BATCH_LENGTH;
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

  let featurePositions: Cartographic[] = [];
  const gltf = gltfs.parseGlb(b3dms.getGlb(b3dmBuffer));

  if (gltf !== undefined) {
    // TODO: test with a RTC_CENTER tileset
    const b3dmRtcCenter = b3dms.readRtcCenter(featureTable);
    const rtcCenter = b3dmRtcCenter ?? gltf.json.extensions?.CESIUM_RTC?.center;
    const rtcTransform = rtcCenter
      ? Matrix4.fromTranslation(Cartesian3.fromArray(rtcCenter))
      : Matrix4.IDENTITY.clone();
    const _modelMatrixForNode = (nodeMatrix: Matrix4) =>
      modelMatrixForNode(rtcTransform, nodeMatrix);
    featurePositions = computeFeaturePositions(gltf, _modelMatrixForNode) ?? [];
  }

  for (let batchId = 0; batchId < batchLength; batchId++) {
    const properties = Object.entries(batchTable).reduce(
      (acc: any, [key, vals]) => {
        acc[key] = Array.isArray(vals) ? vals[batchId] : null;
        return acc;
      },
      {}
    );
    const featurePosition = featurePositions[batchId];
    yield {
      b3dmPath,
      properties,
      tile,
      featurePosition,
    };
  }
}

/**
 * Returns an iterator for iterating the properties of a 3d tile and its subtree.
 *
 * @param tile              The tile object
 * @param tilesetDir        The tileset root directory
 * @param parentTransform   The transformation matrix of the parent tile
 * @returns                 An iterator which returns the {@link Value} object for each property in the tile.
 */
function* tileAndSubtreeFeaturesIterator(
  tile: any,
  tilesetDir: string,
  parentTransform: Matrix4,
  toZUpTransform: Matrix4
): Generator<Value> {
  const tileTransform =
    tile.transform !== undefined
      ? Matrix4.unpack(tile.transform)
      : Matrix4.clone(Matrix4.IDENTITY);

  const transform = Matrix4.multiplyTransformation(
    parentTransform,
    tileTransform,
    new Matrix4()
  );

  const modelMatrixForNode = (rtcTransform: Matrix4, nodeMatrix: Matrix4) => {
    // modelMatrix = transform * rtcTransform * toZUpTransform * nodeMatrix
    const modelMatrix = Matrix4.IDENTITY.clone();
    Matrix4.multiplyTransformation(modelMatrix, transform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, rtcTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, toZUpTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, nodeMatrix, modelMatrix);
    return modelMatrix;
  };

  for (const row of tileFeaturesIterator(
    tile,
    tilesetDir,
    modelMatrixForNode
  )) {
    yield row;
  }

  if (Array.isArray(tile.children)) {
    for (const child of tile.children) {
      for (const row of tileAndSubtreeFeaturesIterator(
        child,
        tilesetDir,
        transform,
        toZUpTransform
      )) {
        yield row;
      }
    }
  }
}

/**
 * Returns an iterator for iterating the feature properties of a 3d tileset.
 *
 * @param tileset    The tileset JSON object
 * @param tilesetDir The tileset root directory
 */
export default function* tilesetFeaturesIterator(
  tileset: any,
  tilesetDir: string
): Generator<Value> {
  if (!Array.isArray(tileset.root?.children)) {
    return;
  }

  const toZUpTransform = tiles.toZUpTransform(tileset);

  for (const entry of tileAndSubtreeFeaturesIterator(
    tileset.root,
    tilesetDir,
    Matrix4.IDENTITY.clone(),
    toZUpTransform
  )) {
    yield entry;
  }
}

function computeFeaturePositions(
  gltf: Gltf,
  modelMatrixForNode: (nodeMatrix: Matrix4) => Matrix4
) {
  const nodes = gltf?.json.nodes;
  const meshes = gltf?.json.meshes;
  const accessors = gltf?.json.accessors;
  const bufferViews = gltf?.json.bufferViews;

  if (
    !Array.isArray(nodes) ||
    !Array.isArray(meshes) ||
    !Array.isArray(accessors) ||
    !Array.isArray(bufferViews)
  ) {
    return;
  }

  const batchIdCoordinates: Cartographic[][] = [];

  nodes.forEach((node) => {
    const mesh = meshes[node.mesh];
    const primitives = mesh.primitives;
    const nodeMatrix = Array.isArray(node.matrix)
      ? Matrix4.fromColumnMajorArray(node.matrix)
      : Matrix4.IDENTITY.clone();
    const modelMatrix = modelMatrixForNode(nodeMatrix);

    primitives.forEach((primitive: any) => {
      const attributes = primitive.attributes;
      const _BATCHID = attributes._BATCHID;
      const POSITION = attributes.POSITION;
      if (_BATCHID === undefined || POSITION === undefined) {
        return;
      }

      const count = accessors[_BATCHID].count;
      for (let i = 0; i < count; i++) {
        const [batchId] = gltfs.readValueAt(gltf, _BATCHID, i);
        const [x, y, z] = gltfs.readValueAt(gltf, POSITION, i);
        const localPosition = new Cartesian3(x, y, z);
        const worldPosition = Matrix4.multiplyByPoint(
          modelMatrix,
          localPosition,
          new Cartesian3()
        );
        const cartographic = Cartographic.fromCartesian(worldPosition);
        batchIdCoordinates[batchId] = batchIdCoordinates[batchId] ?? [];
        batchIdCoordinates[batchId].push(cartographic);
      }
    });
  });

  const featurePositions = batchIdCoordinates.map((cooridnates) => {
    const heights = cooridnates.map((carto) => carto.height);
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);
    const featureHeightAboveGround = maxHeight - Math.max(0, minHeight);
    const rectangle = Rectangle.fromCartographicArray(cooridnates);
    const coordinate = Rectangle.center(rectangle);
    coordinate.height = featureHeightAboveGround;
    return coordinate;
  });

  return featurePositions;
}
