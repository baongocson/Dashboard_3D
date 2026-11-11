import { emptyReplacement, type ReplacementDraft } from './operationForms';
export function ReplacementFields({
  value,
  onChange,
  label,
}: {
  value: ReplacementDraft[];
  onChange: (value: ReplacementDraft[]) => void;
  label: string;
}) {
  return (
    <div className="replacement-fields">
      <table>
        <thead>
          <tr>
            <th>Find Value</th>
            <th>Replacement Value</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {value.map((rule, i) => (
            <tr key={i}>
              {(['from', 'to'] as const).map((side) => (
                <td key={side}>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`${label} ${side === 'from' ? 'Find Value' : 'Replacement Value'} missing ${String(i + 1)}`}
                      checked={side === 'from' ? rule.fromMissing : rule.toMissing}
                      onChange={(e) => {
                        onChange(
                          value.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  [side === 'from' ? 'fromMissing' : 'toMissing']: e.target.checked,
                                }
                              : r,
                          ),
                        );
                      }}
                    />{' '}
                    Missing
                  </label>
                  <input
                    aria-label={`${label} ${side === 'from' ? 'Find Value' : 'Replacement Value'} ${String(i + 1)}`}
                    disabled={side === 'from' ? rule.fromMissing : rule.toMissing}
                    value={rule[side]}
                    onChange={(e) => {
                      onChange(
                        value.map((r, j) => (j === i ? { ...r, [side]: e.target.value } : r)),
                      );
                    }}
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  aria-label={`${label} Remove Rule ${String(i + 1)}`}
                  onClick={() => {
                    onChange(value.filter((_, j) => j !== i));
                  }}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button
        type="button"
        onClick={() => {
          onChange([...value, emptyReplacement()]);
        }}
      >
        Add Replacement
      </button>
    </div>
  );
}
