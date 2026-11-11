import Dexie from 'dexie';
import { z } from 'zod';
import {
  datasetSchema,
  projectSchema,
  sessionSchema,
  versionSchema,
  type Dataset,
} from '@dashboard/contracts';
import { db, type Session } from './db';
import { readDatasetChunks, saveDatasetChunks } from './services/chunk_service';
import { publishApply } from './services/publication_service';
import type { OperationPreview } from '../../../../packages/data-engine/src/operations';
import { analysisSchema } from '../../../../packages/data-engine/src/operations';

export const viewSchema = z.object({
  position: z.tuple([z.number(), z.number(), z.number()]),
  target: z.tuple([z.number(), z.number(), z.number()]),
  zoom: z.number().positive(),
});
export type View = z.infer<typeof viewSchema>;
const outlierViewSchema = z.object({
  method: z.enum(['iqr', 'zscore']),
  threshold: z.number().positive(),
  onlyOutliers: z.boolean(),
});
export type OutlierView = z.infer<typeof outlierViewSchema>;
export const workspaceSchema = z.object({
  updatedAt: z.string().default(''),
  importOptions: z.string().default(''),
  fileName: z.string(),
  fileBytes: z.number(),
  sourceVersionId: z.string(),
  section: z.enum([
    'collection',
    'cleaning',
    'missing',
    'outliers',
    'scaling',
    'transformation',
    'encoding',
  ]),
  chartColumns: z.record(z.string(), z.string()).default({}),
  outlierView: outlierViewSchema.default({ method: 'iqr', threshold: 1.5, onlyOutliers: false }),
  chartVersions: z.record(z.string(), z.string()),
  views: z.record(z.string(), viewSchema),
  chartResults: z
    .record(z.string(), z.object({ versionId: z.string(), analysis: analysisSchema }))
    .default({}),
  historySequence: z.number().int().nonnegative().default(0),
  undo: z.array(z.string()),
  configuration: z.string().default(''),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export type OpenProject = {
  session: Session;
  workspace: Workspace;
  dataset: Dataset;
  source: Dataset;
};

export async function loadVersion(id: string): Promise<Dataset> {
  const version = versionSchema.parse(await db.versions.get(id));
  const dataset = await readDatasetChunks(version.manifestId);
  if (dataset.versionId !== id) throw new Error('Dataset version mismatch.');
  return dataset;
}
export async function openProject(sessionId: string): Promise<OpenProject> {
  const session = sessionSchema.parse(await db.sessions.get(sessionId));
  const workspace = workspaceSchema.parse(
    JSON.parse(String(session.confirmedConfiguration.workspace)),
  );
  const dataset = await loadVersion(session.currentVersionId);
  const source =
    workspace.sourceVersionId === dataset.versionId
      ? dataset
      : await loadVersion(workspace.sourceVersionId);
  return { session, workspace, dataset, source };
}
function setWorkspace(session: Session, workspace: Workspace): Session {
  return sessionSchema.parse({
    ...session,
    section: workspace.section,
    confirmedConfiguration: {
      workspace: JSON.stringify({ ...workspace, updatedAt: new Date().toISOString() }),
    },
  });
}
export async function createProject(
  datasetInput: Dataset,
  fileName: string,
  fileBytes: number,
  ownerId: string,
  analysis?: z.infer<typeof analysisSchema>,
  importOptions = '',
): Promise<OpenProject> {
  const dataset = datasetSchema.parse(datasetInput);
  const projectId = crypto.randomUUID(),
    datasetId = crypto.randomUUID(),
    sessionId = crypto.randomUUID();
  const workspace: Workspace = {
    updatedAt: new Date().toISOString(),
    importOptions,
    fileName,
    fileBytes,
    sourceVersionId: dataset.versionId,
    section: 'collection',
    chartColumns: {},
    outlierView: { method: 'iqr', threshold: 1.5, onlyOutliers: false },
    chartVersions: { collection: dataset.versionId },
    chartResults: analysis ? { collection: { versionId: dataset.versionId, analysis } } : {},
    views: {},
    historySequence: 0,
    undo: [],
    configuration: '',
  };
  const session = setWorkspace(
    sessionSchema.parse({
      id: sessionId,
      projectId,
      datasetId,
      currentVersionId: dataset.versionId,
      section: 'collection',
      confirmedConfiguration: {},
      charts: [],
      views: [],
      table: { filters: [], sorts: [], selection: null },
    }),
    workspace,
  );
  const { manifest } = await saveDatasetChunks(datasetId, dataset.versionId, dataset);
  await db.transaction(
    'rw',
    [db.projects, db.sessions, db.versions, db.outbox, db.manifests, db.chunks],
    async () => {
      const verified = await Dexie.waitFor(readDatasetChunks(manifest.id));
      if (verified.versionId !== dataset.versionId) throw new Error('Import version mismatch');
      await db.projects.add(
        projectSchema.parse({ id: projectId, ownerId, name: fileName, datasetId, sessionId }),
      );
      await db.versions.add(
        versionSchema.parse({
          id: dataset.versionId,
          projectId,
          datasetId,
          parentVersionId: null,
          manifestId: manifest.id,
          source: 'import',
        }),
      );
      await db.sessions.add(session);
      await enqueue(projectId, 'import');
    },
  );
  return { session, workspace, dataset, source: dataset };
}
async function enqueue(projectId: string, kind: 'import' | 'apply' | 'undo' | 'save-session') {
  const pending = await db.outbox.where('projectId').equals(projectId).toArray();
  await db.outbox.add({
    operationId: crypto.randomUUID(),
    projectId,
    kind,
    status: 'pending',
    dependsOn: pending.filter((o) => o.status !== 'synced').map((o) => o.operationId),
    baseRevision: null,
  });
}
export async function saveWorkspace(open: OpenProject, workspace: Workspace): Promise<Session> {
  const next = setWorkspace(open.session, workspace);
  await db.transaction('rw', [db.sessions, db.outbox], async () => {
    const current = await db.sessions.get(next.id);
    if (
      current?.currentVersionId !== next.currentVersionId ||
      current.confirmedConfiguration.workspace !== open.session.confirmedConfiguration.workspace
    )
      throw new Error('This session changed in another tab. Reopen it.');
    await db.sessions.put(next);
    await enqueue(next.projectId, 'save-session');
  });
  return next;
}
export async function commitPreview(
  open: OpenProject,
  preview: OperationPreview,
  workspace: Workspace,
  selection: Session['table']['selection'] = null,
): Promise<OpenProject> {
  if (
    preview.baseVersionId !== open.dataset.versionId ||
    preview.fingerprint !== JSON.stringify(preview.configuration)
  )
    throw new Error('The preview is outdated. Generate a new preview.');
  const dataset = datasetSchema.parse(preview.dataset);
  const { manifest } = await saveDatasetChunks(open.session.datasetId, dataset.versionId, dataset);
  const operationId = crypto.randomUUID();
  const nextWorkspace = {
    ...workspace,
    undo: [...workspace.undo, open.dataset.versionId],
    historySequence: workspace.historySequence + 1,
  };
  const session = setWorkspace(
    {
      ...open.session,
      currentVersionId: dataset.versionId,
      table: { ...open.session.table, selection },
    },
    nextWorkspace,
  );
  await db.transaction(
    'rw',
    [db.versions, db.manifests, db.chunks, db.histories, db.outbox, db.sessions],
    async () => {
      await publishApply(open.session.id, {
        version: {
          id: dataset.versionId,
          projectId: session.projectId,
          datasetId: session.datasetId,
          parentVersionId: open.dataset.versionId,
          manifestId: manifest.id,
          source: 'apply',
        },
        manifest,
        currentVersionId: dataset.versionId,
        history: {
          sequence: nextWorkspace.historySequence,
          createdAt: new Date().toISOString(),
          operationId,
          kind: 'apply',
          fromVersionId: open.dataset.versionId,
          toVersionId: dataset.versionId,
          method: preview.configuration.method,
          columnIds: preview.configuration.columnIds,
          rowIds: preview.configuration.rowId ? [preview.configuration.rowId] : [],
          parameters: {
            configuration: JSON.stringify(preview.configuration),
            ...preview.parameters,
          },
          changes: preview.changes,
        },
        outbox: {
          operationId,
          projectId: session.projectId,
          kind: 'apply',
          baseRevision: null,
          dependsOn: [],
          status: 'pending',
        },
      });
      await db.sessions.put(session);
    },
  );
  return { ...open, session, workspace: nextWorkspace, dataset };
}
export async function undoWorkspace(open: OpenProject, workspace: Workspace): Promise<OpenProject> {
  const previousId = workspace.undo.at(-1);
  if (!previousId) throw new Error('No operation to undo.');
  const previous = await loadVersion(previousId);
  const nextWorkspace = {
    ...workspace,
    undo: workspace.undo.slice(0, -1),
    historySequence: workspace.historySequence + 1,
  };
  const session = setWorkspace({ ...open.session, currentVersionId: previousId }, nextWorkspace);
  await db.transaction('rw', [db.sessions, db.histories, db.outbox], async () => {
    const current = await db.sessions.get(session.id);
    if (current?.currentVersionId !== open.dataset.versionId)
      throw new Error('The session has changed. Reopen it.');
    const operationId = crypto.randomUUID();
    await db.histories.add({
      sequence: nextWorkspace.historySequence,
      createdAt: new Date().toISOString(),
      operationId,
      kind: 'undo',
      fromVersionId: open.dataset.versionId,
      toVersionId: previousId,
      method: 'undo',
      columnIds: [],
      rowIds: [],
      parameters: {},
      changes: { cells: 0, columns: 0, rows: 0 },
    });
    await db.sessions.put(session);
    await enqueue(session.projectId, 'undo');
  });
  return { ...open, session, workspace: nextWorkspace, dataset: previous };
}
