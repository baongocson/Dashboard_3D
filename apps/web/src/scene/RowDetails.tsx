import { useEffect, useState } from 'react';
import type { Cell, Dataset } from '@dashboard/contracts';
import { AXIS_NAMES, type Axis } from './scatterModel';
import { draftFor, validateDraft } from './rowDraft';
import { useDraftGuard } from './DraftGuard';
export type SaveRow = (rowId: string, values: Record<string, Cell>) => Promise<void>;
export function RowDetails({
  dataset,
  row,
  axes,
  onSave,
  onBegin,
}: {
  dataset: Dataset;
  row: Dataset['rows'][number];
  axes: Axis[];
  onSave?: SaveRow | undefined;
  onBegin: () => void;
}) {
  const initial = draftFor(row, dataset.columns);
  const [draft, setDraft] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const { errors, values } = validateDraft(dataset.columns, draft);
  const { bind } = useDraftGuard();
  function discard() {
    setDraft(draftFor(row, dataset.columns));
    setFailure(null);
  }
  async function save() {
    if (!onSave || saving) return false;
    if (Object.keys(errors).length) {
      setFailure('Correct the invalid fields.');
      return false;
    }
    if (dataset.columns.every((c) => Object.is(values[c.id], row.cells[c.id]))) {
      discard();
      return true;
    }
    setSaving(true);
    setFailure(null);
    try {
      await onSave(row.id, values);
      setDraft(draftFor({ ...row, cells: values }, dataset.columns));
      return true;
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Save failed. Your draft has been kept.');
      return false;
    } finally {
      setSaving(false);
    }
  }
  useEffect(() => {
    if (dirty) return bind({ save, discard, saving });
    return undefined;
  });
  return (
    <div
      className="row-editor"
      onKeyDown={(event) => {
        if (!onSave || saving) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          discard();
        }
        if (
          event.key === 'Enter' &&
          !event.shiftKey &&
          !(event.target instanceof HTMLButtonElement)
        ) {
          event.preventDefault();
          if (dirty) void save();
        }
      }}
    >
      <table>
        <thead>
          <tr>
            <th>Column</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {dataset.columns.map((c) => {
            const field = draft[c.id];
            return (
              <tr key={c.id}>
                <th>
                  {c.name}{' '}
                  {axes.flatMap((a, i) =>
                    a.columnId === c.id
                      ? [
                          <span className="axis-badge" key={i}>
                            {AXIS_NAMES[i]}
                            {a.id.startsWith('length:') ? ' · character count' : ''}
                          </span>,
                        ]
                      : [],
                  )}
                </th>
                <td>
                  {onSave && field ? (
                    <>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`${c.name}: missing value`}
                          checked={field.missing}
                          disabled={saving}
                          onFocus={onBegin}
                          onChange={(e) => {
                            onBegin();
                            setDraft({ ...draft, [c.id]: { ...field, missing: e.target.checked } });
                          }}
                        />{' '}
                        Missing
                      </label>
                      <textarea
                        aria-label={`Edit ${c.name}`}
                        aria-invalid={Boolean(errors[c.id])}
                        disabled={saving || field.missing}
                        value={field.raw}
                        onFocus={onBegin}
                        onChange={(e) => {
                          onBegin();
                          setDraft({ ...draft, [c.id]: { ...field, raw: e.target.value } });
                        }}
                      />
                      {errors[c.id] && (
                        <span className="field-error" role="alert">
                          {errors[c.id]}
                        </span>
                      )}
                    </>
                  ) : row.cells[c.id] === null || row.cells[c.id] === undefined ? (
                    <em>Missing</em>
                  ) : (
                    String(row.cells[c.id])
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {onSave && (
        <>
          <div className="action-row">
            <button
              type="button"
              disabled={!dirty || saving || Object.keys(errors).length > 0}
              onClick={() => {
                void save();
              }}
            >
              Save Changes
            </button>
            <button type="button" disabled={!dirty || saving} onClick={discard}>
              Discard Changes
            </button>
          </div>
        </>
      )}
      {saving && <p role="status">Saving new version…</p>}
      {failure && <p role="alert">{failure}</p>}
    </div>
  );
}
