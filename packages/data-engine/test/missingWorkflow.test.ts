import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  startMissingWorkflow,
  executeMissingWorkflow,
  undoMissingWorkflow,
  redoMissingWorkflow,
} from '../src/missing/missingWorkflow.js';

describe('missingWorkflow integration', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [
      { id: 'c1', name: 'Name', type: 'text' },
      { id: 'c2', name: 'Age', type: 'number' },
    ],
    rows: [
      { id: 'r1', cells: { c1: 'An', c2: 20 } },
      { id: 'r2', cells: { c1: null, c2: null } },
      { id: 'r3', cells: { c1: 'Chi', c2: 30 } },
    ],
  };

  it('applies missing-value cleaning and saves a version', () => {
    const history = startMissingWorkflow(dataset);

    const result = executeMissingWorkflow(
      history,
      [
        { columnId: 'c1', strategy: 'constant', value: 'Unknown' },
        { columnId: 'c2', strategy: 'mean' },
      ],
      'v2',
    );

    expect(result.dataset.versionId).toBe('v2');
    expect(result.dataset.rows[1]?.cells).toEqual({
      c1: 'Unknown',
      c2: 25,
    });
    expect(result.history.versions).toHaveLength(2);
  });

  it('supports undo and redo after cleaning', () => {
    const history = startMissingWorkflow(dataset);

    const cleaned = executeMissingWorkflow(history, [{ columnId: 'c2', strategy: 'mean' }], 'v2');

    const undone = undoMissingWorkflow(cleaned.history);

    expect(undone.dataset.versionId).toBe('v1');
    expect(undone.dataset.rows[1]?.cells['c2']).toBeNull();

    const redone = redoMissingWorkflow(undone.history);

    expect(redone.dataset.versionId).toBe('v2');
    expect(redone.dataset.rows[1]?.cells['c2']).toBe(25);
  });

  it('does not modify the original dataset', () => {
    const original = structuredClone(dataset);
    const history = startMissingWorkflow(dataset);

    executeMissingWorkflow(history, [{ columnId: 'c2', strategy: 'mean' }], 'v2');

    expect(dataset).toEqual(original);
  });

  it('rejects invalid cleaning requests without changing history', () => {
    const history = startMissingWorkflow(dataset);
    const originalHistory = structuredClone(history);

    expect(() =>
      executeMissingWorkflow(history, [{ columnId: 'c1', strategy: 'mean' }], 'v2'),
    ).toThrow();

    expect(history).toEqual(originalHistory);
  });
});
