import type { Dataset } from '@dashboard/contracts';
import { DatasetTable } from '../../components/DatasetTable';
import { CsvImportPanel } from './CsvImportPanel';
import type { CsvOptions, ImportStatus } from './csvInput';

export type CollectionStatistics = {
  missingCells: number;
  rowsWithMissing: number;
  duplicateExcessRows: number;
  outlierCells: number | null;
  outlierRows: number | null;
  methodNote: string;
};

type CollectionPageProps = {
  dataset: Dataset | null;
  fileName?: string | undefined;
  fileBytes?: number | undefined;
  statistics?: CollectionStatistics | null;
  importStatus?: ImportStatus;
  onImport?: ((file: File, options: CsvOptions) => Promise<void>) | undefined;
  onCancelImport?: (() => void) | undefined;
  onNext: () => void;
  demoMode?: boolean;
  nextBusy?: boolean;
};

export function CollectionPage({
  dataset,
  fileName,
  fileBytes,
  statistics,
  importStatus = { phase: 'idle' },
  onImport,
  onCancelImport,
  onNext,
  demoMode = false,
  nextBusy = false,
}: CollectionPageProps) {
  return (
    <main className="workspace collection-workspace">
      <p className="eyebrow">01 / COLLECTION</p>
      <h1>Import and Explore Data</h1>

      {demoMode && (
        <p className="alert alert-demo" role="note">
          TEST FIXTURE — synthetic data, not a saved project.
        </p>
      )}
      <div className="collection-grid">
        <CsvImportPanel onImport={onImport} status={importStatus} onCancel={onCancelImport} />
        <section className="panel dataset-overview" aria-labelledby="overview-title">
          <div className="panel-heading">
            <h2 id="overview-title">Dataset Overview</h2>
            <span className="chip">Collection</span>
          </div>
          {dataset ? (
            <>
              <p className="hint">
                Source: <strong>{fileName ?? 'Untitled Source'}</strong>
                {fileBytes === undefined ? '' : ` · ${fileBytes.toLocaleString('en-US')} byte`}
              </p>
              <div className="stat-grid">
                <div className="metric">
                  <span>Rows</span>
                  <strong>{dataset.rows.length.toLocaleString('en-US')}</strong>
                </div>
                <div className="metric">
                  <span>Columns</span>
                  <strong>{dataset.columns.length.toLocaleString('en-US')}</strong>
                </div>
                <div className="metric">
                  <span>Missing Cells</span>
                  <strong>
                    {statistics
                      ? statistics.missingCells.toLocaleString('en-US')
                      : 'Not Calculated'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Rows with Missing Values</span>
                  <strong>
                    {statistics
                      ? statistics.rowsWithMissing.toLocaleString('en-US')
                      : 'Not Calculated'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Missing Rate</span>
                  <strong>
                    {statistics && dataset.rows.length
                      ? `${((statistics.missingCells / (dataset.rows.length * dataset.columns.length)) * 100).toFixed(2)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Duplicate Rows</span>
                  <strong>
                    {statistics
                      ? statistics.duplicateExcessRows.toLocaleString('en-US')
                      : 'Not Calculated'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Outlier Cells</span>
                  <strong>
                    {statistics?.outlierCells === null || !statistics
                      ? 'Not Calculated'
                      : statistics.outlierCells.toLocaleString('en-US')}
                  </strong>
                </div>
                <div className="metric">
                  <span>Rows with Outliers</span>
                  <strong>
                    {statistics?.outlierRows === null || !statistics
                      ? 'Not Calculated'
                      : statistics.outlierRows.toLocaleString('en-US')}
                  </strong>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state" aria-labelledby="collection-title">
              <div className="file-mark" aria-hidden="true">
                CSV
              </div>
              <h2 id="collection-title">No Data</h2>
              <p>Select a CSV file to begin.</p>
              <p className="limit">CSV · Maximum 20 MB (20.000.000 byte)</p>
            </div>
          )}
        </section>
      </div>
      {dataset && <DatasetTable dataset={dataset} />}
      <div className="bottom-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!dataset || nextBusy}
          onClick={onNext}
        >
          {nextBusy ? 'Preparing…' : 'Preprocessing'}
        </button>
      </div>
    </main>
  );
}
