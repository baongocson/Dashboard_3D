import type { Cell, Dataset } from '@dashboard/contracts';
import { parseFillValue } from './previewRules';
export type ReplacementDraft = {
  from: string;
  to: string;
  fromMissing: boolean;
  toMissing: boolean;
};
export const emptyReplacement = (): ReplacementDraft => ({
  from: '',
  to: '',
  fromMissing: false,
  toMissing: false,
});
export function parseReplacements(column: Dataset['columns'][number], drafts: ReplacementDraft[]) {
  const result = drafts.map((draft) => {
    function value(raw: string, missing: boolean): Cell {
      if (missing) return null;
      const p = parseFillValue(column.type, raw);
      if (!p.valid) throw new Error(`${column.name}: ${p.reason}`);
      return p.value;
    }
    return { from: value(draft.from, draft.fromMissing), to: value(draft.to, draft.toMissing) };
  });
  if (new Set(result.map((r) => JSON.stringify(r.from))).size !== result.length)
    throw new Error(`${column.name}: duplicate find values.`);
  return result;
}
export function categoryValues(dataset: Dataset, columnId: string) {
  const column = dataset.columns.find((c) => c.id === columnId);
  if (!column || !['text', 'boolean'].includes(column.type))
    throw new Error('Select a categorical column.');
  return [
    ...new Set(
      dataset.rows.flatMap((row) =>
        row.cells[columnId] === null ? [] : [String(row.cells[columnId])],
      ),
    ),
  ];
}
export function orderedCategories(
  values: string[],
  ranks: Record<string, string>,
  columnId: string,
) {
  const entries = values.map((value) => ({
    value,
    raw: ranks[JSON.stringify([columnId, value])] ?? '',
  }));
  if (
    entries.some(
      (e) => e.raw.trim() === '' || !/^\d+$/.test(e.raw) || Number(e.raw) >= values.length,
    ) ||
    new Set(entries.map((e) => Number(e.raw))).size !== values.length
  )
    throw new Error('Ranks must be unique consecutive integers starting at 0.');
  return entries.sort((a, b) => Number(a.raw) - Number(b.raw)).map((e) => e.value);
}
