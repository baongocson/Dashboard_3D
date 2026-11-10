import { describe, expect, it } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import { createMissingProposals } from '../src/missing/createMissingProposals.js';

import { applyMissingProposals } from '../src/missing/applyMissingProposals.js';

describe('applyMissingProposals', () => {
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

  it('applies proposals to a new dataset version', () => {
    const proposals = createMissingProposals(dataset, [
      { columnId: 'c1', strategy: 'constant', value: 'Unknown' },
      { columnId: 'c2', strategy: 'mean' },
    ]);

    const result = applyMissingProposals(dataset, proposals, 'v2');

    expect(result.versionId).toBe('v2');
    expect(result.rows[1]?.cells).toEqual({
      c1: 'Unknown',
      c2: 25,
    });
  });

  it('does not mutate the original dataset', () => {
    const original = structuredClone(dataset);

    const proposals = createMissingProposals(dataset, [{ columnId: 'c2', strategy: 'mean' }]);

    applyMissingProposals(dataset, proposals, 'v2');

    expect(dataset).toEqual(original);
  });

  it('rejects the same version ID', () => {
    expect(() => applyMissingProposals(dataset, [], 'v1')).toThrow('New version ID must differ');
  });

  it('rejects proposals for unknown rows', () => {
    expect(() =>
      applyMissingProposals(
        dataset,
        [
          {
            baseVersionId: 'v1',
            columnId: 'c2',
            columnName: 'Age',
            strategy: 'constant',
            proposedValue: 25,
            affectedRowIds: ['unknown'],
          },
        ],
        'v2',
      ),
    ).toThrow('Row not found');
  });

  it('rejects proposals targeting non-missing cells', () => {
    expect(() =>
      applyMissingProposals(
        dataset,
        [
          {
            baseVersionId: 'v1',
            columnId: 'c2',
            columnName: 'Age',
            strategy: 'constant',
            proposedValue: 25,
            affectedRowIds: ['r1'],
          },
        ],
        'v2',
      ),
    ).toThrow('Cell is not missing');
  });

  it('rejects invalid values using the dataset schema', () => {
    expect(() =>
      applyMissingProposals(
        dataset,
        [
          {
            baseVersionId: 'v1',
            columnId: 'c2',
            columnName: 'Age',
            strategy: 'constant',
            proposedValue: 'invalid',
            affectedRowIds: ['r2'],
          },
        ],
        'v2',
      ),
    ).toThrow();
  });
});
