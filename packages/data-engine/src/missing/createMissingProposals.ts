import type { Cell, Dataset } from '@dashboard/contracts';

export type MissingFillStrategy = 'constant' | 'mean';

export interface MissingFillProposal {
  baseVersionId: string;
  columnId: string;
  columnName: string;
  strategy: MissingFillStrategy;
  proposedValue: Cell;
  affectedRowIds: string[];
}

export interface MissingFillRequest {
  columnId: string;
  strategy: MissingFillStrategy;
  value?: Cell;
}

export function createMissingProposals(
  dataset: Dataset,
  requests: readonly MissingFillRequest[],
): MissingFillProposal[] {
  const proposals: MissingFillProposal[] = [];
  const processedColumns = new Set<string>();

  for (const request of requests) {
    if (processedColumns.has(request.columnId)) {
      throw new Error(`Duplicate fill request for column: ${request.columnId}`);
    }

    processedColumns.add(request.columnId);

    const column = dataset.columns.find((item) => item.id === request.columnId);

    if (column === undefined) {
      throw new Error(`Column not found: ${request.columnId}`);
    }

    const affectedRowIds = dataset.rows
      .filter((row) => row.cells[column.id] === null)
      .map((row) => row.id);

    if (affectedRowIds.length === 0) {
      continue;
    }

    let proposedValue: Cell;

    if (request.strategy === 'mean') {
      if (column.type !== 'number') {
        throw new Error(`Mean strategy requires a numeric column: ${column.id}`);
      }

      let mean = 0;
      let count = 0;

      for (const row of dataset.rows) {
        const value = row.cells[column.id];

        if (typeof value === 'number') {
          count += 1;
          mean = mean * ((count - 1) / count) + value / count;
        }
      }

      if (count === 0) {
        throw new Error(`Cannot calculate mean for column: ${column.id}`);
      }

      proposedValue = mean;
    } else {
      if (request.value === undefined || request.value === null) {
        throw new Error(`Constant fill requires a non-null value: ${column.id}`);
      }

      const value = request.value;

      const validType =
        (column.type === 'number' && typeof value === 'number') ||
        (column.type === 'boolean' && typeof value === 'boolean') ||
        (column.type !== 'number' && column.type !== 'boolean' && typeof value === 'string');

      if (!validType) {
        throw new Error(`Invalid fill value for column: ${column.id}`);
      }

      proposedValue = value;
    }

    proposals.push({
      baseVersionId: dataset.versionId,
      columnId: column.id,
      columnName: column.name,
      strategy: request.strategy,
      proposedValue,
      affectedRowIds,
    });
  }

  return proposals;
}
