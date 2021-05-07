import {
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Matrix4,
  Rectangle,
} from "cesium";
import * as fse from "fs-extra";
import * as path from "path";
import {
  FeaturePosition,
  IndexesConfig,
  parseIndexesConfig,
  PositionProperties,
} from "../Config";
import { Index, IndexRoot } from "../Index";
import { createIndexBuilder, IndexBuilder } from "../IndexBuilder";
import writeCsv from "../writeCsv";
import * as b3dms from "./b3dms";
import { FeatureTable } from "./b3dms";
import * as gltfs from "./gltfs";
import { Gltf } from "./gltfs";
import * as tiles from "./tiles";

const USAGE =
  "USAGE: index.ts <tileset.json file> <config.json file> <index output directory>";

/**
 * Generate an index for the given tileset.
 *
 * This is rougly what happens in this method:
 *   1) Iterate all the features in the tileset - from both intermediary and leaf tiles
 *   2) Uniquify the features based on their id property
 *   3) Build indexes for all the properties specified in the config
 *   4) Write out the indexes and the resultsData file
 *
 * Because we uniquify the features, if there are 2 LOD tiles for the same feature
 * has different properties we only index the properties of the highest LOD tile.
 */
function index3dTileset(
  tileset: any,
  tilesetDir: string,
  indexesConfig: IndexesConfig,
  outDir: string
) {
  const indexBuilders = Object.entries(
    indexesConfig.indexes
  ).map(([property, config]) => createIndexBuilder(property, config));

  const features = readTilesetFeatures(tileset, tilesetDir, indexesConfig);
  const featuresCount = Object.entries(features).length;
  console.log(`\nUnique features found: ${featuresCount}`);

  console.log("Building indexes...");
  const resultsData: any[] = [];
  Object.entries(features).forEach(([idValue, { position, properties }]) => {
    const len = resultsData.push({
      [indexesConfig.idProperty]: idValue,
      ...position,
    });
    const dataRowId = len - 1;
    indexBuilders.forEach((b) =>
      b.addIndexValue(dataRowId, properties[b.property])
    );
  });

  console.log("Writing indexes...");
  const indexes = writeIndexes(indexBuilders, outDir);
  const resultsDataUrl = writeResultsData(resultsData, outDir);
  const indexRoot: IndexRoot = {
    resultsDataUrl,
    idProperty: indexesConfig.idProperty,
    indexes,
  };
  writeIndexRoot(indexRoot, outDir);
  console.log(`Indexes written to ${outDir}/`);
  console.log("Done.");
}

/**
 * Read properties and position data for all features in the tileset
 * @param tileset The tileset JSON
 * @param tilesetDir The directory path of the tileset
 * @param indexesConfig The indexes config object
 * @returns An object containing {properties,position} for each feature in the tilset. The object is keyed by the idProperty for the feature.
 */
function readTilesetFeatures(
  tileset: any,
  tilesetDir: string,
  indexesConfig: IndexesConfig
): Record<string, { properties: any; position: FeaturePosition }> {
  const uniqueFeatures: Record<
    string,
    { position: FeaturePosition; properties: any }
  > = {};
  let featuresRead = 0;

  // For each feature in each tile in tileset
  // 1. read properties for the feature from the batch table
  // 2. compute position of the feature from the vertex data
  // Then generate a unique list of feature id -> {position, properties} value
  tiles.forEachTile(tileset, ({ tile, computedTransform: tileTransform }) => {
    const tileUri = tiles.uri(tile);
    if (tileUri === undefined) {
      return;
    }

    const b3dmPath = path.join(tilesetDir, tileUri);
    const b3dm = fse.readFileSync(b3dmPath);
    const featureTable = b3dms.getFeatureTable(b3dm);
    const batchLength = featureTable.jsonFeatureTable.BATCH_LENGTH;

    if (typeof batchLength !== "number") {
      console.error(`Missing or invalid batchLength for tile ${tileUri}`);
      return;
    }

    const batchTable = b3dms.getBatchTable(b3dm);
    const batchTableProperties = b3dms.getBatchTableProperties(
      batchTable,
      batchLength
    );

    const gltf = gltfs.parseGlb(b3dms.getGlb(b3dm));
    let computedFeaturePositions: Cartographic[] = [];
    if (gltf !== undefined) {
      // TODO: test with a RTC_CENTER tileset
      const rtcTransform = getRtcTransform(featureTable, gltf);
      const toZUpTransform = tiles.toZUpTransform(tileset);
      computedFeaturePositions =
        computeFeaturePositionsFromGltfVertices(
          gltf,
          tileTransform,
          rtcTransform,
          toZUpTransform
        ) ?? [];
    }

    for (let batchId = 0; batchId < batchLength; batchId++) {
      const batchProperties: Record<string, any> = {};
      Object.entries(batchTableProperties).forEach(([name, values]) => {
        batchProperties[name] = Array.isArray(values) ? values[batchId] : null;
      });
      const position = getFeaturePosition(
        indexesConfig.positionProperties,
        batchProperties,
        computedFeaturePositions[batchId]
      );
      // limit the number of decimal places to reduce the output file size
      position.latitude = roundToNDecimalPlaces(position.latitude, 5);
      position.longitude = roundToNDecimalPlaces(position.longitude, 5);
      position.height = roundToNDecimalPlaces(position.height, 3);

      const idValue = batchProperties[indexesConfig.idProperty];
      uniqueFeatures[idValue] = {
        position,
        properties: batchProperties,
      };

      featuresRead += 1;
      logOnSameLine(`Features read: ${featuresRead}`);
    }
  });

  return uniqueFeatures;
}

