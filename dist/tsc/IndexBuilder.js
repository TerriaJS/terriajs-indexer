"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createIndexBuilder = exports.EnumIndexBuilder = exports.TextIndexBuilder = exports.NumericIndexBuilder = void 0;
const tslib_1 = require("tslib");
const minisearch_1 = tslib_1.__importDefault(require("minisearch"));
const path = tslib_1.__importStar(require("path"));
const fse = tslib_1.__importStar(require("fs-extra"));
const writeCsv_1 = tslib_1.__importDefault(require("./writeCsv"));
class NumericIndexBuilder {
    constructor(property, config) {
        this.property = property;
        this.config = config;
        this.idValuePairs = [];
    }
    addIndexValue(dataRowId, value) {
        if (typeof value === "number") {
            this.range = {
                min: this.range === undefined ? value : Math.min(value, this.range.min),
                max: this.range === undefined ? value : Math.max(value, this.range.max),
            };
        }
        this.idValuePairs.push({ dataRowId, value });
    }
    writeIndex(fileId, outDir) {
        if (!this.range)
            throw new Error(`Index for property "${this.property}" is empty`);
        this.idValuePairs.sort((a, b) => a.value - b.value);
        const fileName = `${fileId}.csv`;
        const filePath = path.join(outDir, fileName);
        writeCsv_1.default(filePath, this.idValuePairs);
        return {
            type: "numeric",
            url: fileName,
            range: this.range,
        };
    }
}
exports.NumericIndexBuilder = NumericIndexBuilder;
class TextIndexBuilder {
    constructor(property, config) {
        this.property = property;
        this.config = config;
        this.miniSearchIndex = new minisearch_1.default({ fields: [property] });
    }
    addIndexValue(dataRowId, value) {
        this.miniSearchIndex.add({ id: dataRowId, [this.property]: value });
    }
    writeIndex(fileId, outDir) {
        const index = this.miniSearchIndex;
        const fileName = `${fileId}.json`;
        const filePath = path.join(outDir, fileName);
        fse.writeFileSync(filePath, JSON.stringify({ index, options: index._options }));
        return {
            type: "text",
            url: fileName,
        };
    }
}
exports.TextIndexBuilder = TextIndexBuilder;
class EnumIndexBuilder {
    constructor(property, config) {
        this.property = property;
        this.config = config;
        this.valueIds = {};
    }
    addIndexValue(dataRowId, value) {
        this.valueIds[value] = this.valueIds[value] || [];
        this.valueIds[value].push({ dataRowId });
    }
    writeIndex(fileId, outDir) {
        const values = Object.entries(this.valueIds).reduce((values, [value, ids], i) => {
            values[value] = this.writeValueIndex(fileId, i, ids, outDir);
            return values;
        }, {});
        return {
            type: "enum",
            values,
        };
    }
    writeValueIndex(fileId, valueId, ids, outDir) {
        const fileName = `${fileId}-${valueId}.csv`;
        const filePath = path.join(outDir, fileName);
        writeCsv_1.default(filePath, ids);
        return {
            count: ids.length,
            url: fileName,
        };
    }
}
exports.EnumIndexBuilder = EnumIndexBuilder;
function createIndexBuilder(property, indexConfig) {
    switch (indexConfig.type) {
        case "numeric":
            return new NumericIndexBuilder(property, indexConfig);
        case "text":
            return new TextIndexBuilder(property, indexConfig);
        case "enum":
            return new EnumIndexBuilder(property, indexConfig);
    }
}
exports.createIndexBuilder = createIndexBuilder;
//# sourceMappingURL=IndexBuilder.js.map