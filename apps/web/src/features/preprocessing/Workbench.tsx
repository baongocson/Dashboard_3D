import { useState } from 'react';
import type { Dataset } from '@dashboard/contracts';
import {
  operationSchema,
  type Operation,
  type OperationPreview,
} from '../../../../../packages/data-engine/src/operations';
import type { CellSelection } from '../../components/DatasetTable';
import { parseFillValue } from './previewRules';

export const sections = [
  ['collection', 'Collection'],
  ['cleaning', 'Cleaning'],
  ['missing', 'Missing values'],
  ['outliers', 'Outliers'],
  ['scaling', 'Chuẩn hóa thang đo'],
  ['transformation', 'Transformation'],
  ['encoding', 'Encoding'],
] as const;
const methods: Record<string, [Operation['method'], string][]> = {
  cleaning: [
    ['deduplicate', 'Xóa dòng trùng (giữ dòng đầu)'],
    ['trim', 'Bỏ khoảng trắng'],
    ['strip-html', 'Loại HTML'],
    ['missing-token', 'Thống nhất ký hiệu thiếu'],
    ['number', 'Chuyển sang số'],
    ['text', 'Chuyển sang text'],
    ['boolean', 'Chuyển true/false'],
    ['date', 'Ngày ISO YYYY-MM-DD'],
    ['datetime', 'Datetime có timezone → UTC'],
    ['rename', 'Đổi tên cột'],
    ['drop-column', 'Xóa cột'],
  ],
  missing: [
    ['fill', 'Giá trị cố định'],
    ['missing-batch', 'Missing toàn bộ — cấu hình riêng từng cột'],
    ['mean', 'Trung bình'],
    ['median', 'Trung vị'],
    ['mode', 'Mode (đồng hạng: xuất hiện đầu)'],
    ['forward', 'Điền tiến'],
    ['backward', 'Điền lùi'],
    ['interpolate', 'Nội suy tuyến tính'],
    ['drop-missing', 'Xóa dòng có missing'],
    ['drop-row', 'Xóa dòng đã chọn'],
    ['drop-column', 'Xóa cột'],
  ],
  outliers: [
    ['iqr-clip', 'IQR: kéo về biên'],
    ['iqr-drop', 'IQR: xóa dòng ngoại lệ'],
    ['zscore-clip', 'Z-score: kéo về biên'],
    ['zscore-drop', 'Z-score: xóa dòng ngoại lệ'],
  ],
  scaling: [
    ['minmax', 'Min–Max'],
    ['standard', 'Standard (độ lệch chuẩn tổng thể)'],
    ['robust', 'Robust (trung vị/IQR)'],
  ],
  transformation: [
    ['log1p', 'Log1p'],
    ['sqrt', 'Căn bậc hai'],
    ['yeojohnson', 'Yeo–Johnson (ước lượng λ từng cột)'],
  ],
  encoding: [
    ['onehot', 'One-hot'],
    ['ordinal', 'Ordinal (thứ tự do bạn nhập)'],
  ],
};
export function Workbench({
  dataset,
  section,
  selection,
  busy,
  cancellable,
  preview,
  onPreview,
  onApply,
  onCancel,
  onBusyCancel,
  savedConfiguration,
  onConfiguration,
}: {
  dataset: Dataset;
  section: string;
  selection: CellSelection | null;
  busy: boolean;
  preview: OperationPreview | null;
  onPreview: (configuration: Operation) => void;
  onApply: () => void;
  onCancel: () => void;
  onBusyCancel: () => void;
  cancellable: boolean;
  savedConfiguration: string;
  onConfiguration: (configuration: string) => void;
}) {
  const previous = (() => {
    try {
      return operationSchema.safeParse(JSON.parse(savedConfiguration));
    } catch {
      return null;
    }
  })();
  const initial = previous?.success ? previous.data : null;
  const available = methods[section] ?? [];
  const [method, setMethod] = useState<Operation['method']>(
    initial && available.some(([id]) => id === initial.method)
      ? initial.method
      : (available[0]?.[0] ?? 'fill'),
  );
  const [columns, setColumns] = useState<string[]>(
    initial?.columnIds.filter((id) => dataset.columns.some((c) => c.id === id)) ?? [],
  );
  const [rawValue, setRawValue] = useState(
    initial?.value === null || initial?.value === undefined ? '' : String(initial.value),
  );
  const [scope, setScope] = useState<'cell' | 'all'>('cell');
  const [sortColumnId, setSort] = useState(initial?.sortColumnId ?? '');
  const [descending, setDescending] = useState(initial?.descending ?? false);
  const [parameter, setParameter] = useState(
    method === 'minmax' ? '0' : String(initial?.parameter ?? 1.5),
  );
  const [upper, setUpper] = useState(String(initial?.upper ?? 1));
  const [keepOriginal, setKeepOriginal] = useState(initial?.keepOriginal ?? false);
  const [missingCategory, setMissingCategory] = useState(initial?.missingCategory ?? false);
  const [plans, setPlans] = useState<
    Record<string, { method: Operation['plans'][number]['method']; value: string }>
  >(
    Object.fromEntries(
      (initial?.plans ?? []).map((p) => [
        p.columnId,
        { method: p.method, value: String(p.value ?? '') },
      ]),
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const currentSelection = selection?.versionId === dataset.versionId ? selection : null;
  const affectedColumns =
    scope === 'cell' && currentSelection ? [currentSelection.columnId] : columns;
  function unavailableReason(id: Operation['method']): string | null {
    const selected = dataset.columns.filter((c) => affectedColumns.includes(c.id));
    const requiresNumber = [
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
    if (requiresNumber.includes(id) && selected.some((c) => c.type !== 'number'))
      return 'cần cột số';
    if (
      ['onehot', 'ordinal'].includes(id) &&
      selected.some((c) => c.type !== 'text' && c.type !== 'boolean')
    )
      return 'cần cột phân loại';
    if (
      ['mean', 'median', 'mode', 'forward', 'backward', 'interpolate'].includes(id) &&
      selected.some((c) => dataset.rows.every((r) => r.cells[c.id] === null))
    )
      return 'cột thiếu toàn bộ';
    return null;
  }
  function configure(): Operation | null {
    try {
      if (
        scope === 'cell' &&
        !currentSelection &&
        method !== 'missing-batch' &&
        method !== 'deduplicate'
      )
        throw new Error('Chọn ô trong bảng hiện tại hoặc chọn phạm vi nhiều cột.');
      let value: string | number | boolean | null = rawValue;
      if (method === 'fill') {
        const column = dataset.columns.find((c) => c.id === affectedColumns[0]);
        if (!column) throw new Error('Hãy chọn cột.');
        const parsed = parseFillValue(column.type, rawValue);
        if (!parsed.valid) throw new Error(parsed.reason);
        value = parsed.value;
      }
      const configuration = operationSchema.parse({
        method,
        columnIds: affectedColumns,
        rowId: scope === 'cell' ? (currentSelection?.rowId ?? null) : null,
        value,
        parameter: Number(parameter),
        upper: Number(upper),
        sortColumnId: sortColumnId || null,
        descending,
        categories: rawValue.split('\n').filter((v) => v !== ''),
        keepOriginal,
        missingCategory,
        plans:
          method !== 'missing-batch'
            ? []
            : Object.entries(plans).map(([columnId, plan]) => {
                const column = dataset.columns.find((c) => c.id === columnId);
                if (!column) throw new Error('Cột không còn tồn tại.');
                const parsed =
                  plan.method === 'fill' ? parseFillValue(column.type, plan.value) : null;
                if (parsed && !parsed.valid) throw new Error(`${column.name}: ${parsed.reason}`);
                return {
                  columnId,
                  method: plan.method,
                  value: parsed?.valid ? parsed.value : null,
                };
              }),
      });
      if (['scaling', 'transformation', 'encoding'].includes(section)) configuration.rowId = null;
      return configuration;
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Cấu hình không hợp lệ.');
      return null;
    }
  }
  const invalidate = () => {
    onCancel();
    setError(null);
  };
  return (
    <section className="panel editor-panel">
      <h2>Cấu hình xử lý</h2>
      <fieldset disabled={busy} className="operation-fields" onChange={invalidate}>
        <label className="form-field">
          <span>Phương pháp</span>
          <select
            aria-label="Phương pháp"
            value={method}
            onChange={(event) => {
              const selected = available.find(([id]) => id === event.target.value);
              if (selected) {
                setMethod(selected[0]);
                setParameter(
                  selected[0] === 'minmax' ? '0' : selected[0].startsWith('zscore') ? '3' : '1.5',
                );
              }
            }}
          >
            {available.map(([id, label]) => {
              const reason = unavailableReason(id);
              return (
                <option key={id} value={id} disabled={reason !== null}>
                  {label}
                  {reason ? ` — ${reason}` : ''}
                </option>
              );
            })}
          </select>
        </label>
        <label className="form-field">
          <span>Phạm vi</span>
          <select
            aria-label="Phạm vi"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value === 'all' ? 'all' : 'cell');
            }}
          >
            <option value="cell">Ô/dòng đang chọn</option>
            <option value="all">Nhiều cột / toàn bộ dòng</option>
          </select>
        </label>
        {method === 'missing-batch' && (
          <div className="batch-plans">
            <p className="hint">
              Mỗi cột một phương pháp, Bỏ qua giữ nguyên cột. Tính trên toàn bộ dòng.
            </p>
            {dataset.columns.map((column) => (
              <div key={column.id} className="form-field">
                <label>
                  {column.name}
                  <select
                    aria-label={`Missing cột ${column.name}`}
                    value={plans[column.id]?.method ?? 'skip'}
                    onChange={(event) => {
                      if (event.target.value === 'skip') {
                        setPlans(
                          Object.fromEntries(
                            Object.entries(plans).filter(([id]) => id !== column.id),
                          ),
                        );
                        return;
                      }
                      const parsed = operationSchema.shape.plans
                        .unwrap()
                        .element.shape.method.safeParse(event.target.value);
                      if (parsed.success)
                        setPlans({
                          ...plans,
                          [column.id]: {
                            method: parsed.data,
                            value: plans[column.id]?.value ?? '',
                          },
                        });
                    }}
                  >
                    <option value="skip">Bỏ qua</option>
                    {['fill', 'mean', 'median', 'mode', 'forward', 'backward', 'interpolate'].map(
                      (id) => (
                        <option
                          key={id}
                          value={id}
                          disabled={
                            ['mean', 'median', 'interpolate'].includes(id) &&
                            column.type !== 'number'
                          }
                        >
                          {id}
                          {['mean', 'median', 'interpolate'].includes(id) &&
                          column.type !== 'number'
                            ? ' — cần cột số'
                            : ''}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                {plans[column.id]?.method === 'fill' && (
                  <input
                    aria-label={`Giá trị cột ${column.name}`}
                    value={plans[column.id]?.value ?? ''}
                    onChange={(event) => {
                      const plan = plans[column.id];
                      if (plan)
                        setPlans({ ...plans, [column.id]: { ...plan, value: event.target.value } });
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        {scope === 'cell' ? (
          <p className="hint">
            {currentSelection
              ? `Đã chọn ${currentSelection.rowId} / ${dataset.columns.find((c) => c.id === currentSelection.columnId)?.name ?? ''}`
              : 'Chưa chọn ô hiện tại.'}
          </p>
        ) : (
          <label className="form-field">
            <span>Cột xử lý (Ctrl/⌘ để chọn nhiều)</span>
            <select
              multiple
              aria-label="Cột xử lý"
              value={columns}
              onChange={(event) => {
                setColumns(Array.from(event.target.selectedOptions, (option) => option.value));
              }}
            >
              {dataset.columns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.type})
                </option>
              ))}
            </select>
          </label>
        )}
        {['fill', 'rename', 'missing-token', 'ordinal'].includes(method) && (
          <label className="form-field">
            <span>
              {method === 'ordinal' ? 'Thứ tự nhóm, mỗi dòng một giá trị' : 'Giá trị / tên mới'}
            </span>
            <textarea
              aria-label="Giá trị thay thế"
              value={rawValue}
              onChange={(event) => {
                setRawValue(event.target.value);
              }}
            />
          </label>
        )}
        {(method.startsWith('iqr') || method.startsWith('zscore') || method === 'minmax') && (
          <label className="form-field">
            <span>{method === 'minmax' ? 'Cận dưới đầu ra' : 'Ngưỡng k / z'}</span>
            <input
              aria-label="Tham số"
              type="number"
              step="any"
              value={parameter}
              onChange={(event) => {
                setParameter(event.target.value);
              }}
            />
          </label>
        )}
        {method === 'minmax' && (
          <label className="form-field">
            <span>Cận trên đầu ra</span>
            <input
              type="number"
              aria-label="Cận trên"
              step="any"
              value={upper}
              onChange={(event) => {
                setUpper(event.target.value);
              }}
            />
          </label>
        )}
        {['forward', 'backward', 'interpolate', 'missing-batch'].includes(method) && (
          <>
            <label className="form-field">
              <span>Thứ tự sử dụng (không đổi thứ tự đầu ra)</span>
              <select
                aria-label="Cột sắp xếp"
                value={sortColumnId}
                onChange={(event) => {
                  setSort(event.target.value);
                }}
              >
                <option value="">Thứ tự dòng nguồn</option>
                {dataset.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={descending}
                onChange={(event) => {
                  setDescending(event.target.checked);
                }}
              />{' '}
              Giảm dần
            </label>
          </>
        )}
        {['onehot', 'ordinal'].includes(method) && (
          <>
            <label>
              <input
                type="checkbox"
                checked={keepOriginal}
                onChange={(event) => {
                  setKeepOriginal(event.target.checked);
                }}
              />{' '}
              Giữ cột gốc
            </label>
            <label>
              <input
                type="checkbox"
                checked={missingCategory}
                onChange={(event) => {
                  setMissingCategory(event.target.checked);
                }}
              />{' '}
              Chủ động tạo nhóm missing riêng (mặc định phải xử lý missing trước)
            </label>
          </>
        )}
      </fieldset>
      <p className="hint">
        {['scaling', 'transformation', 'encoding'].includes(section)
          ? 'Áp dụng toàn bộ giá trị hợp lệ của cột đã chọn.'
          : method === 'drop-column'
            ? 'Xóa toàn bộ cột đã chọn, vượt phạm vi ô.'
            : method === 'drop-row'
              ? 'Xóa toàn bộ dòng đang chọn, vượt phạm vi ô.'
              : 'Tham số thống kê tính từ toàn bộ giá trị hợp lệ trong cột.'}
      </p>
      <div className="action-row">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => {
            const config = configure();
            if (config) {
              onConfiguration(JSON.stringify(config));
              onPreview(config);
            }
          }}
        >
          Xem trước
        </button>
        <button
          className="primary-button"
          disabled={
            busy ||
            !preview ||
            preview.changes.cells + preview.changes.rows + preview.changes.columns === 0
          }
          onClick={onApply}
        >
          Áp dụng
        </button>
        <button
          className="quiet-button"
          disabled={busy && !cancellable}
          onClick={busy ? onBusyCancel : onCancel}
        >
          {busy ? (cancellable ? 'Hủy xử lý' : 'Đang lưu…') : 'Hủy preview'}
        </button>
      </div>
      {error && (
        <p role="alert" className="alert alert-error">
          {error}
        </p>
      )}
      {preview && (
        <div className="preview-result" aria-label="Kết quả xem trước">
          <h3>Preview — chưa thay đổi dữ liệu chính</h3>
          <p>
            {preview.changes.cells} ô thay đổi · {preview.changes.rows} dòng xóa ·{' '}
            {preview.changes.columns} cột thay đổi
          </p>
          <p>
            Trước: {dataset.rows.length} dòng / {dataset.columns.length} cột → Sau:{' '}
            {preview.dataset.rows.length} dòng / {preview.dataset.columns.length} cột
          </p>
          <p>Cột đầu ra: {preview.dataset.columns.map((c) => c.name).join(', ')}</p>
          {preview.examples.map((e) => (
            <p key={`${e.rowId}:${e.columnId}`}>
              {e.rowId} / {e.columnId}: {String(e.before)} → <strong>{String(e.after)}</strong>
            </p>
          ))}
          {preview.warnings.map((w) => (
            <p className="hint" key={w}>
              {w}
            </p>
          ))}
          {Object.entries(preview.parameters).map(([key, value]) => (
            <p key={key}>
              {key}: {value}
            </p>
          ))}
          <p className="hint">Phiên bản nguồn: {preview.baseVersionId}. Hủy giữ nguyên dữ liệu.</p>
        </div>
      )}
    </section>
  );
}
