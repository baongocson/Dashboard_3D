import { useState } from 'react';
import type { analyzeDataset } from '../../../../../packages/data-engine/src/operations';
type Analysis = ReturnType<typeof analyzeDataset>;
export function CorrelationMatrix({ analysis }: { analysis: Analysis }) {
  const columns = analysis.columns.filter((c) => c.type === 'number');
  const pairs = new Map(analysis.correlation.map((p) => [JSON.stringify([p.a, p.b]), p]));
  const [selected, setSelected] = useState<{ a: string; b: string } | null>(null);
  const active = selected ? pairs.get(JSON.stringify([selected.a, selected.b])) : null;
  return (
    <section className="correlation-matrix">
      <h3>Correlation Matrix</h3>
      {columns.length === 0 ? (
        <p>No numeric columns available.</p>
      ) : (
        <>
          <div className="table-scroll heatmap-scroll">
            <table className="heatmap" aria-label="Correlation Matrix">
              <thead>
                <tr>
                  <th />
                  {columns.map((c) => (
                    <th scope="col" key={c.id}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.map((a) => (
                  <tr key={a.id}>
                    <th scope="row">{a.name}</th>
                    {columns.map((b) => {
                      const pair = pairs.get(JSON.stringify([a.name, b.name]));
                      const coefficient = pair?.coefficient ?? null;
                      const color =
                        coefficient === null
                          ? '#e2e8f0'
                          : `hsl(${coefficient < 0 ? '8' : '205'} 70% ${String(94 - Math.abs(coefficient) * 48)}%)`;
                      return (
                        <td key={b.id}>
                          <button
                            type="button"
                            style={{ background: color }}
                            aria-label={`${a.name} × ${b.name}: ${coefficient === null ? 'Undefined' : coefficient.toFixed(3)}`}
                            title={`${a.name} × ${b.name}`}
                            onMouseEnter={() => {
                              setSelected({ a: a.name, b: b.name });
                            }}
                            onFocus={() => {
                              setSelected({ a: a.name, b: b.name });
                            }}
                            onClick={() => {
                              setSelected({ a: a.name, b: b.name });
                            }}
                          >
                            {coefficient === null ? '—' : coefficient.toFixed(2)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="correlation-legend">
            <span>−1</span>
            <div />
            <span>0</span>
            <div />
            <span>+1</span>
          </div>
          {active && (
            <p role="status">
              {active.a} × {active.b}: {active.coefficient?.toFixed(4) ?? 'Undefined'}
            </p>
          )}
        </>
      )}
    </section>
  );
}
