import { Cartesian3, Cartographic, Math as CesiumMath, Matrix4 } from "cesium";
import * as fse from "fs-extra";
import * as path from "path";
import { IndexesConfig, parseIndexesConfig } from "../Config";
import { COMPUTED_HEIGHT_PROPERTY_NAME } from "../constants";
import * as gltfs from "../gltfs";
import { computeFeaturePositionsFromGltfVertices, Gltf } from "../gltfs";
import { IndexRoot } from "../Index";
import {
  createIndexBuilder,
  writeIndexes,
  writeIndexRoot,
  writeResultsData,
} from "../IndexBuilder";
import {
  logOnSameLine,
  printUsageAndExit,
  roundToNDecimalPlaces,
} from "../utils";
import * as b3dms from "./b3dms";
import { FeatureTable } from "./b3dms";
import * as tiles from "./tiles";

const USAGE =
  "USAGE: npx index-3dtiles <tileset.json file> <config.json file> <index output directory>";

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
    const positionProperties = {
      // rounding to fewer decimal places significantly reduces the size of resultData file
      latitude: roundToNDecimalPlaces(
        CesiumMath.toDegrees(position.latitude),
        5
      ),
      longitude: roundToNDecimalPlaces(
        CesiumMath.toDegrees(position.longitude),
        5
      ),
      height: roundToNDecimalPlaces(position.height, 3),
    };
    const len = resultsData.push({
      [indexesConfig.idProperty]: idValue,
      ...positionProperties,
    });
    const dataRowId = len - 1;
    indexBuilders.forEach((b) => {
      if (b.property in properties) {
        b.addIndexValue(dataRowId, properties[b.property]);
      } else if (b.property === COMPUTED_HEIGHT_PROPERTY_NAME) {
        b.addIndexValue(dataRowId, positionProperties.height);
      }
    });
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
): Record<string, { properties: any; position: Cartographic }> {
  const uniqueFeatures: Record<
    string,
    { position: Cartographic; properties: any }
  > = {};
  let featuresRead = 0;

  // The tileset can contain child tilesets. We add any child tilesets that we come
  // across to this queue so that they will be processed sequentially.
  const tilesetQueue = [tileset];
  for (tileset of tilesetQueue) {
    // For each feature in each tile in the tileset
    // 1. read properties for the feature from the batch table
    // 2. compute position of the feature from the vertex data
    // Then generate a unique list of feature id -> {position, properties} value
    tiles.forEachTile(tileset, ({ tile, computedTransform: tileTransform }) => {
      const tileUri = tiles.uri(tile);
      if (tileUri === undefined) {
        return;
      }

      const contentPath = path.join(tilesetDir, tileUri);
      if (contentPath.endsWith(".json")) {
        // the content is another tileset json
        // enqueue it so that it is processed at the end
        const childTileset = JSON.parse(
          fse.readFileSync(contentPath).toString()
        );
        tilesetQueue.push(childTileset);
        return;
      }
      // content is most likely b3dm (TODO: handle other types gracefully)
      const b3dm = fse.readFileSync(contentPath);
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

      let computedFeaturePositions: Cartographic[] = [];
      const gltf = gltfs.parseGlb(b3dms.getGlb(b3dm));
      if (gltf !== undefined) {
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
          batchProperties[name] = Array.isArray(values)
            ? values[batchId]
            : null;
        });
        const position = computedFeaturePositions[batchId];
        const idValue = batchProperties[indexesConfig.idProperty];
        uniqueFeatures[idValue] = {
          position,
          properties: batchProperties,
        };

        featuresRead += 1;
        logOnSameLine(`Features read: ${featuresRead}`);
      }
    });
  }

  return uniqueFeatures;
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

/**
 * Runs the indexer with the given arguments
 * @params argv An argument array
 */
export default function runIndexer(argv: string[]) {
  const [tilesetFile, indexConfigFile, outDir] = argv.slice(2);
  let tileset: any;
  let indexesConfig: IndexesConfig;

  try {
    tileset = JSON.parse(fse.readFileSync(tilesetFile).toString());
  } catch (e) {
    console.error(`Failed to read tileset file "${tilesetFile}"`);
    console.error(e);
    printUsageAndExit(USAGE);
  }

  try {
    indexesConfig = parseIndexesConfig(
      JSON.parse(fse.readFileSync(indexConfigFile).toString())
    );
  } catch (e) {
    console.error(`Failed to read index config file "${indexConfigFile}"`);
    console.error(e);
    printUsageAndExit(USAGE);
    return;
  }

  if (typeof outDir !== "string") {
    console.error(`Output directory not specified.`);
    printUsageAndExit(USAGE);
  }

  fse.mkdirpSync(outDir);
  const tilesetDir = path.dirname(tilesetFile);
  index3dTileset(tileset, tilesetDir, indexesConfig, outDir);
}

// TODO: do not run, instead just export this function
runIndexer(process.argv);
