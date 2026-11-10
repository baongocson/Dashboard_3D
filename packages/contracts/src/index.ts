import { z } from 'zod';

export const CONTRACT_VERSION = 1;
export const MAX_CSV_BYTES = 20_000_000;
export const idSchema = z.string().min(1);
export const cellSchema = z.union([
  z.string(),
  z
    .number()

    .refine((value) => !Number.isInteger(value) || Number.isSafeInteger(value), {
      message: 'Unsafe integers must remain text',
    }),
  z.boolean(),
  z.null(),
]);
export type Cell = z.infer<typeof cellSchema>;
export const columnSchema = z.strictObject({
  id: idSchema,
  name: z.string().trim().min(1),
  type: z.enum(['text', 'number', 'boolean', 'date', 'datetime']),
});
export const rowSchema = z.strictObject({
  id: idSchema,
  cells: z.record(idSchema, cellSchema),
});
export const datasetSchema = z
  .strictObject({
    versionId: idSchema,
    columns: z.array(columnSchema).min(1),
    rows: z.array(rowSchema),
  })
  .superRefine((dataset, context) => {
    const ids = dataset.columns.map((column) => column.id);
    if (new Set(ids).size !== ids.length)
      context.addIssue({ code: 'custom', message: 'Duplicate column ID' });
    if (new Set(dataset.columns.map((column) => column.name)).size !== ids.length)
      context.addIssue({ code: 'custom', message: 'Duplicate column name' });
    if (new Set(dataset.rows.map((row) => row.id)).size !== dataset.rows.length)
      context.addIssue({ code: 'custom', message: 'Duplicate row ID' });
    for (const row of dataset.rows) {
      if (
        Object.keys(row.cells).length !== ids.length ||
        ids.some((id) => !Object.hasOwn(row.cells, id))
      ) {
        context.addIssue({ code: 'custom', message: `Row ${row.id}: cells must match column IDs` });
      }
      for (const column of dataset.columns) {
        const cell = row.cells[column.id];
        if (cell === null || cell === undefined) continue;
        const expected =
          column.type === 'number' ? 'number' : column.type === 'boolean' ? 'boolean' : 'string';
        if (typeof cell !== expected)
          context.addIssue({
            code: 'custom',
            message: `Row ${row.id}: incompatible cell for ${column.id}`,
          });
        if (
          column.type === 'date' &&
          typeof cell === 'string' &&
          !z.iso.date().safeParse(cell).success
        )
          context.addIssue({ code: 'custom', message: 'Invalid ISO date' });
        if (
          column.type === 'datetime' &&
          typeof cell === 'string' &&
          !z.iso.datetime().safeParse(cell).success
        )
          context.addIssue({ code: 'custom', message: 'Datetime must be ISO UTC' });
      }
    }
  });
export type Dataset = z.infer<typeof datasetSchema>;

export const csvOptionsSchema = z.strictObject({
  encoding: z.literal('utf-8'),
  delimiter: z.enum(['auto', ',', ';', '\t']),
  header: z.enum(['first-row', 'generated']),
  additionalMissingTokens: z.array(z.string()),
  confirmedHeaders: z.array(z.string().trim().min(1)).nullable(),
});
export const csvFileSchema = z.strictObject({
  name: z.string().min(1),
  bytes: z.number().int().min(1).max(MAX_CSV_BYTES),
});

export const selectionSchema = z.strictObject({
  versionId: idSchema,
  rowId: idSchema,
  columnId: idSchema,
});
export const fillCellConfigSchema = z.strictObject({
  method: z.literal('fill-cell'),
  selection: selectionSchema,
  value: cellSchema,
});
export type FillCellConfig = z.infer<typeof fillCellConfigSchema>;
export const changeCountsSchema = z.strictObject({
  rows: z.number().int().nonnegative(),
  columns: z.number().int().nonnegative(),
  cells: z.number().int().nonnegative(),
});
export const issueSchema = z.strictObject({
  code: z.string(),
  message: z.string(),
  rowId: idSchema.nullable(),
  columnId: idSchema.nullable(),
});
export const previewSchema = z
  .strictObject({
    id: idSchema,
    jobId: idSchema,
    baseVersionId: idSchema,
    configFingerprint: z.string().min(1),
    configuration: fillCellConfigSchema,
    changes: changeCountsSchema,
    examples: z.array(
      z.strictObject({
        rowId: idSchema,
        columnId: idSchema,
        before: cellSchema,
        after: cellSchema,
      }),
    ),
    errors: z.array(issueSchema),
    warnings: z.array(issueSchema),
  })
  .refine((preview) => preview.baseVersionId === preview.configuration.selection.versionId, {
    message: 'Preview selection must use its base version',
  });

