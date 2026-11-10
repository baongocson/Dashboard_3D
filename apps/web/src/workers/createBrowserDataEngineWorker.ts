export function createBrowserDataEngineWorker(): Worker {
  return new Worker(
    new URL('../../../../packages/data-engine/src/worker/dataEngine.worker.ts', import.meta.url),
    {
      type: 'module',
      name: 'data-engine-worker',
    },
  );
}
