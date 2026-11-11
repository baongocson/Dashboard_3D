import { useState } from 'react';
import type { Dataset } from '@dashboard/contracts';
import {
  operationSchema,
  type Operation,
  type OperationPreview,
} from '../../../../../packages/data-engine/src/operations';
import type { CellSelection } from '../../components/DatasetTable';
import { parseFillValue } from './previewRules';
import { ReplacementFields } from './ReplacementFields';
import {
  emptyReplacement,
  parseReplacements,
  categoryValues,
  orderedCategories,
  type ReplacementDraft,
} from './operationForms';
export const sections = [
  ['collection', 'Collection'],
  ['cleaning', 'Cleaning'],
  ['missing', 'Missing Values'],
  ['outliers', 'Outliers'],
  ['scaling', 'Scaling'],
  ['transformation', 'Transformation'],
  ['encoding', 'Encoding'],
] as const;
export const methods: Record<string, [Operation['method'], string][]> = {
  cleaning: [
    ['cleaning-batch', 'Per-column Cleaning'],
    ['replace', 'Replace Values'],
    ['trim', 'Trim Whitespace'],
    ['strip-html', 'Strip HTML'],
    ['number', 'Convert to Number'],
    ['text', 'Convert to Text'],
    ['boolean', 'Convert to Boolean'],
    ['date', 'Convert to Date'],
    ['datetime', 'Convert to Datetime'],
    ['rename', 'Rename Column'],
    ['drop-column', 'Drop Columns'],
    ['deduplicate', 'Remove Duplicates'],
  ],
  missing: [
    ['missing-batch', 'Per-column Imputation'],
    ['fill', 'Constant Imputation'],
    ['mean', 'Mean Imputation'],
    ['median', 'Median Imputation'],
    ['mode', 'Most Frequent Imputation'],
    ['drop-row', 'Delete Selected Row'],
    ['drop-column', 'Drop Columns'],
  ],
  outliers: [
    ['iqr-clip', 'IQR Clipping'],
    ['iqr-drop', 'IQR Filtering'],
    ['zscore-clip', 'Z-score Clipping'],
    ['zscore-drop', 'Z-score Filtering'],
  ],
  scaling: [
    ['minmax', 'Min–Max'],
    ['standard', 'Standardization'],
  ],
  transformation: [
    ['log1p', 'Log1p'],
    ['sqrt', 'Square Root'],
  ],
  encoding: [
    ['onehot', 'One-hot'],
    ['ordinal', 'Ordinal'],
  ],
};
const missingMethods = [
  ['fill', 'Constant Value'],
  ['mean', 'Mean'],
  ['median', 'Median'],
  ['mode', 'Most Frequent Value'],
] as const;
type CleanDraft = {
  trim: boolean;
  stripHtml: boolean;
  convert: Operation['cleaningPlans'][number]['convert'];
  replace: boolean;
  replacements: ReplacementDraft[];
};
const emptyClean = (): CleanDraft => ({
  trim: false,
  stripHtml: false,
  convert: 'keep',
  replace: false,
  replacements: [],
});
export function Workbench({
  dataset,
  section,
  selection,
  busy,
  cancellable,
  preview,
  onPreview,
  onApply,
  onCancel,
  onBusyCancel,
  savedConfiguration,
  onConfiguration,
}: {
  dataset: Dataset;
  section: string;
  selection: CellSelection | null;
  busy: boolean;
  cancellable: boolean;
  preview: OperationPreview | null;
  onPreview: (configuration: Operation) => void;
  onApply: () => void;
  onCancel: () => void;
  onBusyCancel: () => void;
  savedConfiguration: string;
  onConfiguration: (configuration: string) => void;
}) {
  const initial = (() => {
    try {
      const p = operationSchema.safeParse(JSON.parse(savedConfiguration));
      return p.success ? p.data : null;
    } catch {
      return null;
    }
  })();
  const available = methods[section] ?? [];
  const [method, setMethod] = useState<Operation['method']>(
    initial && available.some(([m]) => m === initial.method)
      ? initial.method
      : (available[0]?.[0] ?? 'fill'),
  );
  const [columns, setColumns] = useState<string[]>(
    initial?.columnIds.filter((id) => dataset.columns.some((c) => c.id === id)) ?? [],
  );
  const [scope, setScope] = useState<'cell' | 'all'>(initial?.rowId ? 'cell' : 'all');
  const [rawValue, setRawValue] = useState(
    initial?.value === null || initial?.value === undefined ? '' : String(initial.value),
  );
  const [parameter, setParameter] = useState(
    String(initial?.method === method ? initial.parameter : method === 'minmax' ? 0 : 1.5),
  );
  const [upper, setUpper] = useState(String(initial?.upper ?? 1));
  const [keepOriginal, setKeepOriginal] = useState(initial?.keepOriginal ?? false);
  const [missingCategory, setMissingCategory] = useState(initial?.missingCategory ?? false);
  const asDraft = (r: Operation['replacements'][number]): ReplacementDraft => ({
    from: r.from === null ? '' : String(r.from),
    to: r.to === null ? '' : String(r.to),
    fromMissing: r.from === null,
    toMissing: r.to === null,
  });
  const [replacements, setReplacements] = useState<ReplacementDraft[]>(
    initial?.replacements.length ? initial.replacements.map(asDraft) : [emptyReplacement()],
  );
  const [clean, setClean] = useState<Record<string, CleanDraft>>(
    Object.fromEntries(
      (initial?.cleaningPlans ?? []).map((p) => [
        p.columnId,
        { ...p, replace: p.replacements.length > 0, replacements: p.replacements.map(asDraft) },
      ]),
    ),
  );
  const [plans, setPlans] = useState<
    Record<string, { method: Operation['plans'][number]['method']; value: string }>
  >(
    Object.fromEntries(
      (initial?.plans ?? [])
        .filter((p) => missingMethods.some(([m]) => m === p.method))
        .map((p) => [
          p.columnId,
          { method: p.method, value: p.value === null ? '' : String(p.value) },
        ]),
    ),
  );
  const [ranks, setRanks] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(initial?.orders ?? {}).flatMap(([id, values]) =>
        values.map((v, i) => [JSON.stringify([id, v]), String(i)]),
      ),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const selected = selection?.versionId === dataset.versionId ? selection : null;
  const global =
    ['scaling', 'transformation', 'encoding'].includes(section) ||
    [
      'number',
      'text',
      'boolean',
      'date',
      'datetime',
      'rename',
      'drop-column',
      'deduplicate',
    ].includes(method);
  const batch = method === 'cleaning-batch' || method === 'missing-batch';
  const ids = scope === 'cell' && !global && selected ? [selected.columnId] : columns;
  const affected = dataset.columns.filter((c) => ids.includes(c.id));
  function configure() {
    try {
      if (!batch && method !== 'deduplicate' && scope === 'cell' && !global && !selected)
        throw new Error('Select a data cell.');
      if (!batch && method !== 'deduplicate' && !affected.length)
        throw new Error('Select at least one column.');
      if (
        ['onehot', 'ordinal'].includes(method) &&
        affected.some((c) => !['text', 'boolean'].includes(c.type))
      )
        throw new Error('Select a categorical column.');
      let value: Operation['value'] = rawValue;
      if (method === 'fill') {
        const c = affected[0];
        if (!c) throw new Error('Select columns.');
        const p = parseFillValue(c.type, rawValue);
        if (!p.valid) throw new Error(p.reason);
        value = p.value;
      }
      if (method === 'replace' && new Set(affected.map((c) => c.type)).size > 1)
        throw new Error('Select columns with the same data type or use Per-column Cleaning.');
      const config = operationSchema.parse({
        method,
        columnIds: ids,
        rowId: global || batch ? null : scope === 'cell' ? (selected?.rowId ?? null) : null,
        value,
        parameter: Number(parameter),
        upper: Number(upper),
        keepOriginal,
        missingCategory,
        replacements:
          method === 'replace' && affected[0] ? parseReplacements(affected[0], replacements) : [],
        orders:
          method === 'ordinal'
            ? Object.fromEntries(
                affected.map((c) => [
                  c.id,
                  orderedCategories(categoryValues(dataset, c.id), ranks, c.id),
                ]),
              )
            : {},
        cleaningPlans:
          method === 'cleaning-batch'
            ? dataset.columns.flatMap((c) => {
                const p = clean[c.id];
                return p && (p.trim || p.stripHtml || p.replace || p.convert !== 'keep')
                  ? [
                      {
                        columnId: c.id,
                        trim: p.trim,
                        stripHtml: p.stripHtml,
                        convert: p.convert,
                        replacements: p.replace ? parseReplacements(c, p.replacements) : [],
                      },
                    ]
                  : [];
              })
            : [],
        plans:
          method === 'missing-batch'
            ? Object.entries(plans).map(([columnId, plan]) => {
                const c = dataset.columns.find((c) => c.id === columnId);
                if (!c) throw new Error('Column not found.');
                const p = plan.method === 'fill' ? parseFillValue(c.type, plan.value) : null;
                if (p && !p.valid) throw new Error(`${c.name}: ${p.reason}`);
                return { columnId, method: plan.method, value: p?.valid ? p.value : null };
              })
            : [],
      });
      onConfiguration(JSON.stringify(config));
      onPreview(config);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid configuration.');
    }
  }
  return (
    <section className="panel editor-panel">
      <h2>Processing Settings</h2>
      <fieldset
        className="operation-fields"
        disabled={busy}
        onChange={() => {
          onCancel();
          setError(null);
        }}
      >
        <label className="form-field">
          Method
          <select
            aria-label="Method"
            value={method}
            onChange={(e) => {
              const found = available.find(([m]) => m === e.target.value);
              if (found) {
                setMethod(found[0]);
                setParameter(
                  found[0] === 'minmax' ? '0' : found[0].startsWith('zscore') ? '3' : '1.5',
                );
              }
            }}
          >
            {available.map(([m, label]) => (
              <option key={m} value={m}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {!batch && method !== 'deduplicate' && (
          <>
            {!global && (
              <label className="form-field">
                Scope
                <select
                  aria-label="Scope"
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value === 'cell' ? 'cell' : 'all');
                  }}
                >
                  <option value="all">Selected Columns</option>
                  <option value="cell">Selected Cell</option>
                </select>
              </label>
            )}
            {global || scope === 'all' ? (
              <label className="form-field">
                Target Columns
                <select
                  multiple
                  aria-label="Target Columns"
                  value={columns}
                  onChange={(e) => {
                    setColumns(Array.from(e.target.selectedOptions, (o) => o.value));
                  }}
                >
                  {dataset.columns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p role="status">
                {selected
                  ? `${String(dataset.rows.findIndex((r) => r.id === selected.rowId) + 1)} · ${dataset.columns.find((c) => c.id === selected.columnId)?.name ?? ''}`
                  : 'No Cell Selected'}
              </p>
            )}
          </>
        )}
        {method === 'cleaning-batch' && (
          <div className="cleaning-plans">
            {dataset.columns.map((c) => {
              const p = clean[c.id] ?? emptyClean();
              const update = (next: Partial<CleanDraft>) => {
                onCancel();
                setClean({ ...clean, [c.id]: { ...p, ...next } });
              };
              return (
                <details key={c.id} className="column-clean-plan">
                  <summary>{c.name}</summary>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Trim Whitespace ${c.name}`}
                      disabled={c.type !== 'text'}
                      checked={p.trim}
                      onChange={(e) => {
                        update({ trim: e.target.checked });
                      }}
                    />{' '}
                    Trim Whitespace
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Strip HTML ${c.name}`}
                      disabled={c.type !== 'text'}
                      checked={p.stripHtml}
                      onChange={(e) => {
                        update({ stripHtml: e.target.checked });
                      }}
                    />{' '}
                    Strip HTML
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Replacement ${c.name}`}
                      checked={p.replace}
                      onChange={(e) => {
                        update({
                          replace: e.target.checked,
                          replacements: p.replacements.length
                            ? p.replacements
                            : [emptyReplacement()],
                        });
                      }}
                    />{' '}
                    Replace Values
                  </label>
                  {p.replace && (
                    <ReplacementFields
                      label={c.name}
                      value={p.replacements}
                      onChange={(replacements) => {
                        update({ replacements });
                      }}
                    />
                  )}
                  <label className="form-field">
                    Data Type
                    <select
                      aria-label={`Output Type ${c.name}`}
                      value={p.convert}
                      onChange={(e) => {
                        const parsed = operationSchema.shape.cleaningPlans
                          .unwrap()
                          .element.shape.convert.safeParse(e.target.value);
                        if (parsed.success) update({ convert: parsed.data });
                      }}
                    >
                      {[
                        ['keep', 'Keep Unchanged'],
                        ['number', 'Number'],
                        ['text', 'Text'],
                        ['boolean', 'Boolean'],
                        ['date', 'Date'],
                        ['datetime', 'Datetime'],
                      ].map(([v, label]) => (
                        <option key={v} value={v}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </details>
              );
            })}
          </div>
        )}
        {method === 'missing-batch' && (
          <div className="batch-plans">
            {dataset.columns.map((c) => (
              <div className="form-field" key={c.id}>
                <label>
                  {c.name}
                  <select
                    aria-label={`Imputation Method ${c.name}`}
                    value={plans[c.id]?.method ?? 'skip'}
                    onChange={(e) => {
                      const m = missingMethods.find(([m]) => m === e.target.value)?.[0];
                      if (!m)
                        setPlans(
                          Object.fromEntries(Object.entries(plans).filter(([id]) => id !== c.id)),
                        );
                      else
                        setPlans({
                          ...plans,
                          [c.id]: { method: m, value: plans[c.id]?.value ?? '' },
                        });
                    }}
                  >
                    <option value="skip">Keep Unchanged</option>
                    {missingMethods.map(([m, label]) => (
                      <option
                        key={m}
                        value={m}
                        disabled={['mean', 'median'].includes(m) && c.type !== 'number'}
                      >
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {plans[c.id]?.method === 'fill' && (
                  <input
                    aria-label={`Imputation Value ${c.name}`}
                    value={plans[c.id]?.value ?? ''}
                    onChange={(e) => {
                      const p = plans[c.id];
                      if (p) setPlans({ ...plans, [c.id]: { ...p, value: e.target.value } });
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {method === 'replace' && (
          <ReplacementFields
            label="Replacement"
            value={replacements}
            onChange={(value) => {
              onCancel();
              setReplacements(value);
            }}
          />
        )}
        {['fill', 'rename'].includes(method) && (
          <label className="form-field">
            {method === 'rename' ? 'New Column Name' : 'Fill Value'}
            <textarea
              aria-label="Replacement Value"
              value={rawValue}
              onChange={(e) => {
                setRawValue(e.target.value);
              }}
            />
          </label>
        )}
        {method === 'ordinal' &&
          affected.map((c) => {
            if (!['text', 'boolean'].includes(c.type))
              return (
                <p role="alert" key={c.id}>
                  {c.name}: not a categorical column.
                </p>
              );
            const values = categoryValues(dataset, c.id);
            return (
              <div key={c.id} className="ordinal-order">
                <h3>{c.name}</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Value</th>
                      <th>Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {values.map((value) => {
                      const key = JSON.stringify([c.id, value]);
                      return (
                        <tr key={value}>
                          <td>{value}</td>
                          <td>
                            <input
                              aria-label={`Rank ${c.name}: ${value}`}
                              type="number"
                              min="0"
                              max={values.length - 1}
                              step="1"
                              value={ranks[key] ?? ''}
                              onChange={(e) => {
                                setRanks({ ...ranks, [key]: e.target.value });
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {values.length === 0 ? (
                  <p>No categories available.</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      onCancel();
                      setRanks({
                        ...ranks,
                        ...Object.fromEntries(
                          values.map((v, i) => [JSON.stringify([c.id, v]), String(i)]),
                        ),
                      });
                    }}
                  >
                    Assign Ranks by Appearance
                  </button>
                )}
              </div>
            );
          })}
        {(method.startsWith('iqr') || method.startsWith('zscore') || method === 'minmax') && (
          <label className="form-field">
            {method === 'minmax' ? 'Output Minimum' : 'Threshold'}
            <input
              aria-label="Parameter"
              type="number"
              step="any"
              value={parameter}
              onChange={(e) => {
                setParameter(e.target.value);
              }}
            />
          </label>
        )}
        {method === 'minmax' && (
          <label className="form-field">
            Output Maximum
            <input
              aria-label="Output Maximum"
              type="number"
              step="any"
              value={upper}
              onChange={(e) => {
                setUpper(e.target.value);
              }}
            />
          </label>
        )}
        {['onehot', 'ordinal'].includes(method) && (
          <>
            <label>
              <input
                type="checkbox"
                checked={keepOriginal}
                onChange={(e) => {
                  setKeepOriginal(e.target.checked);
                }}
              />{' '}
              Keep Original Columns
            </label>
            <label>
              <input
                type="checkbox"
                checked={missingCategory}
                onChange={(e) => {
                  setMissingCategory(e.target.checked);
                }}
              />{' '}
              Encode Missing as a Separate Category
            </label>
          </>
        )}
      </fieldset>
      <div className="action-row">
        <button className="primary-button" disabled={busy} onClick={configure}>
          Preview
        </button>
        <button
          className="primary-button"
          disabled={
            busy ||
            !preview ||
            preview.changes.cells + preview.changes.rows + preview.changes.columns === 0
          }
          onClick={onApply}
        >
          Apply
        </button>
        <button
          className="quiet-button"
          disabled={busy && !cancellable}
          onClick={busy ? onBusyCancel : onCancel}
        >
          {busy ? (cancellable ? 'Cancel Processing' : 'Saving…') : 'Clear Preview'}
        </button>
      </div>
      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <div className="preview-result" aria-label="Preview Result">
          <h3>Preview Result</h3>
          <p>
            {preview.changes.cells} cells changed · {preview.changes.rows} rows removed ·{' '}
            {preview.changes.columns} columns changed
          </p>
          <p>
            {dataset.rows.length} rows → {preview.dataset.rows.length} rows
          </p>
          <p>{preview.dataset.columns.map((c) => c.name).join(', ')}</p>
          {preview.warnings.map((w) => (
            <p role="status" key={w}>
              {w}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
