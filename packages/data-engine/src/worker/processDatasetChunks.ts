
import type { Dataset } from '@dashboard/contracts';
import type { WorkerProgress } from './workerMessages.js';

export interface ChunkProcessingOptions {
  chunkSize: number;
  onProgress: (progress: WorkerProgress) => void;
  processChunk: (rows: Dataset['rows']) => void | Promise<void>;
  yieldControl?: () => Promise<void>;
  signal?: AbortSignal;
}

export class ChunkProcessingCancelledError extends Error {
  constructor() {
    super('Chunk processing was cancelled');
    this.name = 'ChunkProcessingCancelledError';
  }
}

export async function processDatasetChunks(
  taskId: string,
  dataset: Dataset,
  options: ChunkProcessingOptions,
): Promise<void> {
  const {
    chunkSize,
    onProgress,
    processChunk,
    signal,
  } = options;

  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize must be a positive safe integer');
  }

  const throwIfCancelled = (): void => {
    if (signal?.aborted === true) {
      throw new ChunkProcessingCancelledError();
    }
  };

  throwIfCancelled();

  const total = dataset.rows.length;

  if (total === 0) {
    onProgress({
      taskId,
      status: 'progress',
      completed: 0,
      total: 0,
      percentage: 100,
    });

    return;
  }

  for (let start = 0; start < total; start += chunkSize) {
    throwIfCancelled();

    const end = Math.min(start + chunkSize, total);
    const rows = dataset.rows.slice(start, end);

    await processChunk(rows);

    throwIfCancelled();

    onProgress({
      taskId,
      status: 'progress',
      completed: end,
      total,
      percentage: Math.round((end / total) * 100),
    });

    if (end < total && options.yieldControl !== undefined) {
      await options.yieldControl();
    }
  }

  throwIfCancelled();
}
