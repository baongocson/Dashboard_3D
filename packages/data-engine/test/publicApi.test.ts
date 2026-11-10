import { describe, expect, it } from 'vitest';

import {
  detectMissingValues,
  createMissingPreview,
  createMissingProposals,
  applyMissingProposals,
  createDatasetHistory,
  getCurrentDataset,
  pushDatasetVersion,
  undoDataset,
  redoDataset,
  startMissingWorkflow,
  executeMissingWorkflow,
  undoMissingWorkflow,
  redoMissingWorkflow,
} from '../src/index.js';

describe('Data Engine public API', () => {
  it('exports missing-value functions', () => {
    expect(detectMissingValues).toBeTypeOf('function');
    expect(createMissingPreview).toBeTypeOf('function');
    expect(createMissingProposals).toBeTypeOf('function');
    expect(applyMissingProposals).toBeTypeOf('function');
  });

  it('exports dataset history functions', () => {
    expect(createDatasetHistory).toBeTypeOf('function');
    expect(getCurrentDataset).toBeTypeOf('function');
    expect(pushDatasetVersion).toBeTypeOf('function');
    expect(undoDataset).toBeTypeOf('function');
    expect(redoDataset).toBeTypeOf('function');
  });

  it('exports missing-value workflow functions', () => {
    expect(startMissingWorkflow).toBeTypeOf('function');
    expect(executeMissingWorkflow).toBeTypeOf('function');
    expect(undoMissingWorkflow).toBeTypeOf('function');
    expect(redoMissingWorkflow).toBeTypeOf('function');
  });
});
