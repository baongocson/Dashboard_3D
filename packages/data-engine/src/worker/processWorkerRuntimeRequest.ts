
import { processWorkerRequest } from './processWorkerRequest.js';

import {
  ChunkProcessingCancelledError,
  processDatasetChunks,
} from './processDatasetChunks.js';

import {
  createWorkerTaskManager,
} from './workerTaskManager.js';

import type {
  WorkerRuntimeRequest,
  WorkerRuntimeResponse,
} from './workerMessages.js';

export interface WorkerRuntime {
  handleRequest: (
    request: WorkerRuntimeRequest,
    emit: (response: WorkerRuntimeResponse) => void,
  ) => Promise<void>;
}

export function createWorkerRuntime(
  yieldControl: () => Promise<void>,
): WorkerRuntime {
  const manager = createWorkerTaskManager();

  const handleRequest = async (
    request: WorkerRuntimeRequest,
    emit: (response: WorkerRuntimeResponse) => void,
  ): Promise<void> => {
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
