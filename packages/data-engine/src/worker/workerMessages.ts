
import type { Dataset } from '@dashboard/contracts';

import type {
  DatasetSummary,
} from '../stats/getDatasetSummary.js';

import type {
  ColumnStatistics,
} from '../stats/getColumnStatistics.js';

import type {
  MissingValuesReport,
} from '../missing/detectMissingValues.js';

export type WorkerTaskType =
  | 'dataset-summary'
  | 'column-statistics'
  | 'missing-values';

export type WorkerRequest =
  | {
      taskId: string;
      type: 'dataset-summary';
      dataset: Dataset;
    }
  | {
      taskId: string;
      type: 'column-statistics';
      dataset: Dataset;
      columnId: string;
    }
  | {
      taskId: string;
      type: 'missing-values';
      dataset: Dataset;
    };

export type WorkerResponse =
  | {
      taskId: string;
      status: 'success';
      type: 'dataset-summary';
      result: DatasetSummary;
    }
  | {
      taskId: string;
      status: 'success';
      type: 'column-statistics';
      result: ColumnStatistics;
    }
  | {
      taskId: string;
      status: 'success';
      type: 'missing-values';
      result: MissingValuesReport;
    }
  | {
      taskId: string;
      status: 'error';
      message: string;
    };


export interface WorkerProgress {
  taskId: string;
  status: 'progress';
  completed: number;
  total: number;
  percentage: number;
}

export interface WorkerCancelRequest {
  taskId: string;
  type: 'cancel';
}

export interface WorkerCancelledResponse {
  taskId: string;
  status: 'cancelled';
}


export interface WorkerChunkRequest {
  taskId: string;
  type: 'process-chunks';
  dataset: Dataset;
  chunkSize: number;
}

export interface WorkerChunkSuccess {
  taskId: string;
  status: 'success';
  type: 'process-chunks';
  result: {
    processedRows: number;
  };
}

export type WorkerRuntimeRequest =
  | WorkerRequest
  | WorkerChunkRequest
  | WorkerCancelRequest;

export type WorkerRuntimeResponse =
  | WorkerResponse
  | WorkerChunkSuccess
  | WorkerProgress
  | WorkerCancelledResponse;
