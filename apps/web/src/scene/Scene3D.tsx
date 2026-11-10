import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Dataset } from '@dashboard/contracts';
import type { CellSelection } from '../components/DatasetTable';
import type { OutlierView, View } from '../storage/workspace';
import { analyzeDataset } from '../../../../packages/data-engine/src/operations';

type Point = {
  rowId: string;
  columnId: string;
  position: [number, number, number];
  color: string;
  label: string;
  height?: number;
};
type Props = {
  dataset: Dataset;
  section: string;
  currentVersionId: string;
  columnId: string | null;
  analysis: ReturnType<typeof analyzeDataset> | null;
  selection: CellSelection | null;
  onSelect: (selection: CellSelection) => void;
  view?: View | undefined;
  onView: (view: View) => void;
  outlierView?: OutlierView;
};

function CameraControls({
  view,
  onView,
  onObserved,
}: {
  view: View | undefined;
  onView: (view: View) => void;
  onObserved: (view: View) => void;
}) {
  const { camera, gl, invalidate } = useThree();
  const callback = useRef(onView);
  callback.current = onView;
  const initial = useRef(view);
  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    const restore = initial.current;
    if (restore) {
      camera.position.fromArray(restore.position);
      camera.zoom = restore.zoom;
      controls.target.fromArray(restore.target);
      camera.updateProjectionMatrix();
    }
    controls.minDistance = 3;
    controls.maxDistance = 35;
    controls.update();
    const observe = () => ({
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      zoom: camera.zoom,
    });
    onObserved(observe());
    const change = () => {
      invalidate();
    };
    const end = () => {
      const observed = observe();
      onObserved(observed);
      callback.current(observed);
    };
    controls.addEventListener('change', change);
    controls.addEventListener('end', end);
    return () => {
      controls.dispose();
    };
  }, [camera, gl, invalidate, onObserved]);
  return null;
}
function Points({
  points,
  onPick,
  onHover,
  selection,
  bars,
  onReady,
}: {
  points: Point[];
  onPick: (point: Point) => void;
  onHover: (point: Point | null) => void;
  selection: CellSelection | null;
  bars: boolean;
  onReady: (ready: boolean) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const object = new Object3D();
    for (const [i, point] of points.entries()) {
      object.position.set(...point.position);
      object.scale.setScalar(point.rowId === selection?.rowId ? 1.8 : 1);
      object.updateMatrix();
      if (bars) {
        object.scale.set(1, Math.max(0.01, point.height ?? 1), 1);
        object.updateMatrix();
      }
      mesh.setMatrixAt(i, object.matrix);
      mesh.setColorAt(i, new Color(point.color));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    invalidate();
    onReady(true);
  }, [points, selection, bars, invalidate, onReady]);
  const pointAt = (event: ThreeEvent<PointerEvent | MouseEvent>) =>
    event.instanceId === undefined ? undefined : points[event.instanceId];
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, points.length]}
      onClick={(event) => {
        const point = pointAt(event);
        if (point) {
          event.stopPropagation();
          onPick(point);
        }
      }}
      onPointerMove={(event) => {
        onHover(pointAt(event) ?? null);
      }}
      onPointerOut={() => {
        onHover(null);
      }}
    >
      {bars ? <boxGeometry args={[0.28, 1, 0.4]} /> : <sphereGeometry args={[0.095, 10, 8]} />}
      <meshStandardMaterial roughness={0.4} metalness={0.15} />
    </instancedMesh>
  );
}
export function Scene3D({
  dataset,
  section,
  currentVersionId,
  columnId,
  analysis,
  selection,
  onSelect,
  view,
  onView,
  outlierView,
}: Props) {
  const [hover, setHover] = useState<Point | null>(null);
  const [ready, setReady] = useState(false);
  const [observedView, setObservedView] = useState<View | null>(null);
  const column =
    dataset.columns.find((c) => c.id === columnId) ??
    dataset.columns.find((c) => c.type === 'number') ??
    dataset.columns[0];
  const stats = column ? analysis?.columns.find((c) => c.id === column.id)?.statistics : null;
  const bars = ['scaling', 'transformation', 'encoding'].includes(section);
  const outlierMethod = outlierView?.method ?? 'iqr',
    threshold = outlierView?.threshold ?? 1.5;
  const spread = stats ? (outlierMethod === 'iqr' ? stats.q3 - stats.q1 : stats.deviation) : 0;
  const lower = stats ? (outlierMethod === 'iqr' ? stats.q1 : stats.mean) - threshold * spread : 0;
  const upper = stats ? (outlierMethod === 'iqr' ? stats.q3 : stats.mean) + threshold * spread : 0;
  const points = useMemo((): Point[] => {
    const summary = analysis?.columns.find((c) => c.id === column?.id);
    if (bars && summary) {
      const bins = summary.histogram;
      const categories = summary.categories;
      const counts = bins.length ? bins.map((b) => b.count) : categories.map((c) => c.count);
      const maximum = counts.reduce((m, n) => Math.max(m, n), 1);
      return counts.slice(0, 1500).map((count, i) => {
        const height = (count / maximum) * 6;
        const bin = bins[i],
          category = categories[i];
        return {
          rowId: '',
          columnId: summary.id,
          position: [
            (i / Math.max(1, Math.min(counts.length, 1500) - 1)) * 8 - 4,
            -3 + height / 2,
            0,
          ],
          height,
          color: '#38bdf8',
          label: `${summary.name}: ${bin ? `[${bin.lower.toPrecision(4)}, ${bin.upper.toPrecision(4)}]` : (category?.value ?? '')} · ${String(count)} bản ghi`,
        };
      });
    }
    if (section === 'collection' && analysis?.correlation.length) {
      const names = [...new Set(analysis.correlation.map((c) => c.a))];
      return analysis.correlation.slice(0, 1500).map((c) => ({
        rowId: '',
        columnId: '',
        position: [names.indexOf(c.a) - names.length / 2, 0, names.indexOf(c.b) - names.length / 2],
        color: c.coefficient === null ? '#78849c' : c.coefficient < 0 ? '#fb7185' : '#38bdf8',
        label: `${c.a} × ${c.b}: ${c.coefficient?.toFixed(4) ?? `N/A (${c.reason ?? ''})`}`,
      }));
    }
    if (section === 'cleaning' && analysis)
      return analysis.columns
        .flatMap((c, i) =>
          c.issues.map((issue, j): Point => ({
            rowId: '',
            columnId: c.id,
            position: [
              (i / Math.max(1, dataset.columns.length - 1)) * 8 - 4,
              j * 2 - 2,
              (issue.count / Math.max(1, dataset.rows.length)) * 6 - 3,
            ],
            color: ['#fbbf24', '#38bdf8', '#c084fc'][j] ?? '#38bdf8',
            label: `${c.name} / ${issue.kind}: ${String(issue.count)} ô`,
          })),
        )
        .slice(0, 1500);
    // Missing is intentionally a dependent quality view: Y + Z = number of columns.
    return dataset.rows.slice(0, 1500).flatMap((row, index): Point[] => {
      const missingColumns = dataset.columns.filter((c) => row.cells[c.id] === null);
      const missing = missingColumns.length,
        total = dataset.columns.length;
      const raw = column ? row.cells[column.id] : null;
      if (section !== 'missing' && section !== 'collection' && typeof raw !== 'number') return [];
      const y =
        section === 'missing' || section === 'collection'
          ? (missing / total) * 6 - 3
          : stats && stats.max !== stats.min && typeof raw === 'number'
            ? ((raw - stats.min) / (stats.max - stats.min)) * 6 - 3
            : 0;
      const outside = spread > 0 && typeof raw === 'number' && (raw < lower || raw > upper);
      if (section === 'outliers' && outlierView?.onlyOutliers && !outside) return [];
      return [
        {
          rowId: row.id,
          columnId:
            (columnId && dataset.columns.some((c) => c.id === columnId)
              ? columnId
              : missingColumns[0]?.id) ??
            dataset.columns[0]?.id ??
            '',
          position: [
            (index / Math.max(1, dataset.rows.length - 1)) * 8 - 4,
            y,
            section === 'missing' || section === 'collection'
              ? ((total - missing) / total) * 6 - 3
              : 0,
          ],
          color:
            section === 'outliers' && outside
              ? '#fb7185'
              : missing
                ? new Color('#fbbf24').lerp(new Color('#ef4444'), missing / total).getStyle()
                : '#38bdf8',
          label: `${row.id} · thiếu ${String(missing)}/${String(total)} (${((missing / total) * 100).toFixed(1)}%)${column ? ` · ${column.name}: ${String(raw)}` : ''}`,
        },
      ];
    });
  }, [
    dataset,
    section,
    column,
    columnId,
    stats,
    analysis,
    bars,
    lower,
    upper,
    spread,
    outlierView?.onlyOutliers,
  ]);
  return (
    <div className="chart-region">
      <div
        className="scene-canvas"
        data-scene-ready={ready}
        data-camera={JSON.stringify(observedView)}
        aria-label={`Biểu đồ 3D ${section}`}
      >
        <Canvas camera={{ position: [10, 8, 12], fov: 45 }} frameloop="demand">
          <color attach="background" args={['#0d1729']} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[4, 8, 5]} intensity={2} />
          <gridHelper args={[12, 12, '#334763', '#1b2e48']} position={[0, -3.3, 0]} />
          <axesHelper args={[5]} />
          {section === 'outliers' &&
            stats &&
            spread > 0 &&
            stats.max !== stats.min &&
            [lower, upper].map((boundary, index) => (
              <mesh
                key={index}
                position={[0, ((boundary - stats.min) / (stats.max - stats.min)) * 6 - 3, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <planeGeometry args={[9, 4]} />
                <meshBasicMaterial color="#fb7185" transparent opacity={0.15} side={2} />
              </mesh>
            ))}
          <Points
            points={points}
            bars={bars}
            onReady={setReady}
            selection={selection?.versionId === dataset.versionId ? selection : null}
            onHover={setHover}
            onPick={(point) => {
              setHover(point);
              if (point.rowId && point.columnId)
                onSelect({
                  versionId: dataset.versionId,
                  rowId: point.rowId,
                  columnId: point.columnId,
                });
            }}
          />
          <CameraControls view={view} onView={onView} onObserved={setObservedView} />
        </Canvas>
        <div className="chart-tooltip" role="status">
          {hover?.label ?? 'Kéo để xoay · Cuộn để zoom · Nhấn điểm để chọn dòng/ô'}
        </div>
      </div>
      <p className="hint">
        Phiên bản vẽ: {dataset.versionId} ·{' '}
        {bars || section === 'collection' || section === 'cleaning'
          ? `${String(points.length)} ô/nhóm hiển thị`
          : `${points.length.toLocaleString('vi-VN')}/${dataset.rows.length.toLocaleString('vi-VN')} dòng đầu hiển thị`}{' '}
        · Tổng {dataset.rows.length.toLocaleString('vi-VN')} dòng (tối đa 1.500 đối tượng; thống kê
        toàn bộ).
      </p>
      <p className="hint">
        {section === 'collection' && analysis?.correlation.length
          ? 'X/Z: cặp cột; Y cố định. Xanh: tương quan dương; đỏ: âm; xám: N/A. Nhấn/rê điểm xem hệ số.'
          : section === 'missing' || section === 'collection'
            ? 'X: thứ tự dòng; Y: số ô thiếu; Z: số ô hợp lệ (tọa độ chuẩn hóa theo số cột). Y và Z phụ thuộc nhau. Xanh: không thiếu; vàng → đỏ: tỷ lệ thiếu tăng.'
            : bars
              ? `X: khoảng giá trị/nhóm của ${column?.name ?? 'cột đã chọn'}; Y: số bản ghi (tỷ lệ tương đối theo đỉnh); Z: phân bố trên mặt phẳng. Rê cột xem số lượng và khoảng gốc.`
              : section === 'cleaning'
                ? 'X: cột; Y: loại vấn đề (missing / khoảng trắng / HTML); Z: số ô ảnh hưởng, chuẩn hóa theo tổng dòng. Rê điểm xem số lượng.'
                : `X: thứ tự dòng; Y: ${column?.name ?? 'chưa chọn cột số'}; Z: mặt phẳng (không có cột phụ). Đỏ: ngoại lệ ${outlierMethod}, ngưỡng ${String(threshold)}.`}
      </p>
      {section === 'outliers' && (
        <p className="hint">
          {stats && spread > 0
            ? `Biên dưới: ${String(lower)} · Biên trên: ${String(upper)}`
            : 'N/A — không có cột số phù hợp hoặc độ phân tán bằng 0.'}
        </p>
      )}
      {dataset.versionId !== currentVersionId && (
        <p className="alert alert-demo">
          Dữ liệu đã thay đổi — cần chạy lại. Biểu đồ cũ chỉ xem; chọn ô trong bảng hiện tại để sửa.
        </p>
      )}
    </div>
  );
}
