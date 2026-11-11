import type { Dataset } from '@dashboard/contracts';
export type Vec3 = [number, number, number];
export const LOW = -4;
export const HIGH = 4;
export const AXIS_NAMES = ['X', 'Y', 'Z'] as const;
export interface Axis {
  id: string;
  columnId?: string;
  label: string;
  values: (number | null)[];
  min: number | null;
  max: number | null;
}
export function coordinate(value: number, axis: Pick<Axis, 'min' | 'max'>): number {
  if (axis.min === null || axis.max === null || !Number.isFinite(value)) return NaN;
  return axis.max === axis.min
    ? 0
    : LOW + ((value - axis.min) / (axis.max - axis.min)) * (HIGH - LOW);
}
export function ticks(axis: Axis) {
  if (axis.min === null || axis.max === null) return [];
  if (axis.min === axis.max) return [{ value: axis.min, position: 0 }];
  return Array.from({ length: 5 }, (_, i) => {
    const value =
      axis.min === null || axis.max === null ? 0 : axis.min + ((axis.max - axis.min) * i) / 4;
    return { value, position: coordinate(value, axis) };
  });
}
export function axisOptions(dataset: Dataset): Axis[] {
  const options = [
    { id: '__row', label: 'Row Number', values: dataset.rows.map((_, i) => i + 1) },
    ...dataset.columns
      .filter((c) => c.type === 'number')
      .map((c) => ({
        id: c.id,
        columnId: c.id,
        label: c.name,
        values: dataset.rows.map((r) =>
          typeof r.cells[c.id] === 'number' && Number.isFinite(r.cells[c.id])
            ? (r.cells[c.id] as number)
            : null,
        ),
      })),
    ...dataset.columns
      .filter((c) => c.type === 'text')
      .map((c) => ({
        id: `length:${c.id}`,
        columnId: c.id,
        label: `${c.name} — character count`,
        values: dataset.rows.map((r) =>
          typeof r.cells[c.id] === 'string' ? Array.from(r.cells[c.id] as string).length : null,
        ),
      })),
  ];
  return options.map((option) => {
    let min = Infinity,
      max = -Infinity;
    for (const value of option.values)
      if (value !== null) {
        min = Math.min(min, value);
        max = Math.max(max, value);
      }
    return { ...option, min: min === Infinity ? null : min, max: max === -Infinity ? null : max };
  });
}
export function scatterRows(dataset: Dataset, axes: Axis[]) {
  const rejected: { rowId: string; index: number; reason: string }[] = [];
  const points: { rowId: string; index: number; position: Vec3 }[] = [];
  dataset.rows.forEach((row, index) => {
    const invalid = axes.flatMap((axis, i) =>
      axis.values[index] === null ||
      axis.values[index] === undefined ||
      !Number.isFinite(axis.values[index])
        ? [`${String(AXIS_NAMES[i])}: ${axis.label} missing or non-finite`]
        : [],
    );
    if (invalid.length) rejected.push({ rowId: row.id, index, reason: invalid.join('; ') });
    else
      points.push({
        rowId: row.id,
        index,
        position: axes.map((a) => coordinate(a.values[index] as number, a)) as Vec3,
      });
  });
  return { points, rejected };
}

export function missingPointColor(count: number, total: number) {
  if (count === 0) return '#38bdf8';
  const f = count / Math.max(1, total);
  return `rgb(${String(Math.round(254 - 60 * f))}, ${String(Math.round(215 - 150 * f))}, ${String(Math.round(170 - 158 * f))})`;
}
