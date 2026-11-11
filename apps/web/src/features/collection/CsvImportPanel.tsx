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
      setError(caught instanceof Error ? caught.message : 'CSV import failed. Please try again.');
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
          setError('Select exactly one CSV file.');
          return;
        }
        const selected = event.dataTransfer.files.item(0);
        setFile(selected);
        setProposedHeaders(null);
        setOptions({ ...options, confirmedHeaders: null });
        setError(selected ? validateCsvInput(selected, options) : 'Cannot read the dropped file.');
      }}
    >
      <div className="panel-heading">
        <h2 id="import-title">Import CSV</h2>
        <span className="chip">20 MB Limit</span>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label className="form-label" htmlFor="csv-file">
          Select or Drop a CSV File
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
          Maximum {MAX_CSV_BYTES.toLocaleString('en-US')} byte.
        </p>
        {file && (
          <p className="file-detail">
            {file.name} · {file.size.toLocaleString('en-US')} byte
          </p>
        )}
        <div className="form-two-columns">
          <label className="form-field">
            <span className="form-label">Delimiter</span>
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
              <option value="auto">Auto-detect</option>
              <option value=",">Comma (,)</option>
              <option value=";">Semicolon (;)</option>
              <option value={'\t'}>Tab</option>
            </select>
          </label>
          <label className="form-field">
            <span className="form-label">Header</span>
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
              <option value="first-row">First Row as Header</option>
              <option value="generated">Generate Column Names</option>
            </select>
          </label>
        </div>
        {proposedHeaders !== null && (
          <div className="header-confirmation">
            <label className="form-field">
              <span>Proposed Column Names</span>
              <textarea
                aria-label="Proposed Column Names"
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
                  setError('Column names must be nonempty and unique.');
                  return;
                }
                setOptions({ ...options, confirmedHeaders: names });
                setProposedHeaders(null);
                setError(null);
              }}
            >
              Confirm Column Names
            </button>
          </div>
        )}
        {options.confirmedHeaders && (
          <p className="hint">Confirmed Columns: {options.confirmedHeaders.join(', ')}</p>
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
            <p>{status.message ?? 'Reading data…'}</p>
            {status.percent !== undefined && (
              <progress
                max={100}
                value={Math.max(0, Math.min(100, status.percent))}
                aria-label="CSV Import Progress"
              />
            )}
          </div>
        )}
        {unavailable && <p className="integration-note">Import is unavailable.</p>}
        <div className="action-row">
          <button
            className="primary-button"
            type="submit"
            disabled={busy || unavailable || !file || error !== null}
          >
            {busy ? 'Processing…' : 'Analyze Data'}
          </button>
          {busy && onCancel && (status.phase !== 'processing' || (status.percent ?? 0) < 90) && (
            <button type="button" className="quiet-button" onClick={onCancel}>
              Cancel Processing
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
