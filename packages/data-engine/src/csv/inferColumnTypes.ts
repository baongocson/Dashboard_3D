export type InferredColumnType = 'text' | 'number' | 'boolean' | 'date' | 'datetime';

export function isNumericValue(value: string): boolean {
  const trimmed = value.trim();

  if (trimmed.length === 0) return false;

  // Không chuyển các mã có số 0 ở đầu thành số.
  if (/^[+-]?0\d/u.test(trimmed)) return false;

  // Chỉ chấp nhận định dạng số thập phân thông thường.
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/u.test(trimmed)) {
    return false;
  }

  const numberValue = Number(trimmed);

  return (
    Number.isFinite(numberValue) &&
    decimalKey(trimmed) === decimalKey(String(numberValue)) &&
    (!Number.isInteger(numberValue) || Number.isSafeInteger(numberValue))
  );
}

function isBooleanValue(value: string): boolean {
  return value === 'true' || value === 'false';
}

export function inferColumnType(values: readonly (string | null)[]): InferredColumnType {
  const nonMissingValues = values.filter((value): value is string => value !== null);

  if (nonMissingValues.length === 0) {
    return 'text';
  }

  if (nonMissingValues.every(isBooleanValue)) {
    return 'boolean';
  }

  if (nonMissingValues.every(isNumericValue)) {
    return 'number';
  }

  return 'text';
}

function decimalKey(value: string): string {
  const [mantissa = '', exponent = '0'] = value.toLowerCase().replace(/^\+/, '').split('e');
  const negative = mantissa.startsWith('-');
  const [whole = '', fraction = ''] = mantissa.replace(/^-/, '').split('.');
  let digits = (whole + fraction).replace(/^0+/, '');
  let power = Number(exponent) - fraction.length;
  const significant = digits.replace(/0+$/u, '');
  power += digits.length - significant.length;
  digits = significant;
  return digits ? `${negative ? '-' : ''}${digits}e${String(power)}` : '0';
}
