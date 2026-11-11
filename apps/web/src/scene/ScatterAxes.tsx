import { useEffect, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, CanvasTexture, LinearFilter } from 'three';
import { AXIS_NAMES, LOW, HIGH, type Axis, type Vec3 } from './scatterModel';
const COLORS = ['#fb7185', '#86efac', '#7dd3fc'];
function Lines({ vertices, color }: { vertices: number[]; color: string }) {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    return g;
  }, [vertices]);
  useEffect(
    () => () => {
      geometry.dispose();
    },
    [geometry],
  );
  return (
    <lineSegments geometry={geometry} raycast={() => {}}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  );
}
function Label({
  text,
  position,
  color,
  wide = false,
}: {
  text: string;
  position: Vec3;
  color: string;
  wide?: boolean;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.font = '48px sans-serif';
      canvas.width = Math.min(1400, Math.ceil(ctx.measureText(text).width) + 24);
      ctx.fillStyle = '#0d1729dd';
      ctx.fillRect(0, 0, canvas.width, 64);
      ctx.font = '48px sans-serif';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, 32, canvas.width - 24);
    }
    const result = new CanvasTexture(canvas);
    result.minFilter = LinearFilter;
    return result;
  }, [text, color]);
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  return (
    <sprite
      position={position}
      scale={[(wide ? 0.04 : 0.032) * (texture.image.width / 64), wide ? 0.04 : 0.032, 1]}
      raycast={() => {}}
    >
      <spriteMaterial map={texture} transparent depthTest={false} sizeAttenuation={false} />
    </sprite>
  );
}
export function ScatterAxes({ axes }: { axes: Axis[] }) {
  const grid: number[] = [];
  for (let i = 0; i <= 4; i++) {
    const v = LOW + ((HIGH - LOW) * i) / 4;
    grid.push(LOW, LOW, v, HIGH, LOW, v, v, LOW, LOW, v, LOW, HIGH);
  }
  return (
    <group>
      <Lines vertices={grid} color="#334763" />
      {axes.map((_, i) => {
        const end: Vec3 = [LOW, LOW, LOW];
        end[i] = HIGH;
        const title: Vec3 = [...end];
        title[i] = (title[i] ?? 0) + 1.1;
        return (
          <group key={i}>
            <Lines vertices={[LOW, LOW, LOW, ...end]} color={COLORS[i] ?? '#fff'} />
            <Label text={String(AXIS_NAMES[i])} position={title} color={COLORS[i] ?? '#fff'} wide />
          </group>
        );
      })}
    </group>
  );
}
export function Projection({ position }: { position: Vec3 }) {
  return (
    <group>
      {position.map((_, i) => {
        const foot: Vec3 = [LOW, LOW, LOW];
        foot[i] = position[i] ?? LOW;
        return <Lines key={i} vertices={[...position, ...foot]} color={COLORS[i] ?? '#fff'} />;
      })}
    </group>
  );
}
