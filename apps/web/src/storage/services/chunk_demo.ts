
import {
  datasetSchema,
  projectSchema,
  sessionSchema,
  versionSchema,
  historySchema,
  outboxSchema,
  applyPublicationSchema,
} from '@dashboard/contracts';

import { db } from '../db';
import { recoverSession } from './recovery_service';
import {
  saveDatasetChunks,
  readDatasetChunks,
} from './chunk_service';

import { publishApply } from './publication_service.';
import {
  markOutboxUploading,
  markOutboxSynced,
  getOutboxByProject,
} from './outbox_service';
export async function runChunkDemo() {
  // -----------------------------------------
  // 1. Tạo ID cho dữ liệu demo
  // -----------------------------------------

  const projectId = crypto.randomUUID();
  const sessionId = crypto.randomUUID();
  const datasetId = crypto.randomUUID();

  const initialVersionId = crypto.randomUUID();
  const newVersionId = crypto.randomUUID();

  const operationId = crypto.randomUUID();

  console.log('Bắt đầu Chunk + Publication Demo');

  // -----------------------------------------
  // 2. Tạo Dataset ban đầu
  // -----------------------------------------

  const initialDataset = datasetSchema.parse({
    versionId: initialVersionId,

    columns: [
      { id: 'col-name', name: 'name', type: 'text' },
      { id: 'col-age', name: 'age', type: 'number' },
      { id: 'col-score', name: 'score', type: 'number' },
    ],

    rows: [
      {
        id: 'row-001',
        cells: {
          'col-name': 'An',
          'col-age': 20,
          'col-score': 8.5,
        },
      },
      {
        id: 'row-002',
        cells: {
          'col-name': 'Bình',
          'col-age': 21,
          'col-score': 9,
        },
      },
      {
        id: 'row-003',
        cells: {
          'col-name': 'Chi',
          'col-age': 19,
          'col-score': 7.5,
        },
      },
    ],
  });

  // -----------------------------------------
  // 3. Tạo Dataset sau khi Apply
  //    Mô phỏng fill-cell: 8.5 -> 9
  // -----------------------------------------

  const updatedDataset = datasetSchema.parse({
    ...initialDataset,
    versionId: newVersionId,

    rows: initialDataset.rows.map((row) => {
      if (row.id !== 'row-001') {
        return row;
      }

      return {
        ...row,
        cells: {
          ...row.cells,
          'col-score': 9,
        },
      };
    }),
  });

  console.log('Dataset ban đầu:', initialDataset);
  console.log('Dataset sau Apply:', updatedDataset);

  // -----------------------------------------
  // 4. Lưu Dataset ban đầu thành Chunks
  // -----------------------------------------

  const initialSaved = await saveDatasetChunks(
    datasetId,
    initialVersionId,
    initialDataset,
    100,
  );

  console.log('Initial Manifest:', initialSaved.manifest);

  // -----------------------------------------
  // 5. Lưu Dataset sau Apply thành Chunks
  // -----------------------------------------

  const saved = await saveDatasetChunks(
    datasetId,
    newVersionId,
    updatedDataset,
    100,
  );

  console.log('New Manifest:', saved.manifest);
  console.log('Số chunk:', saved.chunkCount);
  console.log('Tổng dung lượng:', saved.totalBytes);

  // -----------------------------------------
  // 6. Tạo Project đúng projectSchema
  // -----------------------------------------

  const project = projectSchema.parse({
    id: projectId,
    ownerId: 'demo-owner',
    name: 'Chunk Publication Demo',
    datasetId,
    sessionId,
  });

  // -----------------------------------------
  // 7. Tạo Session đúng sessionSchema
  // -----------------------------------------

  const session = sessionSchema.parse({
    id: sessionId,
    projectId,
    datasetId,
    currentVersionId: initialVersionId,

    section: 'collection',

    confirmedConfiguration: {},

    charts: [],

    views: [],

    table: {
      filters: [],
      sorts: [],
      selection: null,
    },
  });

  // -----------------------------------------
  // 8. Tạo Version ban đầu
  // -----------------------------------------

  const initialVersion = versionSchema.parse({
    id: initialVersionId,
    projectId,
    datasetId,
    parentVersionId: null,
    manifestId: initialSaved.manifest.id,
    source: 'import',
  });

  // -----------------------------------------
  // 9. Lưu Project, Session và Version gốc
  // -----------------------------------------

  await db.transaction(
    'rw',
    db.projects,
    db.sessions,
    db.versions,
    async () => {
      await db.projects.add(project);
      await db.sessions.add(session);
      await db.versions.add(initialVersion);
    },
  );

  console.log('Project đã lưu:', project.id);
  console.log('Session đã lưu:', session.id);
  console.log('Initial Version đã lưu:', initialVersion.id);

  // -----------------------------------------
  // 10. Tạo History
  // -----------------------------------------

  const history = historySchema.parse({
    operationId,
    kind: 'apply',

    fromVersionId: initialVersionId,
    toVersionId: newVersionId,

    method: 'fill-cell',

    columnIds: ['col-score'],
    rowIds: ['row-001'],

    parameters: {
      rowId: 'row-001',
      columnId: 'col-score',
      value: 9,
    },

    changes: {
      rows: 1,
      columns: 1,
      cells: 1,
    },
  });

  // -----------------------------------------
  // 11. Tạo Outbox
  // -----------------------------------------

  const outbox = outboxSchema.parse({
    operationId,
    projectId,

    kind: 'apply',

    baseRevision: null,
    dependsOn: [],

    status: 'pending',
  });

  // -----------------------------------------
  // 12. Tạo Version mới
  // -----------------------------------------

  const newVersion = versionSchema.parse({
    id: newVersionId,
    projectId,
    datasetId,

    parentVersionId: initialVersionId,

    manifestId: saved.manifest.id,

    source: 'apply',
  });

  // -----------------------------------------
  // 13. Tạo Publication theo contract
  // -----------------------------------------

  const publication = applyPublicationSchema.parse({
    version: newVersion,
    manifest: saved.manifest,
    history,
    outbox,
    currentVersionId: newVersionId,
  });

  // -----------------------------------------
  // 14. Publish
  // -----------------------------------------

  const publishedVersionId = await publishApply(
    sessionId,
    publication,
  );

  console.log(
    'Publication thành công:',
    publishedVersionId,
  );
  // OUTBOX TEST
await markOutboxUploading(operationId);

// Mô phỏng server đã xác nhận đồng bộ thành công.
// Đây chưa phải request gửi lên server thật.
await markOutboxSynced(operationId);

const outboxItems = await getOutboxByProject(projectId);

const syncedItem = outboxItems.find(
  (item) => item.operationId === operationId,
);

if (!syncedItem || syncedItem.status !== 'synced') {
  throw new Error('Outbox không chuyển sang trạng thái synced.');
}

console.log('OUTBOX TEST: SUCCESS', syncedItem);
// RECOVERY TEST
const recovered = await recoverSession(sessionId);

console.log('Recovery:', recovered);

if (recovered.versionId !== newVersionId) {
  throw new Error('Recovery trả về sai Version.');
}

if (
  JSON.stringify(recovered.dataset) !==
  JSON.stringify(updatedDataset)
) {
  throw new Error('Dataset khôi phục không khớp dữ liệu ban đầu.');
}

console.log('RECOVERY TEST: SUCCESS');
  // -----------------------------------------
  // 15. Đọc lại Dataset từ Chunks
  // -----------------------------------------

  const restoredDataset = await readDatasetChunks(
    saved.manifest.id,
  );

  const isIdentical =
    JSON.stringify(updatedDataset) ===
    JSON.stringify(restoredDataset);

  console.log('Dataset khôi phục:', restoredDataset);
  console.log('Dữ liệu giống nhau:', isIdentical);

  if (!isIdentical) {
    throw new Error(
      'Dataset khôi phục không giống dữ liệu sau Apply',
    );
  }

  // -----------------------------------------
  // 16. Kiểm tra Publication đã lưu
  // -----------------------------------------

  const storedVersion = await db.versions.get(newVersionId);
  const storedHistory = await db.histories.get(operationId);
  const storedOutbox = await db.outbox.get(operationId);
  const storedSession = await db.sessions.get(sessionId);

  if (!storedVersion) {
    throw new Error('Không tìm thấy Version sau Publication');
  }

  if (!storedHistory) {
    throw new Error('Không tìm thấy History sau Publication');
  }

  if (!storedOutbox) {
    throw new Error('Không tìm thấy Outbox sau Publication');
  }

  if (storedSession?.currentVersionId !== newVersionId) {
    throw new Error('Session chưa được cập nhật currentVersionId');
  }

  console.log('Version:', storedVersion);
  console.log('History:', storedHistory);
  console.log('Outbox:', storedOutbox);
  console.log('Session:', storedSession);

  console.log('CHUNK + PUBLICATION DEMO: SUCCESS');

  return {
    projectId,
    sessionId,
    datasetId,

    initialVersionId,
    publishedVersionId,

    initialManifestId: initialSaved.manifest.id,
    manifestId: saved.manifest.id,

    chunkCount: saved.chunkCount,
    totalBytes: saved.totalBytes,

    isIdentical,

    publicationSuccess: true,
    historySuccess: true,
    outboxSuccess: true,
    sessionUpdated: true,
  };
}
