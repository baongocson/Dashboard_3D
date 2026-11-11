import { FeatureExplorer } from '../features/collection/FeatureExplorer';
import { CorrelationMatrix } from '../features/collection/CorrelationMatrix';
import { DraftGuard } from '../scene/DraftGuard';
import { CollectionCharts } from '../features/collection/CollectionCharts';
import { AccountPanel } from '../features/session/AccountPanel';
import { api, remoteListSchema, syncProject, downloadProject, type Account } from '../sync/client';
import type { SyncStatus } from '../features/session/SessionControls';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { datasetSchema, sessionSchema, type Dataset } from '@dashboard/contracts';
import { CollectionPage } from '../features/collection/CollectionPage';
import { SessionControls, type StorageStatus } from '../features/session/SessionControls';
import { DatasetTable, type CellSelection } from '../components/DatasetTable';
import { Workbench, sections, methods } from '../features/preprocessing/Workbench';
const Scene3D = lazy(async () => {
  const module = await import('../scene/Scene3D');
  return { default: module.Scene3D };
});
import { db, type Project, type Session } from '../storage/db';
import {
  workspaceSchema,
  createProject,
  openProject,
  saveWorkspace,
  commitPreview,
  undoWorkspace,
  loadVersion,
  type OpenProject,
  type Workspace,
} from '../storage/workspace';
import { runDataJob } from '../workers/productClient';
import {
  analysisSchema,
  operationPreviewSchema,
  operationSchema,
  type Operation,
  type OperationPreview,
} from '../../../../packages/data-engine/src/operations';
import type { CsvOptions, ImportStatus } from '../features/collection/csvInput';

