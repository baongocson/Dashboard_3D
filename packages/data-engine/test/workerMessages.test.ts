import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import type { WorkerRequest, WorkerResponse } from '../src/worker/workerMessages.js';

describe('worker message contracts', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [{ id: 'c1', name: 'Age', type: 'number' }],
    rows: [{ id: 'r1', cells: { c1: 20 } }],
  };

  it('supports dataset summary requests', () => {
    const request: WorkerRequest = {
      taskId: 'task-1',
      type: 'dataset-summary',
      dataset,
    };

    expect(request.type).toBe('dataset-summary');
    expect(request.taskId).toBe('task-1');
  });

  it('supports column statistics requests', () => {
    const request: WorkerRequest = {
      taskId: 'task-2',
      type: 'column-statistics',
      dataset,
      columnId: 'c1',
    };

    expect(request.type).toBe('column-statistics');
    expect(request.columnId).toBe('c1');
  });

  it('supports missing-value requests', () => {
    const request: WorkerRequest = {
      taskId: 'task-3',
      type: 'missing-values',
      dataset,
    };

    expect(request.type).toBe('missing-values');
  });

  it('supports error responses', () => {
    const response: WorkerResponse = {
      taskId: 'task-4',
      status: 'error',
      message: 'Processing failed',
    };

    expect(response.status).toBe('error');
    expect(response.message).toBe('Processing failed');
  });
});
