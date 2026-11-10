import { describe, expect, it } from 'vitest';

import { createWorkerTaskHandler } from '../src/worker/workerTaskHandler.js';

describe('createWorkerTaskHandler', () => {
  it('starts a task', () => {
    const handler = createWorkerTaskHandler();

    const signal = handler.start('task-1');

    expect(signal.aborted).toBe(false);
    expect(handler.isActive('task-1')).toBe(true);
  });

  it('cancels a running task', () => {
    const handler = createWorkerTaskHandler();

    const signal = handler.start('task-1');

    const response = handler.cancel({
      taskId: 'task-1',
      type: 'cancel',
    });

    expect(signal.aborted).toBe(true);
    expect(response).toEqual({
      taskId: 'task-1',
      status: 'cancelled',
    });
  });

  it('returns null when cancelling an unknown task', () => {
    const handler = createWorkerTaskHandler();

    const response = handler.cancel({
      taskId: 'unknown',
      type: 'cancel',
    });

    expect(response).toBeNull();
  });

  it('finishes a task', () => {
    const handler = createWorkerTaskHandler();

    handler.start('task-1');
    handler.finish('task-1');

    expect(handler.isActive('task-1')).toBe(false);
  });

  it('prevents duplicate tasks', () => {
    const handler = createWorkerTaskHandler();

    handler.start('task-1');

    expect(() => handler.start('task-1')).toThrow('Task already exists: task-1');
  });
});
