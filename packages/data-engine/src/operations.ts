import { z } from 'zod';
import { cellSchema, datasetSchema, type Cell, type Dataset } from '@dashboard/contracts';
import { isNumericValue } from './csv/inferColumnTypes.js';

const missingPlanSchema = z.object({
  columnId: z.string(),
  method: z.enum(['fill', 'mean', 'median', 'mode', 'forward', 'backward', 'interpolate']),
  value: cellSchema.default(null),
});
const replacementSchema = z.object({ from: cellSchema, to: cellSchema });
const cleaningPlanSchema = z.object({
  columnId: z.string(),
  trim: z.boolean().default(false),
  stripHtml: z.boolean().default(false),
  convert: z.enum(['keep', 'number', 'text', 'boolean', 'date', 'datetime']).default('keep'),
  replacements: z.array(replacementSchema).default([]),
});
export const operationSchema = z.object({
  method: z.enum([
    'replace',
    'cleaning-batch',
    'edit-row',
    'fill',
    'mean',
    'median',
    'mode',
    'forward',
    'backward',
    'interpolate',
    'drop-missing',
    'drop-row',
    'drop-column',
    'deduplicate',
    'trim',
    'strip-html',
    'missing-token',
    'number',
    'text',
    'boolean',
    'date',
    'rename',
    'iqr-clip',
    'iqr-drop',
    'zscore-clip',
    'zscore-drop',
    'minmax',
    'standard',
    'robust',
    'log1p',
    'sqrt',
    'yeojohnson',
    'onehot',
    'ordinal',
    'missing-batch',
    'datetime',
  ]),
  columnIds: z.array(z.string().min(1)),
  values: z.record(z.string(), cellSchema).default({}),
  replacements: z.array(replacementSchema).default([]),
  cleaningPlans: z.array(cleaningPlanSchema).default([]),
  orders: z.record(z.string(), z.array(z.string())).default({}),
  rowId: z.string().nullable().default(null),
  value: cellSchema.default(null),
  parameter: z.number().default(1.5),
  upper: z.number().default(1),
  sortColumnId: z.string().nullable().default(null),
  descending: z.boolean().default(false),
  categories: z.array(z.string()).default([]),
  keepOriginal: z.boolean().default(false),
  missingCategory: z.boolean().default(false),
  plans: z.array(missingPlanSchema).default([]),
});
export type Operation = z.infer<typeof operationSchema>;
export type OperationPreview = {
  baseVersionId: string;
  fingerprint: string;
  configuration: Operation;
  dataset: Dataset;
  changes: { cells: number; rows: number; columns: number };
  examples: { rowId: string; columnId: string; before: Cell; after: Cell }[];
  warnings: string[];
  parameters: Record<string, number>;
  analysisBefore?: ReturnType<typeof analyzeDataset> | undefined;
  analysisAfter?: ReturnType<typeof analyzeDataset> | undefined;
};
export const operationPreviewSchema = z.object({
  baseVersionId: z.string().min(1),
  fingerprint: z.string(),
  configuration: operationSchema,
  dataset: datasetSchema,
  changes: z.object({
    cells: z.number().int().nonnegative(),
    rows: z.number().int().nonnegative(),
    columns: z.number().int().nonnegative(),
  }),
  examples: z.array(
    z.object({ rowId: z.string(), columnId: z.string(), before: cellSchema, after: cellSchema }),
  ),
  warnings: z.array(z.string()),
  parameters: z.record(z.string(), z.number()),
  analysisBefore: z.lazy(() => analysisSchema).optional(),
  analysisAfter: z.lazy(() => analysisSchema).optional(),
});
const summarySchema = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  median: z.number(),
  q1: z.number(),
  q3: z.number(),
  deviation: z.number(),
});
export const analysisSchema = z.object({
  missingCells: z.number(),
  rowsWithMissing: z.number(),
  duplicateExcessRows: z.number(),
  outlierCells: z.number(),
  outlierRows: z.number(),
  methodNote: z.string(),
  columns: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.enum(['text', 'number', 'boolean', 'date', 'datetime']),
      statistics: summarySchema.nullable(),
      missingCount: z.number(),
      histogram: z.array(z.object({ lower: z.number(), upper: z.number(), count: z.number() })),
      categories: z.array(z.object({ value: z.string(), count: z.number() })),
      issues: z.array(z.object({ kind: z.string(), count: z.number() })).default([]),
    }),
  ),
  correlation: z.array(
    z.object({
      a: z.string(),
      b: z.string(),
      coefficient: z.number().min(-1).max(1).nullable(),
      reason: z.string().nullable(),
    }),
  ),
});

