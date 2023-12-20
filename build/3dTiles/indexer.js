"use strict";
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
const cesium_1 = require("cesium");
const fse = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const Config_1 = require("../Config");
const IndexBuilder_1 = require("../IndexBuilder");
const constants_1 = require("../constants");
const gltfs = __importStar(require("../gltfs"));
const gltfs_1 = require("../gltfs");
const utils_1 = require("../utils");
const b3dms = __importStar(require("./b3dms"));
const tiles = __importStar(require("./tiles"));
const USAGE = "USAGE: npx index-3dtiles <tileset.json file> <config.json file> <index output directory>";
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
async function index3dTileset(tileset, tilesetDir, indexesConfig, outDir) {
    const indexBuilders = Object.entries(indexesConfig.indexes).map(([property, config]) => (0, IndexBuilder_1.createIndexBuilder)(property, config));
    const features = await readTilesetFeatures(tileset, tilesetDir, indexesConfig);
    const featuresCount = Object.entries(features).length;
    console.log(`\nUnique features found: ${featuresCount}`);
    console.log("Building indexes...");
    const resultsData = [];
    Object.entries(features).forEach(([idValue, { position, properties }]) => {
        const positionProperties = {
            // rounding to fewer decimal places significantly reduces the size of resultData file
            latitude: (0, utils_1.roundToNDecimalPlaces)(cesium_1.Math.toDegrees(position.latitude), 5),
            longitude: (0, utils_1.roundToNDecimalPlaces)(cesium_1.Math.toDegrees(position.longitude), 5),
            height: (0, utils_1.roundToNDecimalPlaces)(position.height, 3),
        };
        const len = resultsData.push({
            [indexesConfig.idProperty]: idValue,
            ...positionProperties,
        });
        const dataRowId = len - 1;
        indexBuilders.forEach((b) => {
            if (b.property in properties) {
                b.addIndexValue(dataRowId, properties[b.property]);
            }
            else if (b.property === constants_1.COMPUTED_HEIGHT_PROPERTY_NAME) {
                b.addIndexValue(dataRowId, positionProperties.height);
            }
        });
    });
    console.log("Writing indexes...");
    const indexes = (0, IndexBuilder_1.writeIndexes)(indexBuilders, outDir);
    const resultsDataUrl = (0, IndexBuilder_1.writeResultsData)(resultsData, outDir);
    const indexRoot = {
        resultsDataUrl,
        idProperty: indexesConfig.idProperty,
        indexes,
    };
    (0, IndexBuilder_1.writeIndexRoot)(indexRoot, outDir);
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
async function readTilesetFeatures(tileset, tilesetDir, indexesConfig) {
    const uniqueFeatures = {};
    let featuresRead = 0;
    // The tileset can contain child tilesets. We add any child tilesets that we come
    // across to this queue so that they will be processed sequentially.
    const tilesetQueue = [tileset];
    for await (tileset of tilesetQueue) {
        // For each feature in each tile in the tileset
        // 1. read properties for the feature from the batch table
        // 2. compute position of the feature from the vertex data
        // Then generate a unique list of feature id -> {position, properties} value
        const promise = tiles.forEachTile(tileset, async ({ tile, computedTransform: tileTransform }) => {
            const tileUri = tiles.uri(tile);
            if (tileUri === undefined) {
                return;
            }
            const contentPath = path.join(tilesetDir, tileUri);
            if (contentPath.endsWith(".json")) {
                // the content is another tileset json
                // enqueue it so that it is processed at the end
                const childTileset = JSON.parse(fse.readFileSync(contentPath).toString());
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
            const batchTableProperties = b3dms.getBatchTableProperties(batchTable, batchLength);
            let computedFeaturePositions = [];
            const gltf = await gltfs.parseGlb(b3dms.getGlb(b3dm));
            if (gltf !== undefined) {
                const toZUpTransform = tiles.toZUpTransform(tileset);
                computedFeaturePositions =
                    (0, gltfs_1.computeFeaturePositionsFromGltfVertices)(gltf, tileTransform, toZUpTransform) ?? [];
            }
            for (let batchId = 0; batchId < batchLength; batchId++) {
                const batchProperties = {};
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
                (0, utils_1.logOnSameLine)(`Features read: ${featuresRead}`);
            }
        });
        await promise;
    }
    return uniqueFeatures;
}
/**
 * Runs the indexer with the given arguments
 * @params argv An argument array
 */
async function runIndexer(argv) {
    const [tilesetFile, indexConfigFile, outDir] = argv.slice(2);
    let tileset;
    let indexesConfig;
    try {
        tileset = JSON.parse(fse.readFileSync(tilesetFile).toString());
    }
    catch (e) {
        console.error(`Failed to read tileset file "${tilesetFile}"`);
        console.error(e);
        (0, utils_1.printUsageAndExit)(USAGE);
    }
    try {
        indexesConfig = (0, Config_1.parseIndexesConfig)(JSON.parse(fse.readFileSync(indexConfigFile).toString()));
    }
    catch (e) {
        console.error(`Failed to read index config file "${indexConfigFile}"`);
        console.error(e);
        (0, utils_1.printUsageAndExit)(USAGE);
        return;
    }
    if (typeof outDir !== "string") {
        console.error(`Output directory not specified.`);
        (0, utils_1.printUsageAndExit)(USAGE);
    }
    fse.mkdirpSync(outDir);
    const tilesetDir = path.dirname(tilesetFile);
    await index3dTileset(tileset, tilesetDir, indexesConfig, outDir);
}
exports.default = runIndexer;
// TODO: do not run, instead just export this function
runIndexer(process.argv);
