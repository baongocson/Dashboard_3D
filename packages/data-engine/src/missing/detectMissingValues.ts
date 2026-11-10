
import type { Dataset } from '@dashboard/contracts';

export interface MissingCell {
  rowId: string;
  columnId: string;
}

export interface MissingColumnSummary {
  columnId: string;
  columnName: string;
  missingCount: number;
  missingPercentage: number;
}

export interface MissingValuesReport {
  totalMissingCells: number;
  totalCells: number;
  missingPercentage: number;
  missingCells: MissingCell[];
  columns: MissingColumnSummary[];
}

export function detectMissingValues(
  dataset: Dataset,
): MissingValuesReport {
  const missingCells: MissingCell[] = [];
  const columns: MissingColumnSummary[] = [];

  const totalCells =
    dataset.rows.length * dataset.columns.length;

  for (const column of dataset.columns) {
    let missingCount = 0;

    for (const row of dataset.rows) {
      if (row.cells[column.id] === null) {
        missingCount += 1;
        missingCells.push({
          rowId: row.id,
          columnId: column.id,
        });
      }
    }

    columns.push({
      columnId: column.id,
      columnName: column.name,
      missingCount,
      missingPercentage:
        dataset.rows.length === 0
          ? 0
          : (missingCount / dataset.rows.length) * 100,
    });
  }

  return {
    totalMissingCells: missingCells.length,
    totalCells,
    missingPercentage:
      totalCells === 0
        ? 0
        : (missingCells.length / totalCells) * 100,
    missingCells,
    columns,
  };
}
