import { datasetSchema, type Dataset } from '@dashboard/contracts';

import type { MissingFillProposal } from './createMissingProposals.js';

export function applyMissingProposals(
  dataset: Dataset,
  proposals: readonly MissingFillProposal[],
  newVersionId: string,
): Dataset {
  if (newVersionId.trim().length === 0) {
    throw new Error('New version ID must not be empty');
  }

  if (newVersionId === dataset.versionId) {
    throw new Error('New version ID must differ from current version');
  }

  const columnIds = new Set(dataset.columns.map((column) => column.id));

  const rowIds = new Set(dataset.rows.map((row) => row.id));

  const seenColumns = new Set<string>();

  for (const proposal of proposals) {
    if (proposal.baseVersionId !== dataset.versionId)
      throw new Error('Stale proposal: preview again');
    if (!columnIds.has(proposal.columnId)) {
      throw new Error(`Column not found: ${proposal.columnId}`);
    }

    if (seenColumns.has(proposal.columnId)) {
      throw new Error(`Duplicate proposal for column: ${proposal.columnId}`);
    }

    seenColumns.add(proposal.columnId);

    for (const rowId of proposal.affectedRowIds) {
      if (!rowIds.has(rowId)) {
        throw new Error(`Row not found: ${rowId}`);
      }
    }
  }

  const nextRows = dataset.rows.map((row) => ({
    id: row.id,
    cells: { ...row.cells },
  }));

  const nextRowById = new Map(nextRows.map((row) => [row.id, row]));

  for (const proposal of proposals) {
    for (const rowId of proposal.affectedRowIds) {
      const row = nextRowById.get(rowId);

      if (row === undefined) {
        throw new Error(`Row not found: ${rowId}`);
      }

      if (row.cells[proposal.columnId] !== null) {
        throw new Error(`Cell is not missing: ${rowId}/${proposal.columnId}`);
      }

      row.cells[proposal.columnId] = proposal.proposedValue;
    }
  }

  const nextDataset: Dataset = {
    versionId: newVersionId,
    columns: dataset.columns.map((column) => ({ ...column })),
    rows: nextRows,
  };

  return datasetSchema.parse(nextDataset);
}
