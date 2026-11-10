
import type { Cell, Dataset } from '@dashboard/contracts';

export interface ColumnStatistics {
  columnId: string;
  columnName: string;
  columnType: Dataset['columns'][number]['type'];
  totalCount: number;
  missingCount: number;
  validCount: number;
  uniqueCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
}

export function getColumnStatistics(
  dataset: Dataset,
  columnId: string,
): ColumnStatistics {
  const column = dataset.columns.find(
    (item) => item.id === columnId,
  );

  if (column === undefined) {
    throw new Error(`Column not found: ${columnId}`);
  }

  const values: Cell[] = dataset.rows.map(
    (row) => row.cells[columnId] ?? null,
  );

  const validValues = values.filter(
    (value) => value !== null,
  );

  const numericValues =
    column.type === 'number'
      ? validValues.filter(
          (value): value is number => typeof value === 'number',
        )
      : [];

  const uniqueCount = new Set(validValues).size;

  let min: number | null = null;
  let max: number | null = null;
  let mean: number | null = null;



if (numericValues.length > 0) {
  let runningMean = 0;
  let processed = 0;

  for (const value of numericValues) {
    min = min === null ? value : Math.min(min, value);
    max = max === null ? value : Math.max(max, value);

    processed += 1;
    runningMean += (value - runningMean) / processed;
  }

  mean = runningMean;
}



  return {
    columnId: column.id,
    columnName: column.name,
    columnType: column.type,
    totalCount: values.length,
    missingCount: values.length - validValues.length,
    validCount: validValues.length,
    uniqueCount,
    min,
    max,
    mean,
  };
}
