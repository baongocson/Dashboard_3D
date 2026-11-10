import { useMemo, useRef, useState } from "react";
import Scene3D from "./Scene3D";
import {
  demo,
  derivePoints,
  missingStats,
  numericColumns,
  parseCsv,
} from "./data";
import type { DataRow, DataSet, Status } from "./data";

const statusLabel: Record<Status, string> = {
  normal: "Bình thường",
  missing: "Thiếu dữ liệu",
  outlier: "Ngoại lệ",
};
const statusOptions: Status[] = ["normal", "missing", "outlier"];
export default function App() {
  const [ds, setDs] = useState<DataSet>(demo);
  const [mode, setMode] = useState<"scatter" | "bars">("scatter");
  const [selectedId, setSelectedId] = useState<string | null>("R001");
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);
  const [visible, setVisible] = useState<Record<Status, boolean>>({
    normal: true,
    missing: true,
    outlier: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [axis, setAxis] = useState<[string, string, string]>([
    "Tuổi",
    "Thu nhập",
    "Chi tiêu",
  ]);
  const [activeTab, setActiveTab] = useState<"data" | "summary">("data");
  const tableRef = useRef<HTMLDivElement>(null);
  const nums = useMemo(() => numericColumns(ds), [ds]);
  const effectiveAxis = useMemo<[string, string, string]>(
    () =>
      [0, 1, 2].map((i) =>
        nums.includes(axis[i]) ? axis[i] : (nums[i % (nums.length || 1)] ?? ""),
      ) as [string, string, string],
    [axis, nums],
  );
  const points = useMemo(
    () => (nums.length ? derivePoints(ds, effectiveAxis) : []),
    [ds, effectiveAxis, nums],
  );
  const stats = useMemo(() => missingStats(ds), [ds]);
  const chosen = ds.rows.find((r) => r.rowId === selectedId);
  const filtered = ds.rows.filter(
    (row) =>
      row.rowId.toLowerCase().includes(search.toLowerCase()) ||
      ds.columns.some((c) =>
        row.values[c].toLowerCase().includes(search.toLowerCase()),
      ),
  );
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const tableRows = filtered.slice(
    currentPage * pageSize,
    (currentPage + 1) * pageSize,
  );
  const missingCount = ds.rows.filter((r) =>
    ds.columns.some((c) => r.values[c].trim() === ""),
  ).length;
  const outlierCount = ds.rows.filter((r) => r.status === "outlier").length;
  const choose = (rowId: string) => {
    setSelectedId(rowId);
    setActiveTab("data");
    setSearch("");
    const idx = ds.rows.findIndex((r) => r.rowId === rowId);
    setPage(Math.floor(idx / pageSize));
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  async function importFile(file?: File) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new Error("Vui lòng chọn file .csv.");
      if (file.size > 8 * 1024 * 1024)
        throw new Error("Bản demo hỗ trợ CSV tối đa 8 MB.");
      const loaded = parseCsv(await file.text(), file.name);
      setDs(loaded);
      setAxis(["", "", ""]);
      setSelectedId(loaded.rows[0]?.rowId ?? null);
      setSelectedColumn(null);
      setSearch("");
      setPage(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể đọc CSV.");
    } finally {
      setLoading(false);
    }
  }
  function reset() {
    setDs(demo);
    setSelectedId("R001");
    setSelectedColumn(null);
    setAxis(["Tuổi", "Thu nhập", "Chi tiêu"]);
    setSearch("");
    setPage(0);
    setError(null);
  }
  function toggleStatus(status: Status) {
    setVisible((prev) => ({ ...prev, [status]: !prev[status] }));
  }
  return (
    <main className="app-shell">
      <aside className="rail">
        <div className="mark">
          N<span>◆</span>
        </div>
        <div className="rail-icon active" title="Dashboard">
          ▦
        </div>
        <div className="rail-icon" title="Visualization">
          ◈
        </div>
        <div className="rail-icon" title="Data">
          ▤
        </div>
        <div className="rail-bottom">3D</div>
      </aside>
      <div className="content">
        <header className="topbar">
          <div>
            <div className="eyebrow">DATA MINING / MODULE NGA</div>
            <h1>Interactive Data Sculpture</h1>
            <p>Trực quan hóa 3D · tương tác dữ liệu · liên kết bảng</p>
          </div>
          <div className="top-actions">
            <span className="pill light">● Frontend 3D</span>
            <button className="btn subdued" onClick={reset}>
              ↺ Dữ liệu mẫu
            </button>
            <label className="btn primary upload">
              ＋ Tải CSV
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  void importFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        {loading && <div className="notice">Đang đọc dữ liệu…</div>}
        <div className="metrics">
          <div className="metric">
            <div className="mini-label">DATASET</div>
            <div className="metric-value file">{ds.source}</div>
            <div className="metric-sub">Version: {ds.versionId}</div>
          </div>
          <div className="metric">
            <div className="mini-label">BẢN GHI</div>
            <div className="metric-value">
              {ds.rows.length.toLocaleString("vi-VN")}
            </div>
            <div className="metric-sub">Đã đọc từ bộ dữ liệu</div>
          </div>
          <div className="metric">
            <div className="mini-label">THUỘC TÍNH</div>
            <div className="metric-value">{ds.columns.length}</div>
            <div className="metric-sub">{nums.length} cột số</div>
          </div>
          <div className="metric">
            <div className="mini-label">HÀNG CÓ GIÁ TRỊ THIẾU</div>
            <div className="metric-value peach">{missingCount}</div>
            <div className="metric-sub">Không tự động sửa dữ liệu</div>
          </div>
          <div className="metric">
            <div className="mini-label">NGOẠI LỆ ĐƯỢC GẮN NHÃN</div>
            <div className="metric-value pink">{outlierCount}</div>
            <div className="metric-sub">
              Demo có nhãn mẫu; CSV chưa phát hiện
            </div>
          </div>
        </div>
        <div className="work-grid">
          <section className="viz-panel">
            <div className="panel-head">
              <div>
                <span className="mini-label">INTERACTIVE VISUALIZATION</span>
                <h2>Không gian phân tích 3D</h2>
              </div>
              <div className="switch">
                <button
                  className={mode === "scatter" ? "chosen" : ""}
                  onClick={() => setMode("scatter")}
                >
                  ◌ Scatter 3D
                </button>
                <button
                  className={mode === "bars" ? "chosen" : ""}
                  onClick={() => setMode("bars")}
                >
                  ▥ Missing 3D
                </button>
              </div>
            </div>
            {mode === "scatter" && (
              <div className="axis-controls">
                {[0, 1, 2].map((i) => (
                  <label key={i}>
                    Trục {["X", "Y", "Z"][i]}{" "}
                    <select
                      aria-label={`Trục ${["X", "Y", "Z"][i]}`}
                      value={effectiveAxis[i]}
                      onChange={(e) =>
                        setAxis(
                          (prev) =>
                            prev.map((v, j) =>
                              j === i ? e.target.value : effectiveAxis[j],
                            ) as [string, string, string],
                        )
                      }
                    >
                      {nums.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                ))}
                {nums.length < 3 && (
                  <span className="axis-warning">
                    Cần ≥ 3 cột số để có scatter 3D đầy đủ.
                  </span>
                )}
              </div>
            )}
            <div className="scene-wrap">
              {mode === "scatter" && !nums.length ? (
                <div className="empty">
                  CSV chưa có cột số để dựng Scatter 3D. Bạn có thể xem biểu đồ
                  Missing 3D.
                </div>
              ) : (
                <Scene3D
                  points={points}
                  stats={stats}
                  mode={mode}
                  selectedId={selectedId}
                  selectedColumn={selectedColumn}
                  onSelectRow={choose}
                  onSelectColumn={setSelectedColumn}
                  visible={visible}
                />
              )}
            </div>
            <div className="scene-footer">
              <div className="legend">
                {statusOptions.map((s) => (
                  <button
                    key={s}
                    className={`legend-item ${visible[s] ? "" : "disabled"}`}
                    onClick={() => toggleStatus(s)}
                    title="Bật/tắt nhóm điểm"
                  >
                    <span className={`legend-dot ${s}`} />
                    {statusLabel[s]}
                  </button>
                ))}
              </div>
              <div className="footer-small">
                {mode === "scatter"
                  ? `Đang vẽ ${Math.min(1500, ds.rows.length)} điểm tối đa`
                  : `Đang xem ${Math.min(stats.length, 10)} thuộc tính đầu tiên`}
              </div>
            </div>
          </section>
          <aside className="details-panel">
            <div className="panel-head slim">
              <div>
                <span className="mini-label">SELECTION INSPECTOR</span>
                <h2>Thông tin được chọn</h2>
              </div>
              <span className="live-dot" />
            </div>
            {mode === "scatter" ? (
              chosen ? (
                <div className="selection">
                  <div className="selected-label">DÒNG ĐANG CHỌN</div>
                  <div className="selected-hero">
                    {chosen.rowId}
                    <span className={`state-chip ${chosen.status}`}>
                      {statusLabel[chosen.status]}
                    </span>
                  </div>
                  <div className="attribute-list">
                    {ds.columns.map((c) => (
                      <div className="attribute" key={c}>
                        <span>{c}</span>
                        <strong>{chosen.values[c] || <em>Trống</em>}</strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn subdued full"
                    onClick={() => {
                      setActiveTab("data");
                      tableRef.current?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Xem trong bảng dữ liệu ↗
                  </button>
                </div>
              ) : (
                <div className="empty-mini">
                  Nhấn một điểm để xem thông tin.
                </div>
              )
            ) : (
              <div className="selection">
                <div className="selected-label">THUỘC TÍNH ĐANG CHỌN</div>
                <div className="selected-hero small">
                  {selectedColumn ?? "Chọn một cột"}
                </div>
                {selectedColumn && (
                  <div className="attribute-list">
                    <div className="attribute">
                      <span>Giá trị thiếu</span>
                      <strong>
                        {stats.find((s) => s.name === selectedColumn)
                          ?.missing ?? 0}
                      </strong>
                    </div>
                    <div className="attribute">
                      <span>Tổng số dòng</span>
                      <strong>{ds.rows.length}</strong>
                    </div>
                  </div>
                )}
                <p className="help-note">
                  Chiều cao cột biểu diễn tỷ lệ % dữ liệu bị thiếu. Không có
                  nhãn dưới chân cột theo yêu cầu.
                </p>
              </div>
            )}
            <div className="details-bottom">
              <div className="mini-label">TRẠNG THÁI KẾT NỐI</div>
              <div className="connection">● Mock / Local data</div>
              <p>
                Dữ liệu xử lý từ Nguyên có thể nối qua <code>DataSet</code> với{" "}
                <code>rowId</code> và <code>versionId</code>. Đây chưa phải kết
                nối backend thật.
              </p>
            </div>
          </aside>
        </div>
        <section className="table-panel" ref={tableRef}>
          <div className="panel-head">
            <div>
              <span className="mini-label">DATA EXPLORER</span>
              <h2>Bảng dữ liệu liên kết</h2>
            </div>
            <div className="table-actions">
              <button
                className={activeTab === "data" ? "tab selected" : "tab"}
                onClick={() => setActiveTab("data")}
              >
                Bản ghi
              </button>
              <button
                className={activeTab === "summary" ? "tab selected" : "tab"}
                onClick={() => setActiveTab("summary")}
              >
                Thiếu dữ liệu
              </button>
            </div>
          </div>
          {activeTab === "data" ? (
            <>
              <div className="table-toolbar">
                <input
                  aria-label="Tìm bản ghi"
                  placeholder="⌕ Tìm theo mã dòng hoặc giá trị…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
                <span>{filtered.length} bản ghi phù hợp</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Mã dòng</th>
                      <th>Trạng thái</th>
                      {ds.columns.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => (
                      <tr
                        key={row.rowId}
                        className={selectedId === row.rowId ? "active-row" : ""}
                        onClick={() => {
                          setSelectedId(row.rowId);
                          setMode("scatter");
                        }}
                      >
                        <td className="id-cell">{row.rowId}</td>
                        <td>
                          <span className={`state-chip ${row.status}`}>
                            {statusLabel[row.status]}
                          </span>
                        </td>
                        {ds.columns.map((c) => (
                          <td key={c}>{row.values[c] || <em>Trống</em>}</td>
                        ))}
                      </tr>
                    ))}
                    {!tableRows.length && (
                      <tr>
                        <td colSpan={2 + ds.columns.length}>
                          Không có bản ghi phù hợp.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <span>
                  Trang {currentPage + 1} / {pageCount}
                </span>
                <div>
                  <button
                    className="btn subdued"
                    onClick={() => setPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                  >
                    ← Trước
                  </button>
                  <button
                    className="btn subdued"
                    onClick={() =>
                      setPage(Math.min(pageCount - 1, currentPage + 1))
                    }
                    disabled={currentPage >= pageCount - 1}
                  >
                    Sau →
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="summary-bars">
              {stats.map((s) => (
                <div className="summary-row" key={s.name}>
                  <span>{s.name}</span>
                  <div className="progress">
                    <div
                      style={{
                        width: `${s.total ? (100 * s.missing) / s.total : 0}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {s.missing} / {s.total} (
                    {s.total ? ((100 * s.missing) / s.total).toFixed(1) : "0"}%)
                  </strong>
                </div>
              ))}
            </div>
          )}
        </section>
        <footer className="app-footer">
          NGA · Frontend 3D prototype · React + React Three Fiber · Dữ liệu chỉ
          chạy trong trình duyệt · Không tự upload lên server
        </footer>
      </div>
    </main>
  );
}
