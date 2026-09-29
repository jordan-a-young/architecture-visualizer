import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import {
  CurvePath,
  LineCurve3,
  QuadraticBezierCurve3,
  Quaternion,
  Vector3,
} from 'three';
import type { PointsMaterial } from 'three';
import type { ArchitectureEdge } from 'archgraph-core';
import type { Position3 } from './layout.js';
import { roundRoute, routeLabelPosition } from './routeGeometry.js';
import type { ResolvedEdgeStyle } from './edgeStyles.js';
// Keep Three's color pipeline intact while making procedural point sprites round.
function roundDots(shader: Parameters<PointsMaterial['onBeforeCompile']>[0]) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <opaque_fragment>',
    `
    vec2 p = 2.0 * gl_PointCoord - 1.0;
    float radius = dot(p, p);
    float smoothing = fwidth(radius);
    diffuseColor.a *= 1.0 - smoothstep(1.0 - smoothing, 1.0 + smoothing, radius);
    #include <opaque_fragment>
  `,
  );
}
export function GraphEdge({
  edge,
  route,
  start,
  end,
  emphasized,
  dimmed,
  label,
  style,
  offset = 0,
  edgeKey,
  onSelect,
}: {
  edge: ArchitectureEdge;
  route?: readonly Position3[];
  edgeKey: string;
  onSelect: () => void;
  start: Position3;
  end: Position3;
  emphasized: boolean;
  dimmed: boolean;
  label: boolean;
  style: ResolvedEdgeStyle;
  offset?: number;
}) {
  const { points, arrow, rotation, midpoint } = useMemo(() => {
    const from = new Vector3(...start);
    const to = new Vector3(...end);
    let points: Vector3[];
    if (route) {
      points = roundRoute(route).map((p) => new Vector3(...p));
    } else if (edge.source === edge.target) {
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
    const curve = new CurvePath<Vector3>();
    for (let i = 1; i < points.length; i++)
      curve.add(new LineCurve3(points[i - 1]!, points[i]!));
    const arrow = curve.getPoint(0.82);
    const direction = curve.getTangent(0.82);
    const rotation = new Quaternion().setFromUnitVectors(
      new Vector3(0, 1, 0),
      direction,
    );
    return {
      points,
      arrow,
      rotation,
      midpoint: route ? new Vector3(...routeLabelPosition(route)) : points[20]!,
    };
  }, [start, end, edge.source, edge.target, offset, route]);
  const hitCurve = useMemo(() => {
    const curve = new CurvePath<Vector3>();
    for (let i = 1; i < points.length; i++)
      curve.add(new LineCurve3(points[i - 1]!, points[i]!));
    return curve;
  }, [points]);
  const dots = useMemo(() => {
    if (style.lineStyle !== 'dotted') return null;
    // Arc-length samples keep round dots evenly spaced through bends. Bound the
    // geometry allocation for unusually long custom routes.
    const count = Math.max(
      1,
      Math.min(2048, Math.ceil(hitCurve.getLength() / 0.24)),
    );
    return new Float32Array(
      Array.from({ length: count + 1 }, (_, i) =>
        hitCurve.getPoint(i / count).toArray(),
      ).flat(),
    );
  }, [hitCurve, style.lineStyle]);
  const visual = style;
  const lineWidth = visual.width + (emphasized ? 1 : 0);
  const opacity = dimmed ? 0.16 : emphasized ? 1 : 0.62;
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <mesh>
        <tubeGeometry args={[hitCurve, 40, 0.12, 6, false]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
      {dots ? (
        <points raycast={() => null}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[dots, 3]} />
          </bufferGeometry>
          <pointsMaterial
            onBeforeCompile={roundDots}
            color={visual.color}
            size={Math.max(2, lineWidth)}
            sizeAttenuation={false}
            transparent
            opacity={opacity}
            depthWrite={false}
          />
        </points>
      ) : (
        <Line
          points={points}
          color={visual.color}
          lineWidth={lineWidth}
          dashed={visual.lineStyle === 'dashed'}
          dashSize={0.25}
          gapSize={0.16}
          transparent
          opacity={opacity}
          raycast={() => null}
        />
      )}
      <mesh position={arrow} quaternion={rotation} raycast={() => null}>
        <coneGeometry args={[0.12, 0.32, 10]} />
        <meshBasicMaterial color={visual.color} transparent opacity={opacity} />
      </mesh>
      {label && (
        <Html
          position={midpoint}
          center
          style={{ opacity }}
          zIndexRange={[20, 0]}
        >
          <button
            type="button"
            className="av-edge-label"
            data-av-export-label="edge"
            data-edge-key={edgeKey}
            aria-label={`Inspect relationship: ${edge.label ?? edge.type ?? 'relationship'}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSelect();
            }}
          >
            {edge.label ?? edge.type ?? 'relationship'}
          </button>
        </Html>
      )}
    </group>
  );
}