export const chunkReferenceSchema = z.strictObject({
  id: idSchema,
  ordinal: z.number().int().nonnegative(),
  bytes: z.number().int().positive(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});
export const manifestSchema = z
  .strictObject({
    id: idSchema,
    chunks: z.array(chunkReferenceSchema).min(1),
    totalBytes: z.number().int().positive(),
  })
  .superRefine((manifest, context) => {
    if (manifest.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) !== manifest.totalBytes)
      context.addIssue({ code: 'custom', message: 'Manifest size mismatch' });
    if (
      new Set(manifest.chunks.map((chunk) => chunk.id)).size !== manifest.chunks.length ||
      manifest.chunks.some((chunk, index) => chunk.ordinal !== index)
    )
      context.addIssue({
        code: 'custom',
        message: 'Chunks must be unique and in contiguous order',
      });
  });
export const versionSchema = z.strictObject({
  id: idSchema,
  projectId: idSchema,
  datasetId: idSchema,
  parentVersionId: idSchema.nullable(),
  manifestId: idSchema,
  source: z.enum(['import', 'apply', 'sync-conflict']),
});
export const historySchema = z.strictObject({
  operationId: idSchema,
  kind: z.enum(['apply', 'undo']),
  fromVersionId: idSchema,
  toVersionId: idSchema,
  method: z.string().min(1),
  columnIds: z.array(idSchema),
  rowIds: z.array(idSchema),
  parameters: z.record(z.string(), cellSchema),
  changes: changeCountsSchema,
});
export const outboxSchema = z.strictObject({
  operationId: idSchema,
  projectId: idSchema,
  kind: z.enum(['import', 'apply', 'undo', 'save-session']),
  baseRevision: z.number().int().nonnegative().nullable(),
  dependsOn: z.array(idSchema),
  status: z.enum(['pending', 'uploading', 'conflict','synced', 'auth-required', 'retryable-error']),
});
export const applyPublicationSchema = z
  .strictObject({
    version: versionSchema,
    manifest: manifestSchema,
    history: historySchema,
    outbox: outboxSchema,
    currentVersionId: idSchema,
  })
  .superRefine((publication, context) => {
    const { version, manifest, history, outbox, currentVersionId } = publication;
    if (
      version.id !== currentVersionId ||
      history.toVersionId !== version.id ||
      version.manifestId !== manifest.id ||
      history.operationId !== outbox.operationId ||
      version.projectId !== outbox.projectId ||
      history.kind !== 'apply' ||
      outbox.kind !== 'apply' ||
      version.source !== 'apply' ||
      version.parentVersionId !== history.fromVersionId
    )
      context.addIssue({
        code: 'custom',
        message: 'Apply publication references are inconsistent',
      });
  });

export const sectionSchema = z.enum([
  'collection',
  'cleaning',
  'missing',
  'outliers',
  'scaling',
  'transformation',
  'encoding',
]);
export const chartSchema = z
  .strictObject({
    id: idSchema,
    section: sectionSchema,
    versionId: idSchema,
    configuration: z.record(z.string(), cellSchema),
    resultManifestId: idSchema,
    displayedRows: z.number().int().nonnegative(),
    totalRows: z.number().int().nonnegative(),
  })
  .refine((chart) => chart.displayedRows <= chart.totalRows, {
    message: 'Displayed rows exceed total rows',
  });
