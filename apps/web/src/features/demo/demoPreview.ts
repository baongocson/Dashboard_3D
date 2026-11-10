import { previewSchema } from '@dashboard/contracts';
import type { FillCellConfig, PreviewResult } from '../preprocessing/previewRules';

// Development-only fake service for UI rehearsals. NEVER use for production Apply.
export function demoPreview(config: FillCellConfig): Promise<PreviewResult> {
  const { selection, value } = config;
  return Promise.resolve(previewSchema.parse({
    id: 'demo-preview',
    jobId: 'demo-worker-not-real',
    baseVersionId: selection.versionId,
    configFingerprint: `demo-only:${selection.rowId}:${selection.columnId}:${String(value)}`,
    configuration: config,
    changes: { rows: 1, columns: 1, cells: 1 },
    examples: [{ rowId: selection.rowId, columnId: selection.columnId, before: null, after: value }],
    errors: [],
    warnings: [],
  }));
}
