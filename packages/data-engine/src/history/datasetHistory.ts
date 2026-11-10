import { datasetSchema, type Dataset } from '@dashboard/contracts';

export interface DatasetHistory {
  versions: Dataset[];
  currentIndex: number;
}

function cloneDataset(dataset: Dataset): Dataset {
  return structuredClone(dataset);
}

export function createDatasetHistory(initialDataset: Dataset): DatasetHistory {
  const validated = datasetSchema.parse(initialDataset);

  return {
    versions: [cloneDataset(validated)],
    currentIndex: 0,
  };
}

export function getCurrentDataset(history: DatasetHistory): Dataset {
  const dataset = history.versions[history.currentIndex];

  if (dataset === undefined) {
    throw new Error('Invalid dataset history');
  }

  return cloneDataset(dataset);
}

export function pushDatasetVersion(history: DatasetHistory, nextDataset: Dataset): DatasetHistory {
  const validated = datasetSchema.parse(nextDataset);

  const current = history.versions[history.currentIndex];

  if (current === undefined) {
    throw new Error('Invalid dataset history');
  }

  if (validated.versionId === current.versionId) {
    throw new Error('New dataset version ID must differ from current version');
  }

  const retainedVersions = history.versions.slice(0, history.currentIndex + 1);

  if (retainedVersions.some((version) => version.versionId === validated.versionId)) {
    throw new Error('Duplicate dataset version ID');
  }

  return {
    versions: [...retainedVersions.map(cloneDataset), cloneDataset(validated)],
    currentIndex: retainedVersions.length,
  };
}

export function undoDataset(history: DatasetHistory): DatasetHistory {
  if (history.currentIndex <= 0) {
    return history;
  }

  return {
    versions: history.versions,
    currentIndex: history.currentIndex - 1,
  };
}

export function redoDataset(history: DatasetHistory): DatasetHistory {
  if (history.currentIndex >= history.versions.length - 1) {
    return history;
  }

  return {
    versions: history.versions,
    currentIndex: history.currentIndex + 1,
  };
}
