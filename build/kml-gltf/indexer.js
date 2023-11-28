"use strict";
// See https://cesium.com/blog/2020/04/09/kml-collada-metadata/ for supported KML format
//
// Note: kml indexer hasn't been fully tested since the migration to gltf-transform, so expect errors when using it.
//       Just enough fixes have been made to make the typescript compiler happy.
//
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
const xml2json = __importStar(require("xml2json"));
const Config_1 = require("../Config");
const IndexBuilder_1 = require("../IndexBuilder");
const constants_1 = require("../constants");
const gltfs = __importStar(require("../gltfs"));
const gltfs_1 = require("../gltfs");
const utils_1 = require("../utils");
const USAGE = "USAGE: npx index-kml-gltf <kml-directory> <config.json file> <index output directory>";
const kmlFileRe = /.*?\.kml$/;
/**
 * Read properties from KML in a format.
 * The KML should be formatted as described here:
 * https://cesium.com/blog/2020/04/09/kml-collada-metadata/
 *
 */
function readFeatureProperties(kml) {
    const placeMark = kml?.Placemark;
    const name = placeMark?.name;
    const data = placeMark?.ExtendedData?.Data;
    if (typeof name !== "string" || Array.isArray(data) === false) {
        return;
    }
    const properties = { Name: name };
    data?.forEach((prop) => {
        if (typeof prop.name === "string" && typeof prop.value === "string") {
            properties[prop.name] = prop.value;
        }
    });
    return properties;
}
function readModel(kml) {
    const gltfLink = kml?.Placemark?.Model?.Link?.href;
    const location = kml?.Placemark?.Model?.Location;
    const longitude = parseFloat(location?.longitude ?? "");
    const latitude = parseFloat(location?.latitude ?? "");
    const altitude = parseFloat(location?.altitude ?? "");
    if (typeof gltfLink !== "string")
        return;
    if (isNaN(longitude) || isNaN(latitude) || isNaN(altitude))
        return;
    return {
        gltfLink,
        location: { longitude, latitude, altitude },
    };
}
function computeModelPosition(gltf, location) {
    // Compute a lat, lon & feature height from the gltf vertices
    // this is mostly to get a precise feature height
    const gltfPosition = cesium_1.Cartographic.toCartesian(cesium_1.Cartographic.fromDegrees(location.longitude, location.latitude, location.altitude));
    // The gltf will contain only one feature, so the 0th element will be its position
    const modelPosition = (0, gltfs_1.computeFeaturePositionsFromGltfVertices)(gltf, cesium_1.Transforms.eastNorthUpToFixedFrame(gltfPosition), // gltf local coords to globe coords
    cesium_1.Axis.Y_UP_TO_Z_UP.clone() // default gltf axis to cesium axis
    )?.[0];
    return modelPosition;
}
async function indexKmlFiles(kmlDir, kmlFiles, indexesConfig, outDir) {
    const resultsData = [];
    const indexBuilders = Object.entries(indexesConfig.indexes).map(([property, config]) => (0, IndexBuilder_1.createIndexBuilder)(property, config));
    let featuresRead = 0;
    const promises = kmlFiles.map(async (file) => {
        if (kmlFileRe.test(file) === false) {
            return;
        }
        const kmlFile = path.join(kmlDir, file);
        const kml = xml2json.toJson(fse.readFileSync(kmlFile), { object: true });
        const properties = readFeatureProperties(kml);
        if (properties === undefined) {
            console.error(`Failed to read properties from ${kmlFile}`);
            return;
        }
        const model = readModel(kml);
        if (model === undefined) {
            console.error(`No valid Model definition found in kml file ${kmlFile}`);
            return;
        }
        const gltfPath = path.resolve(path.dirname(kmlFile), model.gltfLink);
        const gltf = await gltfs.parseGltf(fse.readFileSync(gltfPath));
        const position = computeModelPosition(gltf, model.location);
        if (position === undefined) {
            console.error(`Failed to compute position for model: ${model.gltfLink}`);
            return;
        }
        const positionProperties = {
            // rounding to fewer decimal places significantly reduces the size of resultData file
            latitude: (0, utils_1.roundToNDecimalPlaces)(cesium_1.Math.toDegrees(position.latitude), 5),
            longitude: (0, utils_1.roundToNDecimalPlaces)(cesium_1.Math.toDegrees(position.longitude), 5),
            height: (0, utils_1.roundToNDecimalPlaces)(position.height, 3),
        };
        const idValue = properties.Name;
        const dataRowId = resultsData.push({
            [indexesConfig.idProperty]: idValue,
            ...positionProperties,
        }) - 1;
        indexBuilders.forEach((b) => {
            if (b.property in properties) {
                b.addIndexValue(dataRowId, properties[b.property]);
            }
            else if (b.property === constants_1.COMPUTED_HEIGHT_PROPERTY_NAME) {
                b.addIndexValue(dataRowId, positionProperties.height);
            }
        });
        featuresRead += 1;
        (0, utils_1.logOnSameLine)(`Features read: ${featuresRead}`);
    });
    await Promise.all(promises);
    console.log(`\nUnique features found: ${featuresRead}`);
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
async function runIndexer(argv) {
    const [kmlDir, indexConfigFile, outDir] = argv.slice(2);
    let kmlFiles = [];
    let indexesConfig;
    try {
        indexesConfig = (0, Config_1.parseIndexesConfig)(JSON.parse(fse.readFileSync(indexConfigFile).toString()));
    }
    catch (e) {
        console.error(`Failed to read index config file "${indexConfigFile}"`);
        console.error(e);
        (0, utils_1.printUsageAndExit)(USAGE);
        return;
    }
    try {
        kmlFiles = fse.readdirSync(kmlDir).filter((file) => kmlFileRe.test(file));
    }
    catch (e) {
        console.error(`Failed to list directory: ${kmlDir}`);
        console.error(e);
        (0, utils_1.printUsageAndExit)(USAGE);
    }
    fse.mkdirpSync(outDir);
    await indexKmlFiles(kmlDir, kmlFiles, indexesConfig, outDir);
}
runIndexer(process.argv);
