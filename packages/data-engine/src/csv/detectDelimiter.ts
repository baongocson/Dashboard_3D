import { parseCsv, type CsvDelimiter } from './parseCsv.js';

const DELIMITERS: readonly CsvDelimiter[] = [',', ';', '\t'];

export function detectDelimiter(input: string): CsvDelimiter {
  let bestDelimiter: CsvDelimiter = ',';
  let bestScore = -1;

  for (const delimiter of DELIMITERS) {
    try {
      const parsed = parseCsv(input, delimiter);
      const sample = parsed.records.slice(0, 20);

      if (sample.length === 0) {
        continue;
      }

      const columnCounts = sample.map((record) => record.length);
      const firstCount = columnCounts[0];

      if (firstCount === undefined || firstCount < 2) {
        continue;
      }

      const consistentRows = columnCounts.filter((count) => count === firstCount).length;

      const score = consistentRows * firstCount;

      if (score > bestScore) {
        bestScore = score;
        bestDelimiter = delimiter;
      }
    } catch {
      // Thử dấu phân cách tiếp theo.
    }
  }

  return bestDelimiter;
}
