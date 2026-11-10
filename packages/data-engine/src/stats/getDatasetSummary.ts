
import type { Dataset } from '@dashboard/contracts';

export interface DatasetSummary {
  rowCount: number;
  columnCount: number;
  cellCount: number;
  missingCellCount: number;
  nonMissingCellCount: number;
}

export function getDatasetSummary(
  dataset: Dataset,
): DatasetSummary {
  const rowCount = dataset.rows.length;
  const columnCount = dataset.columns.length;
  const cellCount = rowCount * columnCount;

  let missingCellCount = 0;

  for (const row of dataset.rows) {
    for (const column of dataset.columns) {
      if (row.cells[column.id] === null) {
        missingCellCount += 1;
      }
    }
  }

  return {
    rowCount,
    columnCount,
    cellCount,
    missingCellCount,
    nonMissingCellCount: cellCount - missingCellCount,
  };
}
