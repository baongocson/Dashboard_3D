import { useEffect, useState } from 'react';
import type { Dataset } from '@dashboard/contracts';
import type { z } from 'zod';
import { selectionSchema } from '@dashboard/contracts';

export type CellSelection = z.infer<typeof selectionSchema>;

type DatasetTableProps = {
  dataset: Dataset;
  selection?: CellSelection | null;
  onSelect?: ((selection: CellSelection) => void) | undefined;
  pageSize?: number;
};

export function DatasetTable({ dataset, selection = null, onSelect, pageSize = 20 }: DatasetTableProps) {
  const [page, setPage] = useState(0);
  useEffect(() => { setPage(0); }, [dataset.versionId]);
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(dataset.rows.length / safePageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = dataset.rows.slice(currentPage * safePageSize, (currentPage + 1) * safePageSize);

  return (
    <section className="panel table-panel" aria-label="Bảng dữ liệu">
      <div className="panel-heading">
        <h2>Bảng dữ liệu</h2>
        <span className="chip">{dataset.rows.length.toLocaleString('vi-VN')} dòng · {dataset.columns.length} cột</span>
      </div>
      <p className="hint">Chọn một ô để xử lý. Vị trí trên bảng có thể thay đổi; hệ thống dùng rowId/columnId để nhận diện.</p>
      <div className="table-scroll" role="region" aria-label="Bảng có thể cuộn ngang" tabIndex={0}>
        <table className="dataset-table">
          <thead>
            <tr>
              <th scope="col">Dòng</th>
              {dataset.columns.map((column) => <th scope="col" key={column.id}>{column.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, rowIndex) => (
              <tr key={row.id}>
                <th scope="row" className="row-number">{currentPage * safePageSize + rowIndex + 1}</th>
                {dataset.columns.map((column) => {
                  const value = row.cells[column.id];
                  const isSelected = selection?.versionId === dataset.versionId && selection.rowId === row.id && selection.columnId === column.id;
                  return (
                    <td key={column.id} className={value === null ? 'missing-cell' : undefined}>
                      {onSelect ? (
                        <button
                          type="button"
                          className={`cell-button${isSelected ? ' is-selected' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => { onSelect({ versionId: dataset.versionId, rowId: row.id, columnId: column.id }); }}
                          aria-label={`Chọn dòng ${String(rowIndex + 1 + currentPage * safePageSize)}, cột ${column.name}: ${value === null ? 'thiếu dữ liệu' : String(value)}`}
                        >{value === null ? <span className="missing-tag">Thiếu</span> : String(value)}</button>
                      ) : (value === null ? <span className="missing-tag">Thiếu</span> : String(value))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dataset.rows.length === 0 && <p className="hint">Bộ dữ liệu chưa có dòng dữ liệu.</p>}
      <div className="pagination">
        <button type="button" className="quiet-button" disabled={currentPage === 0} onClick={() => { setPage((value) => Math.max(value - 1, 0)); }}>Trước</button>
        <span>Trang {currentPage + 1}/{pageCount}</span>
        <button type="button" className="quiet-button" disabled={currentPage >= pageCount - 1} onClick={() => { setPage((value) => Math.min(value + 1, pageCount - 1)); }}>Sau</button>
      </div>
      {dataset.rows.length > 2000 && <p className="hint">Bảng hiện phân trang theo phần dữ liệu đã có trong bộ nhớ; cần tích hợp virtualized table cho CSV rất lớn.</p>}
    </section>
  );
}
