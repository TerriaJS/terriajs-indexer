// See https://cesium.com/blog/2020/04/09/kml-collada-metadata/ for supported KML format

import {
  Axis,
  Cartographic,
  Math as CesiumMath,
  Matrix4,
  Transforms,
} from "cesium";
import * as fse from "fs-extra";
import * as path from "path";
import * as xml2json from "xml2json";
import { IndexesConfig, parseIndexesConfig } from "../Config";
import { COMPUTED_HEIGHT_PROPERTY_NAME } from "../constants";
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

const USAGE =
  "USAGE: npx index-kml-gltf <kml-directory> <config.json file> <index output directory>";

const kmlFileRe = /.*?\.kml$/;

type Kml = {
  Placemark?: {
    name?: string;
    ExtendedData?: {
      Data: { name?: string; value?: string }[];
    };
    Model?: {
      Link?: { href?: string };
      Location?: { longitude?: string; latitude?: string; altitude?: string };
    };
  };
};

type FeatureProperties = { Name: string; [key: string]: string };

type Model = {
  gltfLink: string;
  location: {
    longitude: number;
    latitude: number;
    altitude: number;
  };
};

/**
 * Read properties from KML in a format.
 * The KML should be formatted as described here:
 * https://cesium.com/blog/2020/04/09/kml-collada-metadata/
 *
 */
function readFeatureProperties(kml: Kml): FeatureProperties | undefined {
  const placeMark = kml?.Placemark;
  const name = placeMark?.name;
  const data = placeMark?.ExtendedData?.Data;

  if (typeof name !== "string" || Array.isArray(data) === false) {
    return;
  }

  const properties: FeatureProperties = { Name: name };
  data?.forEach((prop) => {
    if (typeof prop.name === "string" && typeof prop.value === "string") {
      properties[prop.name] = prop.value;
    }
  });
  return properties;
}

function readModel(kml: Kml): Model | undefined {
  const gltfLink = kml?.Placemark?.Model?.Link?.href;
  const location = kml?.Placemark?.Model?.Location;
  const longitude = parseFloat(location?.longitude ?? "");
  const latitude = parseFloat(location?.latitude ?? "");
  const altitude = parseFloat(location?.altitude ?? "");

  if (typeof gltfLink !== "string") return;
  if (isNaN(longitude) || isNaN(latitude) || isNaN(altitude)) return;

  return {
    gltfLink,
    location: { longitude, latitude, altitude },
  };
}

function computeModelPosition(
  gltf: Gltf,
  location: Model["location"]
): Cartographic | undefined {
  // Compute a lat, lon & feature height from the gltf vertices
  // this is mostly to get a precise feature height
  const gltfPosition = Cartographic.toCartesian(
    Cartographic.fromDegrees(
      location.longitude,
      location.latitude,
      location.altitude
    )
  );
  // The gltf will contain only one feature, so the 0th element will be its position
  const modelPosition = computeFeaturePositionsFromGltfVertices(
    gltf,
    Transforms.eastNorthUpToFixedFrame(gltfPosition), // gltf local coords to globe coords
    Matrix4.IDENTITY.clone(), // rtc transform - there is none
    (Axis as any).Y_UP_TO_Z_UP.clone() // default gltf axis to cesium axis
  )?.[0];
  return modelPosition;
}

function readGltf(gltfPath: string): Gltf {
  const json = JSON.parse(fse.readFileSync(gltfPath).toString());
  if (Array.isArray(json.buffers) === false) {
    return { json, buffers: [] };
  }

  const buffers: Buffer[] = json.buffers.map(
    ({ uri }: { uri: string }): Buffer => {
      const bufferPath = path.resolve(path.dirname(gltfPath), uri);
      const buffer = fse.readFileSync(bufferPath);
      return buffer;
    }
  );

  return { json, buffers };
}

function indexKmlFiles(
  kmlDir: string,
  kmlFiles: string[],
  indexesConfig: IndexesConfig,
  outDir: string
) {
  const resultsData: any[] = [];
  const indexBuilders = Object.entries(
    indexesConfig.indexes
  ).map(([property, config]) => createIndexBuilder(property, config));

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
    const idValue = properties.Name;
    const dataRowId =
      resultsData.push({
        [indexesConfig.idProperty]: idValue,
        ...positionProperties,
      }) - 1;
    indexBuilders.forEach((b) => {
      if (b.property in properties) {
        b.addIndexValue(dataRowId, properties[b.property]);
      } else if (b.property === COMPUTED_HEIGHT_PROPERTY_NAME) {
        b.addIndexValue(dataRowId, positionProperties.height);
      }
    });
    featuresRead += 1;
    logOnSameLine(`Features read: ${featuresRead}`);
  });

  console.log(`\nUnique features found: ${featuresRead}`);
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

function runIndexer(argv: string[]) {
  const [kmlDir, indexConfigFile, outDir] = argv.slice(2);

  let kmlFiles: string[] = [];
  let indexesConfig: IndexesConfig;

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

  try {
    kmlFiles = fse.readdirSync(kmlDir).filter((file) => kmlFileRe.test(file));
  } catch (e) {
    console.error(`Failed to list directory: ${kmlDir}`);
    console.error(e);
    printUsageAndExit(USAGE);
  }

  fse.mkdirpSync(outDir);
  indexKmlFiles(kmlDir, kmlFiles, indexesConfig, outDir);
}

runIndexer(process.argv);
