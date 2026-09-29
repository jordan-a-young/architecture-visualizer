import { useCallback, useState } from 'react';
import type { RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { Html } from '@react-three/drei';
import type { ArchitectureNode } from 'archgraph-core';
import { DefaultNodeRenderer, getNodeColor } from './Node.js';
import { useNodeDrag } from './useNodeDrag.js';
import type { NodeRendererRegistry } from './types.js';
import type { Position3 } from './layout.js';

export function InteractiveNode({
  node,
  position,
  selected,
  highlighted,
  dimmed,
  groupLabel,
  nodeRenderers,
  geometryObjects,
  draggable,
  dragLock,
  onSelect,
  onMove,
  onDragEnd,
}: {
  node: ArchitectureNode;
  position: Position3;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  groupLabel?: string;
  nodeRenderers?: NodeRendererRegistry;
  geometryObjects: Map<string, Group>;
  draggable: boolean;
  dragLock: RefObject<boolean>;
  onSelect: () => void;
  onMove: (position: Position3) => void;
  onDragEnd: (position: Position3) => void;
}) {
  const { invalidate } = useThree();
  const [hovered, setHovered] = useState(false);
  // Drei mounts HTML in a separate root. Request placement after the caption exists,
  // including when filters restore nodes while the demand-rendered canvas is idle.
  const labelMounted = useCallback(
    (label: HTMLButtonElement | null) => {
      if (label) invalidate();
    },
    [invalidate],
  );
  const register = useCallback(
    (object: Group | null) => {
      if (object) geometryObjects.set(node.id, object);
      else geometryObjects.delete(node.id);
    },
    [geometryObjects, node.id],
  );
  const beginDrag = useNodeDrag({
    enabled: draggable,
    position,
    lock: dragLock,
    onMove,
    onEnd: onDragEnd,
    onSelect,
  });
  const Renderer =
    nodeRenderers && Object.hasOwn(nodeRenderers, node.type)
      ? nodeRenderers[node.type]!
      : DefaultNodeRenderer;
  return (
    <group
      position={position}
      onPointerDown={(event) => {
        if (beginDrag(event.nativeEvent)) event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <group
        ref={register}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <Renderer
          node={node}
          selected={selected}
          highlighted={highlighted}
          dimmed={dimmed}
          color={node.visual?.color ?? getNodeColor(node.type)}
          opacity={dimmed ? 0.28 : 1}
        />
      </group>
      {selected && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.6, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[0.8, 0.88, 40]} />
          <meshBasicMaterial color="#335b93" />
        </mesh>
      )}
      <Html position={[0, 0, 0]} center zIndexRange={[30, 0]}>
        <button
          type="button"
          ref={labelMounted}
          data-av-export-label="node"
          data-node-id={node.id}
          data-hovered={hovered || undefined}
          data-highlighted={highlighted || undefined}
          className={`av-node-label${selected ? ' av-node-label-selected' : ''}`}
          style={{
            opacity: dimmed ? 0.45 : 1,
            touchAction: draggable ? 'none' : undefined,
            cursor: draggable ? 'grab' : undefined,
          }}
          aria-pressed={selected}
          aria-label={node.label}
          title={`${node.label} · ${groupLabel ?? node.type}`}
          onPointerEnter={() => {
            setHovered(true);
            invalidate();
          }}
          onPointerLeave={() => {
            setHovered(false);
            invalidate();
          }}
          onFocus={() => invalidate()}
          onBlur={() => invalidate()}
          onPointerDown={(event) => {
            event.stopPropagation();
            beginDrag(event.nativeEvent);
          }}
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
        >
          <strong>{node.label}</strong>
        </button>
      </Html>
    </group>
  );
}