export function quantile(sorted: readonly number[], p: number): number {
  if (!sorted.length) throw new Error('Không đủ giá trị hợp lệ.');
  const index = (sorted.length - 1) * p;
  const a = sorted[Math.floor(index)];
  const b = sorted[Math.ceil(index)];
  if (a === undefined || b === undefined) throw new Error('Không đủ dữ liệu.');
  return a * (1 - (index % 1)) + b * (index % 1);
}
export function numericSummary(values: readonly number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const scale = values.reduce((m, n) => Math.max(m, Math.abs(n)), 0) || 1;
  const meanScaled = values.reduce((sum, n) => sum + n / scale / values.length, 0);
  const deviation =
    Math.sqrt(values.reduce((sum, n) => sum + (n / scale - meanScaled) ** 2 / values.length, 0)) *
    scale;
  const min = sorted[0] ?? 0,
    max = sorted[sorted.length - 1] ?? 0;
  return {
    min,
    max,
    mean: min === max ? min : meanScaled * scale,
    median: quantile(sorted, 0.5),
    q1: quantile(sorted, 0.25),
    q3: quantile(sorted, 0.75),
    deviation: min === max ? 0 : deviation,
  };
}
function numeric(values: readonly Cell[]): number[] {
  return values.filter((v): v is number => typeof v === 'number');
}
function yj(x: number, lambda: number): number {
  return x >= 0
    ? Math.abs(lambda) < 1e-8
      ? Math.log1p(x)
      : Math.expm1(lambda * Math.log1p(x)) / lambda
    : Math.abs(lambda - 2) < 1e-8
      ? -Math.log1p(-x)
      : -Math.expm1((2 - lambda) * Math.log1p(-x)) / (2 - lambda);
}
function fitLambda(values: number[]): number {
  if (values.length < 2 || values.every((v) => v === values[0]))
    throw new Error('Không thể ước lượng Yeo–Johnson cho cột hằng.');
  const jacobian = values.reduce((sum, x) => sum + Math.sign(x) * Math.log1p(Math.abs(x)), 0);
  const likelihood = (lambda: number) => {
    const transformed = values.map((x) => yj(x, lambda));
    if (transformed.some((v) => !Number.isFinite(v))) return -Infinity;
    const scale = transformed.reduce((maximum, v) => Math.max(maximum, Math.abs(v)), 0) || 1;
    const mean = transformed.reduce((sum, v) => sum + v / scale / transformed.length, 0);
    const variance = transformed.reduce(
      (sum, v) => sum + (v / scale - mean) ** 2 / transformed.length,
      0,
    );
    if (variance <= 0) return -Infinity;
    return -values.length * (Math.log(scale) + 0.5 * Math.log(variance)) + (lambda - 1) * jacobian;
  };
  let best = 1,
    score = -Infinity;
  for (let step = -100; step <= 100; step++) {
    const lambda = step / 20,
      next = likelihood(lambda);
    if (next > score) {
      score = next;
      best = lambda;
    }
  }
  if (!Number.isFinite(score)) throw new Error('Không thể ước lượng Yeo–Johnson cho cột hằng.');
  if (Math.abs(best) >= 5)
    throw new Error('MLE lambda ngoài khoảng tìm kiếm [-5,5]. Chọn phương pháp khác.');
  let left = best - 0.1,
    right = best + 0.1;
  const ratio = (Math.sqrt(5) - 1) / 2;
  for (let iteration = 0; iteration < 80 && right - left > 1e-6; iteration++) {
    const a = right - ratio * (right - left),
      b = left + ratio * (right - left);
    if (likelihood(a) > likelihood(b)) right = b;
    else left = a;
  }
  return (left + right) / 2;
}

