import { useMemo, useState } from 'react';
import type { Dataset } from '@dashboard/contracts';
import { missingByColumn, boxSummary } from './chartSummary';
const fmt = (n: number) => n.toLocaleString('en-US', { maximumSignificantDigits: 7 });
export function CollectionCharts({ dataset }: { dataset: Dataset }) {
  const missing = useMemo(() => missingByColumn(dataset), [dataset]);
  const numeric = dataset.columns.filter((c) => c.type === 'number');
  const [chosen, setChosen] = useState('');
  const column = numeric.find((c) => c.id === chosen) ?? numeric[0];
  const box = useMemo(() => (column ? boxSummary(dataset, column.id) : null), [dataset, column]);
  const [hover, setHover] = useState<string | null>(null);
  const [outlier, setOutlier] = useState<string | null>(null);
  const stats = box?.stats;
  const project = (v: number) =>
    !stats
      ? 320
      : stats.max === stats.min
        ? 320
        : 40 + ((v - stats.min) / (stats.max - stats.min)) * 560;
  return (
    <div className="collection-charts">
      <section className="summary-chart" aria-label="Missing Values by Column">
        <h3>Missing Values by Column</h3>
        <p>{dataset.rows.length} rows</p>
        <div className="missing-bars">
          {missing.map((c) => (
            <button
              type="button"
              className="missing-bar-row"
              key={c.id}
              aria-label={`${c.name}: ${String(c.count)}/${String(c.total)} missing (${fmt(c.percent)}%)`}
              onMouseEnter={() => {
                setHover(c.id);
              }}
              onFocus={() => {
                setHover(c.id);
              }}
              onClick={() => {
                setHover(c.id);
              }}
            >
              <span>{c.name}</span>
              <span className="missing-bar-track">
                <span style={{ width: `${String(c.percent)}%` }} />
              </span>
              <span>
                {c.count} · {fmt(c.percent)}%
              </span>
            </button>
          ))}
        </div>
        <p role="status">
          {missing.find((c) => c.id === hover)
            ? missing
                .filter((c) => c.id === hover)
                .map(
                  (c) =>
                    `${c.name}: ${String(c.count)} missing values out of ${String(c.total)} rows (${fmt(c.percent)}%).`,
                )
            : 'Select Feature'}
        </p>
      </section>
      <section className="summary-chart" aria-label="Boxplot">
        <h3>Boxplot · 1.5 × IQR</h3>
        <label>
          Numeric Column
          <select
            aria-label="Boxplot Column"
            value={column?.id ?? ''}
            onChange={(e) => {
              setChosen(e.target.value);
              setOutlier(null);
            }}
          >
            {numeric.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {!column ? (
          <p>No numeric columns available.</p>
        ) : !stats ? (
          <p>
            No valid numeric values. Missing: {box?.missing ?? 0}, invalid {box?.invalid ?? 0}.
          </p>
        ) : (
          <>
            <p>
              Valid: {box.valid} · Missing: {box.missing} · Outliers: {box.outliers.length}{' '}
              {box.invalid ? `· Invalid: ${String(box.invalid)}` : ''}
            </p>
            {box.valid < 4 && <p className="hint">Small Sample: {box.valid} values.</p>}
            {stats.min === stats.max && <p className="hint">Constant Column.</p>}
            <svg
              viewBox="0 0 640 180"
              role="img"
              aria-label={`Boxplot ${column.name}: Q1 ${fmt(stats.q1)}, median ${fmt(stats.q2)}, Q3 ${fmt(stats.q3)}, whiskers ${fmt(stats.low)} to ${fmt(stats.high)}, ${String(box.outliers.length)} outliers`}
            >
              <line x1="40" y1="140" x2="600" y2="140" stroke="currentColor" />
              <text x="40" y="164" fill="currentColor">
                {fmt(stats.min)}
              </text>
              <text x="600" y="164" textAnchor="end" fill="currentColor">
                {fmt(stats.max)}
              </text>
              <line
                x1={project(stats.low)}
                y1="70"
                x2={project(stats.high)}
                y2="70"
                stroke="currentColor"
              />
              {[stats.low, stats.high].map((v, i) => (
                <line
                  key={i}
                  x1={project(v)}
                  y1="45"
                  x2={project(v)}
                  y2="95"
                  stroke="currentColor"
                />
              ))}
              <rect
                x={project(stats.q1) - (stats.q1 === stats.q3 ? 1 : 0)}
                y="40"
                width={Math.max(2, project(stats.q3) - project(stats.q1))}
                height="60"
                fill="#38bdf844"
                stroke="#0284c7"
              />
              <line
                x1={project(stats.q2)}
                y1="40"
                x2={project(stats.q2)}
                y2="100"
                stroke="#e11d48"
                strokeWidth="3"
              />
              {box.outliers.map((o) => (
                <circle
                  key={o.rowId}
                  cx={project(o.value)}
                  cy="70"
                  r="5"
                  fill="#e11d48"
                  role="button"
                  tabIndex={0}
                  aria-label={`Outliers ${o.rowId}: ${fmt(o.value)}`}
                  onMouseEnter={() => {
                    setOutlier(`${o.rowId}: ${fmt(o.value)}`);
                  }}
                  onClick={() => {
                    setOutlier(`${o.rowId}: ${fmt(o.value)}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ')
                      setOutlier(`${o.rowId}: ${fmt(o.value)}`);
                  }}
                >
                  <title>
                    {o.rowId}: {fmt(o.value)}
                  </title>
                </circle>
              ))}
            </svg>
            <dl className="box-statistics">
              {[
                ['Q1', stats.q1],
                ['Q2 · Median', stats.q2],
                ['Q3', stats.q3],
                ['Lower Whisker', stats.low],
                ['Upper Whisker', stats.high],
              ].map(([name, value]) => (
                <div key={String(name)}>
                  <dt>{name}</dt>
                  <dd>{fmt(Number(value))}</dd>
                </div>
              ))}
            </dl>
            {outlier && <p role="status">Outliers: {outlier}</p>}
          </>
        )}
      </section>
    </div>
  );
}
