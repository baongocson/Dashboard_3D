
import { db } from '../db';

import {
  datasetSchema,
  manifestSchema,
} from '@dashboard/contracts';

import type {
  Dataset,
  LocalChunkRecord,
  LocalManifestRecord,
} from '../types';

const DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1 MB

export type SaveChunksResult = {
  manifest: LocalManifestRecord;
  chunkCount: number;
  totalBytes: number;
};

async function calculateSHA256(
  data: Uint8Array,
): Promise<string> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);

  const hash = await crypto.subtle.digest(
    'SHA-256',
    copy.buffer,
  );

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lưu dataset thành nhiều chunk và tạo manifest.
 */
export async function saveDatasetChunks(
  datasetId: string,
  versionId: string,
  data: unknown,
  chunkSize = DEFAULT_CHUNK_SIZE,
): Promise<SaveChunksResult> {
  if (!datasetId || !versionId) {
    throw new Error('datasetId và versionId không được để trống');
  }

  if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize phải là số nguyên dương');
  }

  // Xác thực dataset bằng contract chính thức
  const dataset: Dataset = datasetSchema.parse(data);

  if (dataset.versionId !== versionId) {
    throw new Error('versionId không khớp với dataset');
  }

  const json = JSON.stringify(dataset);
  const bytes = new TextEncoder().encode(json);

  if (bytes.byteLength === 0) {
    throw new Error('Dataset rỗng');
  }

  const manifestId = crypto.randomUUID();

  const chunkReferences: LocalManifestRecord['chunks'] = [];

  try {
    let ordinal = 0;

    for (
      let offset = 0;
      offset < bytes.byteLength;
      offset += chunkSize
    ) {
      const part = bytes.slice(
        offset,
        Math.min(offset + chunkSize, bytes.byteLength),
      );

      const id = crypto.randomUUID();
      const sha256 = await calculateSHA256(part);

      const dataBuffer = new ArrayBuffer(part.byteLength);
      new Uint8Array(dataBuffer).set(part);

      const chunk: LocalChunkRecord = {
        id,
        manifestId,
        ordinal,
        bytes: part.byteLength,
        sha256,
        data: dataBuffer,
      };

      await db.chunks.add(chunk);

      chunkReferences.push({
        id,
        ordinal,
        bytes: part.byteLength,
        sha256,
      });

      ordinal++;
    }

    // Manifest tuân thủ manifestSchema
    const manifest = manifestSchema.parse({
      id: manifestId,
      chunks: chunkReferences,
      totalBytes: bytes.byteLength,
    });

    await db.manifests.add(manifest);

    return {
      manifest,
      chunkCount: chunkReferences.length,
      totalBytes: bytes.byteLength,
    };
  } catch (error) {
    // Xóa các chunk đã ghi nếu quá trình thất bại
    await db.chunks
      .where('manifestId')
      .equals(manifestId)
      .delete()
      .catch((cleanupError) => {
        console.error('Lỗi dọn chunk:', cleanupError);
      });

    throw error;
  }
}

/**
 * Đọc manifest, ghép chunk và xác minh SHA-256.
 */
export async function readDatasetChunks(
  manifestId: string,
): Promise<Dataset> {
  const rawManifest = await db.manifests.get(manifestId);

  if (!rawManifest) {
    throw new Error('Không tìm thấy manifest');
  }

  const manifest = manifestSchema.parse(rawManifest);

  const chunks = await db.chunks
    .where('manifestId')
    .equals(manifestId)
    .sortBy('ordinal');

  if (chunks.length !== manifest.chunks.length) {
    throw new Error('Số lượng chunk không khớp manifest');
  }

  const parts: Uint8Array[] = [];

  for (let i = 0; i < manifest.chunks.length; i++) {
    const chunk = chunks[i];
    const reference = manifest.chunks[i];

    if (!chunk || !reference) {
      throw new Error(`Thiếu chunk tại vị trí ${i}`);
    }

    if (
      chunk.id !== reference.id ||
      chunk.ordinal !== reference.ordinal
    ) {
      throw new Error(`Chunk không đúng thứ tự tại vị trí ${i}`);
    }

    if (
      chunk.bytes !== reference.bytes ||
      chunk.data.byteLength !== reference.bytes
    ) {
      throw new Error(`Dung lượng chunk ${i} không hợp lệ`);
    }

    if (chunk.sha256 !== reference.sha256) {
      throw new Error(`Metadata SHA-256 chunk ${i} không khớp`);
    }

    const part = new Uint8Array(chunk.data);
    const actualHash = await calculateSHA256(part);

    if (actualHash !== reference.sha256) {
      throw new Error(`SHA-256 chunk ${i} không hợp lệ`);
    }

    parts.push(part);
  }

  const totalBytes = parts.reduce(
    (sum, part) => sum + part.byteLength,
    0,
  );

  if (totalBytes !== manifest.totalBytes) {
    throw new Error('Tổng dung lượng không khớp manifest');
  }

  const combined = new Uint8Array(totalBytes);

  let offset = 0;

  for (const part of parts) {
    combined.set(part, offset);
    offset += part.byteLength;
  }

  const json = new TextDecoder().decode(combined);

  // Kiểm tra dataset khôi phục bằng contract
  return datasetSchema.parse(JSON.parse(json));
}

/**
 * Xóa manifest và các chunk liên quan.
 */
export async function deleteDatasetChunks(
  manifestId: string,
): Promise<void> {
  await db.transaction(
    'rw',
    db.manifests,
    db.chunks,
    async () => {
      await db.chunks
        .where('manifestId')
        .equals(manifestId)
        .delete();

      await db.manifests.delete(manifestId);
    },
  );
}
