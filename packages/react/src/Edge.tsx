import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { QuadraticBezierCurve3, Quaternion, Vector3 } from 'three';
import type { ArchitectureEdge } from 'archgraph-core';
import type { Position3 } from './layout.js';
import type { EdgeStyle } from './types.js';
const palette = ['#8394ab', '#6c9693', '#a59375', '#9383a4'];
export function defaultEdgeStyle(type = ''): EdgeStyle {
  let hash = 0;
  for (const char of type) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { color: palette[hash % palette.length], width: 1.4, dashed: false };
}
export function GraphEdge({
  edge,
  start,
  end,
  emphasized,
  dimmed,
  label,
  style,
  offset = 0,
}: {
  edge: ArchitectureEdge;
  start: Position3;
  end: Position3;
  emphasized: boolean;
  dimmed: boolean;
  label: boolean;
  style?: EdgeStyle;
  offset?: number;
}) {
  const { points, arrow, rotation, midpoint } = useMemo(() => {
    const from = new Vector3(...start);
    const to = new Vector3(...end);
    let points: Vector3[];
    if (edge.source === edge.target) {
      points = Array.from({ length: 41 }, (_, index) => {
        const angle = (index / 40) * Math.PI * 2;
        return from
          .clone()
          .add(
            new Vector3(
              Math.sin(angle) * 1.2,
              0.4 + (1 - Math.cos(angle)) * 1.1,
              0,
            ),
          );
      });
    } else {
      const middle = from
        .clone()
        .lerp(to, 0.5)
        .add(new Vector3(0, 0.2 + Math.abs(offset) * 0.5, offset));
      points = new QuadraticBezierCurve3(from, middle, to).getPoints(40);
    }
    const arrow = points[31]!;
    const direction = points[32]!.clone().sub(points[30]!).normalize();
    const rotation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction,
    );
    return { points, arrow, rotation, midpoint: points[20]! };
  }, [start, end, edge.source, edge.target, offset]);
  const visual = { ...defaultEdgeStyle(edge.type), ...edge.visual, ...style };
  const opacity = dimmed ? 0.16 : emphasized ? 1 : 0.62;
  return (
    <group>
      <Line
        points={points}
        color={visual.color}
        lineWidth={emphasized ? (visual.width ?? 1.4) + 1 : visual.width}
        dashed={visual.dashed}
        dashSize={0.25}
        gapSize={0.16}
        transparent
        opacity={opacity}
        raycast={() => null}
      />
      <mesh position={arrow} quaternion={rotation} raycast={() => null}>
        <coneGeometry args={[0.12, 0.32, 10]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity} />
      </mesh>
      {label && (
        <Html
          position={midpoint}
          center
          style={{ pointerEvents: 'none', opacity }}
          zIndexRange={[20, 0]}
        >
          <span className="av-edge-label" data-av-export-label="edge">
            {edge.label ?? edge.type}
          </span>
        </Html>
      )}
    </group>
  );
}
