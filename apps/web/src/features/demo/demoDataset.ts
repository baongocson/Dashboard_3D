import type { Dataset } from '@dashboard/contracts';
import { datasetSchema } from '@dashboard/contracts';
import type { CollectionStatistics } from '../collection/CollectionPage';

// Deliberately DEV-ONLY fixture. Never treat it as imported CSV or saved data.
export const demoDataset: Dataset = datasetSchema.parse({
  versionId: 'demo-v1',
  columns: [
    { id: 'col-name', name: 'Tên', type: 'text' },
    { id: 'col-age', name: 'Tuổi', type: 'number' },
    { id: 'col-score', name: 'Điểm', type: 'number' },
    { id: 'col-area', name: 'Khu vực', type: 'text' },
  ],
  rows: [
    { id: 'row-001', cells: { 'col-name': 'An', 'col-age': 20, 'col-score': 8, 'col-area': 'TP.HCM' } },
    { id: 'row-002', cells: { 'col-name': 'Bình', 'col-age': 22, 'col-score': 7, 'col-area': 'Cà Mau' } },
    { id: 'row-003', cells: { 'col-name': 'Chi', 'col-age': null, 'col-score': 9, 'col-area': 'TP.HCM' } },
    { id: 'row-004', cells: { 'col-name': 'Dũng', 'col-age': 24, 'col-score': null, 'col-area': 'Đà Nẵng' } },
    { id: 'row-005', cells: { 'col-name': 'An', 'col-age': 20, 'col-score': 8, 'col-area': 'TP.HCM' } },
  ],
});

export const demoCollectionStatistics: CollectionStatistics = {
  missingCells: 2,
  rowsWithMissing: 2,
  duplicateExcessRows: 1,
  outlierCells: null,
  outlierRows: null,
  methodNote: 'Thống kê mẫu tĩnh: 2 ô thiếu, 2 dòng có thiếu, 1 dòng trùng dư. IQR và tương quan chưa chạy.',
};
