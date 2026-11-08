import { describe, expect, it } from 'vitest';
import { demoDataset } from '../demo/demoDataset';
import { demoPreview } from '../demo/demoPreview';
import { buildFillConfig, isPreviewCurrent, parseFillValue } from './previewRules';

const missingAge = { versionId: 'demo-v1', rowId: 'row-003', columnId: 'col-age' };

describe('Pre-processing UI safety rules', () => {
  it('rejects an unsafe numeric fill value', () => {
    expect(parseFillValue('number', '9007199254740994').valid).toBe(false);
    expect(parseFillValue('number', 'abc').valid).toBe(false);
    expect(parseFillValue('number', '22')).toEqual({ valid: true, value: 22 });
  });
  it('only builds a fill-cell operation for current missing cells', () => {
    expect(buildFillConfig(demoDataset, missingAge, '22')).toMatchObject({ method: 'fill-cell', value: 22 });
    expect(buildFillConfig(demoDataset, { ...missingAge, versionId: 'old-version' }, '22')).toBeNull();
    expect(buildFillConfig(demoDataset, { ...missingAge, rowId: 'row-001' }, '22')).toBeNull();
  });
  it('invalidates a preview when parameters change', async () => {
    const config = buildFillConfig(demoDataset, missingAge, '22');
    expect(config).not.toBeNull();
    if (!config) return;
    const preview = await demoPreview(config);
    expect(isPreviewCurrent(preview, config, demoDataset)).toBe(true);
    expect(isPreviewCurrent(preview, { ...config, value: 23 }, demoDataset)).toBe(false);
    expect(isPreviewCurrent(preview, { ...config, selection: { ...missingAge, rowId: 'row-004' } }, demoDataset)).toBe(false);
    expect(isPreviewCurrent({ ...preview, baseVersionId: 'old-version' }, config, demoDataset)).toBe(false);
  });
});
