import { useMemo, useState } from 'react';
import type { Cell, Dataset } from '@dashboard/contracts';
export const typeNames: Record<Dataset['columns'][number]['type'], string> = {
  number: 'Number',
  text: 'Text',
  boolean: 'Boolean',
  date: 'Date',
  datetime: 'Datetime',
};
export function valueCounts(dataset: Dataset, columnId: string, includeMissing = true) {
  const counts = new Map<Cell, number>();
  for (const row of dataset.rows) {
    const v = row.cells[columnId] ?? null;
    if (v === null && !includeMissing) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}
export function FeatureExplorer({ dataset }: { dataset: Dataset }) {
  const [chosen, setChosen] = useState('');
  const [includeMissing, setIncludeMissing] = useState(true);
  const [page, setPage] = useState(0);
  const column = dataset.columns.find((c) => c.id === chosen) ?? dataset.columns[0];
  const counts = useMemo(
    () => (column ? valueCounts(dataset, column.id, includeMissing) : []),
    [dataset, column, includeMissing],
  );
  const currentPage = Math.min(page, Math.max(0, Math.ceil(counts.length / 25) - 1));
  return (
    <section className="feature-explorer">
      <h3>Feature Summary</h3>
      <div className="table-scroll">
        <table className="dataset-table">
          <thead>
            <tr>
              <th>Feature</th>
              <th>Data Type</th>
            </tr>
          </thead>
          <tbody>
            {dataset.columns.map((c) => (
              <tr key={c.id}>
                <th>{c.name}</th>
                <td>{typeNames[c.type]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Value Counts</h3>
      <label className="form-field">
        Feature
        <select
          aria-label="Value Counts Column"
          value={column?.id ?? ''}
          onChange={(e) => {
            setChosen(e.target.value);
            setPage(0);
          }}
        >
          {dataset.columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={includeMissing}
          onChange={(e) => {
            setIncludeMissing(e.target.checked);
            setPage(0);
          }}
        />{' '}
        Include Missing Values
      </label>
      <div className="table-scroll">
        <table className="dataset-table value-counts">
          <thead>
            <tr>
              <th>Value</th>
              <th>Count</th>
              <th>Percentage of Rows</th>
            </tr>
          </thead>
          <tbody>
            {counts.slice(currentPage * 25, currentPage * 25 + 25).map((entry, i) => (
              <tr key={i}>
                <td>{entry.value === null ? <em>Missing</em> : String(entry.value)}</td>
                <td>{entry.count}</td>
                <td>
                  {(dataset.rows.length ? (entry.count / dataset.rows.length) * 100 : 0).toFixed(2)}
                  %
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button
          disabled={currentPage === 0}
          onClick={() => {
            setPage(currentPage - 1);
          }}
        >
          Previous
        </button>
        <span>
          {currentPage + 1}/{Math.max(1, Math.ceil(counts.length / 25))} · {counts.length} value
        </span>
        <button
          disabled={(currentPage + 1) * 25 >= counts.length}
          onClick={() => {
            setPage(currentPage + 1);
          }}
        >
          Next
        </button>
      </div>
    </section>
  );
}
