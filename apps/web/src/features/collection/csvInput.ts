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
  if (!file) return 'Hãy chọn một tệp CSV.';
  if (!file.name.toLowerCase().endsWith('.csv')) return 'Chỉ nhận tệp có đuôi .csv.';
  if (file.size === 0) return 'Tệp đang trống.';
  if (file.size > MAX_CSV_BYTES)
    return `Tệp vượt giới hạn ${MAX_CSV_BYTES.toLocaleString('vi-VN')} byte.`;
  const checkedFile = csvFileSchema.safeParse({ name: file.name, bytes: file.size });
  if (!checkedFile.success) return 'Thông tin tệp không hợp lệ.';
  if (!csvOptionsSchema.safeParse(options).success) return 'Cấu hình đọc CSV không hợp lệ.';
  return null;
}
