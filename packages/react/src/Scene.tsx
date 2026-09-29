import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import type { Group } from 'three';
import type { ResolvedEdgeStyle } from './edgeStyles.js';
import type { ComponentRef } from 'react';
import type {
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureEdge,
} from 'archgraph-core';
import { getNeighbors } from 'archgraph-core';
import type { LayoutResult, Position3 } from './layout.js';
import type { ArchitectureViewerProps } from './types.js';
import { LabelPlacement } from './LabelPlacement.js';
import { GroupBoundaries } from './GroupBoundaries.js';
import type { GroupBoundary } from './groupBounds.js';
import { InteractiveNode } from './InteractiveNode.js';
import { GraphEdge } from './Edge.js';
import { captureViewport } from './screenshot.js';
import type { CameraState } from './viewState.js';
import type { CameraPreset } from './types.js';
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
  layoutPositions,
  bounds,
  preset,
  reset,
  focusRequest,
  onCameraReady,
  cameraRequest,
}: {
  positions: LayoutResult;
  layoutPositions: LayoutResult;
  bounds: readonly Position3[];
  preset: CameraPreset;
  reset: number;
  focusRequest?: { id: string; token: number } | null;
  onCameraReady?: (reader: (() => CameraState) | null) => void;
  cameraRequest?: { state: CameraState; token: number } | null;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, size, invalidate } = useThree();
  const latestPositions = useRef(positions);
  latestPositions.current = positions;
  const latestBounds = useRef(bounds);
  latestBounds.current = bounds;
  const framingKey = JSON.stringify([...layoutPositions]);
  useEffect(() => {
    const positions = latestPositions.current;
    const box = new Box3();
    for (const position of latestBounds.current)
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
    const direction =
      preset === 'top'
        ? new Vector3(0, 1, 0.001).normalize()
        : new Vector3(0, 1.6, 0.6).normalize();
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
  }, [framingKey, reset, preset, camera, size.width, size.height, invalidate]);
  useEffect(() => {
    if (!focusRequest) return;
    const position = latestPositions.current.get(focusRequest.id);
    if (!position || !controls.current) return;
    const target = new Vector3(...position);
    const direction = camera.position
      .clone()
      .sub(controls.current.target)
      .normalize();
    camera.position.copy(target.clone().add(direction.multiplyScalar(10)));
    controls.current.target.copy(target);
    controls.current.update();
    invalidate();
  }, [focusRequest, camera, invalidate]);
  useEffect(() => {
    onCameraReady?.(() => ({
      position: camera.position.toArray() as Position3,
      target: controls.current!.target.toArray() as Position3,
    }));
    return () => onCameraReady?.(null);
  }, [camera, onCameraReady]);
  useEffect(() => {
    if (!cameraRequest || !controls.current) return;
    const orbit = controls.current;
    const damping = orbit.enableDamping;
    orbit.enableDamping = false;
    orbit.update();
    camera.position.fromArray(cameraRequest.state.position);
    orbit.target.fromArray(cameraRequest.state.target);
    camera.far = Math.max(1000, camera.position.distanceTo(orbit.target) * 10);
    camera.updateProjectionMatrix();
    orbit.update();
    orbit.enableDamping = damping;
    invalidate();
  }, [cameraRequest, camera, invalidate]);
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
  cameraPreset?: CameraPreset;
  edgePaths?: ReadonlyMap<string, readonly Position3[]>;
  groupBoundaries?: readonly GroupBoundary[];
  groupStyle?: ArchitectureViewerProps['groupStyle'];
  onCollapseGroup?: (id: string) => void;
  onCaptureReady?: (
    capture: ArchitectureViewerHandle['captureScreenshot'] | null,
  ) => void;
  graph: ArchitectureGraph;
  groupSummaries?: ReadonlyMap<string, string>;
  onCameraReady?: (reader: (() => CameraState) | null) => void;
  cameraRequest?: { state: CameraState; token: number } | null;
  focusRequest?: { id: string; token: number } | null;
  edgeKeys: ReadonlyMap<ArchitectureEdge, string>;
  selectedEdgeKey: string | null;
  highlightedEdgeKeys: readonly string[];
  pathActive?: boolean;
  onEdgeSelect: (edge: ArchitectureEdge | null) => void;
  positions: LayoutResult;
  layoutPositions: LayoutResult;
  draggableNodes: boolean;
  onNodeMove: (node: ArchitectureNode, position: Position3) => void;
  onNodeDragEnd?: ArchitectureViewerProps['onNodeDragEnd'];
  selectedId: string | null;
  onSelect: (node: ArchitectureNode | null) => void;
  reset: number;
  highlightedNodeIds: readonly string[];
  nodeRenderers?: ArchitectureViewerProps['nodeRenderers'];
  edgeStyles: ReadonlyMap<ArchitectureEdge, ResolvedEdgeStyle>;
  legendEdgeKeys?: readonly string[];
  showEdgeLabels?: boolean;
  nodeLabelMode?: ArchitectureViewerProps['nodeLabelMode'];
}
function SupportedScene({
  graph,
  cameraPreset = 'perspective',
  edgePaths,
  groupBoundaries = [],
  groupStyle,
  onCollapseGroup,
  groupSummaries,
  positions,
  selectedId,
  onSelect,
  reset,
  highlightedNodeIds,
  nodeRenderers,
  edgeStyles,
  legendEdgeKeys = [],
  showEdgeLabels,
  nodeLabelMode = 'auto',
  onCaptureReady,
  layoutPositions,
  draggableNodes,
  onNodeMove,
  onNodeDragEnd,
  focusRequest,
  onCameraReady,
  cameraRequest,
  edgeKeys,
  selectedEdgeKey,
  highlightedEdgeKeys,
  pathActive,
  onEdgeSelect,
}: GraphSceneProps) {
  const dragLock = useRef(false);
  const geometryObjects = useMemo(() => new Map<string, Group>(), []);
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
  const activeEdge = graph.edges.find(
    (edge) => edgeKeys.get(edge) === selectedEdgeKey,
  );
  const connectedNodes = new Set(pathActive ? highlightedNodeIds : connected);
  if (activeEdge) {
    connectedNodes.add(activeEdge.source);
    connectedNodes.add(activeEdge.target);
  }
  const hasSelection = !!selectedId || !!activeEdge;
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
      camera={{ position: [0, 30, 12], fov: 42 }}
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
      <CameraRig
        preset={cameraPreset}
        positions={positions}
        bounds={[
          ...positions.values(),
          ...[...(edgePaths?.values() ?? [])].flat(),
          ...groupBoundaries.flatMap(
            (b) =>
              [
                [b.minX, b.floor, b.minZ],
                [b.maxX, b.floor, b.maxZ],
              ] as Position3[],
          ),
        ]}
        layoutPositions={layoutPositions}
        reset={reset}
        focusRequest={focusRequest}
        onCameraReady={onCameraReady}
        cameraRequest={cameraRequest}
      />
      <CaptureBridge onCaptureReady={onCaptureReady} />
      <gridHelper
        args={[100, 50, '#dce1e7', '#e8ecf0']}
        position={[0, -0.8, 0]}
        raycast={() => null}
      />
      <GroupBoundaries
        boundaries={groupBoundaries}
        groupStyle={groupStyle}
        onCollapse={(id) => onCollapseGroup?.(id)}
      />
      {graph.edges.map((edge, i) => {
        const siblings = parallel.get(
          JSON.stringify([edge.source, edge.target].sort()),
        )!;
        const offset = (siblings.indexOf(i) - (siblings.length - 1) / 2) * 0.8;
        const selectionEmphasis =
          (!pathActive &&
            (selectedId === edge.source || selectedId === edge.target)) ||
          selectedEdgeKey === edgeKeys.get(edge) ||
          highlightedEdgeKeys.includes(edgeKeys.get(edge)!);
        const emphasized =
          selectionEmphasis || legendEdgeKeys.includes(edgeKeys.get(edge)!);
        return (
          <GraphEdge
            key={edge.id ?? `edge-${i}`}
            edge={edge}
            route={edgePaths?.get(edgeKeys.get(edge)!)}
            edgeKey={edgeKeys.get(edge)!}
            onSelect={() => onEdgeSelect(edge)}
            start={positions.get(edge.source)!}
            end={positions.get(edge.target)!}
            emphasized={emphasized}
            dimmed={(hasSelection || legendEdgeKeys.length > 0) && !emphasized}
            label={!!showEdgeLabels || selectionEmphasis}
            offset={offset}
            style={edgeStyles.get(edge)!}
          />
        );
      })}
      {graph.nodes.map((node) => {
        const selected = node.id === selectedId;
        const dimmed =
          hasSelection &&
          !connectedNodes.has(node.id) &&
          !highlighted.has(node.id);
        return (
          <InteractiveNode
            key={node.id}
            node={node}
            geometryObjects={geometryObjects}
            position={positions.get(node.id)!}
            selected={selected}
            dimmed={dimmed}
            highlighted={highlighted.has(node.id)}
            groupLabel={
              groupSummaries?.get(node.id) ??
              (node.group ? groupNames.get(node.group) : undefined)
            }
            nodeRenderers={
              groupSummaries?.has(node.id) ? undefined : nodeRenderers
            }
            draggable={draggableNodes && !groupSummaries?.has(node.id)}
            dragLock={dragLock}
            onSelect={() => onSelect(node)}
            onMove={(position) => onNodeMove(node, position)}
            onDragEnd={(position) => onNodeDragEnd?.(node, position)}
          />
        );
      })}
      <LabelPlacement geometryObjects={geometryObjects} mode={nodeLabelMode} />
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
