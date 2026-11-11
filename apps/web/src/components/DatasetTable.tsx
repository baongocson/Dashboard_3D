import { useEffect, useMemo, useState } from 'react';
import type { Session } from '../storage/db';
import type { Dataset } from '@dashboard/contracts';
import type { z } from 'zod';
import { selectionSchema } from '@dashboard/contracts';

export type CellSelection = z.infer<typeof selectionSchema>;

type DatasetTableProps = {
  dataset: Dataset;
  selection?: CellSelection | null;
  onSelect?: ((selection: CellSelection) => void) | undefined;
  pageSize?: number;
  view?: Session['table'];
  onViewChange?: (view: Session['table']) => void;
};

export function DatasetTable({
  dataset,
  selection = null,
  onSelect,
  pageSize = 20,
  view,
  onViewChange,
}: DatasetTableProps) {
  const [page, setPage] = useState(0);
  const [internalView, setInternalView] = useState<Session['table']>({
    filters: [],
    sorts: [],
    selection: null,
  });
  const tableView = view ?? internalView;
  const setView = (next: Session['table']) => {
    setInternalView(next);
    onViewChange?.(next);
    setPage(0);
  };
  const filtered = useMemo(() => {
    const rows = dataset.rows.filter((row) =>
      tableView.filters.every((filter) => {
        if (!dataset.columns.some((c) => c.id === filter.columnId)) return true;
        const value = row.cells[filter.columnId];
        return filter.operator === 'missing'
          ? value === null
          : filter.operator === 'equals'
            ? Object.is(value, filter.value)
            : String(value ?? '')
                .toLowerCase()
                .includes(String(filter.value ?? '').toLowerCase());
      }),
    );
    const sort = tableView.sorts[0];
    if (sort && dataset.columns.some((c) => c.id === sort.columnId))
      rows.sort((a, b) => {
        const x = a.cells[sort.columnId],
          y = b.cells[sort.columnId];
        if (x === null) return y === null ? 0 : 1;
        if (y === null) return -1;
        const comparison =
          typeof x === 'number' && typeof y === 'number'
            ? x - y
            : String(x).localeCompare(String(y));
        return sort.direction === 'asc' ? comparison : -comparison;
      });
    return rows;
  }, [dataset, tableView]);
  useEffect(() => {
    setPage(0);
  }, [dataset.versionId]);
  useEffect(() => {
    if (selection?.versionId !== dataset.versionId) return;
    const index = filtered.findIndex((r) => r.id === selection.rowId);
    if (index >= 0) setPage(Math.floor(index / Math.max(1, pageSize)));
  }, [selection, dataset, pageSize, filtered]);
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(filtered.length / safePageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * safePageSize, (currentPage + 1) * safePageSize);

  return (
    <section className="panel table-panel" aria-label="Data Table">
      <div className="panel-heading">
        <h2>Data Table</h2>
        <span className="chip">
          {dataset.rows.length.toLocaleString('en-US')} rows · {dataset.columns.length} columns
        </span>
      </div>

      <div className="table-tools">
        <label>
          Filter Column{' '}
          <select
            aria-label="Filter Column"
            value={tableView.filters[0]?.columnId ?? ''}
            onChange={(event) => {
              setView({
                ...tableView,
                filters: event.target.value
                  ? [{ columnId: event.target.value, operator: 'contains', value: '' }]
                  : [],
              });
            }}
          >
            <option value="">All</option>
            {dataset.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {tableView.filters[0] && (
          <>
            <input
              aria-label="Filter Value"
              value={String(tableView.filters[0].value ?? '')}
              onChange={(event) => {
                const filter = tableView.filters[0];
                if (filter)
                  setView({
                    ...tableView,
                    filters: [{ ...filter, operator: 'contains', value: event.target.value }],
                  });
              }}
            />
            <label>
              <input
                type="checkbox"
                checked={tableView.filters[0].operator === 'missing'}
                onChange={(event) => {
                  const filter = tableView.filters[0];
                  if (filter)
                    setView({
                      ...tableView,
                      filters: [
                        { ...filter, operator: event.target.checked ? 'missing' : 'contains' },
                      ],
                    });
                }}
              />{' '}
              Missing Only
            </label>
          </>
        )}
        <label>
          Sort{' '}
          <select
            aria-label="Sort Column"
            value={tableView.sorts[0]?.columnId ?? ''}
            onChange={(event) => {
              setView({
                ...tableView,
                sorts: event.target.value
                  ? [{ columnId: event.target.value, direction: 'asc' }]
                  : [],
              });
            }}
          >
            <option value="">Original Order</option>
            {dataset.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {tableView.sorts[0] && (
          <button
            type="button"
            className="quiet-button"
            onClick={() => {
              const sort = tableView.sorts[0];
              if (sort)
                setView({
                  ...tableView,
                  sorts: [{ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' }],
                });
            }}
          >
            {tableView.sorts[0].direction === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        )}
        <span className="hint">
          {filtered.length.toLocaleString('en-US')}/{dataset.rows.length.toLocaleString('en-US')}{' '}
          rows
        </span>
      </div>
      <div className="table-scroll" role="region" aria-label="Scrollable Data Table" tabIndex={0}>
        <table className="dataset-table">
          <thead>
            <tr>
              <th scope="col">Row</th>
              {dataset.columns.map((column) => (
                <th scope="col" key={column.id}>
                  {column.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={row.id}>
                <th scope="row" className="row-number">
                  {currentPage * safePageSize + rowIndex + 1}
                </th>
                {dataset.columns.map((column) => {
                  const value = row.cells[column.id];
                  const isSelected =
                    selection?.versionId === dataset.versionId &&
                    selection.rowId === row.id &&
                    selection.columnId === column.id;
                  return (
                    <td key={column.id} className={value === null ? 'missing-cell' : undefined}>
                      {onSelect ? (
                        <button
                          type="button"
                          className={`cell-button${isSelected ? ' is-selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => {
                            onSelect({
                              versionId: dataset.versionId,
                              rowId: row.id,
                              columnId: column.id,
                            });
                          }}
                          aria-label={`Select Row ${String(rowIndex + 1 + currentPage * safePageSize)}, column ${column.name}: ${value === null ? 'missing' : String(value)}`}
                        >
                          {value === null ? (
                            <span className="missing-tag">Missing</span>
                          ) : (
                            String(value)
                          )}
                        </button>
                      ) : value === null ? (
                        <span className="missing-tag">Missing</span>
                      ) : (
                        String(value)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dataset.rows.length === 0 && <p className="hint">No rows available.</p>}
      <div className="pagination">
        <button
          type="button"
          className="quiet-button"
          disabled={currentPage === 0}
          onClick={() => {
            setPage((value) => Math.max(value - 1, 0));
          }}
        >
          Previous
        </button>
        <span>
          Page {currentPage + 1}/{pageCount}
        </span>
        <button
          type="button"
          className="quiet-button"
          disabled={currentPage >= pageCount - 1}
          onClick={() => {
            setPage((value) => Math.min(value + 1, pageCount - 1));
          }}
        >
          Next
        </button>
      </div>
    </section>
  );
}
