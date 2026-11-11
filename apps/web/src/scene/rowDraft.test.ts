import { describe, it, expect } from 'vitest';
import type { Dataset } from '@dashboard/contracts';
import { draftFor, validateDraft } from './rowDraft';
const columns: Dataset['columns'] = [
  { id: 'n', name: 'User ID', type: 'number' },
  { id: 'b', name: 'Flag', type: 'boolean' },
  { id: 's', name: 'Text', type: 'text' },
  { id: 'd', name: 'Date', type: 'date' },
];
const row = { id: 'internal-readonly', cells: { n: 0, b: false, s: '', d: '2024-02-29' } };
describe('inline row draft validation', () => {
  it('preserves zero, false, empty text and user data IDs', () => {
    const result = validateDraft(columns, draftFor(row, columns));
    expect(result.errors).toEqual({});
    expect(result.values).toEqual(row.cells);
  });
  it.each(['', 'NaN', 'Infinity', 'oops', '9007199254740993', '0x10'])(
    'rejects invalid numeric input %s without overwriting draft',
    (raw) => {
      const draft = draftFor(row, columns);
      draft.n = { raw, missing: false };
      expect(validateDraft(columns, draft).errors.n).toBeTruthy();
      expect(draft.n.raw).toBe(raw);
    },
  );
  it('only makes null explicit and rejects invalid booleans/dates', () => {
    const draft = draftFor(row, columns);
    draft.n = { raw: '0', missing: true };
    draft.b = { raw: '0', missing: false };
    draft.d = { raw: '2024-02-30', missing: false };
    const parsed = validateDraft(columns, draft);
    expect(parsed.values.n).toBeNull();
    expect(parsed.errors.b).toBeTruthy();
    expect(parsed.errors.d).toBeTruthy();
  });
});
