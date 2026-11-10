
import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  createMissingProposals,
} from '../src/missing/createMissingProposals.js';

describe('createMissingProposals', () => {
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

  it('proposes a constant value for missing text', () => {
    const proposals = createMissingProposals(dataset, [
      { columnId: 'c1', strategy: 'constant', value: 'Unknown' },
    ]);

    expect(proposals).toEqual([
      {
        columnId: 'c1',
        columnName: 'Name',
        strategy: 'constant',
        proposedValue: 'Unknown',
        affectedRowIds: ['r2'],
      },
    ]);
  });

  it('proposes the mean for missing numeric values', () => {
    const proposals = createMissingProposals(dataset, [
      { columnId: 'c2', strategy: 'mean' },
    ]);

    expect(proposals[0]?.proposedValue).toBe(25);
    expect(proposals[0]?.affectedRowIds).toEqual(['r2']);
  });

  it('rejects mean strategy for text columns', () => {
    expect(() =>
      createMissingProposals(dataset, [
        { columnId: 'c1', strategy: 'mean' },
      ]),
    ).toThrow('Mean strategy requires a numeric column');
  });

  it('rejects duplicate requests for one column', () => {
    expect(() =>
      createMissingProposals(dataset, [
        { columnId: 'c1', strategy: 'constant', value: 'Unknown' },
        { columnId: 'c1', strategy: 'constant', value: 'N/A' },
      ]),
    ).toThrow('Duplicate fill request');
  });

  it('does not modify the original dataset', () => {
    const original = structuredClone(dataset);

    createMissingProposals(dataset, [
      { columnId: 'c2', strategy: 'mean' },
    ]);

    expect(dataset).toEqual(original);
  });
});