/**
 * Compute position for each feature from the vertex data
 *
 */
function computeFeaturePositionsFromGltfVertices(
  gltf: Gltf,
  tileTransform: Matrix4,
  rtcTransform: Matrix4,
  toZUpTransform: Matrix4
): Cartographic[] | undefined {
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

  const batchIdPositions: Cartographic[][] = [];

  nodes.forEach((node) => {
    const mesh = meshes[node.mesh];
    const primitives = mesh.primitives;
    const nodeMatrix = Array.isArray(node.matrix)
      ? Matrix4.fromColumnMajorArray(node.matrix)
      : Matrix4.IDENTITY.clone();

    const modelMatrix = Matrix4.IDENTITY.clone();
    Matrix4.multiplyTransformation(modelMatrix, tileTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, rtcTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, toZUpTransform, modelMatrix);
    Matrix4.multiplyTransformation(modelMatrix, nodeMatrix, modelMatrix);

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
        batchIdPositions[batchId] = batchIdPositions[batchId] ?? [];
        batchIdPositions[batchId].push(cartographic);
      }
    });
  });

  const featurePositions = batchIdPositions.map((positions) => {
    // From all the positions for the feature
    // 1. compute a center point
    // 2. compute the feature height
    const heights = positions.map((carto) => carto.height);
    const maxHeight = Math.max(...heights);
    const minHeight = Math.min(...heights);
    const featureHeightAboveGround = maxHeight - Math.max(0, minHeight);
    const rectangle = Rectangle.fromCartographicArray(positions);
    const position = Rectangle.center(rectangle);
    position.height = featureHeightAboveGround;
    return position;
  });

  return featurePositions;
}

/**
 * Returns an RTC_CENTER or CESIUM_RTC transformation matrix which ever exists.
 *
 */
function getRtcTransform(featureTable: FeatureTable, gltf: Gltf): Matrix4 {
  const b3dmRtcCenter = b3dms.readRtcCenter(featureTable);
  const rtcCenter = b3dmRtcCenter ?? gltf.json.extensions?.CESIUM_RTC?.center;
  const rtcTransform = rtcCenter
    ? Matrix4.fromTranslation(Cartesian3.fromArray(rtcCenter))
    : Matrix4.IDENTITY.clone();
  return rtcTransform;
}

function getFeaturePosition(
  positionProperties: PositionProperties | undefined,
  properties: Record<string, any>,
  defaults: Cartographic
): FeaturePosition {
  const position = {
    latitude: CesiumMath.toDegrees(defaults.latitude),
    longitude: CesiumMath.toDegrees(defaults.longitude),
    height: defaults.height,
  };
  if (positionProperties?.latitude && properties[positionProperties.latitude])
    position.latitude = properties[positionProperties.latitude];
  if (positionProperties?.longitude && properties[positionProperties.longitude])
    position.longitude = properties[positionProperties.longitude];
  if (positionProperties?.height && properties[positionProperties.height])
    position.height = properties[positionProperties.height];
  return position;
}

function roundToNDecimalPlaces(value: number, n: number): number {
  const multiplier = 10 ** n;
  const roundedValue = Math.round(value * multiplier) / multiplier;
  return roundedValue;
}

/**
 * Write indexes using the index builders and returns a `IndexRoot.indexes` map
 */
function writeIndexes(
  indexBuilders: IndexBuilder[],
  outDir: string
): Record<string, Index> {
  return indexBuilders.reduce((indexes, b, fileId) => {
    indexes[b.property] = b.writeIndex(fileId, outDir);
    return indexes;
  }, {} as Record<string, Index>);
}

/**
 * Writes the data.csv file under `outDir` and returns its path.
 */
function writeResultsData(data: Record<string, any>[], outDir: string): string {
  const fileName = "resultsData.csv";
  const filePath = path.join(outDir, fileName);
  writeCsv(filePath, data);
  return fileName;
}

/**
 *  Writes the index root file under `outDir`.
 */
function writeIndexRoot(indexRoot: IndexRoot, outDir: string) {
  fse
    .createWriteStream(path.join(outDir, "indexRoot.json"))
    .write(JSON.stringify(indexRoot));
}

/**
 * Main
 */
function main() {
  const [tilesetFile, indexConfigFile, outDir] = process.argv.slice(2);
  let tileset: any;
  let indexesConfig: IndexesConfig;

  try {
    tileset = JSON.parse(fse.readFileSync(tilesetFile).toString());
  } catch (e) {
    console.error(`Failed to read tileset file "${tilesetFile}"`);
    console.error(e);
    printUsageAndExit();
  }

  try {
    indexesConfig = parseIndexesConfig(
      JSON.parse(fse.readFileSync(indexConfigFile).toString())
    );
  } catch (e) {
    console.error(`Failed to read index config file "${indexConfigFile}"`);
    console.error(e);
    printUsageAndExit();
    return;
  }

  if (typeof outDir !== "string") {
    console.error(`Output directory not specified.`);
    printUsageAndExit();
  }

  fse.mkdirpSync(outDir);
  const tilesetDir = path.dirname(tilesetFile);
  index3dTileset(tileset, tilesetDir, indexesConfig, outDir);
}

function printUsageAndExit() {
  console.error(`\n${USAGE}\n`);
  process.exit(1);
}

function logOnSameLine(message: string) {
  // clear line and move to first col
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(message);
}

main();
