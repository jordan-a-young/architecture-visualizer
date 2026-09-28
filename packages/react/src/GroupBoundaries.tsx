import { Html, Line } from '@react-three/drei';
import type { ArchitectureGroup } from 'archgraph-core';
import type { GroupBoundary } from './groupBounds.js';
import type { GroupStyle } from './types.js';
export function GroupBoundaries({
  boundaries,
  onCollapse,
  groupStyle,
}: {
  boundaries: readonly GroupBoundary[];
  onCollapse: (id: string) => void;
  groupStyle?: (group: ArchitectureGroup) => GroupStyle;
}) {
  return (
    <>
      {boundaries.map((boundary) => {
        const { group, minX, maxX, minZ, maxZ, floor, depth } = boundary;
        const style = groupStyle?.(group);
        const color =
          style?.color ?? ['#637f9d', '#6d927f', '#9b8869'][depth % 3]!;
        const opacity = Math.max(0, Math.min(1, style?.fillOpacity ?? 0.055));
        return (
          <group key={group.id}>
            <mesh
              position={[(minX + maxX) / 2, floor, (minZ + maxZ) / 2]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[maxX - minX, maxZ - minZ]} />
              <meshBasicMaterial
                color={color}
                transparent
                opacity={opacity}
                depthWrite={false}
              />
            </mesh>
            <Line
              points={[
                [minX, floor, minZ],
                [maxX, floor, minZ],
                [maxX, floor, maxZ],
                [minX, floor, maxZ],
                [minX, floor, minZ],
              ]}
              color={color}
              lineWidth={1.2}
              transparent
              opacity={0.6}
              raycast={() => null}
            />
            <Html
              position={[minX + 0.3, floor, minZ + 0.3]}
              zIndexRange={[10, 0]}
            >
              <button
                className="av-group-label"
                style={{ color }}
                data-av-export-label="group"
                data-group-id={group.id}
                aria-label={`Collapse group: ${group.label}`}
                title={group.description ?? 'Collapse this group'}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onCollapse(group.id);
                }}
              >
                {group.label}
                <span aria-hidden="true"> −</span>
              </button>
            </Html>
          </group>
        );
      })}
    </>
  );
}
