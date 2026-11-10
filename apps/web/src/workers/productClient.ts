import { z } from 'zod';

const envelope = z.discriminatedUnion('type', [
  z.object({
    jobId: z.string(),
    type: z.literal('headers-required'),
    headers: z.array(z.string()),
  }),
  z.object({ jobId: z.string(), type: z.literal('progress'), percent: z.number().min(0).max(100) }),
  z.object({ jobId: z.string(), type: z.literal('error'), message: z.string() }),
  z.object({ jobId: z.string(), type: z.literal('result'), result: z.unknown() }),
]);
export class HeadersRequiredError extends Error {
  constructor(readonly headers: string[]) {
    super('Tên cột rỗng hoặc trùng. Kiểm tra và xác nhận tên đề xuất.');
  }
}
export function runDataJob<T>(
  request: Record<string, unknown>,
  validate: (value: unknown) => T,
  signal?: AbortSignal,
  progress?: (percent: number) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./product.worker.ts', import.meta.url), { type: 'module' });
    const jobId = crypto.randomUUID();
    const cleanup = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(new Error('Đã hủy xử lý.'));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(new Error('Worker gặp lỗi. Dữ liệu hiện tại được giữ nguyên.'));
    };
    worker.onmessage = (event: MessageEvent<unknown>) => {
      try {
        const message = envelope.parse(event.data);
        if (message.jobId !== jobId) throw new Error('Worker job không khớp.');
        if (message.type === 'progress') {
          progress?.(message.percent);
          return;
        }
        cleanup();
        if (message.type === 'headers-required') reject(new HeadersRequiredError(message.headers));
        else if (message.type === 'error') reject(new Error(message.message));
        else resolve(validate(message.result));
      } catch (error: unknown) {
        cleanup();
        reject(error instanceof Error ? error : new Error('Worker trả dữ liệu không hợp lệ.'));
      }
    };
    worker.postMessage({ ...request, jobId });
  });
}
