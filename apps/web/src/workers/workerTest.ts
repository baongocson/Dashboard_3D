import type { Dataset } from '@dashboard/contracts';

import { createBrowserDataEngineWorker } from './createBrowserDataEngineWorker.js';

import type {
  WorkerRuntimeRequest,
  WorkerRuntimeResponse,
} from '../../../../packages/data-engine/src/worker/workerMessages.js';

const summaryButton = document.querySelector<HTMLButtonElement>('#run-summary');
const runButton = document.querySelector<HTMLButtonElement>('#run-test');
const cancelButton = document.querySelector<HTMLButtonElement>('#cancel-test');
const progressBar = document.querySelector<HTMLProgressElement>('#worker-progress');
const progressText = document.querySelector<HTMLElement>('#progress-text');
const resultElement = document.querySelector<HTMLElement>('#result');

if (
  summaryButton === null ||
  runButton === null ||
  cancelButton === null ||
  progressBar === null ||
  progressText === null ||
  resultElement === null
) {
  throw new Error('Không tìm thấy phần tử giao diện Worker Test');
}

const worker = createBrowserDataEngineWorker();

let activeTaskId: string | null = null;
let nextTaskNumber = 0;

function setRunning(running: boolean): void {
  if (summaryButton === null || runButton === null || cancelButton === null) {
    return;
  }

  summaryButton.disabled = running;
  runButton.disabled = running;
  cancelButton.disabled = !running;
}

function sendRequest(request: WorkerRuntimeRequest): void {
  worker.postMessage(request);
}

function createSummaryDataset(): Dataset {
  return {
    versionId: 'v1',
    columns: [
      {
        id: 'c1',
        name: 'Age',
        type: 'number',
      },
    ],
    rows: [
      { id: 'r1', cells: { c1: 20 } },
      { id: 'r2', cells: { c1: null } },
      { id: 'r3', cells: { c1: 30 } },
    ],
  };
}

function createLargeDataset(rowCount: number): Dataset {
  return {
    versionId: 'worker-browser-test',
    columns: [
      {
        id: 'value',
        name: 'Value',
        type: 'number',
      },
    ],
    rows: Array.from({ length: rowCount }, (_, index) => ({
      id: `row-${String(index)}`,
      cells: {
        value: index,
      },
    })),
  };
}

function startTask(request: WorkerRuntimeRequest): void {
  if (progressBar === null || progressText === null || resultElement === null) {
    return;
  }

  activeTaskId = request.taskId;

  progressBar.value = 0;
  progressText.textContent = '0%';
  resultElement.textContent = 'Worker đang xử lý...';

  setRunning(true);
  sendRequest(request);
}

summaryButton.addEventListener('click', () => {
  nextTaskNumber += 1;

  startTask({
    taskId: `summary-${String(nextTaskNumber)}`,
    type: 'dataset-summary',
    dataset: createSummaryDataset(),
  });
});

runButton.addEventListener('click', () => {
  nextTaskNumber += 1;

  startTask({
    taskId: `chunks-${String(nextTaskNumber)}`,
    type: 'process-chunks',
    dataset: createLargeDataset(100_000),
    chunkSize: 1_000,
  });
});

cancelButton.addEventListener('click', () => {
  if (activeTaskId === null) {
    return;
  }

  sendRequest({
    taskId: activeTaskId,
    type: 'cancel',
  });

  cancelButton.disabled = true;
  resultElement.textContent = 'Đã gửi yêu cầu hủy...';
});

worker.addEventListener('message', (event: MessageEvent<WorkerRuntimeResponse>) => {
  const response = event.data;

  if (response.taskId !== activeTaskId) {
    return;
  }

  if (response.status === 'progress') {
    progressBar.value = response.percentage;

    progressText.textContent =
      `${String(response.percentage)}% ` +
      `(${String(response.completed)}/${String(response.total)} dòng)`;

    return;
  }

  if (response.status === 'success') {
    progressBar.value = 100;
    progressText.textContent = 'Hoàn thành';
  } else if (response.status === 'error') {
    progressText.textContent = 'Có lỗi';
  } else {
    progressText.textContent = 'Đã hủy';
  }

  resultElement.textContent = JSON.stringify(response, null, 2);

  activeTaskId = null;
  setRunning(false);
});

worker.addEventListener('error', (event: ErrorEvent) => {
  resultElement.textContent = `Worker gặp lỗi: ${event.message}`;

  activeTaskId = null;
  setRunning(false);
});
