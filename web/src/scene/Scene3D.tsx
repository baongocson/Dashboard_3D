import { useMemo, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Html, Edges } from "@react-three/drei";
import * as THREE from "three";
import type { ChartPoint, Status } from "./data";

const palette: Record<Status, string> = {
  normal: "#78a8ff",
  missing: "#ffc36b",
  outlier: "#fe76be",
};
const gradients = [
  ["#4d3bdf", "#d99bff"],
  ["#155acb", "#79e8ff"],
  ["#077e91", "#6bf9da"],
  ["#9b45be", "#ff9ac6"],
  ["#a76724", "#ffcc79"],
];

type ChartProps = {
  points: ChartPoint[];
  stats: { name: string; missing: number; total: number }[];
  mode: "scatter" | "bars";
  selectedId: string | null;
  selectedColumn: string | null;
  onSelectRow: (id: string) => void;
  onSelectColumn: (name: string) => void;
  visible: Record<Status, boolean>;
};

function GlassBase() {
  return (
    <>
      <RoundedBox
        args={[10.3, 0.28, 8.8]}
        radius={0.18}
        smoothness={4}
        position={[0, -2.75, 0]}
        receiveShadow
      >
        <meshPhysicalMaterial
          color="#19243c"
          metalness={0.32}
          roughness={0.24}
          clearcoat={1}
        />
      </RoundedBox>
      <gridHelper
        args={[9.2, 9, "#263d68", "#182a46"]}
        position={[0, -2.56, 0]}
      />
    </>
  );
}

function Bar({
  name,
  pct,
  index,
  count,
  selected,
  select,
}: {
  name: string;
  pct: number;
  index: number;
  count: number;
  selected: boolean;
  select: () => void;
}) {
  const height = 0.3 + (Math.max(0, pct) / 100) * 4.5;
  const x = (index - (count - 1) / 2) * Math.min(1.65, 8.5 / count);
  const colors = gradients[index % gradients.length];
  const geometry = useMemo(() => {
    const g = new THREE.BoxGeometry(
      Math.min(1.1, 8 / count),
      height,
      1.1,
      1,
      24,
      1,
    ).toNonIndexed();
    const attr = g.getAttribute("position");
    const rgb = new Float32Array(attr.count * 3);
    const low = new THREE.Color(colors[0]);
    const high = new THREE.Color(colors[1]);
    for (let i = 0; i < attr.count; i++) {
      const c = low
        .clone()
        .lerp(high, THREE.MathUtils.clamp(attr.getY(i) / height + 0.5, 0, 1));
      rgb[i * 3] = c.r;
      rgb[i * 3 + 1] = c.g;
      rgb[i * 3 + 2] = c.b;
    }
    g.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    return g;
  }, [height, colors[0], colors[1], count]);
  return (
    <group position={[x, 0, 0]}>
      <mesh
        position={[0, -2.5 + height / 2, 0]}
        geometry={geometry}
        castShadow
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          select();
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <meshPhysicalMaterial
          vertexColors
          roughness={0.12}
          metalness={0.09}
          clearcoat={1}
          emissive={colors[0]}
          emissiveIntensity={selected ? 0.22 : 0.05}
        />
        {selected && <Edges scale={1.02} color="#ffffff" threshold={12} />}
      </mesh>
      <Html
        position={[0, -2.05 + height, 0]}
        center
        distanceFactor={12}
        style={{ pointerEvents: "none" }}
      >
        <div className="value-float">{pct.toFixed(1)}%</div>
      </Html>
      {/* No bottom column labels */}
    </group>
  );
}

function ScatterPoint({
  item,
  selected,
  pick,
}: {
  item: ChartPoint;
  selected: boolean;
  pick: (id: string) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <mesh
      position={[item.x, item.y * 0.6, item.z]}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        pick(item.rowId);
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
        setHover(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        setHover(false);
      }}
      scale={selected ? 1.8 : hover ? 1.35 : 1}
    >
      <sphereGeometry args={[0.105, 12, 12]} />
      <meshPhysicalMaterial
        color={palette[item.status]}
        emissive={palette[item.status]}
        emissiveIntensity={selected ? 1.1 : 0.4}
        metalness={0.15}
        roughness={0.17}
        clearcoat={1}
      />
      {(hover || selected) && (
        <Html center distanceFactor={11} position={[0, 0.3, 0]}>
          <div className="point-float">
            {item.rowId} ·{" "}
            {item.status === "missing"
              ? "Thiếu"
              : item.status === "outlier"
                ? "Ngoại lệ"
                : "Bình thường"}
          </div>
        </Html>
      )}
    </mesh>
  );
}

function SideDecor() {
  return (
    <group position={[4.25, 1.9, -2.7]} rotation={[0, -0.3, 0]}>
      <RoundedBox args={[2.4, 1.15, 0.09]} radius={0.12} smoothness={4}>
        <meshPhysicalMaterial
          color="#263450"
          metalness={0.25}
          roughness={0.21}
          clearcoat={1}
        />
      </RoundedBox>
      <mesh position={[0, 0.02, 0.09]}>
        <torusGeometry args={[0.31, 0.085, 10, 54, Math.PI * 1.55]} />
        <meshStandardMaterial
          color="#a87cff"
          emissive="#5a37c8"
          emissiveIntensity={0.3}
        />
      </mesh>
      <mesh rotation={[0, 0, 4.87]} position={[0, 0.02, 0.09]}>
        <torusGeometry args={[0.31, 0.085, 10, 54, Math.PI * 0.45]} />
        <meshStandardMaterial
          color="#68dfe9"
          emissive="#0088a0"
          emissiveIntensity={0.3}
        />
      </mesh>
    </group>
  );
}

function World(props: ChartProps) {
  const bars = props.stats.slice(0, 10);
  return (
    <>
      <color attach="background" args={["#080b16"]} />
      <ambientLight intensity={1.2} />
      <hemisphereLight args={["#dcdfff", "#111628", 1.5]} />
      <directionalLight
        position={[7, 11, 8]}
        intensity={2.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <pointLight position={[-5, 4, 5]} intensity={30} color="#b382ff" />
      <pointLight position={[6, 6, -3]} intensity={24} color="#6fcfff" />
      <GlassBase />
      {props.mode === "bars" ? (
        bars.map((s, i) => (
          <Bar
            key={s.name}
            name={s.name}
            index={i}
            count={bars.length}
            pct={s.total ? (100 * s.missing) / s.total : 0}
            selected={props.selectedColumn === s.name}
            select={() => props.onSelectColumn(s.name)}
          />
        ))
      ) : (
        <group>
          {props.points
            .filter((p) => props.visible[p.status])
            .map((p) => (
              <ScatterPoint
                key={p.rowId}
                item={p}
                selected={props.selectedId === p.rowId}
                pick={props.onSelectRow}
              />
            ))}
        </group>
      )}
      <SideDecor />
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={8}
        maxDistance={25}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2.03}
      />
    </>
  );
}

export default function Scene3D(props: ChartProps) {
  return (
    <div className="canvas-root">
      <Canvas
        shadows
        camera={{ position: [10, 8, 12], fov: 45 }}
        dpr={[1, 1.7]}
        gl={{ antialias: true }}
      >
        <World {...props} />
      </Canvas>
      <div className="canvas-instruction">
        Kéo để xoay · Cuộn để phóng to · Nhấn điểm/cột để chọn
      </div>
    </div>
  );
}
