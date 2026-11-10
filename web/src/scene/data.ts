export type Status = "normal" | "missing" | "outlier";
export type DataRow = {
  rowId: string;
  values: Record<string, string>;
  status: Status;
};
export type DataSet = {
  datasetId: string;
  versionId: string;
  source: string;
  columns: string[];
  rows: DataRow[];
};
export type ChartPoint = {
  rowId: string;
  x: number;
  y: number;
  z: number;
  status: Status;
  label: string;
};

export const demo: DataSet = {
  datasetId: "demo-customer",
  versionId: "demo-v1",
  source: "Dữ liệu mẫu",
  columns: ["Tuổi", "Thu nhập", "Chi tiêu", "Nhóm"],
  rows: Array.from({ length: 42 }, (_, i) => {
    const age = 19 + ((i * 7) % 43);
    const income = 12 + ((i * 13) % 76);
    const spend = 16 + ((i * 17) % 78);
    const status: Status =
      i % 13 === 0 ? "missing" : i % 11 === 0 ? "outlier" : "normal";
    return {
      rowId: `R${String(i + 1).padStart(3, "0")}`,
      status,
      values: {
        Tuổi: String(age),
        "Thu nhập": status === "missing" ? "" : String(income),
        "Chi tiêu": String(spend),
        Nhóm: ["A", "B", "C"][i % 3],
      },
    };
  }),
};

// CSV parser supports quoted cells, escaped quotes, commas, CRLF and newlines inside quotes.
export function parseCsv(raw: string, filename: string): DataSet {
  const input = raw.replace(/^\uFEFF/, "");
  const grid: string[][] = [];
  let cell = "",
    current: string[] = [],
    quoted = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      current.push(cell);
      cell = "";
    } else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      current.push(cell);
      cell = "";
      if (current.some((v) => v.trim() !== "")) grid.push(current);
      current = [];
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV có dấu ngoặc kép chưa đóng.");
  current.push(cell);
  if (current.some((v) => v.trim() !== "")) grid.push(current);
  if (grid.length < 2)
    throw new Error("CSV cần có tiêu đề và ít nhất một dòng dữ liệu.");
  const cols = grid[0].map((v, i) => v.trim() || `Cột ${i + 1}`);
  if (new Set(cols).size !== cols.length)
    throw new Error("Tên cột CSV bị trùng. Hãy đặt tên cột duy nhất.");
  const rows: DataRow[] = grid.slice(1).map((cells, i) => {
    const values = Object.fromEntries(cols.map((c, j) => [c, cells[j] ?? ""]));
    const missing = cols.some((c) => values[c].trim() === "");
    return {
      rowId: `R${String(i + 1).padStart(3, "0")}`,
      values,
      status: missing ? "missing" : "normal",
    };
  });
  return {
    datasetId: `csv-${Date.now()}`,
    versionId: "import-v1",
    source: filename,
    columns: cols,
    rows,
  };
}

export function numericColumns(ds: DataSet): string[] {
  return ds.columns.filter(
    (col) =>
      ds.rows.some((row) => row.values[col].trim() !== "") &&
      ds.rows
        .filter((row) => row.values[col].trim() !== "")
        .every((row) => Number.isFinite(Number(row.values[col]))),
  );
}

export function derivePoints(ds: DataSet, axes: string[]): ChartPoint[] {
  const ranges = axes.map((col) => {
    const values = ds.rows
      .map((row) => Number(row.values[col]))
      .filter(Number.isFinite);
    return [Math.min(...values), Math.max(...values)];
  });
  const normalize = (value: string, axis: number) => {
    const v = Number(value);
    const [lo, hi] = ranges[axis];
    return value.trim() === "" || !Number.isFinite(v)
      ? 0
      : ((v - lo) / (hi - lo || 1) - 0.5) * 7;
  };
  return ds.rows.slice(0, 1500).map((row) => ({
    rowId: row.rowId,
    status: row.status,
    label: row.rowId,
    x: normalize(row.values[axes[0]], 0),
    y: normalize(row.values[axes[1]], 1),
    z: normalize(row.values[axes[2]], 2),
  }));
}

export function missingStats(ds: DataSet) {
  return ds.columns.map((col) => ({
    name: col,
    missing: ds.rows.filter((r) => r.values[col].trim() === "").length,
    total: ds.rows.length,
  }));
}