const operationLabels: Record<string, string> = {
  ...Object.fromEntries(Object.values(methods).flat()),
  'edit-row': 'Edit Row',
};
type Analysis = z.infer<typeof analysisSchema>;
const importResultSchema = z.object({
  dataset: datasetSchema,
  analysis: analysisSchema,
  session: sessionSchema,
  workspace: workspaceSchema,
});
export function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('pending');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [remoteProjects, setRemoteProjects] = useState<z.infer<typeof remoteListSchema>>([]);
  const [offlineReady, setOfflineReady] = useState(false);
  const identityRef = useRef<string | null>(null);
  const syncRetryAt = useRef(0),
    syncFailures = useRef(0);
  const syncPromise = useRef<Promise<void> | null>(null);
  const [open, setOpen] = useState<OpenProject | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<(Project & { updatedAt: string; fileName: string })[]>(
    [],
  );
  const [tableView, setTableView] = useState<Session['table']>({
    selection: null,
    sorts: [],
    filters: [],
  });
  const [chartLoading, setChartLoading] = useState(false);
  const [chartEpoch, setChartEpoch] = useState(0);
  const [selection, setSelection] = useState<CellSelection | null>(null);
  const [preview, setPreview] = useState<OperationPreview | null>(null);
  const [chart, setChart] = useState<Dataset | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [sourceAnalysis, setSourceAnalysis] = useState<Analysis | null>(null);
  const [storage, setStorage] = useState<StorageStatus>('unsaved');
  const [importStatus, setImportStatus] = useState<ImportStatus>({ phase: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const lock = useRef(false),
    abort = useRef<AbortController | null>(null);
  useEffect(() => {
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.ready.then(() => {
        setOfflineReady(true);
      });
  }, []);
  async function refreshProjects() {
    const items = await Promise.all(
      (await db.projects.toArray()).map(async (project) => {
        const session = await db.sessions.get(project.sessionId);
        let updatedAt = '',
          fileName = project.name;
        try {
          const saved = workspaceSchema.parse(
            JSON.parse(String(session?.confirmedConfiguration.workspace)),
          );
          updatedAt = saved.updatedAt;
          fileName = saved.fileName;
        } catch {
          /* Legacy entry remains visible and can report recovery errors on open. */
        }
        return { ...project, updatedAt, fileName };
      }),
    );
    setProjects(items);
  }
  useEffect(() => {
    void refreshProjects().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not open local storage.');
    });
  }, []);
  async function execute(action: () => Promise<void>, rethrow = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Operation failed.');
      if (rethrow) throw caught;
    } finally {
      lock.current = false;
      setBusy(false);
      abort.current = null;
    }
  }
  function install(next: OpenProject) {
    setOpen(next);
    setWorkspace(next.workspace);
    setSelection(next.session.table.selection);
    setTableView(next.session.table);
    setSourceAnalysis(next.workspace.chartResults.collection?.analysis ?? null);
    setPreview(null);
    setStorage('saved-local');
  }
  const chartId = workspace ? workspace.chartVersions[workspace.section] : undefined;
  useEffect(() => {
    if (!chartId || !workspace) {
      setChart(null);
      return;
    }
    const cached = workspace.chartResults[workspace.section];
    if (open?.dataset.versionId === chartId && cached?.versionId === chartId) {
      setChart(open.dataset);
      setAnalysis(cached.analysis);
      setChartLoading(false);
      if (workspace.section === 'collection') setSourceAnalysis(cached.analysis);
      return;
    }
    const controller = new AbortController();
    let active = true;
    setChart(null);
    setAnalysis(null);
    setChartLoading(true);
    void (async () => {
      const dataset =
        open?.dataset.versionId === chartId
          ? open.dataset
          : open?.source.versionId === chartId
            ? open.source
            : await loadVersion(chartId);
      const saved = workspace.chartResults[workspace.section];
      const result =
        saved?.versionId === chartId
          ? saved.analysis
          : await runDataJob(
              { type: 'analyze', dataset },
              (value) => analysisSchema.parse(value),
              controller.signal,
            );
      if (!controller.signal.aborted && (!saved || saved.versionId !== chartId))
        setWorkspace((current) =>
          current?.section === workspace.section &&
          current.chartVersions[current.section] === chartId
            ? {
                ...current,
                chartResults: {
                  ...current.chartResults,
                  [current.section]: { versionId: chartId, analysis: result },
                },
              }
            : current,
        );
      if (!controller.signal.aborted) {
        setChartLoading(false);
        setChart(dataset);
        setAnalysis(result);
        if (workspace.section === 'collection') setSourceAnalysis(result);
      }
    })().catch((caught: unknown) => {
      if (active) {
        setChartLoading(false);
        setError(caught instanceof Error ? caught.message : 'Could not load the chart.');
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [chartId, workspace?.section, chartEpoch]);
  useEffect(() => {
    if (!open) {
      setHistory([]);
      return;
    }
    const id = open.session.projectId;
    void (async () => {
      const versions = new Set(
        (await db.versions.where('projectId').equals(id).toArray()).map((v) => v.id),
      );
      const rows = (await db.histories.toArray()).filter((h) => versions.has(h.toVersionId));
      setHistory(
        rows
          .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
          .map(
            (h) =>
              `${h.kind === 'undo' ? 'Undo' : (operationLabels[h.method] ?? h.method)} · ${String(h.changes.cells)} cells / ${String(h.changes.rows)} rows / ${String(h.changes.columns)} columns`,
          ),
      );
    })().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not load history.');
    });
  }, [open]);
  function synchronize(auth: Account, claim = false): Promise<void> {
    if (syncPromise.current) return syncPromise.current;
    const promise = (async () => {
      setSyncError(null);
      setSyncStatus('syncing');
      try {
        const failures: string[] = [];
        for (const project of await db.projects.toArray()) {
          try {
            await syncProject(project.id, auth, claim);
          } catch (caught: unknown) {
            failures.push(
              `${project.name}: ${caught instanceof Error ? caught.message : 'Project error'}`,
            );
          }
        }
        if (failures.length) throw new Error(failures.join(' · '));
        const owned = new Set(
          (await db.projects.where('ownerId').equals(auth.user.id).toArray()).map((p) => p.id),
        );
        const remains = (await db.outbox.toArray()).filter(
          (o) => owned.has(o.projectId) && o.status !== 'synced',
        );
        if (remains.length) throw new Error('Unsynced changes remain. Please retry.');
        syncFailures.current = 0;
        syncRetryAt.current = 0;
        setSyncStatus('synced');
        await refreshProjects();
      } catch (caught: unknown) {
        syncFailures.current++;
        syncRetryAt.current =
          Date.now() + Math.min(300_000, 15_000 * 2 ** Math.min(syncFailures.current, 5));
        setSyncStatus(navigator.onLine ? 'failed' : 'offline');
        setSyncError(caught instanceof Error ? caught.message : 'Sync failed.');
        throw caught;
      } finally {
        syncPromise.current = null;
      }
    })();
    syncPromise.current = promise;
    return promise;
  }
  useEffect(() => {
    const retry = () => {
      if (!navigator.onLine) {
        setSyncStatus('offline');
        return;
      }
      if (account && !lock.current && Date.now() >= syncRetryAt.current)
        void synchronize(account).catch(() => {
          /* Outbox retained; next bounded retry. */
        });
    };
    const online = () => {
      syncRetryAt.current = 0;
      retry();
    };
    retry();
    const timer = window.setInterval(retry, 30_000);
    window.addEventListener('online', online);
    window.addEventListener('offline', retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', retry);
    };
  }, [account, open, busy]);
  function changeIdentity(id: string | null) {
    if (identityRef.current === id) return;
    identityRef.current = id;
    setIdentity(id);
    setOpen(null);
    setWorkspace(null);
    setRemoteProjects([]);
    setPreview(null);
    void refreshProjects().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Could not load projects.');
    });
  }
  function changeWorkspace(next: Workspace) {
    setWorkspace(next);
    setStorage('unsaved');
  }
  async function save() {
    if (!open || !workspace) return;
    if (chartLoading)
      throw new Error('Wait for the chart to finish loading before saving or closing.');
    setStorage('saving');
    try {
      const session = await saveWorkspace(
        { ...open, session: { ...open.session, table: { ...tableView, selection } } },
        workspace,
      );
      setOpen({ ...open, session, workspace });
      setStorage('saved-local');
    } catch (caught: unknown) {
      setStorage('failed');
      throw caught;
    }
  }
  async function importFile(file: File, options: CsvOptions) {
    await execute(async () => {
      const controller = new AbortController();
      abort.current = controller;
      setImportStatus({ phase: 'processing', percent: 0 });
      try {
        const result = await runDataJob(
          {
            type: 'import',
            file,
            options,
            versionId: crypto.randomUUID(),
            ownerId: identity ?? 'local',
          },
          (value) => importResultSchema.parse(value),
          controller.signal,
          (percent) => {
            setImportStatus({
              phase: 'processing',
              percent,
              message:
                percent < 70
                  ? 'Reading CSV…'
                  : percent < 90
                    ? 'Calculating statistics…'
                    : 'Saving locally…',
            });
          },
        );
        setStorage('saving');
        const next: OpenProject = {
          session: result.session,
          workspace: result.workspace,
          dataset: result.dataset,
          source: result.dataset,
        };
        install(next);
        setSourceAnalysis(result.analysis);
        setImportStatus({ phase: 'ready' });
        await refreshProjects();
      } catch (caught: unknown) {
        setImportStatus({
          phase: 'error',
          message: caught instanceof Error ? caught.message : 'CSV import failed.',
        });
        setStorage(open ? 'saved-local' : 'unsaved');
        throw caught;
      }
    }, true);
  }
  async function preparePreprocessing() {
    if (!open || !workspace || lock.current) return;
    await execute(async () => {
      const result = await runDataJob(
        {
          type: 'preview',
          dataset: open.dataset,
          configuration: operationSchema.parse({ method: 'deduplicate', columnIds: [] }),
          versionId: crypto.randomUUID(),
        },
        (value) => operationPreviewSchema.parse(value),
      );
      const versionId = result.changes.rows ? result.dataset.versionId : open.dataset.versionId;
      const nextWorkspace: Workspace = {
        ...workspace,
        section: 'cleaning',
        chartVersions: { ...workspace.chartVersions, cleaning: versionId },
        chartResults: {
          ...workspace.chartResults,
          ...(result.analysisAfter
            ? { cleaning: { versionId, analysis: result.analysisAfter } }
            : {}),
        },
      };
      setStorage('saving');
      try {
        if (result.changes.rows)
          install(
            await commitPreview(
              { ...open, session: { ...open.session, table: { ...tableView, selection: null } } },
              result,
              nextWorkspace,
            ),
          );
        else {
          const session = await saveWorkspace(
            { ...open, session: { ...open.session, table: { ...tableView, selection: null } } },
            nextWorkspace,
          );
          install({ ...open, workspace: nextWorkspace, session });
        }
      } catch (caught) {
        setStorage('failed');
        throw caught;
      }
    });
  }
  function navigate(section: Workspace['section']) {
    if (!workspace || !open || busy) return;
    setPreview(null);
    setSelection(null);
    changeWorkspace({
      ...workspace,
      section,
      chartVersions: {
        ...workspace.chartVersions,
        [section]:
          workspace.chartVersions[section] ??
          (section === 'collection' ? workspace.sourceVersionId : open.dataset.versionId),
      },
    });
  }
  function requestPreview(configuration: Operation) {
    if (!open) return;
    void execute(async () => {
      setPreview(null);
      const controller = new AbortController();
      abort.current = controller;
      const result = await runDataJob(
        { type: 'preview', dataset: open.dataset, configuration, versionId: crypto.randomUUID() },
        (value) => operationPreviewSchema.parse(value),
        controller.signal,
      );
      if (
        result.baseVersionId !== open.dataset.versionId ||
        result.fingerprint !== JSON.stringify(configuration)
      )
        throw new Error('The preview does not match the current data or settings.');
      setPreview(result);
    });
  }
  const visibleProjects = projects.filter(
    (project) => project.ownerId === 'local' || project.ownerId === identity,
  );
  return (
    <Suspense
      fallback={
        <main className="workspace">
          <p role="status">Loading workspace…</p>
        </main>
      }
    >
      <DraftGuard>
        <div className="app">
          <header className="topbar">
            <a className="brand" href="/">
              <span className="brand-mark">D</span>Dashboard <strong>3D</strong>
            </a>
            <span className="stage">
              {sections.find(([id]) => id === workspace?.section)?.[1] ?? 'Collection'}
            </span>
            <SessionControls
              storageStatus={storage}
              syncStatus={account ? syncStatus : navigator.onLine ? 'not-connected' : 'offline'}
              {...(open
                ? {
                    onSave: async () => {
                      if (lock.current) throw new Error('Processing. Please wait.');
                      await save();
                    },
                    onExit: async () => {
                      if (lock.current) throw new Error('Processing. Please wait.');
                      await save();
                      setOpen(null);
                      setWorkspace(null);
                      setPreview(null);
                      await refreshProjects();
                    },
                  }
                : {})}
            />
            <AccountPanel
              busy={busy}
              onAccount={setAccount}
              onIdentity={changeIdentity}
              onLogout={() => {
                setOpen(null);
                setWorkspace(null);
                void refreshProjects().catch((caught: unknown) => {
                  setError(caught instanceof Error ? caught.message : 'Could not load projects.');
                });
              }}
              onSync={async (auth) => {
                await synchronize(auth);
              }}
            />
          </header>
          <div className="sync-bar">
            <span>{offlineReady ? 'Offline Ready' : 'Preparing Offline Support'}</span>
            <span>
              {account
                ? `Sync: ${{ 'not-connected': 'Not Connected', offline: 'Offline', pending: 'Pending Sync', syncing: 'Syncing', synced: 'Synced', failed: 'Failed' }[syncStatus]}`
                : 'Signed Out'}
            </span>
            <button
              className="quiet-button"
              disabled={!account || busy || syncStatus === 'syncing'}
              onClick={() => {
                if (account) void synchronize(account, true).catch(() => {});
              }}
            >
              Sync All Projects
            </button>
            <button
              className="quiet-button"
              disabled={!account || busy}
              onClick={() => {
                if (account)
                  void execute(async () => {
                    setRemoteProjects(remoteListSchema.parse(await api('/projects')));
                  });
              }}
            >
              Server Projects
            </button>
            {syncError && <span role="status">{syncError}</span>}
          </div>
          {remoteProjects.length > 0 && (
            <section className="workspace panel">
              <h2>Server Projects</h2>
              {remoteProjects.map((remote) => (
                <button
                  className="project-card"
                  key={remote.project.id}
                  disabled={
                    busy ||
                    (open?.session.projectId === remote.project.id && storage !== 'saved-local')
                  }
                  onClick={() => {
                    if (account)
                      void execute(async () => {
                        await downloadProject(remote.project.id, account);
                        install(await openProject(remote.project.sessionId));
                        await refreshProjects();
                      });
                  }}
                >
                  {remote.project.name} · {remote.updatedAt} · revision {remote.revision}
                  <span>Download / Open Session</span>
                </button>
              ))}
            </section>
          )}
          {syncError && open && (
            <div className="workspace">
              <button
                className="quiet-button"
                disabled={busy}
                onClick={() => {
                  void execute(async () => {
                    install(
                      await createProject(
                        { ...open.dataset, versionId: crypto.randomUUID() },
                        `${workspace?.fileName ?? 'Project'} — copy`,
                        workspace?.fileBytes ?? 0,
                        identity ?? 'local',
                      ),
                    );
                    await refreshProjects();
                  });
                }}
              >
                Save as New Project
              </button>
            </div>
          )}
          {error && (
            <p className="alert alert-error global-error" role="alert">
              {error}
            </p>
          )}
          {!identity && (
            <main className="workspace">
              <p className="eyebrow">DASHBOARD 3D</p>
              <h1>Sign in to get started.</h1>
            </main>
          )}
          {identity && !open && (
            <section className="workspace project-list">
              <div className="panel-heading">
                <h2>Saved Projects</h2>
                <button
                  className="quiet-button"
                  onClick={() => {
                    setError(null);
                  }}
                >
                  Import New Project
                </button>
              </div>
              {!visibleProjects.length && <p className="hint">No projects yet.</p>}
              {projects
                .filter((project) => project.ownerId === 'local' || project.ownerId === identity)
                .map((project) => (
                  <button
                    className="project-card"
                    key={project.id}
                    disabled={busy}
                    onClick={() => {
                      void execute(async () => {
                        const next = await openProject(project.sessionId);
                        install(next);
                      });
                    }}
                  >
                    {project.name}
                    <span>
                      {project.fileName} ·{' '}
                      {project.updatedAt
                        ? new Date(project.updatedAt).toLocaleString('en-US')
                        : 'Unknown date'}{' '}
                      · Open Session →
                    </span>
                  </button>
                ))}
            </section>
          )}
          {identity &&
            (!workspace || workspace.section === 'collection' ? (
              <>
                <CollectionPage
                  dataset={open?.source ?? null}
                  fileName={workspace?.fileName}
                  fileBytes={workspace?.fileBytes}
                  statistics={sourceAnalysis}
                  importStatus={importStatus}
                  onImport={importFile}
                  onCancelImport={() => {
                    abort.current?.abort();
                  }}
                  nextBusy={busy}
                  onNext={() => {
                    void preparePreprocessing();
                  }}
                />
                {open && workspace && chart && (
                  <section className="workspace panel">
                    <h2>Collection · {workspace.fileBytes.toLocaleString('en-US')} source bytes</h2>
                    <button
                      className="quiet-button"
                      disabled={busy || chartLoading}
                      onClick={() => {
                        changeWorkspace({
                          ...workspace,
                          chartResults: Object.fromEntries(
                            Object.entries(workspace.chartResults).filter(
                              ([section]) => section !== 'collection',
                            ),
                          ),
                        });
                        setChartEpoch((epoch) => epoch + 1);
                      }}
                    >
                      Refresh Collection
                    </button>
                    <Scene3D
                      dataset={chart}
                      section="collection"
                      currentVersionId={workspace.sourceVersionId}
                      columnId={null}
                      analysis={analysis}
                      selection={selection}
                      onSelect={setSelection}
                      view={workspace.views.collection}
                      onView={(view) => {
                        changeWorkspace({
                          ...workspace,
                          views: { ...workspace.views, collection: view },
                        });
                      }}
                    />
                    <CollectionCharts dataset={chart} />
                    <FeatureExplorer dataset={chart} />
                    {analysis && <CorrelationMatrix analysis={analysis} />}
                    {analysis && (
                      <details>
                        <summary>Column Statistics</summary>
                        <div className="table-scroll">
                          <table className="dataset-table">
                            <thead>
                              <tr>
                                <th>Column</th>
                                <th>Min</th>
                                <th>Max</th>
                                <th>Mean</th>
                                <th>Median</th>
                                <th>Q1</th>
                                <th>Q3</th>
                                <th>Standard Deviation</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.columns.map((column) => (
                                <tr key={column.id}>
                                  <th>
                                    {column.name}
                                    {column.statistics?.q1 === column.statistics?.q3 &&
                                    column.statistics ? (
                                      <small> · IQR=0: outliers N/A</small>
                                    ) : null}
                                  </th>
                                  {(
                                    [
                                      'min',
                                      'max',
                                      'mean',
                                      'median',
                                      'q1',
                                      'q3',
                                      'deviation',
                                    ] as const
                                  ).map((key) => (
                                    <td key={key}>
                                      {column.statistics?.[key].toLocaleString('en-US', {
                                        maximumFractionDigits: 6,
                                      }) ?? 'N/A'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    )}
                  </section>
                )}
              </>
            ) : (
              open && (
                <main className="workspace">
                  <div className="page-title-line">
                    <div>
                      <p className="eyebrow">PREPROCESSING</p>
                      <h1>Explore and Process Data</h1>
                    </div>
                    <button
                      className="quiet-button"
                      disabled={busy || !workspace.undo.length}
                      onClick={() => {
                        void execute(async () => {
                          setStorage('saving');
                          try {
                            install(
                              await undoWorkspace(
                                {
                                  ...open,
                                  session: {
                                    ...open.session,
                                    table: { ...tableView, selection: null },
                                  },
                                },
                                workspace,
                              ),
                            );
                          } catch (caught) {
                            setStorage('failed');
                            throw caught;
                          }
                        });
                      }}
                    >
                      Undo
                    </button>
                  </div>
                  <nav className="section-tabs" aria-label="Preprocessing Steps">
                    {sections.map(([id, label]) => (
                      <button
                        key={id}
                        disabled={busy}
                        aria-current={workspace.section === id ? 'page' : undefined}
                        className={workspace.section === id ? 'primary-button' : 'quiet-button'}
                        onClick={() => {
                          navigate(id);
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </nav>
                  <div className="product-grid">
                    <section className="panel scene-panel">
                      <div className="panel-heading">
                        <h2>{sections.find(([id]) => id === workspace.section)?.[1]} 3D</h2>
                        <button
                          className="quiet-button"
                          disabled={busy}
                          onClick={() => {
                            changeWorkspace({
                              ...workspace,
                              chartResults: Object.fromEntries(
                                Object.entries(workspace.chartResults).filter(
                                  ([section]) => section !== workspace.section,
                                ),
                              ),
                              chartVersions: {
                                ...workspace.chartVersions,
                                [workspace.section]: open.dataset.versionId,
                              },
                            });
                            setChartEpoch((epoch) => epoch + 1);
                          }}
                        >
                          Refresh Chart
                        </button>
                      </div>
                      {workspace.section === 'outliers' && (
                        <div className="table-tools">
                          <label>
                            Detection Method
                            <select
                              aria-label="Detection Method"
                              value={workspace.outlierView.method}
                              onChange={(event) => {
                                const method = event.target.value === 'zscore' ? 'zscore' : 'iqr';
                                changeWorkspace({
                                  ...workspace,
                                  outlierView: {
                                    ...workspace.outlierView,
                                    method,
                                    threshold: method === 'zscore' ? 3 : 1.5,
                                  },
                                });
                              }}
                            >
                              <option value="iqr">IQR</option>
                              <option value="zscore">Z-score</option>
                            </select>
                          </label>
                          <label>
                            Detection Threshold
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={workspace.outlierView.threshold}
                              onChange={(event) => {
                                const threshold = Number(event.target.value);
                                if (Number.isFinite(threshold) && threshold > 0)
                                  changeWorkspace({
                                    ...workspace,
                                    outlierView: { ...workspace.outlierView, threshold },
                                  });
                              }}
                            />
                          </label>
                          <label>
                            <input
                              type="checkbox"
                              checked={workspace.outlierView.onlyOutliers}
                              onChange={(event) => {
                                changeWorkspace({
                                  ...workspace,
                                  outlierView: {
                                    ...workspace.outlierView,
                                    onlyOutliers: event.target.checked,
                                  },
                                });
                              }}
                            />{' '}
                            Outliers Only
                          </label>
                        </div>
                      )}
                      {chart && workspace.section === 'outliers' && (
                        <label className="form-field">
                          Outlier Column
                          <select
                            aria-label="Outlier Column"
                            value={workspace.chartColumns[workspace.section] ?? ''}
                            onChange={(event) => {
                              changeWorkspace({
                                ...workspace,
                                chartColumns: {
                                  ...workspace.chartColumns,
                                  [workspace.section]: event.target.value,
                                },
                              });
                            }}
                          >
                            <option value="">Auto-select Column</option>
                            {chart.columns.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {chart ? (
                        <Scene3D
                          key={`${open.session.id}:${workspace.section}`}
                          dataset={chart}
                          section={workspace.section}
                          currentVersionId={open.dataset.versionId}
                          analysis={analysis}
                          outlierView={workspace.outlierView}
                          columnId={
                            workspace.section === 'outliers'
                              ? (workspace.chartColumns.outliers ?? null)
                              : null
                          }
                          selection={selection}
                          onSelect={(next) => {
                            if (!busy) {
                              setSelection(next);
                              setStorage('unsaved');
                              setPreview(null);
                            }
                          }}
                          onSaveRow={async (rowId, values) => {
                            if (lock.current) throw new Error('Processing. Please wait and retry.');
                            await execute(async () => {
                              const result = await runDataJob(
                                {
                                  type: 'preview',
                                  dataset: open.dataset,
                                  configuration: operationSchema.parse({
                                    method: 'edit-row',
                                    columnIds: Object.keys(values),
                                    rowId,
                                    values,
                                  }),
                                  versionId: crypto.randomUUID(),
                                },
                                (value) => operationPreviewSchema.parse(value),
                              );
                              const selected = {
                                versionId: result.dataset.versionId,
                                rowId,
                                columnId: selection?.columnId ?? open.dataset.columns[0]?.id ?? '',
                              };
                              const nextWorkspace = {
                                ...workspace,
                                chartVersions: {
                                  ...workspace.chartVersions,
                                  [workspace.section]: result.dataset.versionId,
                                },
                                chartResults: {
                                  ...workspace.chartResults,
                                  ...(result.analysisAfter
                                    ? {
                                        [workspace.section]: {
                                          versionId: result.dataset.versionId,
                                          analysis: result.analysisAfter,
                                        },
                                      }
                                    : {}),
                                },
                              };
                              setStorage('saving');
                              try {
                                const next = await commitPreview(
                                  { ...open, session: { ...open.session, table: tableView } },
                                  result,
                                  nextWorkspace,
                                  selected,
                                );
                                install(next);
                                setChart(next.dataset);
                                setAnalysis(result.analysisAfter ?? null);
                              } catch (caught) {
                                setStorage('failed');
                                throw caught;
                              }
                            }, true);
                          }}
                          view={workspace.views[workspace.section]}
                          onView={(view) => {
                            changeWorkspace({
                              ...workspace,
                              views: { ...workspace.views, [workspace.section]: view },
                            });
                          }}
                        />
                      ) : (
                        <p role="status">Loading chart…</p>
                      )}
                      {selection && selection.versionId !== open.dataset.versionId && chart && (
                        <>
                          <p className="hint">Viewing a previous version (read-only).</p>
                          <DatasetTable
                            dataset={{
                              ...chart,
                              rows: chart.rows.filter((r) => r.id === selection.rowId),
                            }}
                            selection={selection}
                          />
                        </>
                      )}
                    </section>
                    <Workbench
                      key={`${workspace.section}:${open.dataset.versionId}`}
                      dataset={open.dataset}
                      section={workspace.section}
                      selection={selection}
                      busy={busy}
                      cancellable={abort.current !== null}
                      preview={preview}
                      onPreview={requestPreview}
                      onApply={() => {
                        if (!preview) return;
                        void execute(async () => {
                          setStorage('saving');
                          try {
                            install(
                              await commitPreview(
                                {
                                  ...open,
                                  session: {
                                    ...open.session,
                                    table: { ...tableView, selection: null },
                                  },
                                },
                                preview,
                                workspace,
                              ),
                            );
                          } catch (caught) {
                            setStorage('failed');
                            throw caught;
                          }
                        });
                      }}
                      onCancel={() => {
                        setPreview(null);
                      }}
                      onBusyCancel={() => {
                        abort.current?.abort();
                      }}
                      savedConfiguration={workspace.configuration}
                      onConfiguration={(configuration) => {
                        changeWorkspace({ ...workspace, configuration });
                      }}
                    />
                  </div>
                  <DatasetTable
                    dataset={open.dataset}
                    view={tableView}
                    onViewChange={(view) => {
                      setTableView(view);
                      setStorage('unsaved');
                    }}
                    selection={selection}
                    onSelect={
                      busy
                        ? undefined
                        : (next) => {
                            setSelection(next);
                            setStorage('unsaved');
                            setPreview(null);
                          }
                    }
                  />
                  {preview?.analysisBefore && preview.analysisAfter && (
                    <details className="panel">
                      <summary>Chart Comparison</summary>
                      <div className="product-grid">
                        <div>
                          <h3>Before</h3>
                          <Scene3D
                            dataset={open.dataset}
                            section={workspace.section}
                            currentVersionId={open.dataset.versionId}
                            columnId={
                              workspace.section === 'outliers'
                                ? (workspace.chartColumns.outliers ?? null)
                                : null
                            }
                            analysis={preview.analysisBefore}
                            selection={null}
                            onSelect={() => {}}
                            onView={() => {}}
                          />
                        </div>
                        <div>
                          <h3>Preview Result</h3>
                          <Scene3D
                            dataset={preview.dataset}
                            section={workspace.section}
                            currentVersionId={preview.dataset.versionId}
                            columnId={
                              workspace.section === 'outliers'
                                ? (workspace.chartColumns.outliers ?? null)
                                : null
                            }
                            analysis={preview.analysisAfter}
                            selection={null}
                            onSelect={() => {}}
                            onView={() => {}}
                          />
                        </div>
                      </div>
                    </details>
                  )}
                  {preview && (
                    <details className="panel">
                      <summary>Preview Data</summary>
                      <DatasetTable dataset={preview.dataset} />
                    </details>
                  )}
                  <details className="panel">
                    <summary>History ({history.length})</summary>
                    {history.map((item, index) => (
                      <p key={index}>
                        {String(index + 1)}. {item}
                      </p>
                    ))}
                  </details>
                </main>
              )
            ))}
          <footer>Dashboard 3D</footer>
        </div>
      </DraftGuard>
    </Suspense>
  );
}
