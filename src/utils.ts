export function printUsageAndExit(usage: string) {
  console.error(`\n${usage}\n`);
  process.exit(1);
}

/**
 * Clears the current stdout line and logs the message on the same line
 */
export function logOnSameLine(message: string) {
  // clear line and move to first col
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(message);
}

/**
 * Round value to n decimal places
 */
export function roundToNDecimalPlaces(value: number, n: number): number {
  const multiplier = 10 ** n;
  const roundedValue = Math.round(value * multiplier) / multiplier;
  return roundedValue;
}
