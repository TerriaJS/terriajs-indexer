"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundToNDecimalPlaces = exports.logOnSameLine = exports.printUsageAndExit = void 0;
function printUsageAndExit(usage) {
    console.error(`\n${usage}\n`);
    process.exit(1);
}
exports.printUsageAndExit = printUsageAndExit;
/**
 * Clears the current stdout line and logs the message on the same line
 */
function logOnSameLine(message) {
    // clear line and move to first col
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(message);
}
exports.logOnSameLine = logOnSameLine;
/**
 * Round value to n decimal places
 */
function roundToNDecimalPlaces(value, n) {
    const multiplier = Math.pow(10, n);
    const roundedValue = Math.round(value * multiplier) / multiplier;
    return roundedValue;
}
exports.roundToNDecimalPlaces = roundToNDecimalPlaces;
//# sourceMappingURL=utils.js.map