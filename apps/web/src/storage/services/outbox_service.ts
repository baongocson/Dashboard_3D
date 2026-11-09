import {
  outboxSchema,
} from '@dashboard/contracts';

import type { LocalOutboxRecord } from '../types';
import { db } from '../db';

export type OutboxStatus = LocalOutboxRecord['status'];

const allowedTransitions: Record<
  OutboxStatus,
  OutboxStatus[]
> = {
  pending: ['uploading'],
  uploading: [
    'synced',
    'conflict',
    'auth-required',
    'retryable-error',
  ],
  synced: [],
  conflict: ['pending'],
  'auth-required': ['uploading'],
  'retryable-error': ['uploading'],
};


export async function getOutboxByProject(
  projectId: string,
): Promise<LocalOutboxRecord[]> {
  if (!projectId.trim()) {
    throw new Error('projectId không được để trống.');
  }

  return db.outbox
    .where('projectId')
    .equals(projectId)
    .toArray();
}


export async function getReadyOutbox(
  projectId: string,
): Promise<LocalOutboxRecord[]> {
  const items = await getOutboxByProject(projectId);

  const itemById = new Map(
    items.map((item) => [item.operationId, item]),
  );

  return items.filter((item) => {
    if (
      item.status !== 'pending' &&
      item.status !== 'retryable-error'
    ) {
      return false;
    }

    return item.dependsOn.every((dependencyId) => {
      const dependency = itemById.get(dependencyId);

      return dependency?.status === 'synced';
    });
  });
}


export async function transitionOutboxStatus(
  operationId: string,
  nextStatus: OutboxStatus,
): Promise<LocalOutboxRecord> {
  if (!operationId.trim()) {
    throw new Error('operationId không được để trống.');
  }

  return db.transaction(
    'rw',
    db.outbox,
    async () => {
      const current = await db.outbox.get(operationId);

      if (!current) {
        throw new Error(
          `Không tìm thấy Outbox: ${operationId}`,
        );
      }

      const validatedCurrent = outboxSchema.parse(current);

      if (
        !allowedTransitions[validatedCurrent.status].includes(
          nextStatus,
        )
      ) {
        throw new Error(
          `Không thể chuyển Outbox từ "${validatedCurrent.status}" sang "${nextStatus}".`,
        );
      }

      const updated = outboxSchema.parse({
        ...validatedCurrent,
        status: nextStatus,
      });

      await db.outbox.put(updated);

      return updated;
    },
  );
}


export async function markOutboxUploading(
  operationId: string,
): Promise<LocalOutboxRecord> {
  return transitionOutboxStatus(operationId, 'uploading');
}


export async function markOutboxSynced(
  operationId: string,
): Promise<LocalOutboxRecord> {
  return transitionOutboxStatus(operationId, 'synced');
}


export async function markOutboxRetryableError(
  operationId: string,
): Promise<LocalOutboxRecord> {
  return transitionOutboxStatus(
    operationId,
    'retryable-error',
  );
}


export async function markOutboxAuthRequired(
  operationId: string,
): Promise<LocalOutboxRecord> {
  return transitionOutboxStatus(
    operationId,
    'auth-required',
  );
}

export async function markOutboxConflict(
  operationId: string,
): Promise<LocalOutboxRecord> {
  return transitionOutboxStatus(operationId, 'conflict');
}