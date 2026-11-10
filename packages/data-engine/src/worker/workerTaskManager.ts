
export interface WorkerTaskManager {
  startTask: (taskId: string) => AbortSignal;
  cancelTask: (taskId: string) => boolean;
  finishTask: (taskId: string) => void;
  hasTask: (taskId: string) => boolean;
  getActiveTaskCount: () => number;
}

export function createWorkerTaskManager(): WorkerTaskManager {
  const controllers = new Map<string, AbortController>();

  const startTask = (taskId: string): AbortSignal => {
    if (controllers.has(taskId)) {
      throw new Error(`Task already exists: ${taskId}`);
    }

    const controller = new AbortController();
    controllers.set(taskId, controller);

    return controller.signal;
  };

  const cancelTask = (taskId: string): boolean => {
    const controller = controllers.get(taskId);

    if (controller === undefined) {
      return false;
    }

    controller.abort();
    return true;
  };

  const finishTask = (taskId: string): void => {
    controllers.delete(taskId);
  };

  const hasTask = (taskId: string): boolean => {
    return controllers.has(taskId);
  };

  const getActiveTaskCount = (): number => {
    return controllers.size;
  };

  return {
    startTask,
    cancelTask,
    finishTask,
    hasTask,
    getActiveTaskCount,
  };
}
