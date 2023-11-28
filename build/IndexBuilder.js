"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeIndexRoot = exports.writeResultsData = exports.writeIndexes = exports.createIndexBuilder = exports.EnumIndexBuilder = exports.TextIndexBuilder = exports.NumericIndexBuilder = void 0;
const minisearch_1 = __importDefault(require("minisearch"));
const path = __importStar(require("path"));
const fse = __importStar(require("fs-extra"));
const writeCsv_1 = __importDefault(require("./writeCsv"));
class NumericIndexBuilder {
    constructor(property, config) {
        this.property = property;
        this.config = config;
        this.idValuePairs = [];
    }
    addIndexValue(dataRowId, indexValue) {
        const value = parseFloat(indexValue);
        if (typeof value === "number" && isNaN(value) === false) {
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
        (0, writeCsv_1.default)(filePath, this.idValuePairs);
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
        (0, writeCsv_1.default)(filePath, ids);
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
/**
 * Write indexes using the index builders and returns a `IndexRoot.indexes` map
 */
function writeIndexes(indexBuilders, outDir) {
    return indexBuilders.reduce((indexes, b, fileId) => {
        indexes[b.property] = b.writeIndex(fileId, outDir);
        return indexes;
    }, {});
}
exports.writeIndexes = writeIndexes;
/**
 * Writes the data.csv file under `outDir` and returns its path.
 */
function writeResultsData(data, outDir) {
    const fileName = "resultsData.csv";
    const filePath = path.join(outDir, fileName);
    (0, writeCsv_1.default)(filePath, data);
    return fileName;
}
exports.writeResultsData = writeResultsData;
/**
 *  Writes the index root file under `outDir`.
 */
function writeIndexRoot(indexRoot, outDir) {
    fse
        .createWriteStream(path.join(outDir, "indexRoot.json"))
        .write(JSON.stringify(indexRoot));
}
exports.writeIndexRoot = writeIndexRoot;
