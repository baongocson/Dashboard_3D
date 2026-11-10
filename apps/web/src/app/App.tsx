import { AccountPanel } from '../features/session/AccountPanel';
import { api, remoteListSchema, syncProject, downloadProject, type Account } from '../sync/client';
import type { SyncStatus } from '../features/session/SessionControls';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import { datasetSchema, sessionSchema, type Dataset } from '@dashboard/contracts';
import { CollectionPage } from '../features/collection/CollectionPage';
import { SessionControls, type StorageStatus } from '../features/session/SessionControls';
import { DatasetTable, type CellSelection } from '../components/DatasetTable';
import { Workbench, sections } from '../features/preprocessing/Workbench';
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
  type Operation,
  type OperationPreview,
} from '../../../../packages/data-engine/src/operations';
import type { CsvOptions, ImportStatus } from '../features/collection/csvInput';

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
  const [correlationPage, setCorrelationPage] = useState(0);
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
      setError(caught instanceof Error ? caught.message : 'Không mở được IndexedDB.');
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
      setError(caught instanceof Error ? caught.message : 'Thao tác thất bại.');
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
        setError(caught instanceof Error ? caught.message : 'Không mở được biểu đồ.');
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
              `${h.kind === 'undo' ? 'Hoàn tác' : h.method} · ${String(h.changes.cells)} ô / ${String(h.changes.rows)} dòng / ${String(h.changes.columns)} cột · ${h.fromVersionId} → ${h.toVersionId}`,
          ),
      );
    })().catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : 'Không đọc được lịch sử.');
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
              `${project.name}: ${caught instanceof Error ? caught.message : 'Lỗi project'}`,
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
        if (remains.length) throw new Error('Còn dữ liệu chờ đồng bộ. Hãy thử lại.');
        syncFailures.current = 0;
        syncRetryAt.current = 0;
        setSyncStatus('synced');
        await refreshProjects();
      } catch (caught: unknown) {
        syncFailures.current++;
        syncRetryAt.current =
          Date.now() + Math.min(300_000, 15_000 * 2 ** Math.min(syncFailures.current, 5));
        setSyncStatus(navigator.onLine ? 'failed' : 'offline');
        setSyncError(caught instanceof Error ? caught.message : 'Đồng bộ thất bại.');
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
      setError(caught instanceof Error ? caught.message : 'Không đọc được danh sách project.');
    });
  }
  function changeWorkspace(next: Workspace) {
    setWorkspace(next);
    setStorage('unsaved');
  }
  async function save() {
    if (!open || !workspace) return;
    if (chartLoading) throw new Error('Đang tạo biểu đồ. Hãy chờ trước khi lưu hoặc thoát.');
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
                  ? 'Đang đọc và kiểm tra CSV…'
                  : percent < 90
                    ? 'Đang tính thống kê toàn bộ dữ liệu…'
                    : 'Đang lưu trên máy…',
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
          message: caught instanceof Error ? caught.message : 'Nhập CSV thất bại.',
        });
        setStorage(open ? 'saved-local' : 'unsaved');
        throw caught;
      }
    }, true);
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
        throw new Error('Preview không khớp dữ liệu/cấu hình.');
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
          <p role="status">Đang tải không gian 3D…</p>
        </main>
      }
    >
      <div className="app">
        <header className="topbar">
          <a className="brand" href="/">
            <span className="brand-mark">D</span>Dashboard <strong>3D</strong>
          </a>
          <span className="stage">{workspace?.section ?? 'Collection'}</span>
          <SessionControls
            storageStatus={storage}
            syncStatus={account ? syncStatus : navigator.onLine ? 'not-connected' : 'offline'}
            {...(open
              ? {
                  onSave: async () => {
                    if (lock.current) throw new Error('Đang xử lý, hãy chờ.');
                    await save();
                  },
                  onExit: async () => {
                    if (lock.current) throw new Error('Đang xử lý, hãy chờ.');
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
                setError(
                  caught instanceof Error ? caught.message : 'Không đọc được danh sách project.',
                );
              });
            }}
            onSync={async (auth) => {
              await synchronize(auth);
            }}
          />
        </header>
        <div className="sync-bar">
          <span>{offlineReady ? 'Sẵn sàng offline' : 'Đang chuẩn bị tài nguyên offline'}</span>
          <span>
            {account
              ? `Đồng bộ: ${syncStatus}`
              : 'Đăng nhập để đồng bộ. Dữ liệu local vẫn làm việc offline.'}
          </span>
          <button
            className="quiet-button"
            disabled={!account || busy || syncStatus === 'syncing'}
            onClick={() => {
              if (account) void synchronize(account, true).catch(() => {});
            }}
          >
            Đồng bộ ngay (gồm project local)
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
            Danh sách project server
          </button>
          {syncError && <span role="status">{syncError}</span>}
        </div>
        {remoteProjects.length > 0 && (
          <section className="workspace panel">
            <h2>Project trên server</h2>
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
                <span>Tải / Mở phiên</span>
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
                      `${workspace?.fileName ?? 'Project'} — bản riêng`,
                      workspace?.fileBytes ?? 0,
                      identity ?? 'local',
                    ),
                  );
                  await refreshProjects();
                });
              }}
            >
              Lưu kết quả thành project riêng (giữ nguyên project cũ)
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
            <h1>Đăng nhập để bắt đầu.</h1>
            <p className="intro">
              Mở Đăng nhập / Đăng ký phía trên. Tài khoản đã mở khóa trên máy có thể tiếp tục làm
              việc khi offline.
            </p>
          </main>
        )}
        {identity && !open && (
          <section className="workspace project-list">
            <div className="panel-heading">
              <h2>Project / phiên đã lưu trên máy</h2>
              <button
                className="quiet-button"
                onClick={() => {
                  setError(null);
                }}
              >
                Tạo project — nhập CSV bên dưới
              </button>
            </div>
            {!visibleProjects.length && (
              <p className="hint">Chưa có project. Nhập một CSV để bắt đầu.</p>
            )}
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
                      ? new Date(project.updatedAt).toLocaleString('vi-VN')
                      : 'Chưa rõ thời điểm'}{' '}
                    · Mở phiên →
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
                onNext={() => {
                  navigate('missing');
                }}
              />
              {open && workspace && chart && (
                <section className="workspace panel">
                  <h2>Collection · {workspace.fileBytes.toLocaleString('vi-VN')} byte nguồn</h2>
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
                    Chạy lại Collection
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
                  {analysis && (
                    <details>
                      <summary>Thống kê cột và ma trận Pearson</summary>
                      <div className="table-scroll">
                        <table className="dataset-table">
                          <thead>
                            <tr>
                              <th>Cột</th>
                              <th>Min</th>
                              <th>Max</th>
                              <th>Trung bình</th>
                              <th>Trung vị</th>
                              <th>Q1</th>
                              <th>Q3</th>
                              <th>Độ lệch chuẩn</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.columns.map((column) => (
                              <tr key={column.id}>
                                <th>
                                  {column.name}
                                  {column.statistics?.q1 === column.statistics?.q3 &&
                                  column.statistics ? (
                                    <small> · IQR=0: ngoại lệ N/A</small>
                                  ) : null}
                                </th>
                                {(
                                  ['min', 'max', 'mean', 'median', 'q1', 'q3', 'deviation'] as const
                                ).map((key) => (
                                  <td key={key}>
                                    {column.statistics?.[key].toLocaleString('vi-VN', {
                                      maximumFractionDigits: 6,
                                    }) ?? 'N/A'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <h3>Pearson — từng cặp giá trị hợp lệ</h3>
                      <div className="table-scroll">
                        <table className="dataset-table">
                          <thead>
                            <tr>
                              <th>Cột A</th>
                              <th>Cột B</th>
                              <th>Hệ số</th>
                              <th>Ghi chú</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analysis.correlation
                              .slice(correlationPage * 200, (correlationPage + 1) * 200)
                              .map((pair) => (
                                <tr key={`${pair.a}:${pair.b}`}>
                                  <td>{pair.a}</td>
                                  <td>{pair.b}</td>
                                  <td>{pair.coefficient?.toFixed(4) ?? 'N/A'}</td>
                                  <td>{pair.reason ?? ''}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="pagination">
                        <button
                          className="quiet-button"
                          disabled={correlationPage === 0}
                          onClick={() => {
                            setCorrelationPage((page) => Math.max(0, page - 1));
                          }}
                        >
                          Cặp trước
                        </button>
                        <span>
                          Trang {correlationPage + 1}/
                          {Math.max(1, Math.ceil(analysis.correlation.length / 200))} ·{' '}
                          {analysis.correlation.length} cặp (tính toàn bộ)
                        </span>
                        <button
                          className="quiet-button"
                          disabled={(correlationPage + 1) * 200 >= analysis.correlation.length}
                          onClick={() => {
                            setCorrelationPage((page) => page + 1);
                          }}
                        >
                          Cặp sau
                        </button>
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
                    <p className="eyebrow">PRE-PROCESSING</p>
                    <h1>Khám phá và xử lý dữ liệu</h1>
                    <p className="intro">
                      Xem trước → Áp dụng → tự lưu trên máy. Biểu đồ chỉ cập nhật khi bạn chạy lại.
                    </p>
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
                    Hoàn tác
                  </button>
                </div>
                <nav className="section-tabs" aria-label="Các bước tiền xử lý">
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
                        Chạy lại biểu đồ
                      </button>
                    </div>
                    {workspace.section === 'outliers' && (
                      <div className="table-tools">
                        <label>
                          Phương pháp phát hiện
                          <select
                            aria-label="Phương pháp phát hiện"
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
                          Ngưỡng phát hiện
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
                          Chỉ hiện ngoại lệ
                        </label>
                      </div>
                    )}
                    {chart && workspace.section !== 'missing' && (
                      <label className="form-field">
                        Cột biểu đồ
                        <select
                          aria-label="Cột biểu đồ"
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
                          <option value="">Cột phù hợp đầu tiên</option>
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
                        key={`${workspace.section}:${chart.versionId}`}
                        dataset={chart}
                        section={workspace.section}
                        currentVersionId={open.dataset.versionId}
                        analysis={analysis}
                        outlierView={workspace.outlierView}
                        columnId={workspace.chartColumns[workspace.section] ?? null}
                        selection={selection}
                        onSelect={(next) => {
                          if (!busy) {
                            setSelection(next);
                            setStorage('unsaved');
                            setPreview(null);
                          }
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
                      <p role="status">Đang mở dữ liệu biểu đồ…</p>
                    )}
                    {selection && selection.versionId !== open.dataset.versionId && chart && (
                      <>
                        <p className="hint">Đang xem dòng trên biểu đồ cũ, chỉ đọc.</p>
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
                    <summary>So sánh biểu đồ trước / sau (chưa áp dụng)</summary>
                    <div className="product-grid">
                      <div>
                        <h3>Trước</h3>
                        <Scene3D
                          dataset={open.dataset}
                          section={workspace.section}
                          currentVersionId={open.dataset.versionId}
                          columnId={workspace.chartColumns[workspace.section] ?? null}
                          analysis={preview.analysisBefore}
                          selection={null}
                          onSelect={() => {}}
                          onView={() => {}}
                        />
                      </div>
                      <div>
                        <h3>Sau xem trước</h3>
                        <Scene3D
                          dataset={preview.dataset}
                          section={workspace.section}
                          currentVersionId={preview.dataset.versionId}
                          columnId={workspace.chartColumns[workspace.section] ?? null}
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
                    <summary>So sánh bảng sau xử lý (chưa áp dụng)</summary>
                    <DatasetTable dataset={preview.dataset} />
                  </details>
                )}
                <details className="panel">
                  <summary>Lịch sử thao tác ({history.length})</summary>
                  {history.map((item, index) => (
                    <p key={index}>
                      {String(index + 1)}. {item}
                    </p>
                  ))}
                </details>
              </main>
            )
          ))}
        <footer>
          Dashboard 3D · Dữ liệu nguồn được giữ nguyên · Lưu trên máy và đồng bộ server là hai trạng
          thái riêng
        </footer>
      </div>
    </Suspense>
  );
}
