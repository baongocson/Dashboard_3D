import type { Cell, Dataset } from '@dashboard/contracts';
import { parseFillValue } from '../features/preprocessing/previewRules';
export type Draft = Record<string, { raw: string; missing: boolean }>;
export function draftFor(row: Dataset['rows'][number], columns: Dataset['columns']): Draft {
  return Object.fromEntries(
    columns.map((c) => [
      c.id,
      {
        raw: row.cells[c.id] === null ? '' : String(row.cells[c.id] ?? ''),
        missing: row.cells[c.id] === null,
      },
    ]),
  );
}
export function validateDraft(columns: Dataset['columns'], draft: Draft) {
  const errors: Record<string, string> = {},
    values: Record<string, Cell> = {};
  for (const c of columns) {
    const field = draft[c.id];
    if (!field) {
      errors[c.id] = 'Missing field.';
      continue;
    }
    if (field.missing) {
      values[c.id] = null;
      continue;
    }
    const parsed = parseFillValue(c.type, field.raw);
    if (parsed.valid) values[c.id] = parsed.value;
    else errors[c.id] = parsed.reason;
  }
  return { errors, values };
}
