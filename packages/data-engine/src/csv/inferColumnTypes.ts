
import { z } from 'zod';

export type InferredColumnType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime';

function isNumericValue(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) return false;

  // Không chuyển các mã có số 0 ở đầu thành số.
  if (/^[+-]?0\d+$/u.test(trimmed)) return false;

  // Chỉ chấp nhận định dạng số thập phân thông thường.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(trimmed)) {
    return false;
  }

  const numberValue = Number(trimmed);

  return (
    Number.isFinite(numberValue) &&
    (!Number.isInteger(numberValue) ||
      Number.isSafeInteger(numberValue))
  );
}

function isBooleanValue(value: string): boolean {
  return value === 'true' || value === 'false';
}

function isDateValue(value: string): boolean {
  return z.iso.date().safeParse(value).success;
}

function isDatetimeValue(value: string): boolean {
  return z.iso.datetime().safeParse(value).success;
}

export function inferColumnType(
  values: readonly (string | null)[],
): InferredColumnType {
  const nonMissingValues = values.filter(
    (value): value is string => value !== null,
  );

  if (nonMissingValues.length === 0) {
    return 'text';
  }

  if (nonMissingValues.every(isBooleanValue)) {
    return 'boolean';
  }

  if (nonMissingValues.every(isNumericValue)) {
    return 'number';
  }

  if (nonMissingValues.every(isDateValue)) {
    return 'date';
  }

  if (nonMissingValues.every(isDatetimeValue)) {
    return 'datetime';
  }

  return 'text';
}
