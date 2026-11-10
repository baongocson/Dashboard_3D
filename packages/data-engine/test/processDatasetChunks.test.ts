import { describe, expect, it, vi } from 'vitest';
import type { Dataset } from '@dashboard/contracts';

import {
  ChunkProcessingCancelledError,
  processDatasetChunks,
} from '../src/worker/processDatasetChunks.js';

import type { WorkerProgress } from '../src/worker/workerMessages.js';

describe('processDatasetChunks', () => {
  const dataset: Dataset = {
    versionId: 'v1',
    columns: [{ id: 'c1', name: 'Age', type: 'number' }],
    rows: [
      { id: 'r1', cells: { c1: 10 } },
      { id: 'r2', cells: { c1: 20 } },
      { id: 'r3', cells: { c1: 30 } },
      { id: 'r4', cells: { c1: 40 } },
      { id: 'r5', cells: { c1: 50 } },
    ],
  };

  // TEST 1: Xử lý từng chunk và báo tiến độ
  it('processes chunks and reports progress', async () => {
    const processedRows: string[] = [];
    const progressMessages: WorkerProgress[] = [];

    await processDatasetChunks('task-1', dataset, {
      chunkSize: 2,
      processChunk: (rows) => {
        processedRows.push(...rows.map((row) => row.id));
      },
      onProgress: (progress) => {
        progressMessages.push(progress);
      },
    });

    expect(processedRows).toEqual(['r1', 'r2', 'r3', 'r4', 'r5']);

    expect(progressMessages.map((progress) => progress.completed)).toEqual([2, 4, 5]);

    expect(progressMessages.map((progress) => progress.percentage)).toEqual([40, 80, 100]);
  });

  // TEST 2: Dataset rỗng
  it('handles an empty dataset', async () => {
    const onProgress = vi.fn();

    await processDatasetChunks(
      'task-empty',
      { ...dataset, rows: [] },
      {
        chunkSize: 2,
        processChunk: vi.fn(),
        onProgress,
      },
    );

    expect(onProgress).toHaveBeenCalledWith({
      taskId: 'task-empty',
      status: 'progress',
      completed: 0,
      total: 0,
      percentage: 100,
    });
  });

  // TEST 3: Từ chối chunkSize không hợp lệ
  it('rejects invalid chunk sizes', async () => {
    await expect(
      processDatasetChunks('task-invalid', dataset, {
        chunkSize: 0,
        processChunk: vi.fn(),
        onProgress: vi.fn(),
      }),
    ).rejects.toThrow('chunkSize must be a positive safe integer');
  });

  // TEST 4: Nhường quyền điều khiển giữa các chunk
  it('yields control between chunks', async () => {
    const yieldControl = vi.fn(async (): Promise<void> => {
      await Promise.resolve();
    });

    await processDatasetChunks('task-yield', dataset, {
      chunkSize: 2,
      processChunk: vi.fn(),
      onProgress: vi.fn(),
      yieldControl,
    });

    expect(yieldControl).toHaveBeenCalledTimes(2);
  });

  // TEST 5: Hủy trước khi bắt đầu
  it('cancels before processing starts', async () => {
    const controller = new AbortController();
    controller.abort();

    const processChunk = vi.fn();
    const onProgress = vi.fn();

    await expect(
      processDatasetChunks('task-cancelled', dataset, {
        chunkSize: 2,
        processChunk,
        onProgress,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ChunkProcessingCancelledError);

    expect(processChunk).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
  });

  // TEST 6: Hủy sau chunk đầu tiên
  it('stops before the next chunk after cancellation', async () => {
    const controller = new AbortController();
    const processedRows: string[] = [];
    const completed: number[] = [];

    await expect(
      processDatasetChunks('task-cancel', dataset, {
        chunkSize: 2,
        signal: controller.signal,
        processChunk: (rows) => {
          processedRows.push(...rows.map((row) => row.id));
        },
        onProgress: (progress) => {
          completed.push(progress.completed);

          if (progress.completed === 2) {
            controller.abort();
          }
        },
      }),
    ).rejects.toBeInstanceOf(ChunkProcessingCancelledError);

    expect(processedRows).toEqual(['r1', 'r2']);
    expect(completed).toEqual([2]);
  });

  // TEST 7: Hủy trong lúc xử lý chunk
  it('does not report progress when cancelled during a chunk', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();

    await expect(
      processDatasetChunks('task-mid-chunk', dataset, {
        chunkSize: 2,
        signal: controller.signal,
        processChunk: () => {
          controller.abort();
        },
        onProgress,
      }),
    ).rejects.toBeInstanceOf(ChunkProcessingCancelledError);

    expect(onProgress).not.toHaveBeenCalled();
  });
});
