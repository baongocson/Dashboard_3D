import type { Dataset } from '@dashboard/contracts';

export interface DatasetChunk {
  index: number;
  start: number;
  end: number;
  rows: Dataset['rows'];
}

export function chunkDataset(dataset: Dataset, chunkSize: number): DatasetChunk[] {
  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize must be a positive safe integer');
  }

  const chunks: DatasetChunk[] = [];

  for (let start = 0; start < dataset.rows.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, dataset.rows.length);

    chunks.push({
      index: chunks.length,
      start,
      end,
      rows: dataset.rows.slice(start, end),
    });
  }

  return chunks;
}
