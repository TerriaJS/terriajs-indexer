"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const cesium_1 = require("cesium");
const fse = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const Config_1 = require("../Config");
const IndexBuilder_1 = require("../IndexBuilder");
const writeCsv_1 = tslib_1.__importDefault(require("../writeCsv"));
const b3dms = tslib_1.__importStar(require("./b3dms"));
const gltfs = tslib_1.__importStar(require("./gltfs"));
const tiles = tslib_1.__importStar(require("./tiles"));
const USAGE = "USAGE: npx index-3dtiles <tileset.json file> <config.json file> <index output directory>";
// The name used for the computed feature height. Use this name in the index configuration to
// index the computed height
const computedHeightPropertyName = "height";
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
function index3dTileset(tileset, tilesetDir, indexesConfig, outDir) {
    const indexBuilders = Object.entries(indexesConfig.indexes).map(([property, config]) => IndexBuilder_1.createIndexBuilder(property, config));
    const features = readTilesetFeatures(tileset, tilesetDir, indexesConfig);
    const featuresCount = Object.entries(features).length;
    console.log(`\nUnique features found: ${featuresCount}`);
    console.log("Building indexes...");
    const resultsData = [];
    Object.entries(features).forEach(([idValue, { position, properties }]) => {
        const positionProperties = {
            // rounding to fewer decimal places significantly reduces the size of resultData file
            latitude: roundToNDecimalPlaces(cesium_1.Math.toDegrees(position.latitude), 5),
            longitude: roundToNDecimalPlaces(cesium_1.Math.toDegrees(position.longitude), 5),
            height: roundToNDecimalPlaces(position.height, 3),
        };
        const len = resultsData.push(Object.assign({ [indexesConfig.idProperty]: idValue }, positionProperties));
        const dataRowId = len - 1;
        indexBuilders.forEach((b) => {
            if (b.property in properties) {
                b.addIndexValue(dataRowId, properties[b.property]);
            }
            else if (b.property === computedHeightPropertyName) {
                b.addIndexValue(dataRowId, positionProperties.height);
            }
        });
    });
    console.log("Writing indexes...");
    const indexes = writeIndexes(indexBuilders, outDir);
    const resultsDataUrl = writeResultsData(resultsData, outDir);
    const indexRoot = {
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
function readTilesetFeatures(tileset, tilesetDir, indexesConfig) {
    const uniqueFeatures = {};
    let featuresRead = 0;
    // For each feature in each tile in tileset
    // 1. read properties for the feature from the batch table
    // 2. compute position of the feature from the vertex data
    // Then generate a unique list of feature id -> {position, properties} value
    tiles.forEachTile(tileset, ({ tile, computedTransform: tileTransform }) => {
        var _a;
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
        const batchTableProperties = b3dms.getBatchTableProperties(batchTable, batchLength);
        let computedFeaturePositions = [];
        const gltf = gltfs.parseGlb(b3dms.getGlb(b3dm));
        if (gltf !== undefined) {
            const rtcTransform = getRtcTransform(featureTable, gltf);
            const toZUpTransform = tiles.toZUpTransform(tileset);
            computedFeaturePositions = (_a = computeFeaturePositionsFromGltfVertices(gltf, tileTransform, rtcTransform, toZUpTransform)) !== null && _a !== void 0 ? _a : [];
        }
        for (let batchId = 0; batchId < batchLength; batchId++) {
            const batchProperties = {};
            Object.entries(batchTableProperties).forEach(([name, values]) => {
                batchProperties[name] = Array.isArray(values) ? values[batchId] : null;
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
    return uniqueFeatures;
}
/**
 * Compute position for each feature from the vertex data
 *
 */
function computeFeaturePositionsFromGltfVertices(gltf, tileTransform, rtcTransform, toZUpTransform) {
    const nodes = gltf === null || gltf === void 0 ? void 0 : gltf.json.nodes;
    const meshes = gltf === null || gltf === void 0 ? void 0 : gltf.json.meshes;
    const accessors = gltf === null || gltf === void 0 ? void 0 : gltf.json.accessors;
    const bufferViews = gltf === null || gltf === void 0 ? void 0 : gltf.json.bufferViews;
    if (!Array.isArray(nodes) ||
        !Array.isArray(meshes) ||
        !Array.isArray(accessors) ||
        !Array.isArray(bufferViews)) {
        return;
    }
    const batchIdPositions = [];
    nodes.forEach((node) => {
        const mesh = meshes[node.mesh];
        const primitives = mesh.primitives;
        const nodeMatrix = Array.isArray(node.matrix)
            ? cesium_1.Matrix4.fromColumnMajorArray(node.matrix)
            : cesium_1.Matrix4.IDENTITY.clone();
        const modelMatrix = cesium_1.Matrix4.IDENTITY.clone();
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, tileTransform, modelMatrix);
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, rtcTransform, modelMatrix);
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, toZUpTransform, modelMatrix);
        cesium_1.Matrix4.multiplyTransformation(modelMatrix, nodeMatrix, modelMatrix);
        primitives.forEach((primitive) => {
            var _a;
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
                const localPosition = new cesium_1.Cartesian3(x, y, z);
                const worldPosition = cesium_1.Matrix4.multiplyByPoint(modelMatrix, localPosition, new cesium_1.Cartesian3());
                const cartographic = cesium_1.Cartographic.fromCartesian(worldPosition);
                batchIdPositions[batchId] = (_a = batchIdPositions[batchId]) !== null && _a !== void 0 ? _a : [];
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
        const rectangle = cesium_1.Rectangle.fromCartographicArray(positions);
        const position = cesium_1.Rectangle.center(rectangle);
        position.height = featureHeightAboveGround;
        return position;
    });
    return featurePositions;
}
/**
 * Returns an RTC_CENTER or CESIUM_RTC transformation matrix which ever exists.
 *
 */
function getRtcTransform(featureTable, gltf) {
    var _a, _b;
    const b3dmRtcCenter = b3dms.readRtcCenter(featureTable);
    const rtcCenter = b3dmRtcCenter !== null && b3dmRtcCenter !== void 0 ? b3dmRtcCenter : (_b = (_a = gltf.json.extensions) === null || _a === void 0 ? void 0 : _a.CESIUM_RTC) === null || _b === void 0 ? void 0 : _b.center;
    const rtcTransform = rtcCenter
        ? cesium_1.Matrix4.fromTranslation(cesium_1.Cartesian3.fromArray(rtcCenter))
        : cesium_1.Matrix4.IDENTITY.clone();
    return rtcTransform;
}
function roundToNDecimalPlaces(value, n) {
    const multiplier = Math.pow(10, n);
    const roundedValue = Math.round(value * multiplier) / multiplier;
    return roundedValue;
}
/**
 * Write indexes using the index builders and returns a `IndexRoot.indexes` map
 */
function writeIndexes(indexBuilders, outDir) {
    return indexBuilders.reduce((indexes, b, fileId) => {
        indexes[b.property] = b.writeIndex(fileId, outDir);
        return indexes;
    }, {});
}
/**
 * Writes the data.csv file under `outDir` and returns its path.
 */
function writeResultsData(data, outDir) {
    const fileName = "resultsData.csv";
    const filePath = path.join(outDir, fileName);
    writeCsv_1.default(filePath, data);
    return fileName;
}
/**
 *  Writes the index root file under `outDir`.
 */
function writeIndexRoot(indexRoot, outDir) {
    fse
        .createWriteStream(path.join(outDir, "indexRoot.json"))
        .write(JSON.stringify(indexRoot));
}
/**
 * Runs the indexer with the given arguments
 * @params argv An argument array
 */
function runIndexer(argv) {
    const [tilesetFile, indexConfigFile, outDir] = argv.slice(2);
    let tileset;
    let indexesConfig;
    try {
        tileset = JSON.parse(fse.readFileSync(tilesetFile).toString());
    }
    catch (e) {
        console.error(`Failed to read tileset file "${tilesetFile}"`);
        console.error(e);
        printUsageAndExit();
    }
    try {
        indexesConfig = Config_1.parseIndexesConfig(JSON.parse(fse.readFileSync(indexConfigFile).toString()));
    }
    catch (e) {
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
exports.default = runIndexer;
function printUsageAndExit() {
    console.error(`\n${USAGE}\n`);
    process.exit(1);
}
function logOnSameLine(message) {
    // clear line and move to first col
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
}
// TODO: do not run, instead just export this function
runIndexer(process.argv);
//# sourceMappingURL=indexer.js.map