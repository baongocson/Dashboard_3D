import { datasetSchema, type Cell, type Dataset } from '@dashboard/contracts';

import type { ParsedCsv } from './parseCsv.js';
import { inferColumnType, type InferredColumnType } from './inferColumnTypes.js';

export interface CreateDatasetOptions {
  header: 'first-row' | 'generated';
  versionId: string;
  confirmedHeaders?: string[] | null;
  additionalMissingTokens?: string[];
}

export class CsvDatasetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvDatasetError';
  }
}
export class CsvHeaderError extends CsvDatasetError {
  constructor(public readonly proposedHeaders: string[]) {
    super('Tên cột rỗng hoặc trùng. Hãy kiểm tra và xác nhận tên đề xuất.');
    this.name = 'CsvHeaderError';
  }
}

function normalizeCell(value: string, additionalMissingTokens: readonly string[]): string | null {
  if (value.trim() === '' || ['null', 'n/a'].includes(value.trim().toLowerCase())) return null;

  if (additionalMissingTokens.includes(value.trim())) {
    return null;
  }

  return value;
}

function convertCell(value: string | null, type: InferredColumnType): Cell {
  if (value === null) return null;

  if (type === 'number') {
    return Number(value.trim());
  }

  if (type === 'boolean') {
    return value === 'true';
  }

  return value;
}

export function createDataset(parsed: ParsedCsv, options: CreateDatasetOptions): Dataset {
  const { records, sourceLines } = parsed;

  const firstRecord = records[0];

  if (firstRecord === undefined) {
    throw new CsvDatasetError('CSV contains no records');
  }

  const columnCount = firstRecord.length;

  const rawHeaders =
    options.header === 'first-row'
      ? firstRecord
      : Array.from({ length: columnCount }, (_, index) => `column_${String(index + 1)}`);

  const headers = options.confirmedHeaders ?? rawHeaders;

  if (headers.length !== columnCount) {
    throw new CsvDatasetError('Header count does not match column count');
  }

  const normalizedHeaders = headers.map((header) => header.trim());

  if (
    normalizedHeaders.some((header) => header.length === 0) ||
    new Set(normalizedHeaders).size !== columnCount
  ) {
    const seen = new Set<string>();
    const proposed = normalizedHeaders.map((name, index) => {
      const base = name || `column_${String(index + 1)}`;
      let candidate = base,
        suffix = 2;
      while (seen.has(candidate)) candidate = `${base}_${String(suffix++)}`;
      seen.add(candidate);
      return candidate;
    });
    throw new CsvHeaderError(proposed);
  }

  const dataStart = options.header === 'first-row' ? 1 : 0;
  const dataRecords = records.slice(dataStart);

  for (let index = 0; index < dataRecords.length; index += 1) {
    const record = dataRecords[index];

    if (record === undefined) continue;

    if (record.length !== columnCount) {
      const line = sourceLines[index + dataStart] ?? 0;

      throw new CsvDatasetError(
        `Record ${String(index + 1)} / Line ${String(line)}: expected ${String(columnCount)} columns, received ${String(record.length)}`,
      );
    }
  }

  const missingTokens = options.additionalMissingTokens ?? [];

  const normalizedRecords = dataRecords.map((record) =>
    record.map((value) => normalizeCell(value, missingTokens)),
  );

  const columns = normalizedHeaders.map((name, index) => {
    const values = normalizedRecords.map((record) => record[index] ?? null);

    return {
      id: `column-${String(index + 1)}`,
      name,
      type: inferColumnType(values),
    };
  });

  const rows = normalizedRecords.map((record, index) => {
    const cells: Record<string, Cell> = {};

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const column = columns[columnIndex];

      if (column === undefined) {
        throw new CsvDatasetError('Invalid CSV column');
      }

      cells[column.id] = convertCell(record[columnIndex] ?? null, column.type);
    }

    return {
      id: `row-${String(index + 1)}`,
      cells,
    };
  });

  return datasetSchema.parse({
    versionId: options.versionId,
    columns,
    rows,
  });
}
