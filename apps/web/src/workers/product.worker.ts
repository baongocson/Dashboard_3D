import { z } from 'zod';
import { csvOptionsSchema, datasetSchema, idSchema } from '@dashboard/contracts';
import { importCsv } from '@dashboard/data-engine';
import { CsvHeaderError } from '../../../../packages/data-engine/src/csv/createDataset';
import { createProject } from '../storage/workspace';
import {
  analyzeDataset,
  operationSchema,
  previewOperation,
} from '../../../../packages/data-engine/src/operations';

const requestSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('import'),
    jobId: idSchema,
    file: z.instanceof(File),
    options: csvOptionsSchema,
    versionId: idSchema,
    ownerId: idSchema,
  }),
  z.object({
    type: z.literal('preview'),
    jobId: idSchema,
    dataset: datasetSchema,
    configuration: operationSchema,
    versionId: idSchema,
  }),
  z.object({ type: z.literal('analyze'), jobId: idSchema, dataset: datasetSchema }),
]);
self.onmessage = async (event: MessageEvent<unknown>) => {
  const id = z.object({ jobId: idSchema }).safeParse(event.data);
  const jobId = id.success ? id.data.jobId : 'invalid';
  try {
    const request = requestSchema.parse(event.data);
    self.postMessage({ jobId, type: 'progress', percent: 5 });
    let result: unknown;
    if (request.type === 'import') {
      const dataset = await importCsv(request.file, request.options, request.versionId);
      self.postMessage({ jobId, type: 'progress', percent: 70 });
      const analysis = analyzeDataset(dataset);
      self.postMessage({ jobId, type: 'progress', percent: 90 });
      const opened = await createProject(
        dataset,
        request.file.name,
        request.file.size,
        request.ownerId,
        analysis,
        JSON.stringify(request.options),
      );
      result = { dataset, analysis, session: opened.session, workspace: opened.workspace };
    } else if (request.type === 'preview') {
      const preview = previewOperation(request.dataset, request.configuration, request.versionId);
      result = {
        ...preview,
        analysisBefore: analyzeDataset(request.dataset),
        analysisAfter: analyzeDataset(preview.dataset),
      };
    } else result = analyzeDataset(request.dataset);
    self.postMessage({ jobId, type: 'result', result });
  } catch (error: unknown) {
    if (error instanceof CsvHeaderError) {
      self.postMessage({ jobId, type: 'headers-required', headers: error.proposedHeaders });
      return;
    }
    self.postMessage({
      jobId,
      type: 'error',
      message: error instanceof Error ? error.message : 'Không thể xử lý dữ liệu.',
    });
  }
};
