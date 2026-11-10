
import type { Dataset } from '@dashboard/contracts';

import {
  createMissingProposals,
  type MissingFillRequest,
} from './createMissingProposals.js';

import {
  applyMissingProposals,
} from './applyMissingProposals.js';

import {
  createDatasetHistory,
  getCurrentDataset,
  pushDatasetVersion,
  undoDataset,
  redoDataset,
  type DatasetHistory,
} from '../history/datasetHistory.js';

export interface MissingWorkflowResult {
  history: DatasetHistory;
  dataset: Dataset;
}

export function startMissingWorkflow(
  dataset: Dataset,
): DatasetHistory {
  return createDatasetHistory(dataset);
}

export function executeMissingWorkflow(
  history: DatasetHistory,
  requests: readonly MissingFillRequest[],
  newVersionId: string,
): MissingWorkflowResult {
  const currentDataset = getCurrentDataset(history);

  const proposals = createMissingProposals(
    currentDataset,
    requests,
  );

  const nextDataset = applyMissingProposals(
    currentDataset,
    proposals,
    newVersionId,
  );

  const nextHistory = pushDatasetVersion(
    history,
    nextDataset,
  );

  return {
    history: nextHistory,
    dataset: getCurrentDataset(nextHistory),
  };
}

export function undoMissingWorkflow(
  history: DatasetHistory,
): MissingWorkflowResult {
  const nextHistory = undoDataset(history);

  return {
    history: nextHistory,
    dataset: getCurrentDataset(nextHistory),
  };
}

export function redoMissingWorkflow(
  history: DatasetHistory,
): MissingWorkflowResult {
  const nextHistory = redoDataset(history);

  return {
    history: nextHistory,
    dataset: getCurrentDataset(nextHistory),
  };
}
