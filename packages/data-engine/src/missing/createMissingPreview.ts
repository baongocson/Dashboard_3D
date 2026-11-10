import type { Dataset } from '@dashboard/contracts';

import { detectMissingValues } from './detectMissingValues.js';

export interface MissingPreviewItem {
  rowId: string;
  rowIndex: number;
  columnId: string;
  columnName: string;
  columnIndex: number;
}

export interface MissingPreview {
  totalMissingCells: number;
  items: MissingPreviewItem[];
  hasMore: boolean;
}

export function createMissingPreview(dataset: Dataset, limit = 100): MissingPreview {
  if (!Number.isSafeInteger(limit) || limit < 0) {
    throw new Error('Preview limit must be a non-negative safe integer');
  }

  const report = detectMissingValues(dataset);

  const rowIndexById = new Map(dataset.rows.map((row, index) => [row.id, index]));

  const columnIndexById = new Map(dataset.columns.map((column, index) => [column.id, index]));

  const columnNameById = new Map(dataset.columns.map((column) => [column.id, column.name]));

  const items: MissingPreviewItem[] = report.missingCells.slice(0, limit).map((cell) => ({
    rowId: cell.rowId,
    rowIndex: rowIndexById.get(cell.rowId) ?? -1,
    columnId: cell.columnId,
    columnName: columnNameById.get(cell.columnId) ?? '',
    columnIndex: columnIndexById.get(cell.columnId) ?? -1,
  }));

  return {
    totalMissingCells: report.totalMissingCells,
    items,
    hasMore: report.totalMissingCells > items.length,
  };
}
