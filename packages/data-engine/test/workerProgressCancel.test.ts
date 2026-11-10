
import { describe, expect, it } from 'vitest';

import type {
  WorkerProgress,
  WorkerCancelRequest,
  WorkerCancelledResponse,
} from '../src/worker/workerMessages.js';

describe('Worker Progress and Cancel messages', () => {
  it('creates a progress message', () => {
    const progress: WorkerProgress = {
      taskId: 'task-1',
      status: 'progress',
      completed: 50,
      total: 100,
      percentage: 50,
    };

    expect(progress.taskId).toBe('task-1');
    expect(progress.status).toBe('progress');
    expect(progress.completed).toBe(50);
    expect(progress.total).toBe(100);
    expect(progress.percentage).toBe(50);
  });

  it('creates a cancel request', () => {
    const request: WorkerCancelRequest = {
      taskId: 'task-1',
      type: 'cancel',
    };

    expect(request.taskId).toBe('task-1');
    expect(request.type).toBe('cancel');
  });

  it('creates a cancelled response', () => {
    const response: WorkerCancelledResponse = {
      taskId: 'task-1',
      status: 'cancelled',
    };

    expect(response.taskId).toBe('task-1');
    expect(response.status).toBe('cancelled');
  });

  it('keeps the same taskId across messages', () => {
    const progress: WorkerProgress = {
      taskId: 'task-123',
      status: 'progress',
      completed: 25,
      total: 100,
      percentage: 25,
    };

    const cancel: WorkerCancelRequest = {
      taskId: progress.taskId,
      type: 'cancel',
    };

    const cancelled: WorkerCancelledResponse = {
      taskId: cancel.taskId,
      status: 'cancelled',
    };

    expect(cancel.taskId).toBe(progress.taskId);
    expect(cancelled.taskId).toBe(cancel.taskId);
  });
});
