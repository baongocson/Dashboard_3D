import { useState } from 'react';
import type { ChangeEvent, SyntheticEvent } from 'react';
import { MAX_CSV_BYTES } from '@dashboard/contracts';
import { defaultCsvOptions, validateCsvInput } from './csvInput';
import type { CsvOptions, ImportStatus } from './csvInput';
import { HeadersRequiredError } from '../../workers/productClient';

type CsvImportPanelProps = {
  onImport?: ((file: File, options: CsvOptions) => Promise<void>) | undefined;
  status: ImportStatus;
  onCancel?: (() => void) | undefined;
};

const optionalMissingTokens = ['NA', 'null', '-'] as const;

export function CsvImportPanel({ onImport, status, onCancel }: CsvImportPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [options, setOptions] = useState<CsvOptions>(defaultCsvOptions);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [proposedHeaders, setProposedHeaders] = useState<string | null>(null);
  const busy = submitting || status.phase === 'processing';
  const unavailable = onImport === undefined;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.item(0) ?? null;
    setFile(selected);
    setProposedHeaders(null);
    setOptions({ ...options, confirmedHeaders: null });
    setError(selected ? validateCsvInput(selected, options) : null);
  }

  function toggleMissingToken(token: string, checked: boolean) {
    const nextTokens = checked
      ? [...options.additionalMissingTokens, token]
      : options.additionalMissingTokens.filter((item) => item !== token);
    setOptions({ ...options, additionalMissingTokens: nextTokens });
    setError(null);
  }

  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateCsvInput(file, options);
    setError(validationError);
    if (validationError || !file || !onImport || busy) return;
    setSubmitting(true);
    try {
      await onImport(file, options);
    } catch (caught: unknown) {
      if (caught instanceof HeadersRequiredError) setProposedHeaders(caught.headers.join('\n'));
      setError(caught instanceof Error ? caught.message : 'Không thể nhập CSV. Hãy thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="panel import-panel"
      aria-labelledby="import-title"
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (busy) return;
        if (event.dataTransfer.files.length !== 1) {
          setError('Chọn đúng một tệp CSV.');
          return;
        }
        const selected = event.dataTransfer.files.item(0);
        setFile(selected);
        setProposedHeaders(null);
        setOptions({ ...options, confirmedHeaders: null });
        setError(selected ? validateCsvInput(selected, options) : 'Không đọc được tệp kéo thả.');
      }}
    >
      <div className="panel-heading">
        <h2 id="import-title">Nhập dữ liệu CSV</h2>
        <span className="chip">Giới hạn 20 MB</span>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label className="form-label" htmlFor="csv-file">
          Chọn hoặc kéo thả tệp .csv
        </label>
        <input
          id="csv-file"
          className="file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={busy}
          aria-describedby="csv-limit"
        />
        <p className="hint" id="csv-limit">
          Tối đa {MAX_CSV_BYTES.toLocaleString('vi-VN')} byte. Kiểm tra dung lượng trước khi đọc.
        </p>
        {file && (
          <p className="file-detail">
            {file.name} · {file.size.toLocaleString('vi-VN')} byte
          </p>
        )}
        <div className="form-two-columns">
          <label className="form-field">
            <span className="form-label">Dấu phân cách</span>
            <select
              value={options.delimiter}
              disabled={busy}
              onChange={(event) => {
                const value = event.target.value;
                if (value === 'auto' || value === ',' || value === ';' || value === '\t') {
                  setOptions({ ...options, delimiter: value });
                  setError(null);
                }
              }}
            >
              <option value="auto">Tự phát hiện</option>
              <option value=",">Dấu phẩy (,)</option>
              <option value=";">Chấm phẩy (;)</option>
              <option value={'\t'}>Tab</option>
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Dòng tiêu đề</span>
            <select
              value={options.header}
              disabled={busy}
              onChange={(event) => {
                setOptions({
                  ...options,
                  header: event.target.value === 'generated' ? 'generated' : 'first-row',
                });
                setError(null);
              }}
            >
              <option value="first-row">Dòng đầu là tiêu đề</option>
              <option value="generated">Tự tạo tên cột</option>
            </select>
          </label>
        </div>
        <fieldset className="token-fieldset" disabled={busy}>
          <legend className="form-label">Coi chuỗi sau là giá trị thiếu (tùy chọn)</legend>
          <div className="token-row">
            {optionalMissingTokens.map((token) => (
              <label className="token-label" key={token}>
                <input
                  type="checkbox"
                  checked={options.additionalMissingTokens.includes(token)}
                  onChange={(event) => {
                    toggleMissingToken(token, event.target.checked);
                  }}
                />
                <span>{token}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {proposedHeaders !== null && (
          <div className="header-confirmation">
            <label className="form-field">
              <span>Tên cột đề xuất (mỗi dòng một tên)</span>
              <textarea
                aria-label="Tên cột đề xuất"
                value={proposedHeaders}
                onChange={(event) => {
                  setProposedHeaders(event.target.value);
                }}
              />
            </label>
            <button
              className="quiet-button"
              type="button"
              disabled={busy}
              onClick={() => {
                const names = proposedHeaders.split('\n').map((name) => name.trim());
                if (names.some((name) => !name) || new Set(names).size !== names.length) {
                  setError('Tên cột phải không rỗng và không trùng.');
                  return;
                }
                setOptions({ ...options, confirmedHeaders: names });
                setProposedHeaders(null);
                setError(null);
              }}
            >
              Xác nhận tên cột
            </button>
          </div>
        )}
        {options.confirmedHeaders && (
          <p className="hint">Tên cột đã xác nhận: {options.confirmedHeaders.join(', ')}</p>
        )}
        {error && (
          <p className="alert alert-error" role="alert">
            {error}
          </p>
        )}
        {status.phase === 'error' && (
          <p className="alert alert-error" role="alert">
            {status.message}
          </p>
        )}
        {status.phase === 'processing' && (
          <div role="status" className="progress-state">
            <p>{status.message ?? 'Đang đọc dữ liệu…'}</p>
            {status.percent !== undefined && (
              <progress
                max={100}
                value={Math.max(0, Math.min(100, status.percent))}
                aria-label="Tiến độ đọc CSV"
              />
            )}
          </div>
        )}
        {unavailable && (
          <p className="integration-note">
            Chưa kết nối CSV Worker. Có thể chọn và cấu hình tệp, nhưng chưa thể nhập thật.
          </p>
        )}
        <div className="action-row">
          <button
            className="primary-button"
            type="submit"
            disabled={busy || unavailable || !file || error !== null}
          >
            {busy ? 'Đang xử lý…' : 'Phân tích dữ liệu'}
          </button>
          {busy && onCancel && (status.phase !== 'processing' || (status.percent ?? 0) < 90) && (
            <button type="button" className="quiet-button" onClick={onCancel}>
              Hủy xử lý
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
