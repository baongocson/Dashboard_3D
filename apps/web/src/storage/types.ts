import type { z } from 'zod';

import {
  datasetSchema,
  versionSchema,
  manifestSchema,
  chartSchema,
  historySchema,
  outboxSchema,
} from '@dashboard/contracts';

// Types lấy trực tiếp từ contracts chính thức
export type Dataset = z.infer<typeof datasetSchema>;
export type LocalVersionRecord = z.infer<typeof versionSchema>;
export type LocalManifestRecord = z.infer<typeof manifestSchema>;
export type LocalHistoryRecord = z.infer<typeof historySchema>;
export type LocalOutboxRecord = z.infer<typeof outboxSchema>;
export type Chart = z.infer<typeof chartSchema>;

// Bản ghi dataset bổ sung dành riêng cho IndexedDB
export type LocalDatasetRecord = {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  payload: Dataset;
};

// Dữ liệu nhị phân của chunk nằm trong IndexedDB.
// Metadata tương ứng với chunkReferenceSchema.
export type LocalChunkRecord = {
  id: string;
  manifestId: string;
  ordinal: number;
  bytes: number;
  sha256: string;
  data: ArrayBuffer;
};

// Wrapper lưu chart local, payload tuân theo chartSchema
export type LocalChartRecord = {
  id: string;
  projectId: string;
  versionId: string;
  createdAt: string;
  updatedAt: string;
  payload: Chart;
};
