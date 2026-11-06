import { CONTRACT_VERSION, workerRequestSchema, workerResponseSchema } from '@dashboard/contracts';

// This file runs in a Worker. The caller is introduced with the CSV bridge in task 04.
self.addEventListener('message', (event: MessageEvent<unknown>) => {
  const request = workerRequestSchema.safeParse(event.data);
  const response = request.success
    ? { type: 'ready', jobId: request.data.jobId, contractVersion: CONTRACT_VERSION }
    : { type: 'error', jobId: null, message: 'Invalid Worker request' };
  self.postMessage(workerResponseSchema.parse(response));
});
