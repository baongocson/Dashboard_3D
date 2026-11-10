import { csvOptionsSchema, datasetSchema, type Dataset } from '@dashboard/contracts';
import { z } from 'zod';

import { readCsvFile } from './readCsvFile.js';
import { detectDelimiter } from './detectDelimiter.js';
import { parseCsv } from './parseCsv.js';
import { createDataset } from './createDataset.js';

export type CsvImportOptions = z.infer<typeof csvOptionsSchema>;

export async function importCsv(
  file: Blob,
  options: CsvImportOptions,
  versionId: string,
): Promise<Dataset> {
  const validatedOptions = csvOptionsSchema.parse(options);

  const content = await readCsvFile(file);

  const delimiter =
    validatedOptions.delimiter === 'auto' ? detectDelimiter(content) : validatedOptions.delimiter;

  const parsed = parseCsv(content, delimiter);

  const dataset = createDataset(parsed, {
    header: validatedOptions.header,
    versionId,
    confirmedHeaders: validatedOptions.confirmedHeaders,
    additionalMissingTokens: validatedOptions.additionalMissingTokens,
  });

  return datasetSchema.parse(dataset);
}