function describeChange(
  source: Dataset,
  result: Dataset,
  configuration: Operation,
): OperationPreview {
  const examples: OperationPreview['examples'] = [];
  let cells = 0;
  const originalRows = new Map(source.rows.map((row) => [row.id, row]));
  for (const row of result.rows) {
    const original = originalRows.get(row.id);
    for (const column of result.columns) {
      const before = original?.cells[column.id] ?? null,
        after = row.cells[column.id] ?? null;
      if (!Object.is(before, after)) {
        cells++;
        if (examples.length < 20)
          examples.push({ rowId: row.id, columnId: column.id, before, after });
      }
    }
  }
  const changedColumns = result.columns.filter(
    (c) => source.columns.find((old) => old.id === c.id)?.type !== c.type,
  ).length;
  return {
    baseVersionId: source.versionId,
    fingerprint: JSON.stringify(configuration),
    configuration,
    dataset: result,
    changes: { cells, rows: 0, columns: changedColumns },
    examples: examples.slice(0, 20),
    warnings: [],
    parameters: {},
  };
}

export function previewOperation(
  input: Dataset,
  rawConfig: unknown,
  versionId: string,
): OperationPreview {
  const source = datasetSchema.parse(input);
  const config = operationSchema.parse(rawConfig);
  if (versionId === source.versionId || !versionId) throw new Error('Cần phiên bản kết quả mới.');
  if (config.method === 'replace') {
    if (config.rowId && !source.rows.some((row) => row.id === config.rowId))
      throw new Error('Không tìm thấy dòng.');
    if (!config.replacements.length) throw new Error('Thêm ít nhất một cặp giá trị thay thế.');
    if (
      !config.columnIds.length ||
      new Set(config.columnIds).size !== config.columnIds.length ||
      config.columnIds.some((id) => !source.columns.some((c) => c.id === id))
    )
      throw new Error('Chọn cột hợp lệ.');
    if (
      new Set(config.replacements.map((r) => JSON.stringify(r.from))).size !==
      config.replacements.length
    )
      throw new Error('Giá trị cần thay không được trùng.');
    const result = datasetSchema.parse({
      ...source,
      versionId,
      rows: source.rows.map((row) => ({
        ...row,
        cells: Object.fromEntries(
          source.columns.map((c) => {
            const before = row.cells[c.id] ?? null;
            const pair =
              config.columnIds.includes(c.id) && (!config.rowId || config.rowId === row.id)
                ? config.replacements.find((r) => Object.is(r.from, before))
                : undefined;
            return [c.id, pair ? pair.to : before];
          }),
        ),
      })),
    });
    return describeChange(source, result, config);
  }
  if (config.method === 'cleaning-batch') {
    if (
      !config.cleaningPlans.length ||
      new Set(config.cleaningPlans.map((p) => p.columnId)).size !== config.cleaningPlans.length
    )
      throw new Error('Cấu hình ít nhất một cột.');
    let combined = source;
    for (const plan of config.cleaningPlans) {
      const steps: Operation['method'][] = [
        ...(plan.stripHtml ? ['strip-html' as const] : []),
        ...(plan.trim ? ['trim' as const] : []),
        ...(plan.replacements.length ? ['replace' as const] : []),
        ...(plan.convert === 'keep' ? [] : [plan.convert]),
      ];
      if (!steps.length) throw new Error('Chọn phương pháp làm sạch cho cột.');
      for (const method of steps)
        combined = previewOperation(
          { ...combined, versionId: source.versionId },
          {
            ...config,
            method,
            columnIds: [plan.columnId],
            rowId: null,
            cleaningPlans: [],
            replacements: plan.replacements,
          },
          versionId,
        ).dataset;
    }
    return describeChange(source, combined, config);
  }
  if (config.method === 'edit-row') {
    const row = source.rows.find((r) => r.id === config.rowId);
    if (!row) throw new Error('Dòng không còn tồn tại trong phiên bản đang xử lý.');
    const keys = Object.keys(config.values);
    if (!keys.length || keys.some((id) => !source.columns.some((c) => c.id === id)))
      throw new Error('Cột sửa không hợp lệ.');
    const edited = datasetSchema.parse({
      ...source,
      versionId,
      rows: source.rows.map((r) =>
        r.id === row.id ? { ...r, cells: { ...r.cells, ...config.values } } : r,
      ),
    });
    const examples = keys.flatMap((id) =>
      Object.is(row.cells[id], config.values[id])
        ? []
        : [
            {
              rowId: row.id,
              columnId: id,
              before: row.cells[id] ?? null,
              after: config.values[id] ?? null,
            },
          ],
    );
    if (!examples.length) throw new Error('Không có giá trị thay đổi.');
    return {
      baseVersionId: source.versionId,
      fingerprint: JSON.stringify(config),
      configuration: config,
      dataset: edited,
      changes: { cells: examples.length, rows: 0, columns: 0 },
      examples: examples.slice(0, 20),
      warnings: [],
      parameters: {},
    };
  }
  if (config.method === 'missing-batch') {
    if (
      !config.plans.length ||
      new Set(config.plans.map((p) => p.columnId)).size !== config.plans.length
    )
      throw new Error('Chọn ít nhất một cột, mỗi cột một phương pháp.');
    let combined = source;
    const examples: OperationPreview['examples'] = [];
    const warnings: string[] = [];
    let cells = 0;
    for (const plan of config.plans) {
      const next = previewOperation(
        { ...combined, versionId: source.versionId },
        {
          ...config,
          method: plan.method,
          value: plan.value,
          columnIds: [plan.columnId],
          rowId: null,
          plans: [],
        },
        versionId,
      );
      combined = next.dataset;
      cells += next.changes.cells;
      examples.push(...next.examples);
      warnings.push(...next.warnings);
    }
    return {
      baseVersionId: source.versionId,
      fingerprint: JSON.stringify(config),
      configuration: config,
      dataset: combined,
      changes: { cells, rows: 0, columns: 0 },
      examples: examples.slice(0, 20),
      warnings,
      parameters: {},
    };
  }
  const result = structuredClone(source);
  result.versionId = versionId;
  const warnings: string[] = [];
  const parameters: Record<string, number> = {};
  const selected = new Set(config.columnIds);
  if (
    selected.size !== config.columnIds.length ||
    config.columnIds.some((id) => !source.columns.some((c) => c.id === id))
  )
    throw new Error('Cột không hợp lệ.');
  if (!selected.size && config.method !== 'deduplicate' && config.method !== 'drop-row')
    throw new Error('Hãy chọn cột.');
  if (config.rowId && !source.rows.some((r) => r.id === config.rowId))
    throw new Error('Không tìm thấy dòng.');
  const ordered = [...result.rows];
  if (config.sortColumnId) {
    const key = config.sortColumnId;
    if (!source.columns.some((c) => c.id === key)) throw new Error('Cột thứ tự không tồn tại.');
    ordered.sort((a, b) => {
      const x = a.cells[key] ?? null,
        y = b.cells[key] ?? null;
      if (x === null) return y === null ? 0 : 1;
      if (y === null) return -1;
      const cmp =
        typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return config.descending ? -cmp : cmp;
    });
  } else if (config.descending) ordered.reverse();
  const axisColumn = source.columns.find((c) => c.id === config.sortColumnId);
  const axisValue = (row: Dataset['rows'][number], index: number): number => {
    if (!config.sortColumnId) return index;
    const value = row.cells[config.sortColumnId];
    if (axisColumn?.type === 'number' && typeof value === 'number') return value;
    if (
      (axisColumn?.type === 'date' || axisColumn?.type === 'datetime') &&
      typeof value === 'string'
    )
      return Date.parse(value);
    return NaN;
  };
  if (config.method === 'interpolate' && config.sortColumnId) {
    const axes = source.rows.map(axisValue);
    if (axes.some((v) => !Number.isFinite(v)) || new Set(axes).size !== axes.length)
      throw new Error(
        'Trục nội suy phải là số/ngày hợp lệ, không thiếu/trùng; hoặc chọn thứ tự dòng.',
      );
  }
  const target = (rowId: string) => !config.rowId || rowId === config.rowId;
  const deleted = new Set<string>();
  if (config.method === 'deduplicate') {
    const seen = new Set<string>();
    result.rows = result.rows.filter((r) => {
      const key = JSON.stringify(source.columns.map((c) => r.cells[c.id]));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else if (config.method === 'drop-row') {
    if (!config.rowId) throw new Error('Hãy chọn dòng cần xóa.');
    result.rows = result.rows.filter((r) => r.id !== config.rowId);
  } else if (config.method === 'drop-column') {
    result.columns = result.columns.filter((c) => !selected.has(c.id));
    for (const row of result.rows)
      row.cells = Object.fromEntries(Object.entries(row.cells).filter(([id]) => !selected.has(id)));
  } else
    for (const column of source.columns.filter((c) => selected.has(c.id))) {
      const id = column.id;
      const values = source.rows.map((r) => r.cells[id] ?? null);
      const numbers = numeric(values);
      const stats = numericSummary(numbers);
      const numericMethods = [
        'mean',
        'median',
        'interpolate',
        'iqr-clip',
        'iqr-drop',
        'zscore-clip',
        'zscore-drop',
        'minmax',
        'standard',
        'robust',
        'log1p',
        'sqrt',
        'yeojohnson',
      ];
      if (numericMethods.includes(config.method) && (column.type !== 'number' || !stats))
        throw new Error(`${column.name}: cần cột số có giá trị hợp lệ.`);
      let replacement: Cell = config.value;
      if (config.method === 'mean') replacement = stats?.mean ?? null;
      if (config.method === 'median') replacement = stats?.median ?? null;
      if (config.method === 'mode') {
        const counts = new Map<Cell, number>();
        for (const v of values) if (v !== null) counts.set(v, (counts.get(v) ?? 0) + 1);
        let maximum = 0;
        replacement = null;
        let ties = 0;
        for (const [v, count] of counts) {
          if (count > maximum) {
            maximum = count;
            replacement = v;
            ties = 1;
          } else if (count === maximum) ties++;
        }
        if (!maximum) throw new Error(`${column.name}: thiếu toàn bộ, không có mode.`);
        if (ties > 1)
          warnings.push(`${column.name}: mode đồng hạng, dùng giá trị xuất hiện đầu tiên.`);
      }
      const outputColumn = result.columns.find((c) => c.id === id);
      if (!outputColumn) throw new Error('Cột không tồn tại.');
      if (['number', 'text', 'boolean', 'date', 'datetime'].includes(config.method))
        outputColumn.type = config.method as 'number' | 'text' | 'boolean' | 'date' | 'datetime';
      if (config.method === 'rename') {
        outputColumn.name = String(config.value ?? '').trim();
        continue;
      }
      let lower = 0,
        upper = 0;
      if (stats && (config.method.startsWith('iqr') || config.method.startsWith('zscore'))) {
        if (config.parameter <= 0) throw new Error('Ngưỡng phải lớn hơn 0.');
        const spread = config.method.startsWith('iqr') ? stats.q3 - stats.q1 : stats.deviation;
        if (!spread || !Number.isFinite(spread))
          throw new Error(`${column.name}: độ phân tán bằng 0 hoặc không tính được.`);
        lower =
          (config.method.startsWith('iqr') ? stats.q1 : stats.mean) - config.parameter * spread;
        upper =
          (config.method.startsWith('iqr') ? stats.q3 : stats.mean) + config.parameter * spread;
        parameters[`${id}:lower`] = lower;
        parameters[`${id}:upper`] = upper;
      }
      const lambda = config.method === 'yeojohnson' ? fitLambda(numbers) : 1;
      if (config.method === 'yeojohnson') parameters[`${id}:lambda`] = lambda;
      if (config.method === 'onehot' || config.method === 'ordinal') {
        if (column.type !== 'text' && column.type !== 'boolean')
          throw new Error(`${column.name}: encoding cần cột phân loại.`);
        if (values.includes(null) && !config.missingCategory)
          throw new Error(
            `${column.name}: hãy xử lý missing trước hoặc chủ động tạo nhóm missing.`,
          );
        const order = config.orders[id] ?? config.categories;
        const categories = [...new Set(values.filter((v) => v !== null).map(String))];
        if (config.method === 'onehot' && categories.length * source.rows.length > 2_000_000)
          throw new Error(
            `${column.name}: dự kiến ${String(categories.length)} cột, vượt ngân sách 2.000.000 ô mới; chọn cột có ít nhóm hơn.`,
          );
        if (
          config.method === 'ordinal' &&
          (order.length !== categories.length ||
            new Set(order).size !== order.length ||
            categories.some((v) => !order.includes(v)))
        )
          throw new Error('Thứ tự Ordinal phải chứa đủ mỗi nhóm đúng một lần.');
        for (const [index, category] of (config.method === 'ordinal'
          ? order
          : categories
        ).entries()) {
          parameters[`${id}:category:${category}`] = index;
          if (config.method === 'onehot') {
            const nextId = `${id}:onehot:${String(index)}:${versionId}`;
            const baseName = `${column.name}__${category}`;
            let name = baseName,
              suffix = 2;
            while (result.columns.some((c) => c.name === name))
              name = `${baseName}_${String(suffix++)}`;
            result.columns.push({ id: nextId, name, type: 'number' });
            for (const row of result.rows)
              row.cells[nextId] =
                row.cells[id] === null
                  ? config.missingCategory
                    ? 0
                    : null
                  : Number(String(row.cells[id]) === category);
          }
        }
        if (config.missingCategory && values.includes(null)) {
          if (config.method === 'onehot') {
            const nextId = `${id}:missing:${versionId}`;
            let name = `${column.name}__missing`,
              suffix = 2;
            while (result.columns.some((c) => c.name === name))
              name = `${column.name}__missing_${String(suffix++)}`;
            result.columns.push({ id: nextId, name, type: 'number' });
            for (const row of result.rows) row.cells[nextId] = Number(row.cells[id] === null);
          }
          parameters[`${id}:missing-category`] = categories.length;
        }
        if (config.method === 'ordinal') {
          const ordering = new Map(order.map((value, index) => [value, index]));
          const nextId = config.keepOriginal ? `${id}:ordinal:${versionId}` : id;
          if (config.keepOriginal)
            result.columns.push({ id: nextId, name: `${column.name}_ordinal`, type: 'number' });
          else outputColumn.type = 'number';
          for (const row of result.rows)
            row.cells[nextId] =
              row.cells[id] === null
                ? config.missingCategory
                  ? categories.length
                  : null
                : (ordering.get(String(row.cells[id])) ?? -1);
        } else if (!config.keepOriginal) {
          result.columns = result.columns.filter((c) => c.id !== id);
          for (const row of result.rows)
            row.cells = Object.fromEntries(Object.entries(row.cells).filter(([key]) => key !== id));
        }
        continue;
      }
      const fillMethods = ['fill', 'mean', 'median', 'mode'];
      let previous: Cell = null;
      const traversal = config.method === 'backward' ? [...ordered].reverse() : ordered;
      for (let index = 0; index < traversal.length; index++) {
        const row = traversal[index];
        if (!row) continue;
        const value = row.cells[id] ?? null;
        if (!target(row.id)) {
          if (value !== null) previous = value;
          continue;
        }
        let next: Cell = value;
        if (fillMethods.includes(config.method) && value === null) {
          if (replacement === null) throw new Error(`${column.name}: cần giá trị điền hợp lệ.`);
          next = replacement;
        } else if (
          (config.method === 'forward' || config.method === 'backward') &&
          value === null
        ) {
          next = previous;
          if (next === null)
            warnings.push(`${column.name}/${row.id}: không có giá trị để điền, giữ missing.`);
        } else if (config.method === 'interpolate' && value === null) {
          let left = index - 1,
            right = index + 1;
          while (left >= 0 && traversal[left]?.cells[id] === null) left--;
          while (right < traversal.length && traversal[right]?.cells[id] === null) right++;
          const a = traversal[left],
            b = traversal[right];
          const av = a?.cells[id],
            bv = b?.cells[id];
          if (a && b && typeof av === 'number' && typeof bv === 'number') {
            const x = axisValue(row, index);
            const ax = axisValue(a, left);
            const bx = axisValue(b, right);
            if (!Number.isFinite(x) || !Number.isFinite(ax) || !Number.isFinite(bx) || ax === bx)
              throw new Error('Nội suy cần trục số hợp lệ, không trùng.');
            const t = (x - ax) / (bx - ax);
            next = av * (1 - t) + bv * t;
          } else warnings.push(`${column.name}/${row.id}: thiếu ở đầu/cuối, giữ missing.`);
        } else if (config.method === 'drop-missing' && value === null) deleted.add(row.id);
        else if (value !== null) {
          switch (config.method) {
            case 'trim':
              if (typeof value === 'string') next = value.trim();
              break;
            case 'strip-html':
              if (typeof value === 'string') next = value.replace(/<[^>]*>/gu, '');
              break;
            case 'missing-token':
              if (String(value).trim() === String(config.value)) next = null;
              break;
            case 'number':
              if (!isNumericValue(String(value)))
                throw new Error(
                  `${column.name}/${row.id}: không chuyển được ${String(value)} sang số.`,
                );
              next = Number(value);
              break;
            case 'text':
              next = String(value);
              break;
            case 'boolean':
              if (value !== 'true' && value !== 'false' && typeof value !== 'boolean')
                throw new Error(`${column.name}/${row.id}: chỉ nhận true/false.`);
              next = value === true || value === 'true';
              break;
            case 'date':
              if (!z.iso.date().safeParse(value).success)
                throw new Error(
                  `${column.name}/${row.id}: yêu cầu ngày ISO YYYY-MM-DD, không suy đoán.`,
                );
              break;
            case 'datetime':
              if (
                typeof value !== 'string' ||
                !z.iso.datetime({ offset: true }).safeParse(value).success
              )
                throw new Error(
                  `${column.name}/${row.id}: datetime phải có timezone Z hoặc ±HH:MM.`,
                );
              next = new Date(value).toISOString();
              break;
            default:
              if (typeof value === 'number' && stats) {
                const outside = value < lower || value > upper;
                if (config.method.endsWith('-clip') && outside)
                  next = Math.min(upper, Math.max(lower, value));
                else if (config.method.endsWith('-drop') && outside) deleted.add(row.id);
                else if (config.method === 'minmax') {
                  if (config.parameter >= config.upper || stats.max === stats.min)
                    throw new Error(`${column.name}: khoảng Min–Max không hợp lệ hoặc cột hằng.`);
                  next =
                    config.parameter +
                    ((value - stats.min) / (stats.max - stats.min)) *
                      (config.upper - config.parameter);
                } else if (config.method === 'standard' || config.method === 'robust') {
                  const divisor =
                    config.method === 'standard' ? stats.deviation : stats.q3 - stats.q1;
                  if (!divisor) throw new Error(`${column.name}: không thể chia cho 0.`);
                  next =
                    (value - (config.method === 'standard' ? stats.mean : stats.median)) / divisor;
                } else if (config.method === 'log1p') {
                  if (value <= -1) throw new Error(`${column.name}/${row.id}: log1p cần x > -1.`);
                  next = Math.log1p(value);
                } else if (config.method === 'sqrt') {
                  if (value < 0)
                    throw new Error(`${column.name}/${row.id}: căn bậc hai cần x ≥ 0.`);
                  next = Math.sqrt(value);
                } else if (config.method === 'yeojohnson') next = yj(value, lambda);
              }
          }
        }
        row.cells[id] = next;
        if (value !== null) previous = value;
      }
    }
  result.rows = result.rows.filter((r) => !deleted.has(r.id));
  const checked = datasetSchema.parse(result);
  const beforeRows = new Map(source.rows.map((r) => [r.id, r]));
  const beforeColumns = new Map(source.columns.map((c) => [c.id, c]));
  const afterColumns = new Map(checked.columns.map((c) => [c.id, c]));
  const changedColumns =
    source.columns.filter((c) => {
      const next = afterColumns.get(c.id);
      return !next || next.name !== c.name || next.type !== c.type;
    }).length + checked.columns.filter((c) => !beforeColumns.has(c.id)).length;
  let cells = 0;
  const examples: OperationPreview['examples'] = [];
  for (const row of checked.rows)
    for (const col of checked.columns) {
      const before = beforeRows.get(row.id)?.cells[col.id] ?? null,
        after = row.cells[col.id] ?? null;
      if (!Object.is(before, after)) {
        cells++;
        if (examples.length < 20) examples.push({ rowId: row.id, columnId: col.id, before, after });
      }
    }
  return {
    baseVersionId: source.versionId,
    fingerprint: JSON.stringify(config),
    configuration: config,
    dataset: checked,
    changes: { cells, rows: source.rows.length - checked.rows.length, columns: changedColumns },
    examples,
    warnings: [...new Set(warnings)].slice(0, 30),
    parameters,
  };
}

export function analyzeDataset(dataset: Dataset) {
  let missingCells = 0,
    rowsWithMissing = 0,
    duplicateExcessRows = 0,
    outlierCells = 0;
  const outlierRows = new Set<string>(),
    seen = new Set<string>();
  const columns = dataset.columns.map((column) => {
    const stats = numericSummary(numeric(dataset.rows.map((r) => r.cells[column.id] ?? null)));
    if (stats && stats.q3 > stats.q1)
      for (const row of dataset.rows) {
        const v = row.cells[column.id];
        if (
          typeof v === 'number' &&
          (v < stats.q1 - 1.5 * (stats.q3 - stats.q1) || v > stats.q3 + 1.5 * (stats.q3 - stats.q1))
        ) {
          outlierCells++;
          outlierRows.add(row.id);
        }
      }
    const values = dataset.rows.map((r) => r.cells[column.id] ?? null);
    const histogram: { lower: number; upper: number; count: number }[] = [];
    if (stats) {
      const bins = stats.min === stats.max ? 1 : 20,
        width = (stats.max - stats.min) / bins;
      for (let i = 0; i < bins; i++)
        histogram.push({
          lower: stats.min + i * width,
          upper: stats.min + (i + 1) * width,
          count: 0,
        });
      for (const v of values)
        if (typeof v === 'number') {
          const bin =
            histogram[Math.min(bins - 1, width ? Math.floor((v - stats.min) / width) : 0)];
          if (bin) bin.count++;
        }
    }
    const counts = new Map<string, number>();
    if (column.type !== 'number')
      for (const value of values)
        if (value !== null) counts.set(String(value), (counts.get(String(value)) ?? 0) + 1);
    const issues = [
      { kind: 'missing', count: values.filter((v) => v === null).length },
      {
        kind: 'whitespace',
        count: values.filter((v) => typeof v === 'string' && v !== v.trim()).length,
      },
      {
        kind: 'HTML',
        count: values.filter((v) => typeof v === 'string' && /<[^>]*>/u.test(v)).length,
      },
    ];
    return {
      ...column,
      issues,
      statistics: stats,
      missingCount: values.filter((v) => v === null).length,
      histogram,
      categories: [...counts].map(([value, count]) => ({ value, count })),
    };
  });
  for (const row of dataset.rows) {
    const values = dataset.columns.map((c) => row.cells[c.id] ?? null);
    const missing = values.filter((v) => v === null).length;
    missingCells += missing;
    if (missing) rowsWithMissing++;
    const key = JSON.stringify(values);
    if (seen.has(key)) duplicateExcessRows++;
    seen.add(key);
  }
  const numericColumns = dataset.columns.filter((c) => c.type === 'number');
  const correlation = numericColumns.flatMap((a) =>
    numericColumns.map((b) => {
      const pairs = dataset.rows.flatMap((r) => {
        const x = r.cells[a.id],
          y = r.cells[b.id];
        return typeof x === 'number' && typeof y === 'number' ? [[x, y] as const] : [];
      });
      let coefficient: number | null = null;
      if (pairs.length >= 2) {
        const xs = pairs.map(([x]) => x),
          ys = pairs.map(([, y]) => y);
        const sx = xs.reduce((m, v) => Math.max(m, Math.abs(v)), 1),
          sy = ys.reduce((m, v) => Math.max(m, Math.abs(v)), 1);
        const mx = xs.reduce((s, v) => s + v / sx / pairs.length, 0),
          my = ys.reduce((s, v) => s + v / sy / pairs.length, 0);
        let xx = 0,
          yy = 0,
          xy = 0;
        for (const [x, y] of pairs) {
          const dx = x / sx - mx,
            dy = y / sy - my;
          xx += dx * dx;
          yy += dy * dy;
          xy += dx * dy;
        }
        if (!xs.every((v) => v === xs[0]) && !ys.every((v) => v === ys[0]) && xx && yy)
          coefficient = Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy)));
      }
      return {
        a: a.name,
        b: b.name,
        coefficient,
        reason: coefficient === null ? 'Không đủ cặp hoặc cột hằng' : null,
      };
    }),
  );
  return {
    missingCells,
    rowsWithMissing,
    duplicateExcessRows,
    outlierCells,
    outlierRows: outlierRows.size,
    columns,
    correlation,
    methodNote:
      'Trùng toàn bộ cột, giữ dòng đầu; ngoại lệ IQR k=1.5; phân vị nội suy tuyến tính; Pearson theo cặp hợp lệ. Thống kê toàn bộ dữ liệu.',
  };
}
