

import { describe, expect, it, vi } from 'vitest';

import type {
  WorkerRequest,
  WorkerResponse,
} from '../src/worker/workerMessages.js';

import {
  sendWorkerRequest,
} from '../src/worker/createDataEngineWorker.js';

describe('sendWorkerRequest', () => {
  it('sends a request and receives the matching response', () => {
    let messageHandler:
      | ((event: MessageEvent<WorkerResponse>) => void)
      | undefined;

    const postMessage = vi.fn();

    const addEventListener = vi.fn(
      (
        type: string,
        listener: (
          event: MessageEvent<WorkerResponse>
        ) => void,
      ): void => {
        if (type === 'message') {
          messageHandler = listener;
        }
      },
    );

    const removeEventListener = vi.fn();

    const worker = {
      postMessage,
      addEventListener,
      removeEventListener,
    };

    const request: WorkerRequest = {
      taskId: 'task-1',
      type: 'dataset-summary',
      dataset: {
        versionId: 'v1',
        columns: [
          { id: 'c1', name: 'Age', type: 'number' },
        ],
        rows: [],
      },
    };

    const onResponse = vi.fn();

    sendWorkerRequest(
      worker,
      request,
      onResponse,
    );

    expect(postMessage).toHaveBeenCalledWith(request);

    const response: WorkerResponse = {
      taskId: 'task-1',
      status: 'success',
      type: 'dataset-summary',
      result: {
        rowCount: 0,
        columnCount: 1,
        cellCount: 0,
        missingCellCount: 0,
        nonMissingCellCount: 0,
      },
    };

    if (messageHandler === undefined) {
      throw new Error('Message handler was not registered');
    }

    messageHandler(
      new MessageEvent('message', { data: response }),
    );

    expect(onResponse).toHaveBeenCalledWith(response);
    expect(removeEventListener).toHaveBeenCalledOnce();
  });
});
