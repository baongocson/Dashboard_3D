
import {
  getDatasetSummary,
} from '../stats/getDatasetSummary.js';

import {
  getColumnStatistics,
} from '../stats/getColumnStatistics.js';

import {
  detectMissingValues,
} from '../missing/detectMissingValues.js';

import type {
  WorkerRequest,
  WorkerResponse,
} from './workerMessages.js';

export function processWorkerRequest(
  request: WorkerRequest,
): WorkerResponse {
  try {
    switch (request.type) {
      case 'dataset-summary':
        return {
          taskId: request.taskId,
          status: 'success',
          type: 'dataset-summary',
          result: getDatasetSummary(request.dataset),
        };

      case 'column-statistics':
        return {
          taskId: request.taskId,
          status: 'success',
          type: 'column-statistics',
          result: getColumnStatistics(
            request.dataset,
            request.columnId,
          ),
        };

      case 'missing-values':
        return {
          taskId: request.taskId,
          status: 'success',
          type: 'missing-values',
          result: detectMissingValues(request.dataset),
        };
    }
  } catch (error: unknown) {
    return {
      taskId: request.taskId,
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'Unknown worker processing error',
    };
  }
}
