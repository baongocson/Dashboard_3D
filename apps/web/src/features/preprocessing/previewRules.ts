import type { Dataset } from '@dashboard/contracts';
import { fillCellConfigSchema, previewSchema } from '@dashboard/contracts';
import type { z } from 'zod';
import type { CellSelection } from '../../components/DatasetTable';

export type FillCellConfig = z.infer<typeof fillCellConfigSchema>;
export type PreviewResult = z.infer<typeof previewSchema>;

export function parseFillValue(columnType: Dataset['columns'][number]['type'], raw: string): { valid: true; value: string | number | boolean } | { valid: false; reason: string } {
  if (columnType === 'number') {
    if (raw.trim() === '') return { valid: false, reason: 'Hãy nhập một số.' };
    const numberValue = Number(raw);
    if (!Number.isFinite(numberValue) || (Number.isInteger(numberValue) && !Number.isSafeInteger(numberValue))) {
      return { valid: false, reason: 'Phải là số hữu hạn, không mất độ chính xác.' };
    }
    return { valid: true, value: numberValue };
  }
  if (columnType === 'boolean') {
    if (raw !== 'true' && raw !== 'false') return { valid: false, reason: 'Chọn true hoặc false.' };
    return { valid: true, value: raw === 'true' };
  }
  if (columnType === 'text') return { valid: true, value: raw };
  return { valid: false, reason: 'Form mẫu chưa xử lý kiểu ngày. Cần UI chọn ngày được xác thực.' };
}

export function buildFillConfig(dataset: Dataset, selection: CellSelection | null, raw: string): FillCellConfig | null {
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

export function isPreviewCurrent(preview: PreviewResult | null, config: FillCellConfig | null, dataset: Dataset): boolean {
  if (!preview || !config || preview.baseVersionId !== dataset.versionId) return false;
  if (!previewSchema.safeParse(preview).success) return false;
  const previous = preview.configuration;
  return previous.selection.versionId === config.selection.versionId
    && previous.selection.rowId === config.selection.rowId
    && previous.selection.columnId === config.selection.columnId
    && Object.is(previous.value, config.value);
}
