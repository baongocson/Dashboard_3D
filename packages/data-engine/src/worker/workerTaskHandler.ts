
import {
  createWorkerTaskManager,
} from './workerTaskManager.js';

import type {
  WorkerCancelRequest,
  WorkerCancelledResponse,
} from './workerMessages.js';

export interface WorkerTaskHandler {
  start: (taskId: string) => AbortSignal;
  cancel: (request: WorkerCancelRequest) => WorkerCancelledResponse | null;
  finish: (taskId: string) => void;
  isActive: (taskId: string) => boolean;
}

export function createWorkerTaskHandler(): WorkerTaskHandler {
  const manager = createWorkerTaskManager();

  return {
    start: (taskId) => manager.startTask(taskId),

    cancel: (request) => {
      const cancelled = manager.cancelTask(request.taskId);

      if (!cancelled) {
        return null;
      }

      return {
        taskId: request.taskId,
        status: 'cancelled',
      };
    },


finish: (taskId) => {
  manager.finishTask(taskId);
},

    isActive: (taskId) => manager.hasTask(taskId),
  };
}
