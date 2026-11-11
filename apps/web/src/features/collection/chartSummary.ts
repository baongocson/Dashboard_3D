import type { Dataset } from '@dashboard/contracts';
import { quantile } from '../../../../../packages/data-engine/src/operations';
export function missingByColumn(dataset: Dataset) {
  return dataset.columns.map((column) => {
    const count = dataset.rows.reduce((n, row) => n + (row.cells[column.id] === null ? 1 : 0), 0);
    return {
      id: column.id,
      name: column.name,
      count,
      percent: dataset.rows.length ? (count / dataset.rows.length) * 100 : 0,
      total: dataset.rows.length,
    };
  });
}
export function boxSummary(dataset: Dataset, columnId: string) {
  const values: { rowId: string; value: number }[] = [];
  let missing = 0,
    invalid = 0;
  for (const row of dataset.rows) {
    const v = row.cells[columnId];
    if (v === null) missing++;
    else if (typeof v === 'number' && Number.isFinite(v)) values.push({ rowId: row.id, value: v });
    else invalid++;
  }
  const sorted = values.map((v) => v.value).sort((a, b) => a - b);
  if (!sorted.length) return { valid: 0, missing, invalid, stats: null, outliers: [] };
  const q1 = quantile(sorted, 0.25),
    q2 = quantile(sorted, 0.5),
    q3 = quantile(sorted, 0.75),
    iqr = q3 - q1;
  const inside = sorted.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  const low = inside[0] ?? q1,
    high = inside.at(-1) ?? q3;
  return {
    valid: sorted.length,
    missing,
    invalid,
    stats: { q1, q2, q3, low, high, min: sorted[0] ?? 0, max: sorted.at(-1) ?? 0 },
    outliers: values.filter((v) => v.value < q1 - 1.5 * iqr || v.value > q3 + 1.5 * iqr),
  };
}
