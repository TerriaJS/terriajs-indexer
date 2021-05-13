"use strict";
// See https://cesium.com/blog/2020/04/09/kml-collada-metadata/ for supported KML format
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const cesium_1 = require("cesium");
const fse = tslib_1.__importStar(require("fs-extra"));
const path = tslib_1.__importStar(require("path"));
const xml2json = tslib_1.__importStar(require("xml2json"));
const Config_1 = require("../Config");
const constants_1 = require("../constants");
const gltfs_1 = require("../gltfs");
const IndexBuilder_1 = require("../IndexBuilder");
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
    var _a;
    const placeMark = kml === null || kml === void 0 ? void 0 : kml.Placemark;
    const name = placeMark === null || placeMark === void 0 ? void 0 : placeMark.name;
    const data = (_a = placeMark === null || placeMark === void 0 ? void 0 : placeMark.ExtendedData) === null || _a === void 0 ? void 0 : _a.Data;
    if (typeof name !== "string" || Array.isArray(data) === false) {
        return;
    }
    const properties = { Name: name };
    data === null || data === void 0 ? void 0 : data.forEach((prop) => {
        if (typeof prop.name === "string" && typeof prop.value === "string") {
            properties[prop.name] = prop.value;
        }
    });
    return properties;
}
function readModel(kml) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const gltfLink = (_c = (_b = (_a = kml === null || kml === void 0 ? void 0 : kml.Placemark) === null || _a === void 0 ? void 0 : _a.Model) === null || _b === void 0 ? void 0 : _b.Link) === null || _c === void 0 ? void 0 : _c.href;
    const location = (_e = (_d = kml === null || kml === void 0 ? void 0 : kml.Placemark) === null || _d === void 0 ? void 0 : _d.Model) === null || _e === void 0 ? void 0 : _e.Location;
    const longitude = parseFloat((_f = location === null || location === void 0 ? void 0 : location.longitude) !== null && _f !== void 0 ? _f : "");
    const latitude = parseFloat((_g = location === null || location === void 0 ? void 0 : location.latitude) !== null && _g !== void 0 ? _g : "");
    const altitude = parseFloat((_h = location === null || location === void 0 ? void 0 : location.altitude) !== null && _h !== void 0 ? _h : "");
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
    var _a;
    // Compute a lat, lon & feature height from the gltf vertices
    // this is mostly to get a precise feature height
    const gltfPosition = cesium_1.Cartographic.toCartesian(cesium_1.Cartographic.fromDegrees(location.longitude, location.latitude, location.altitude));
    // The gltf will contain only one feature, so the 0th element will be its position
    const modelPosition = (_a = gltfs_1.computeFeaturePositionsFromGltfVertices(gltf, cesium_1.Transforms.eastNorthUpToFixedFrame(gltfPosition), // gltf local coords to globe coords
    cesium_1.Matrix4.IDENTITY.clone(), // rtc transform - there is none
    cesium_1.Axis.Y_UP_TO_Z_UP.clone() // default gltf axis to cesium axis
    )) === null || _a === void 0 ? void 0 : _a[0];
    return modelPosition;
}
function readGltf(gltfPath) {
    const json = JSON.parse(fse.readFileSync(gltfPath).toString());
    if (Array.isArray(json.buffers) === false) {
        return { json, buffers: [] };
    }
    const buffers = json.buffers.map(({ uri }) => {
        const bufferPath = path.resolve(path.dirname(gltfPath), uri);
        const buffer = fse.readFileSync(bufferPath);
        return buffer;
    });
    return { json, buffers };
}
function indexKmlFiles(kmlDir, kmlFiles, indexesConfig, outDir) {
    const resultsData = [];
    const indexBuilders = Object.entries(indexesConfig.indexes).map(([property, config]) => IndexBuilder_1.createIndexBuilder(property, config));
    let featuresRead = 0;
    kmlFiles.forEach((file) => {
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
        const gltf = readGltf(gltfPath);
        const position = computeModelPosition(gltf, model.location);
        if (position === undefined) {
            console.error(`Failed to compute position for model: ${model.gltfLink}`);
            return;
        }
        const positionProperties = {
            // rounding to fewer decimal places significantly reduces the size of resultData file
            latitude: utils_1.roundToNDecimalPlaces(cesium_1.Math.toDegrees(position.latitude), 5),
            longitude: utils_1.roundToNDecimalPlaces(cesium_1.Math.toDegrees(position.longitude), 5),
            height: utils_1.roundToNDecimalPlaces(position.height, 3),
        };
        const idValue = properties.Name;
        const dataRowId = resultsData.push(Object.assign({ [indexesConfig.idProperty]: idValue }, positionProperties)) - 1;
        indexBuilders.forEach((b) => {
            if (b.property in properties) {
                b.addIndexValue(dataRowId, properties[b.property]);
            }
            else if (b.property === constants_1.COMPUTED_HEIGHT_PROPERTY_NAME) {
                b.addIndexValue(dataRowId, positionProperties.height);
            }
        });
        featuresRead += 1;
        utils_1.logOnSameLine(`Features read: ${featuresRead}`);
    });
    console.log(`\nUnique features found: ${featuresRead}`);
    console.log("Writing indexes...");
    const indexes = IndexBuilder_1.writeIndexes(indexBuilders, outDir);
    const resultsDataUrl = IndexBuilder_1.writeResultsData(resultsData, outDir);
    const indexRoot = {
        resultsDataUrl,
        idProperty: indexesConfig.idProperty,
        indexes,
    };
    IndexBuilder_1.writeIndexRoot(indexRoot, outDir);
    console.log(`Indexes written to ${outDir}/`);
    console.log("Done.");
}
function runIndexer(argv) {
    const [kmlDir, indexConfigFile, outDir] = argv.slice(2);
    let kmlFiles = [];
    let indexesConfig;
    try {
        indexesConfig = Config_1.parseIndexesConfig(JSON.parse(fse.readFileSync(indexConfigFile).toString()));
    }
    catch (e) {
        console.error(`Failed to read index config file "${indexConfigFile}"`);
        console.error(e);
        utils_1.printUsageAndExit(USAGE);
        return;
    }
    try {
        kmlFiles = fse.readdirSync(kmlDir).filter((file) => kmlFileRe.test(file));
    }
    catch (e) {
        console.error(`Failed to list directory: ${kmlDir}`);
        console.error(e);
        utils_1.printUsageAndExit(USAGE);
    }
    fse.mkdirpSync(outDir);
    indexKmlFiles(kmlDir, kmlFiles, indexesConfig, outDir);
}
runIndexer(process.argv);
//# sourceMappingURL=indexer.js.map