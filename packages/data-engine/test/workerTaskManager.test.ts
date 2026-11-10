import { describe, expect, it } from 'vitest';

import { createWorkerTaskManager } from '../src/worker/workerTaskManager.js';

describe('createWorkerTaskManager', () => {
  it('starts and tracks a task', () => {
    const manager = createWorkerTaskManager();

    const signal = manager.startTask('task-1');

    expect(signal.aborted).toBe(false);
    expect(manager.hasTask('task-1')).toBe(true);
    expect(manager.getActiveTaskCount()).toBe(1);
  });

  it('cancels an existing task', () => {
    const manager = createWorkerTaskManager();

    const signal = manager.startTask('task-1');

    const cancelled = manager.cancelTask('task-1');

    expect(cancelled).toBe(true);
    expect(signal.aborted).toBe(true);
  });

  it('returns false when cancelling an unknown task', () => {
    const manager = createWorkerTaskManager();

    expect(manager.cancelTask('unknown')).toBe(false);
  });

  it('prevents duplicate task IDs', () => {
    const manager = createWorkerTaskManager();

    manager.startTask('task-1');

    expect(() => manager.startTask('task-1')).toThrow('Task already exists: task-1');
  });

  it('finishes a task and releases its controller', () => {
    const manager = createWorkerTaskManager();

    manager.startTask('task-1');
    manager.finishTask('task-1');

    expect(manager.hasTask('task-1')).toBe(false);
    expect(manager.getActiveTaskCount()).toBe(0);
  });

  it('cancels only the requested task', () => {
    const manager = createWorkerTaskManager();

    const firstSignal = manager.startTask('task-1');
    const secondSignal = manager.startTask('task-2');

    manager.cancelTask('task-1');

    expect(firstSignal.aborted).toBe(true);
    expect(secondSignal.aborted).toBe(false);
    expect(manager.getActiveTaskCount()).toBe(2);
  });
});
