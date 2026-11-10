
export type CsvDelimiter = ',' | ';' | '\t';

export interface ParsedCsv {
  records: string[][];
  sourceLines: number[];
}

export class CsvParseError extends Error {
  constructor(
    message: string,
    public readonly line: number,
  ) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export function parseCsv(
  input: string,
  delimiter: CsvDelimiter,
): ParsedCsv {

  const content = input.startsWith('\uFEFF')
    ? input.slice(1)
    : input;

  const records: string[][] = [];
  const sourceLines: number[] = [];

  let record: string[] = [];
  let field = '';
  let line = 1;
  let recordStartLine = 1;

  let inQuotes = false;
  let afterQuote = false;
  let atFieldStart = true;

  function finishField(): void {
    record.push(field);
    field = '';
    afterQuote = false;
    atFieldStart = true;
  }

  function finishRecord(): void {
    finishField();

    // Bỏ dòng hoàn toàn trống, nhưng giữ dòng ",".
    if (!(record.length === 1 && record[0] === '')) {
      records.push(record);
      sourceLines.push(recordStartLine);
    }

    record = [];
    recordStartLine = line;
  }

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];

    if (char === undefined) {
      continue;
    }

    if (inQuotes) {
      if (char === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
          afterQuote = true;
        }
      } else if (char === '\r' && content[i + 1] === '\n') {
        field += '\n';
        line += 1;
        i += 1;
      } else {
        field += char;

        if (char === '\n' || char === '\r') {
          line += 1;
        }
      }

      continue;
    }

    if (afterQuote) {
      if (char !== delimiter && char !== '\n' && char !== '\r') {
        throw new CsvParseError(
          'Unexpected character after closing quote',
          line,
        );
      }
    }

    if (char === delimiter) {
      finishField();
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') {
        i += 1;
      }

      finishRecord();
      line += 1;
      recordStartLine = line;
      continue;
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true;
      atFieldStart = false;
      continue;
    }

    if (char === '"') {
      throw new CsvParseError(
        'Unexpected quote inside unquoted field',
        line,
      );
    }

    field += char;
    atFieldStart = false;
  }

  if (inQuotes) {
    throw new CsvParseError('Unclosed quoted field', line);
  }

  if (
    record.length > 0 ||
    field.length > 0 ||
    afterQuote
  ) {
    finishRecord();
  }

  return { records, sourceLines };
}
