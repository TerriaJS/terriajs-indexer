import Papa from "papaparse";
import * as fse from "fs-extra";

export default function writeCsv(
  filePath: string,
  data: any[][] | Record<string, any>[]
) {
  fse.createWriteStream(filePath).write(Papa.unparse(data, { quotes: true }));
}
