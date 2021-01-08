import * as fse from "fs-extra";
import * as path from "path";
import {
  Index,
  IndexRoot,
} from "terriajs/lib/Models/ItemSearchProviders/Index";
import writeCsv from "../writeCsv";
import {
  IndexesConfig,
  parseIndexesConfig,
  PositionProperties,
  ZoomTarget,
} from "./Config";
import { createIndexBuilder, IndexBuilder } from "./IndexBuilder";
import tilesetPropertiesIterator from "./tilesetPropertiesIterator";

const USAGE =
  "USAGE: index.ts <tileset.json file> <config.json file> <index output directory>";

/**
 * Generate an index for the given tileset.
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
  const data: Record<string, any>[] = [];

  let dataRowIndex = 0;
  for (const entry of tilesetPropertiesIterator(tileset, tilesetDir)) {
    const { tilePosition, properties } = entry;
    indexBuilders.forEach((b) =>
      b.addIndexValue(dataRowIndex, properties[b.property])
    );
    const position = getZoomTarget(
      indexesConfig.positionProperties,
      properties,
      tilePosition
    );
    const idValue = properties[idProperty];
    data.push({
      [idProperty]: idValue,
      ...position,
    });
    dataRowIndex += 1;
  }

  const indexes = writeIndexes(indexBuilders, outDir);
  const dataUrl = writeData(data, outDir);
  const indexRoot: IndexRoot = {
    dataUrl,
    idProperty: indexesConfig.idProperty,
    indexes,
  };
  writeIndexRoot(indexRoot, outDir);
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
function writeData(data: Record<string, any>[], outDir: string): string {
  const fileName = "data.csv";
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

  const tilesetDir = path.dirname(tilesetFile);
  index3dTiles(tileset, tilesetDir, indexesConfig, outDir);
}

function printUsageAndExit() {
  console.error(`\n${USAGE}\n`);
  process.exit(1);
}

main();
