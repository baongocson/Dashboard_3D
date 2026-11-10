
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  processWorkerRequest,
} from '../src/worker/processWorkerRequest.js';

describe('processWorkerRequest', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [
      { id: 'c1', name: 'Age', type: 'number' },
    ],
    rows: [
      { id: 'r1', cells: { c1: 20 } },
      { id: 'r2', cells: { c1: null } },
      { id: 'r3', cells: { c1: 30 } },
    ],
  };

  it('processes dataset summary requests', () => {
    const response = processWorkerRequest({
      taskId: 'task-1',
      type: 'dataset-summary',
      dataset,
    });

    expect(response.taskId).toBe('task-1');
    expect(response.status).toBe('success');

    if (
      response.status === 'success' &&
      response.type === 'dataset-summary'
    ) {
      expect(response.result.rowCount).toBe(3);
      expect(response.result.columnCount).toBe(1);
    }
  });

  it('processes column statistics requests', () => {
    const response = processWorkerRequest({
      taskId: 'task-2',
      type: 'column-statistics',
      dataset,
      columnId: 'c1',
    });

    expect(response.status).toBe('success');

    if (
      response.status === 'success' &&
      response.type === 'column-statistics'
    ) {
      expect(response.result.mean).toBe(25);
      expect(response.result.missingCount).toBe(1);
    }
  });

  it('processes missing-value requests', () => {
    const response = processWorkerRequest({
      taskId: 'task-3',
      type: 'missing-values',
      dataset,
    });

    expect(response.status).toBe('success');

    if (
      response.status === 'success' &&
      response.type === 'missing-values'
    ) {
      expect(response.result.totalMissingCells).toBe(1);
    }
  });

  it('returns an error for unknown columns', () => {
    const response = processWorkerRequest({
      taskId: 'task-4',
      type: 'column-statistics',
      dataset,
      columnId: 'unknown',
    });

    expect(response.taskId).toBe('task-4');
    expect(response.status).toBe('error');
  });
});
