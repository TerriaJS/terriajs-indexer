"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const papaparse_1 = tslib_1.__importDefault(require("papaparse"));
const fse = tslib_1.__importStar(require("fs-extra"));
function writeCsv(filePath, data) {
    fse.createWriteStream(filePath).write(papaparse_1.default.unparse(data, { quotes: true }));
}
exports.default = writeCsv;
//# sourceMappingURL=writeCsv.js.map