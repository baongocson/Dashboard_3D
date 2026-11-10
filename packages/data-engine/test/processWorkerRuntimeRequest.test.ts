
import { describe, expect, it, vi } from 'vitest';

import type { Dataset } from '@dashboard/contracts';

import {
  createWorkerRuntime,
} from '../src/worker/processWorkerRuntimeRequest.js';

import type {
  WorkerRuntimeResponse,
} from '../src/worker/workerMessages.js';

describe('createWorkerRuntime', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [
      { id: 'c1', name: 'Age', type: 'number' },
    ],
    rows: [
      { id: 'r1', cells: { c1: 10 } },
      { id: 'r2', cells: { c1: 20 } },
      { id: 'r3', cells: { c1: 30 } },
      { id: 'r4', cells: { c1: 40 } },
      { id: 'r5', cells: { c1: 50 } },
    ],
  };

  it('reports progress and completes a chunk task', async () => {
    const runtime = createWorkerRuntime(async () => {
      await Promise.resolve();
    });

    const responses: WorkerRuntimeResponse[] = [];

    await runtime.handleRequest(
      {
        taskId: 'task-1',
        type: 'process-chunks',
        dataset,
        chunkSize: 2,
      },
      (response) => {
        responses.push(response);
      },
    );

    const progress = responses.filter(
      (response) => response.status === 'progress',
    );

    expect(progress).toHaveLength(3);
    expect(progress.map((item) => item.completed)).toEqual([2, 4, 5]);
    expect(progress.map((item) => item.percentage)).toEqual([40, 80, 100]);

    expect(responses.at(-1)).toEqual({
      taskId: 'task-1',
      status: 'success',
      type: 'process-chunks',
      result: { processedRows: 5 },
    });
  });

  it('cancels a task between chunks', async () => {
    let releaseChunk: (() => void) | undefined;

    const runtime = createWorkerRuntime(() => {
      return new Promise<void>((resolve) => {
        releaseChunk = resolve;
      });
    });

    const responses: WorkerRuntimeResponse[] = [];

    const runningTask = runtime.handleRequest(
      {
        taskId: 'task-cancel',
        type: 'process-chunks',
        dataset,
        chunkSize: 2,
      },
      (response) => {
        responses.push(response);
      },
    );

    await vi.waitFor(() => {
      expect(releaseChunk).toBeDefined();
    });

    await runtime.handleRequest(
      {
        taskId: 'task-cancel',
        type: 'cancel',
      },
      (response) => {
        responses.push(response);
      },
    );

    if (releaseChunk === undefined) {
      throw new Error('Chunk was not paused');
    }

    releaseChunk();

    await runningTask;

    expect(responses.some(
      (response) => response.status === 'cancelled',
    )).toBe(true);

    expect(responses.some(
      (response) => response.status === 'success',
    )).toBe(false);
  });

  it('keeps existing dataset-summary requests working', async () => {
    const runtime = createWorkerRuntime(async () => {
      await Promise.resolve();
    });

    const responses: WorkerRuntimeResponse[] = [];

    await runtime.handleRequest(
      {
        taskId: 'task-summary',
        type: 'dataset-summary',
        dataset,
      },
      (response) => {
        responses.push(response);
      },
    );

    expect(responses).toHaveLength(1);
    expect(responses[0]).toMatchObject({
      taskId: 'task-summary',
      status: 'success',
      type: 'dataset-summary',
    });
  });
});
