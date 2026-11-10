import { MAX_CSV_BYTES } from '@dashboard/contracts';

export class CsvFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvFileError';
  }
}

export async function readCsvFile(file: Blob): Promise<string> {
  if (file.size === 0) {
    throw new CsvFileError('CSV file is empty');
  }

  if (file.size > MAX_CSV_BYTES) {
    throw new CsvFileError(`CSV file exceeds the ${String(MAX_CSV_BYTES)} byte limit`);
  }

  const bytes = await file.arrayBuffer();

  if (bytes.byteLength === 0) {
    throw new CsvFileError('CSV file is empty');
  }

  if (bytes.byteLength > MAX_CSV_BYTES) {
    throw new CsvFileError('CSV file exceeds size limit');
  }

  try {
    const decoder = new TextDecoder('utf-8', {
      fatal: true,
      ignoreBOM: false,
    });

    return decoder.decode(bytes);
  } catch {
    throw new CsvFileError('Invalid UTF-8 encoding');
  }
}
