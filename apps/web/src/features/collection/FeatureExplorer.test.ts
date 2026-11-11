import { it, expect } from 'vitest';
import type { Dataset } from '@dashboard/contracts';
import { valueCounts } from './FeatureExplorer';
it('counts all typed values and allows explicit null exclusion', () => {
  const d: Dataset = {
    versionId: 'counts',
    columns: [{ id: 'x', name: 'x', type: 'number' }],
    rows: [0, 0, 1, null].map((x, i) => ({ id: String(i), cells: { x } })),
  };
  expect(valueCounts(d, 'x')).toEqual([
    { value: 0, count: 2 },
    { value: 1, count: 1 },
    { value: null, count: 1 },
  ]);
  expect(valueCounts(d, 'x', false)).toHaveLength(2);
});
