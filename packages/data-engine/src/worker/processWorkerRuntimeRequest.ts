import { datasetSchema } from '@dashboard/contracts';
import { z } from 'zod';

import { processWorkerRequest } from './processWorkerRequest.js';

import { ChunkProcessingCancelledError, processDatasetChunks } from './processDatasetChunks.js';

import { createWorkerTaskManager } from './workerTaskManager.js';

import type { WorkerRuntimeResponse } from './workerMessages.js';

export interface WorkerRuntime {
  handleRequest: (input: unknown, emit: (response: WorkerRuntimeResponse) => void) => Promise<void>;
}

export function createWorkerRuntime(yieldControl: () => Promise<void>): WorkerRuntime {
  const manager = createWorkerTaskManager();

  const handleRequest = async (
    input: unknown,
    emit: (response: WorkerRuntimeResponse) => void,
  ): Promise<void> => {
    const parsed = runtimeRequestSchema.safeParse(input);
    if (!parsed.success) {
      const id = z.object({ taskId: z.string() }).safeParse(input);
      emit({
        taskId: id.success ? id.data.taskId : 'invalid',
        status: 'error',
        message: 'Invalid Worker request',
      });
      return;
    }
    const request = parsed.data;
    if (request.type === 'cancel') {
      manager.cancelTask(request.taskId);
      return;
    }

    if (request.type !== 'process-chunks') {
      emit(processWorkerRequest(request));
      return;
    }

    let signal: AbortSignal;

    try {
      signal = manager.startTask(request.taskId);
    } catch (error) {
      emit({
        taskId: request.taskId,
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return;
    }

    let processedRows = 0;

    try {
      await processDatasetChunks(request.taskId, request.dataset, {
        chunkSize: request.chunkSize,
        signal,
        yieldControl,
        processChunk: (rows) => {
          processedRows += rows.length;
        },
        onProgress: emit,
      });

      emit({
        taskId: request.taskId,
        status: 'success',
        type: 'process-chunks',
        result: { processedRows },
      });
    } catch (error) {
      if (error instanceof ChunkProcessingCancelledError) {
        emit({
          taskId: request.taskId,
          status: 'cancelled',
        });
      } else {
        emit({
          taskId: request.taskId,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      manager.finishTask(request.taskId);
    }
  };

  return { handleRequest };
}

const base = { taskId: z.string().min(1), dataset: datasetSchema };
const runtimeRequestSchema = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('dataset-summary') }),
  z.object({ ...base, type: z.literal('column-statistics'), columnId: z.string().min(1) }),
  z.object({ ...base, type: z.literal('missing-values') }),
  z.object({ ...base, type: z.literal('process-chunks'), chunkSize: z.number().int().positive() }),
  z.object({ taskId: z.string().min(1), type: z.literal('cancel') }),
]);
