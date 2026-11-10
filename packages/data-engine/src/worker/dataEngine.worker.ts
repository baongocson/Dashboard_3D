import { createWorkerRuntime } from './processWorkerRuntimeRequest.js';

import type { WorkerRuntimeRequest, WorkerRuntimeResponse } from './workerMessages.js';

interface DataEngineWorkerScope {
  postMessage: (message: WorkerRuntimeResponse) => void;
}

const workerScope: DataEngineWorkerScope = self;

const runtime = createWorkerRuntime(() => {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
});

self.addEventListener('message', (event: MessageEvent<WorkerRuntimeRequest>): void => {
  void runtime.handleRequest(event.data, (response) => {
    workerScope.postMessage(response);
  });
});
