import { isNumericValue } from '@dashboard/data-engine';
import type { Dataset } from '@dashboard/contracts';
import { fillCellConfigSchema, previewSchema } from '@dashboard/contracts';
import { z } from 'zod';
import type { CellSelection } from '../../components/DatasetTable';

export type FillCellConfig = z.infer<typeof fillCellConfigSchema>;
export type PreviewResult = z.infer<typeof previewSchema>;

export function parseFillValue(
  columnType: Dataset['columns'][number]['type'],
  raw: string,
): { valid: true; value: string | number | boolean } | { valid: false; reason: string } {
  if (columnType === 'number') {
    if (raw.trim() === '') return { valid: false, reason: 'Enter a number.' };
    const numberValue = Number(raw);
    if (
      !isNumericValue(raw) ||
      !Number.isFinite(numberValue) ||
      (Number.isInteger(numberValue) && !Number.isSafeInteger(numberValue))
    ) {
      return { valid: false, reason: 'Enter a finite number without losing precision.' };
    }
    return { valid: true, value: numberValue };
  }
  if (columnType === 'boolean') {
    if (raw !== 'true' && raw !== 'false') return { valid: false, reason: 'Select true or false.' };
    return { valid: true, value: raw === 'true' };
  }
  if (columnType === 'date' && z.iso.date().safeParse(raw).success)
    return { valid: true, value: raw };
  if (columnType === 'datetime' && z.iso.datetime({ offset: true }).safeParse(raw).success)
    return { valid: true, value: new Date(raw).toISOString() };
  if (columnType === 'text') return { valid: true, value: raw };
  return {
    valid: false,
    reason: 'Use ISO YYYY-MM-DD for dates and include a timezone for datetimes.',
  };
}

export function buildFillConfig(
  dataset: Dataset,
  selection: CellSelection | null,
  raw: string,
): FillCellConfig | null {
  if (!selection || selection.versionId !== dataset.versionId) return null;
  const column = dataset.columns.find((item) => item.id === selection.columnId);
  const row = dataset.rows.find((item) => item.id === selection.rowId);
  if (!column || !row || row.cells[column.id] !== null) return null;
  const parsed = parseFillValue(column.type, raw);
  if (!parsed.valid) return null;
  const result = fillCellConfigSchema.safeParse({
    method: 'fill-cell',
    selection,
    value: parsed.value,
  });
  return result.success ? result.data : null;
}

export function isPreviewCurrent(
  preview: PreviewResult | null,
  config: FillCellConfig | null,
  dataset: Dataset,
): boolean {
  if (!preview || !config || preview.baseVersionId !== dataset.versionId) return false;
  if (!previewSchema.safeParse(preview).success) return false;
  const previous = preview.configuration;
  return (
    previous.selection.versionId === config.selection.versionId &&
    previous.selection.rowId === config.selection.rowId &&
    previous.selection.columnId === config.selection.columnId &&
    Object.is(previous.value, config.value)
  );
}
