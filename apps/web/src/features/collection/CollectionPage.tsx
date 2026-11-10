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
}: CollectionPageProps) {
  return (
    <main className="workspace collection-workspace">
      <p className="eyebrow">01 / COLLECTION — THU THẬP DỮ LIỆU</p>
      <h1>Bắt đầu từ dữ liệu của bạn.</h1>
      <p className="intro">
        Chọn file CSV, kiểm tra dữ liệu đầu vào và chỉ chuyển bước khi đã có dữ liệu hợp lệ.
      </p>
      {demoMode && (
        <p className="alert alert-demo" role="note">
          CHẾ ĐỘ MẪU (chỉ dev): bảng bên dưới là fixture để kiểm tra UI. Chưa nhập CSV thật, chưa
          lưu trên máy.
        </p>
      )}
      <div className="collection-grid">
        <CsvImportPanel onImport={onImport} status={importStatus} onCancel={onCancelImport} />
        <section className="panel dataset-overview" aria-labelledby="overview-title">
          <div className="panel-heading">
            <h2 id="overview-title">Tổng quan dữ liệu</h2>
            <span className="chip">Collection</span>
          </div>
          {dataset ? (
            <>
              <p className="hint">
                Nguồn: <strong>{fileName ?? 'Chưa có tên nguồn'}</strong>
                {fileBytes === undefined ? '' : ` · ${fileBytes.toLocaleString('vi-VN')} byte`}
              </p>
              <div className="stat-grid">
                <div className="metric">
                  <span>Số dòng</span>
                  <strong>{dataset.rows.length.toLocaleString('vi-VN')}</strong>
                </div>
                <div className="metric">
                  <span>Số cột</span>
                  <strong>{dataset.columns.length.toLocaleString('vi-VN')}</strong>
                </div>
                <div className="metric">
                  <span>Ô thiếu</span>
                  <strong>
                    {statistics ? statistics.missingCells.toLocaleString('vi-VN') : 'Chưa tính'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Dòng có thiếu</span>
                  <strong>
                    {statistics ? statistics.rowsWithMissing.toLocaleString('vi-VN') : 'Chưa tính'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Tỷ lệ thiếu</span>
                  <strong>
                    {statistics && dataset.rows.length
                      ? `${((statistics.missingCells / (dataset.rows.length * dataset.columns.length)) * 100).toFixed(2)}%`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Dòng trùng dư</span>
                  <strong>
                    {statistics
                      ? statistics.duplicateExcessRows.toLocaleString('vi-VN')
                      : 'Chưa tính'}
                  </strong>
                </div>
                <div className="metric">
                  <span>Ô ngoại lệ</span>
                  <strong>
                    {statistics?.outlierCells === null || !statistics
                      ? 'Chưa tính'
                      : statistics.outlierCells.toLocaleString('vi-VN')}
                  </strong>
                </div>
                <div className="metric">
                  <span>Dòng có ngoại lệ</span>
                  <strong>
                    {statistics?.outlierRows === null || !statistics
                      ? 'Chưa tính'
                      : statistics.outlierRows.toLocaleString('vi-VN')}
                  </strong>
                </div>
              </div>
              <p className="hint">
                {statistics
                  ? statistics.methodNote
                  : 'Thống kê IQR và tương quan đang chờ được tính.'}
              </p>
            </>
          ) : (
            <div className="empty-state" aria-labelledby="collection-title">
              <div className="file-mark" aria-hidden="true">
                CSV
              </div>
              <h2 id="collection-title">Chưa có dữ liệu</h2>
              <p>
                Chọn tệp CSV tại khung bên trái. Chưa thể hiển thị bảng trước khi Worker trả Dataset
                hợp lệ.
              </p>
              <p className="limit">CSV · Tối đa 20 MB (20.000.000 byte)</p>
            </div>
          )}
        </section>
      </div>
      {dataset && <DatasetTable dataset={dataset} />}
      <div className="bottom-actions">
        <p className="scope-note" role="status">
          {dataset
            ? 'Collection giữ dữ liệu nguồn. Trạng thái lưu trên máy và đồng bộ được hiển thị riêng phía trên.'
            : 'Nhập CSV để tạo project và phiên làm việc mới.'}
        </p>
        <button className="primary-button" type="button" disabled={!dataset} onClick={onNext}>
          Next — Pre-processing
        </button>
      </div>
    </main>
  );
}
