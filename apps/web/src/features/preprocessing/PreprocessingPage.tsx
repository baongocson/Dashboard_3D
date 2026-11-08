import { useState } from 'react';
import type { Dataset } from '@dashboard/contracts';
import { datasetSchema, previewSchema } from '@dashboard/contracts';
import { DatasetTable } from '../../components/DatasetTable';
import type { CellSelection } from '../../components/DatasetTable';
import { buildFillConfig, isPreviewCurrent, parseFillValue } from './previewRules';
import type { FillCellConfig, PreviewResult } from './previewRules';

export type ApplyOutcome = { dataset: Dataset; persistedLocally: boolean };

type PreprocessingPageProps = {
  dataset: Dataset;
  selection: CellSelection | null;
  onSelectionChange: (selection: CellSelection | null) => void;
  onBack: () => void;
  onPreview?: ((config: FillCellConfig) => Promise<PreviewResult>) | undefined;
  onApply?: ((preview: PreviewResult) => Promise<ApplyOutcome>) | undefined;
  onApplied?: (dataset: Dataset) => void;
  demoMode?: boolean;
};

const modules = [
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'missing', label: 'Missing values' },
  { id: 'outliers', label: 'Outliers' },
  { id: 'scaling', label: 'Chuẩn hóa thang đo' },
  { id: 'transformation', label: 'Transformation' },
  { id: 'encoding', label: 'Encoding' },
] as const;