const vectorSchema = z.tuple([z.number(), z.number(), z.number()]);
export const sessionSchema = z.strictObject({
  id: idSchema,
  projectId: idSchema,
  datasetId: idSchema,
  currentVersionId: idSchema,
  section: sectionSchema,
  confirmedConfiguration: z.record(z.string(), cellSchema),
  charts: z.array(chartSchema),
  views: z.array(
    z.strictObject({
      chartId: idSchema,
      position: vectorSchema,
      target: vectorSchema,
      zoom: z.number().positive(),
    }),
  ),
  table: z.strictObject({
    filters: z.array(
      z.strictObject({
        columnId: idSchema,
        operator: z.enum(['equals', 'contains', 'missing']),
        value: cellSchema,
      }),
    ),
    sorts: z.array(z.strictObject({ columnId: idSchema, direction: z.enum(['asc', 'desc']) })),
    selection: selectionSchema.nullable(),
  }),
});
export const projectSchema = z.strictObject({
  id: idSchema,
  ownerId: idSchema,
  name: z.string().trim().min(1),
  datasetId: idSchema,
  sessionId: idSchema,
});

// Foundation messages only. Dataset jobs are added with their implementation.
export const workerRequestSchema = z.strictObject({ type: z.literal('ping'), jobId: idSchema });
export const workerResponseSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('ready'),
    jobId: idSchema,
    contractVersion: z.literal(CONTRACT_VERSION),
  }),
  z.strictObject({ type: z.literal('error'), jobId: idSchema.nullable(), message: z.string() }),
]);

// ---------------------------------------------------------------------------
// Accounts (task 16 draft, owner: Phúc). Rules follow task-01-decisions §Tài khoản;
// see docs/architecture/auth-contract.md for the endpoint list and error matrix.
// ---------------------------------------------------------------------------
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
/** Password length is counted in Unicode code points, not UTF-16 units. */
export const PASSWORD_MIN_CODE_POINTS = 15;
export const PASSWORD_MAX_CODE_POINTS = 128;
export const DISPLAY_NAME_MAX_LENGTH = 50;
export const CSRF_HEADER = 'x-csrf-token';
/** Background requests (e.g. sync) send `x-session-activity: background` so they do not extend idle time. */
export const SESSION_ACTIVITY_HEADER = 'x-session-activity';

const usernamePattern = /^[A-Za-z0-9_.-]+$/;
export function countCodePoints(value: string): number {
  return Array.from(value).length;
}
/** Canonical form used for uniqueness: trimmed, ASCII case-folded. */
export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}
export const usernameSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(usernamePattern, 'Username may only contain A-Z, a-z, 0-9, "_", "-" and "."');
// Never trimmed, case-folded or normalized.
export const passwordSchema = z
  .string()
  .refine((value) => countCodePoints(value) >= PASSWORD_MIN_CODE_POINTS, {
    message: `Password must have at least ${String(PASSWORD_MIN_CODE_POINTS)} characters`,
  })
  .refine((value) => countCodePoints(value) <= PASSWORD_MAX_CODE_POINTS, {
    message: `Password must have at most ${String(PASSWORD_MAX_CODE_POINTS)} characters`,
  });
export const displayNameSchema = z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH);

export const registerRequestSchema = z.strictObject({
  username: usernameSchema,
  password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
// Login does not re-apply registration rules (a wrong format is just wrong credentials),
// but bounds input size so hashing cannot be abused.
export const loginRequestSchema = z.strictObject({
  username: z.string().max(200),
  password: z.string().max(4 * PASSWORD_MAX_CODE_POINTS),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export const updateProfileRequestSchema = z.strictObject({ displayName: displayNameSchema });
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;

export const publicUserSchema = z.strictObject({
  id: idSchema,
  username: z.string(),
  displayName: z.string(),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
export const registerResponseSchema = z.strictObject({ user: publicUserSchema });
export const authSessionResponseSchema = z.strictObject({
  user: publicUserSchema,
  csrfToken: z.string().min(1),
  idleExpiresAt: z.iso.datetime(),
  absoluteExpiresAt: z.iso.datetime(),
});
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
export const userResponseSchema = z.strictObject({ user: publicUserSchema });

export const apiErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'AUTH_REQUIRED',
  'SESSION_EXPIRED',
  'ORIGIN_REJECTED',
  'CSRF_INVALID',
  'NOT_FOUND',
  'USERNAME_TAKEN',
  'TOO_MANY_ATTEMPTS',
  'DATABASE_UNAVAILABLE',
  'INTERNAL_ERROR',
]);
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export const apiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: apiErrorCodeSchema,
    message: z.string(),
    issues: z.array(z.strictObject({ path: z.string(), message: z.string() })).optional(),
    retryAfterSeconds: z.number().int().positive().optional(),
  }),
});
export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
