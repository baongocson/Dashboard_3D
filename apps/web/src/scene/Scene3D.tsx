import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, InstancedMesh, Object3D } from 'three';
import {
  axisOptions,
  scatterRows,
  missingPointColor,
  coordinate,
  AXIS_NAMES,
} from './scatterModel';
import { RowDetails, type SaveRow } from './RowDetails';
import { useDraftGuard } from './DraftGuard';
import { ScatterAxes, Projection } from './ScatterAxes';
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
  onSaveRow?: SaveRow | undefined;
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
  onHover: (point: Point | null, event?: ThreeEvent<PointerEvent>) => void;
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
        if (point && event.delta <= 5) {
          event.stopPropagation();
          onPick(point);
        }
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        onHover(pointAt(event) ?? null, event);
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
  onSaveRow,
}: Props) {
  const guard = useDraftGuard();
  const [chosenAxes, setChosenAxes] = useState<string[] | null>(null);
  const [hover, setHover] = useState<{ version: string; rowId: string } | null>(null);
  const [pinned, setPinned] = useState<{ version: string; rowId: string } | null>(null);
  const [projections, setProjections] = useState(false);
  const [ready, setReady] = useState(false);
  const [observedView, setObservedView] = useState<View | null>(null);
  const options = useMemo(() => axisOptions(dataset), [dataset]);
  const axes = useMemo(() => {
    const numeric = dataset.columns.filter((c) => c.type === 'number').map((c) => c.id);
    const defaults = Array.from({ length: 3 }, (_, i) => numeric[i] ?? '__row');
    return (chosenAxes ?? defaults)
      .map((id) => options.find((a) => a.id === id) ?? options[0])
      .filter((a) => a !== undefined);
  }, [chosenAxes, options, dataset.columns]);
  const model = useMemo(() => scatterRows(dataset, axes), [dataset, axes]);
  const column = dataset.columns.find((c) => c.id === columnId);
  const stats = analysis?.columns.find((c) => c.id === columnId)?.statistics;
  const method = outlierView?.method ?? 'iqr';
  const spread = stats ? (method === 'iqr' ? stats.q3 - stats.q1 : stats.deviation) : 0;
  const threshold = outlierView?.threshold ?? 1.5;
  const lower = stats ? (method === 'iqr' ? stats.q1 : stats.mean) - threshold * spread : 0;
  const upper = stats ? (method === 'iqr' ? stats.q3 : stats.mean) + threshold * spread : 0;
  const points = useMemo(
    () =>
      model.points.flatMap((point) => {
        const row = dataset.rows[point.index];
        if (!row) return [];
        const raw = columnId ? row.cells[columnId] : null;
        const outside = spread > 0 && typeof raw === 'number' && (raw < lower || raw > upper);
        if (section === 'outliers' && outlierView?.onlyOutliers && !outside) return [];
        return [
          {
            ...point,
            columnId: columnId ?? axes[0]?.columnId ?? dataset.columns[0]?.id ?? '',
            color:
              section === 'missing'
                ? missingPointColor(
                    dataset.columns.filter((c) => row.cells[c.id] === null).length,
                    dataset.columns.length,
                  )
                : outside && section === 'outliers'
                  ? '#fb7185'
                  : '#38bdf8',
            label: row.id,
          },
        ];
      }),
    [model, dataset, columnId, axes, spread, lower, upper, section, outlierView?.onlyOutliers],
  );
  const active =
    pinned && dataset.rows.some((r) => r.id === pinned.rowId)
      ? pinned
      : hover?.version === dataset.versionId
        ? hover
        : null;
  const rowIndex = active ? dataset.rows.findIndex((r) => r.id === active.rowId) : -1;
  const row = dataset.rows[rowIndex];
  const activePoint = points.find((p) => p.rowId === row?.id);
  const isPinned = Boolean(pinned && dataset.rows.some((r) => r.id === pinned.rowId));
  const pickLatest = useRef<(rowId: string) => void>(() => {});
  pickLatest.current = (rowId) => {
    setPinned({ version: dataset.versionId, rowId });
    onSelect({
      versionId: dataset.versionId,
      rowId,
      columnId: columnId ?? axes[0]?.columnId ?? dataset.columns[0]?.id ?? '',
    });
  };
  const pick = (rowId: string) => {
    guard.request(() => {
      pickLatest.current(rowId);
    });
  };

  return (
    <div className="chart-region">
      <div className="action-row scatter-controls">
        {axes.map((axis, i) => (
          <label key={i}>
            Axis {AXIS_NAMES[i]}
            <select
              aria-label={`Axis ${String(AXIS_NAMES[i])}`}
              value={axis.id}
              onChange={(e) => {
                const next = axes.map((a) => a.id);
                next[i] = e.target.value;
                setChosenAxes(next);
              }}
            >
              {options.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={projections}
            onChange={(e) => {
              setProjections(e.target.checked);
            }}
          />{' '}
          Axis Projections
        </label>
      </div>
      <div className="scatter-layout">
        <div>
          <div
            className="scene-canvas"
            data-scene-ready={ready}
            data-active-row={row?.id ?? ''}
            data-active-color={activePoint?.color ?? ''}
            data-active-position={JSON.stringify(activePoint?.position ?? null)}
            data-projections={projections}
            data-camera={JSON.stringify(observedView)}
            aria-label={`3D Scatter Plot ${section}`}
          >
            <Canvas camera={{ position: [13, 10, 14], fov: 45 }} frameloop="demand">
              <color attach="background" args={['#0d1729']} />
              <ambientLight intensity={1.5} />
              <directionalLight position={[4, 8, 5]} intensity={2} />
              <ScatterAxes axes={axes} />
              {projections && activePoint && <Projection position={activePoint.position} />}
              {section === 'outliers' &&
                stats &&
                spread > 0 &&
                axes[1]?.columnId === columnId &&
                axes[1].id === columnId &&
                [lower, upper].map((v, i) => {
                  const axis = axes[1];
                  if (
                    !axis ||
                    axis.min === null ||
                    axis.max === null ||
                    v < axis.min ||
                    v > axis.max
                  )
                    return null;
                  return (
                    <mesh
                      key={i}
                      position={[0, coordinate(v, axis), 0]}
                      rotation={[-Math.PI / 2, 0, 0]}
                    >
                      <planeGeometry args={[8, 8]} />
                      <meshBasicMaterial
                        color="#fb7185"
                        transparent
                        opacity={0.12}
                        side={2}
                        depthWrite={false}
                      />
                    </mesh>
                  );
                })}
              <Points
                points={points}
                bars={false}
                onReady={setReady}
                selection={
                  row
                    ? { versionId: dataset.versionId, rowId: row.id, columnId: column?.id ?? '' }
                    : selection?.versionId === dataset.versionId
                      ? selection
                      : null
                }
                onHover={(point) => {
                  if (!isPinned && point)
                    setHover({ version: dataset.versionId, rowId: point.rowId });
                }}
                onPick={(point) => {
                  pick(point.rowId);
                }}
              />
              <CameraControls view={view} onView={onView} onObserved={setObservedView} />
            </Canvas>
          </div>
        </div>
        <aside className="scatter-details" aria-label="Row Details">
          <label>
            Select Row
            <select
              aria-label="Select Row"
              value={row?.id ?? ''}
              onChange={(e) => {
                if (e.target.value) pick(e.target.value);
              }}
            >
              <option value="">Select a row…</option>
              {dataset.rows.map((r, i) => (
                <option key={r.id} value={r.id}>
                  Row {i + 1} · {r.id}
                </option>
              ))}
            </select>
          </label>
          {isPinned && (
            <button
              type="button"
              onClick={() => {
                guard.request(() => {
                  setPinned(null);
                  setHover(null);
                });
              }}
            >
              Unpin
            </button>
          )}
          {row ? (
            <>
              <p role="status">
                Row {rowIndex + 1} · ID {row.id} · {isPinned ? 'Pinned' : 'Viewing'}
              </p>
              {!activePoint && (
                <p className="hint">
                  Row not plotted:{' '}
                  {model.rejected.find((r) => r.rowId === row.id)?.reason ??
                    'excluded by the outlier filter'}
                  .
                </p>
              )}
              <RowDetails
                key={`${dataset.versionId}:${row.id}`}
                dataset={dataset}
                row={row}
                axes={axes}
                onSave={dataset.versionId === currentVersionId ? onSaveRow : undefined}
                onBegin={() => {
                  setPinned({ version: dataset.versionId, rowId: row.id });
                }}
              />
            </>
          ) : (
            <p>Select a point or a row.</p>
          )}
        </aside>
      </div>
      <p role="status">
        Showing {points.length}/{dataset.rows.length} rows · Not Plotted: {model.rejected.length}
      </p>
      {section === 'missing' && (
        <div className="missing-color-legend">
          <span>Complete</span>
          <i />
          <span>Fewer Missing Values</span>
          <b />
          <span>More Missing Values</span>
        </div>
      )}
      {dataset.versionId !== currentVersionId && (
        <p className="alert alert-demo">Outdated chart · Select “Refresh Chart” to update.</p>
      )}
    </div>
  );
}
