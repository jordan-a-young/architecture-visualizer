import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import type { ComponentRef } from 'react';
import type { ArchitectureGraph, ArchitectureNode } from 'archgraph-core';
import { getNeighbors } from 'archgraph-core';
import type { LayoutResult } from './layout.js';
import type { ArchitectureViewerProps } from './types.js';
import { DefaultNodeRenderer, getNodeColor } from './Node.js';
import { GraphEdge } from './Edge.js';
import { captureViewport } from './screenshot.js';
import type { ArchitectureViewerHandle } from './types.js';

function CaptureBridge({
  onCaptureReady,
}: Pick<GraphSceneProps, 'onCaptureReady'>) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    onCaptureReady?.((options) => {
      const viewport = gl.domElement.closest<HTMLElement>('.av-viewport');
      if (!viewport || gl.getContext().isContextLost())
        return Promise.reject(new Error('The 3D view is unavailable.'));
      return captureViewport(
        gl.domElement,
        viewport,
        () => {
          if (gl.getContext().isContextLost())
            throw new Error('The 3D view is unavailable.');
          gl.render(scene, camera);
        },
        options,
      );
    });
    return () => onCaptureReady?.(null);
  }, [gl, scene, camera, onCaptureReady]);
  return null;
}
function CameraRig({
  positions,
  reset,
}: {
  positions: LayoutResult;
  reset: number;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const box = new Box3();
    for (const position of positions.values())
      box.expandByPoint(new Vector3(...position));
    const center = positions.size
      ? box.getCenter(new Vector3())
      : new Vector3();
    const extent = positions.size
      ? box.getSize(new Vector3())
      : new Vector3(8, 0, 8);
    const aspect = size.width / Math.max(1, size.height);
    const fov =
      camera instanceof PerspectiveCamera
        ? (camera.fov * Math.PI) / 180
        : Math.PI / 4;
    const direction = new Vector3(0, 1.3, 1).normalize();
    const tangent = Math.tan(fov / 2);
    const projectedHeight = extent.y * direction.z + extent.z * direction.y;
    const depth = extent.y * direction.y + extent.z * direction.z;
    const distance =
      Math.max(
        10,
        (extent.x + 5) / (2 * tangent * aspect),
        (projectedHeight + 5) / (2 * tangent),
      ) +
      depth / 2;
    camera.position.copy(
      center.clone().add(direction.multiplyScalar(distance)),
    );
    camera.far = Math.max(1000, distance * 10);
    camera.updateProjectionMatrix();
    camera.lookAt(center);
    if (controls.current) {
      controls.current.target.copy(center);
      controls.current.update();
    }
    invalidate();
  }, [positions, reset, camera, size.width, size.height, invalidate]);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      minDistance={3}
      maxPolarAngle={Math.PI * 0.85}
    />
  );
}
export interface GraphSceneProps {
  onCaptureReady?: (
    capture: ArchitectureViewerHandle['captureScreenshot'] | null,
  ) => void;
  graph: ArchitectureGraph;
  positions: LayoutResult;
  selectedId: string | null;
  onSelect: (node: ArchitectureNode | null) => void;
  reset: number;
  highlightedNodeIds: readonly string[];
  nodeRenderers?: ArchitectureViewerProps['nodeRenderers'];
  edgeStyle?: ArchitectureViewerProps['edgeStyle'];
  showEdgeLabels?: boolean;
}
function SupportedScene({
  graph,
  positions,
  selectedId,
  onSelect,
  reset,
  highlightedNodeIds,
  nodeRenderers,
  edgeStyle,
  showEdgeLabels,
  onCaptureReady,
}: GraphSceneProps) {
  const connected = useMemo(
    () =>
      new Set(
        selectedId
          ? [
              selectedId,
              ...getNeighbors(graph, selectedId).map((node) => node.id),
            ]
          : [],
      ),
    [graph, selectedId],
  );
  const highlighted = new Set(highlightedNodeIds);
  const groupNames = new Map(
    graph.groups.map((group) => [group.id, group.label]),
  );
  const parallel = new Map<string, number[]>();
  graph.edges.forEach((edge, i) => {
    const key = JSON.stringify([edge.source, edge.target].sort());
    parallel.set(key, [...(parallel.get(key) ?? []), i]);
  });
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      camera={{ position: [10, 18, 24], fov: 42 }}
      onPointerMissed={(event) => {
        if (event.type === 'click') onSelect(null);
      }}
      fallback={
        <p>
          3D rendering requires WebGL. Use the node list to inspect this graph.
        </p>
      }
    >
      <color attach="background" args={['#f3f5f7']} />
      <ambientLight intensity={1.5} />
      <directionalLight position={[8, 15, 10]} intensity={2} />
      <CameraRig positions={positions} reset={reset} />
      <CaptureBridge onCaptureReady={onCaptureReady} />
      <gridHelper
        args={[100, 50, '#dce1e7', '#e8ecf0']}
        position={[0, -0.8, 0]}
        raycast={() => null}
      />
      {graph.edges.map((edge, i) => {
        const siblings = parallel.get(
          JSON.stringify([edge.source, edge.target].sort()),
        )!;
        const offset = (siblings.indexOf(i) - (siblings.length - 1) / 2) * 0.8;
        const emphasized =
          selectedId === edge.source || selectedId === edge.target;
        return (
          <GraphEdge
            key={edge.id ?? `edge-${i}`}
            edge={edge}
            start={positions.get(edge.source)!}
            end={positions.get(edge.target)!}
            emphasized={emphasized}
            dimmed={!!selectedId && !emphasized}
            label={!!showEdgeLabels || emphasized}
            offset={offset}
            style={edgeStyle?.(edge)}
          />
        );
      })}
      {graph.nodes.map((node) => {
        const selected = node.id === selectedId;
        const dimmed =
          !!selectedId && !connected.has(node.id) && !highlighted.has(node.id);
        const Renderer =
          nodeRenderers && Object.hasOwn(nodeRenderers, node.type)
            ? nodeRenderers[node.type]!
            : DefaultNodeRenderer;
        return (
          <group
            key={node.id}
            position={positions.get(node.id)}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(node);
            }}
          >
            <Renderer
              node={node}
              selected={selected}
              highlighted={highlighted.has(node.id)}
              dimmed={dimmed}
              color={node.visual?.color ?? getNodeColor(node.type)}
              opacity={dimmed ? 0.28 : 1}
            />
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
            <Html
              position={[0, -(node.visual?.size ?? 1) * 0.5 - 0.35, 0]}
              center
              zIndexRange={[30, 0]}
            >
              <button
                type="button"
                data-av-export-label="node"
                data-node-id={node.id}
                className={`av-node-label${selected ? ' av-node-label-selected' : ''}`}
                style={{ opacity: dimmed ? 0.45 : 1 }}
                aria-pressed={selected}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(node);
                }}
              >
                <strong>{node.label}</strong>
                <span>
                  {node.group ? groupNames.get(node.group) : node.type}
                </span>
              </button>
            </Html>
          </group>
        );
      })}
    </Canvas>
  );
}

/** Probe WebGL2 before mounting R3F, whose async renderer initialization can reject outside a React boundary. */
export function GraphScene(props: GraphSceneProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const context = document.createElement('canvas').getContext('webgl2');
      setSupported(context !== null);
      context?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setSupported(false);
    }
  }, []);
  if (supported === null)
    return (
      <p role="status" className="av-scene-fallback">
        Preparing 3D view…
      </p>
    );
  if (!supported)
    return (
      <p role="status" className="av-scene-fallback">
        3D rendering requires WebGL2. Use Browse nodes to inspect this graph.
      </p>
    );
  return <SupportedScene {...props} />;
}