export function PreprocessingPage({ dataset, selection, onSelectionChange, onBack, onPreview, onApply, onApplied, demoMode = false }: PreprocessingPageProps) {
  const [rawValue, setRawValue] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [operation, setOperation] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedColumn = selection?.versionId === dataset.versionId
    ? dataset.columns.find((column) => column.id === selection.columnId) : undefined;
  const selectedRow = selection?.versionId === dataset.versionId
    ? dataset.rows.find((row) => row.id === selection.rowId) : undefined;
  const selectedCell = selectedColumn && selectedRow ? selectedRow.cells[selectedColumn.id] : undefined;
  const isMissing = selectedCell === null;
  const parsedValue = selectedColumn ? parseFillValue(selectedColumn.type, rawValue) : null;
  const fillConfig = buildFillConfig(dataset, selection, rawValue);
  const previewIsCurrent = isPreviewCurrent(preview, fillConfig, dataset);
  const busy = operation !== null;

  function selectCell(next: CellSelection) {
    if (busy) return;
    onSelectionChange(next);
    setRawValue('');
    setPreview(null);
    setError(null);
    setNotice(null);
  }

  function changeValue(value: string) {
    setRawValue(value);
    setPreview(null);
    setError(null);
    setNotice(null);
  }

  async function requestPreview() {
    if (!onPreview || !fillConfig || busy) return;
    setOperation('preview');
    setError(null);
    setNotice(null);
    setPreview(null);
    try {
      const proposed = await onPreview(fillConfig);
      const checked = previewSchema.safeParse(proposed);
      if (!checked.success || !isPreviewCurrent(checked.data, fillConfig, dataset)) {
        throw new Error('Worker trả preview không khớp phiên bản hoặc cấu hình.');
      }
      setPreview(checked.data);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Không thể xem trước.');
    } finally {
      setOperation(null);
    }
  }

  async function applyPreview() {
    if (!onApply || !preview || !previewIsCurrent || preview.errors.length > 0 || preview.changes.cells === 0 || busy) return;
    setOperation('apply');
    setError(null);
    setNotice(null);
    try {
      // The adapter must publish data, history and outbox locally before resolving.
      const outcome = await onApply(preview);
      const checked = datasetSchema.safeParse(outcome.dataset);
      if (!checked.success || !outcome.persistedLocally || outcome.dataset.versionId === dataset.versionId) {
        throw new Error('Chưa có xác nhận commit local hợp lệ. Không thể báo Áp dụng thành công.');
      }
      onApplied?.(checked.data);
      onSelectionChange(null);
      setRawValue('');
      setPreview(null);
      setNotice('Áp dụng thành công. Adapter xác nhận đã commit dữ liệu trên máy; đồng bộ server là trạng thái riêng.');
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Lưu local thất bại. Dữ liệu đang hiển thị chưa được thay đổi.');
    } finally {
      setOperation(null);
    }
  }

  return (
    <main className="workspace preprocess-workspace">
      <div className="page-title-line">
        <div>
          <p className="eyebrow">02 / PRE-PROCESSING — TIỀN XỬ LÝ</p>
          <h1>Khám phá và xử lý dữ liệu</h1>
          <p className="intro">Chọn ô thiếu trong bảng, xem trước thay đổi, rồi mới áp dụng khi đã có kết nối lưu local thật.</p>
        </div>
        <button type="button" className="quiet-button" onClick={onBack} disabled={busy}>← Collection</button>
      </div>
      {demoMode && <p className="alert alert-demo" role="note">DỮ LIỆU MẪU: Preview trong chế độ dev chỉ kiểm tra giao diện, không phải Worker thật. Apply và Save chưa hoạt động.</p>}
      <div className="preprocess-layout">
        <nav className="panel module-nav" aria-label="Các bước tiền xử lý">
          <h2>Quy trình</h2>
          {modules.map((module) => (
            <button
              className={`module-button${module.id === 'missing' ? ' module-active' : ''}`}
              key={module.id}
              disabled={module.id !== 'missing'}
              type="button"
              aria-current={module.id === 'missing' ? 'step' : undefined}
            >
              {module.label}{module.id !== 'missing' && <span>Chưa tích hợp</span>}
            </button>
          ))}
        </nav>
        <section className="panel scene-panel" aria-labelledby="scene-title">
          <div className="panel-heading">
            <h2 id="scene-title">Không gian trực quan hóa 3D</h2>
            <span className="chip">Phiên bản: {dataset.versionId}</span>
          </div>
          <div className="scene-placeholder" role="note">
            <div className="scene-placeholder-icon" aria-hidden="true">3D</div>
            <strong>Chưa tích hợp scene 3D</strong>
            <p>Khu vực này dành cho component Three.js nhận Dataset và gửi lại selection bằng rowId, columnId, versionId.</p>
            <p>Hiện tại hãy chọn ô trực tiếp trong bảng bên dưới để kiểm tra giao diện.</p>
          </div>
          <div className="action-row">
            <button type="button" className="quiet-button" disabled>Phóng to / Thu nhỏ</button>
            <button type="button" className="quiet-button" disabled>Chạy lại biểu đồ</button>
          </div>
        </section>
        <section className="panel editor-panel" aria-labelledby="editor-title">
          <div className="panel-heading"><h2 id="editor-title">Xử lý Missing</h2><span className="chip">1 ô</span></div>
          <p className="hint">Chỉ cho phép điền một ô đang thiếu trong phiên bản dữ liệu hiện tại.</p>
          {selectedColumn && selectedRow ? (
            <div className="selected-details">
              <div><span>Cột</span><strong>{selectedColumn.name}</strong></div>
              <div><span>Dòng ID</span><strong>{selectedRow.id}</strong></div>
              <div><span>Kiểu dữ liệu</span><strong>{selectedColumn.type}</strong></div>
              <div><span>Giá trị hiện tại</span><strong>{isMissing ? 'Thiếu (null)' : String(selectedCell)}</strong></div>
            </div>
          ) : <p className="alert alert-muted">Chưa chọn ô. Hãy nhấn vào một ô thiếu trong bảng bên dưới.</p>}
          {!isMissing && selectedCell !== undefined && <p className="hint">Ô được chọn không bị thiếu. Form hiện chỉ hỗ trợ điền ô thiếu.</p>}
          <label className="form-field" htmlFor="fill-value">
            <span className="form-label">Giá trị thay thế</span>
            {selectedColumn?.type === 'boolean' ? (
              <select id="fill-value" value={rawValue} disabled={!isMissing || busy} onChange={(event) => { changeValue(event.target.value); }}>
                <option value="">Chọn giá trị</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : (
              <input id="fill-value" value={rawValue} type={selectedColumn?.type === 'number' ? 'number' : 'text'} disabled={!isMissing || busy} placeholder="Nhập giá trị" onChange={(event) => { changeValue(event.target.value); }} />
            )}
          </label>
          {isMissing && parsedValue && !parsedValue.valid && <p className="hint">{parsedValue.reason}</p>}
          {!onPreview && <p className="integration-note">Chưa nối Worker preview; nút Xem trước bị khóa.</p>}
          <div className="action-row">
            <button className="primary-button" type="button" disabled={!fillConfig || !onPreview || busy} onClick={() => { void requestPreview(); }}>
              {operation === 'preview' ? 'Đang xem trước…' : 'Xem trước'}
            </button>
            <button className="primary-button" type="button" disabled={!previewIsCurrent || !preview || preview.errors.length > 0 || preview.changes.cells === 0 || !onApply || busy} onClick={() => { void applyPreview(); }}>
              {operation === 'apply' ? 'Đang lưu…' : 'Áp dụng'}
            </button>
            <button type="button" className="quiet-button" disabled={!preview || busy} onClick={() => { setPreview(null); }}>Hủy preview</button>
          </div>
          {preview && previewIsCurrent && (
            <div className="preview-result" role="region" aria-label="Kết quả xem trước">
              <h3>Preview — Chưa thay đổi dữ liệu</h3>
              <p>Ô thay đổi: <strong>{preview.changes.cells}</strong>. Phiên bản nguồn: {preview.baseVersionId}.</p>
              {preview.examples.map((change) => (
                <p key={`${change.rowId}:${change.columnId}`}>
                  <span className="preview-before">{String(change.before)}</span> → <strong>{String(change.after)}</strong>
                </p>
              ))}
              {preview.warnings.map((warning, index) => <p key={`${warning.code}:${String(index)}`} className="hint">Cảnh báo: {warning.message}</p>)}
              {preview.errors.map((issue, index) => <p key={`${issue.code}:${String(index)}`} className="alert alert-error">Lỗi: {issue.message}</p>)}
              {!onApply && <p className="integration-note">Chưa nối storage commit. Không thể Áp dụng hoặc báo đã lưu.</p>}
            </div>
          )}
          {error && <p className="alert alert-error" role="alert">{error}</p>}
          {notice && <p className="alert alert-success" role="status">{notice}</p>}
        </section>
      </div>
      <DatasetTable dataset={dataset} selection={selection} onSelect={busy ? undefined : selectCell} />
    </main>
  );
}
