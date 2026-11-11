import { MAX_CSV_BYTES, csvFileSchema, csvOptionsSchema } from '@dashboard/contracts';
import type { z } from 'zod';

export type CsvOptions = z.infer<typeof csvOptionsSchema>;
export type ImportStatus =
  | { phase: 'idle'; message?: string }
  | { phase: 'processing'; message?: string; percent?: number }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; message?: string };

export function defaultCsvOptions(): CsvOptions {
  return {
    encoding: 'utf-8',
    delimiter: 'auto',
    header: 'first-row',
    additionalMissingTokens: [],
    confirmedHeaders: null,
  };
}

// UI validation only. It does NOT read, decode or parse a CSV.
export function validateCsvInput(
  file: Pick<File, 'name' | 'size'> | null,
  options: CsvOptions,
): string | null {
  if (!file) return 'Select a CSV file.';
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Only .csv files are supported.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > MAX_CSV_BYTES)
    return `The file exceeds the limit of ${MAX_CSV_BYTES.toLocaleString('en-US')} byte.`;
  const checkedFile = csvFileSchema.safeParse({ name: file.name, bytes: file.size });
  if (!checkedFile.success) return 'Invalid file information.';
  if (!csvOptionsSchema.safeParse(options).success) return 'Invalid CSV settings.';
  return null;
}
