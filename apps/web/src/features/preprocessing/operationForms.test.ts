import { describe, it, expect } from 'vitest';
import type { Dataset } from '@dashboard/contracts';
import { parseReplacements, categoryValues, orderedCategories } from './operationForms';
import { methods } from './Workbench';
const data: Dataset = {
  versionId: 'test',
  columns: [
    { id: 'g', name: 'Group', type: 'text' },
    { id: 'n', name: 'Number', type: 'number' },
  ],
  rows: [
    { id: 'a', cells: { g: 'low', n: 0 } },
    { id: 'b', cells: { g: 'high', n: null } },
    { id: 'c', cells: { g: 'low', n: 1 } },
  ],
};
describe('preprocessing configuration', () => {
  it('lists observed groups and enforces explicit consecutive ranks', () => {
    expect(categoryValues(data, 'g')).toEqual(['low', 'high']);
    expect(() => categoryValues(data, 'n')).toThrow();
    expect(
      orderedCategories(['low', 'high'], { '["g","low"]': '1', '["g","high"]': '0' }, 'g'),
    ).toEqual(['high', 'low']);
    expect(() => orderedCategories(['low', 'high'], {}, 'g')).toThrow();
    expect(() =>
      orderedCategories(['low', 'high'], { '["g","low"]': '0', '["g","high"]': '0' }, 'g'),
    ).toThrow();
  });
  it('validates typed replacement inputs including zero and null', () => {
    const c = data.columns[1];
    if (!c) throw new Error('fixture');
    expect(
      parseReplacements(c, [{ from: '0', to: '', fromMissing: false, toMissing: true }]),
    ).toEqual([{ from: 0, to: null }]);
    expect(() =>
      parseReplacements(c, [{ from: 'NaN', to: '1', fromMissing: false, toMissing: false }]),
    ).toThrow();
  });
  it('removes deprecated choices from the UI', () => {
    expect(methods.missing?.map(([m]) => m)).not.toEqual(
      expect.arrayContaining(['forward', 'backward', 'drop-missing', 'interpolate']),
    );
    expect(methods.scaling?.map(([m]) => m)).not.toContain('robust');
    expect(methods.transformation?.map(([m]) => m)).not.toContain('yeojohnson');
    expect(methods.cleaning?.map(([m]) => m)).not.toContain('missing-token');
  });
});

it('uses English section, method and data type labels', () => {
  const forbidden = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
  for (const choices of Object.values(methods))
    for (const [, label] of choices) expect(label).not.toMatch(forbidden);
  expect(methods.missing?.map(([id]) => id)).not.toContain('interpolate');
});
