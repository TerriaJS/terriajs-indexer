import * as fse from "fs-extra";
import * as path from "path";
import { Index, IndexRoot } from "../Index";
import writeCsv from "../writeCsv";
import {
  IndexesConfig,
  parseIndexesConfig,
  PositionProperties,
  ZoomTarget,
} from "../Config";
import { createIndexBuilder, IndexBuilder } from "../IndexBuilder";
import tilesetFeaturesIterator from "./tilesetFeaturesIterator";

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
function index3dTiles(
  tileset: any,
  tilesetDir: string,
  indexesConfig: IndexesConfig,
  outDir: string
) {
  const indexBuilders = Object.entries(
    indexesConfig.indexes
  ).map(([property, config]) => createIndexBuilder(property, config));

  const idProperty = indexesConfig.idProperty;
  const uniqueFeatures: Record<
    string,
    { position: ZoomTarget; properties: any }
  > = {};

  let featuresRead = 0;
  for (const entry of tilesetFeaturesIterator(tileset, tilesetDir)) {
    const { tilePosition, properties } = entry;
    const position = getZoomTarget(
      indexesConfig.positionProperties,
      properties,
      tilePosition
    );
    const idValue = properties[idProperty];
    uniqueFeatures[idValue] = { position, properties };

    featuresRead += 1;
    logOnSameLine(`Features read: ${featuresRead}`);
  }

  const uniqueFeaturesCount = Object.entries(uniqueFeatures).length;
  console.log(`\nUnique features found: ${uniqueFeaturesCount}`);
  console.log("Building indexes...");
  const resultsData: any[] = [];
  Object.entries(uniqueFeatures).forEach(
    ([idValue, { position, properties }]) => {
      const len = resultsData.push({ [idProperty]: idValue, ...position });
      const dataRowId = len - 1;
      indexBuilders.forEach((b) =>
        b.addIndexValue(dataRowId, properties[b.property])
      );
    }
  );

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

function getZoomTarget(
  positionProperties: PositionProperties | undefined,
  properties: Record<string, any>,
  defaults: ZoomTarget
): ZoomTarget {
  const position = { ...defaults };
  if (positionProperties?.latitude && properties[positionProperties.latitude])
    position.latitude = properties[positionProperties.latitude];
  if (positionProperties?.longitude && properties[positionProperties.longitude])
    position.longitude = properties[positionProperties.longitude];
  if (positionProperties?.height && properties[positionProperties.height])
    position.height = properties[positionProperties.height];
  return position;
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
  index3dTiles(tileset, tilesetDir, indexesConfig, outDir);
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
