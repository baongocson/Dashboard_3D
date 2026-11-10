
import type {
  WorkerRequest,
  WorkerResponse,
} from './workerMessages.js';

export interface DataEngineWorkerClient {
  postMessage: (request: WorkerRequest) => void;

  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) => void;

  removeEventListener: (
    type: 'message',
    listener: (event: MessageEvent<WorkerResponse>) => void,
  ) => void;
}

export function sendWorkerRequest(
  worker: DataEngineWorkerClient,
  request: WorkerRequest,
  onResponse: (response: WorkerResponse) => void,
): void {
  const handleMessage = (
    event: MessageEvent<WorkerResponse>,
  ): void => {
    if (event.data.taskId !== request.taskId) {
      return;
    }

    worker.removeEventListener(
      'message',
      handleMessage,
    );

    onResponse(event.data);
  };

  worker.addEventListener('message', handleMessage);
  worker.postMessage(request);
}
