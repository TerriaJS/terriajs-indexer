import * as fse from "fs-extra";
import * as path from "path";
import tilesetFeaturesIterator, { Value } from "./tilesetFeaturesIterator";

const USAGE = "USAGE: dumpCsv.ts <tileset.json file> <outputfile>";

function dumpCsv(
  tileset: any,
  tilesetDir: string,
  csv: fse.WriteStream
): number {
  const rows = tilesetFeaturesIterator(tileset, tilesetDir);

  // Write header and first row
  const firstRow: Value = rows.next().value;
  if (!firstRow) {
    return 0;
  }

  const properties = firstRow.properties;
  const header = Object.keys(properties).join(",");
  const values = Object.values(properties).join(",");
  csv.write(header);
  csv.write("\n");
  csv.write(values);

  let nRowsWritten = 1;
  for (const { properties } of rows) {
    csv.write("\n");
    csv.write(Object.values(properties).join(","));
    nRowsWritten += 1;
  }
  return nRowsWritten;
}

function main() {
  const [tilesetFile, outFile] = process.argv.slice(2);
  let tileset: any;
  let outStream: fse.WriteStream;
  try {
    tileset = JSON.parse(fse.readFileSync(tilesetFile).toString());
  } catch (e) {
    console.error(`Failed to read tileset file "${tilesetFile}"`);
    console.error(e);
    console.error(`\n${USAGE}\n`);
    process.exit(1);
  }
  try {
    outStream = fse.createWriteStream(outFile);
  } catch (e) {
    console.error(`Failed to create output stream for file "${outFile}"`);
    console.error(e);
    console.error(`\n${USAGE}\n`);
    process.exit(1);
  }
  const tilesetDir = path.dirname(tilesetFile);
  const nRows = dumpCsv(tileset, tilesetDir, outStream);
  console.log(`Dumped ${nRows} rows.`);
}

main();
