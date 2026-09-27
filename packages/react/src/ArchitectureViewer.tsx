import {
  Component,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { getNode, validateGraph } from 'archgraph-core';
import type {
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureEdge,
} from 'archgraph-core';
import { projectGroups } from './groups.js';
import { computeLayout } from './layout.js';
import { useFilteredGraph } from './hooks.js';
import { GraphScene } from './Scene.js';
import { parseViewState } from './viewState.js';
import type { CameraState, ViewerViewState } from './viewState.js';
import type { GraphFilterOptions } from 'archgraph-core';
import { Walkthrough } from './Walkthrough.js';
import { resolveWalkthrough } from './walkthrough.js';
import type { WalkthroughState } from './types.js';
import { getEdgeKey } from './edgeKey.js';
import { DefaultEdgeDetailsPanel } from './EdgeDetailsPanel.js';
import { DefaultDetailsPanel } from './DetailsPanel.js';
import { downloadScreenshot } from './screenshot.js';
import { retainNodePositions, resolveNodePositions } from './positions.js';
import type { NodePositions } from './types.js';
import type { Position3 } from './layout.js';
import type {
  ArchitectureViewerHandle,
  ArchitectureViewerProps,
} from './types.js';
class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status" className="av-scene-fallback">
        3D rendering is unavailable. You can still inspect nodes using the list.
      </p>
    ) : (
      this.props.children
    );
  }
}
const ValidViewer = forwardRef<
  ArchitectureViewerHandle,
  ArchitectureViewerProps & { graph: ArchitectureGraph }
>(function ValidViewer(
  {
    graph,
    selectedNodeId,
    defaultSelectedNodeId,
    onNodeSelect,
    highlightedNodeIds = [],
    selectedEdgeKey,
    defaultSelectedEdgeKey,
    onEdgeSelect,
    highlightedEdgeKeys = [],
    showSearch = true,
    showWalkthrough = true,
    walkthrough,
    defaultWalkthrough,
    onWalkthroughChange,
    renderEdgeDetails,
    filters,
    defaultFilters = {},
    onFiltersChange,
    collapsedGroupIds,
    defaultCollapsedGroupIds = [],
    onCollapsedGroupsChange,
    layout = 'layered',
    draggableNodes = false,
    nodePositions,
    defaultNodePositions = {},
    onNodePositionsChange,
    onNodeDragEnd,
    nodeRenderers,
    edgeStyle,
    showEdgeLabels = false,
    showDetailsPanel = true,
    showScreenshotButton = true,
    renderDetails,
    className = '',
    style,
    ariaLabel = 'Architecture graph',
  },
  ref,
) {
  const [internalId, setInternalId] = useState<string | null>(
    defaultSelectedNodeId ?? null,
  );
  const [reset, setReset] = useState(0);
  const [internalFilters, setInternalFilters] =
    useState<GraphFilterOptions>(defaultFilters);
  const effectiveFilters = filters === undefined ? internalFilters : filters;
  const cameraReader = useRef<(() => CameraState) | null>(null);
  const [cameraRequest, setCameraRequest] = useState<{
    state: CameraState;
    token: number;
  } | null>(null);
  const onCameraReady = useCallback((reader: (() => CameraState) | null) => {
    cameraReader.current = reader;
  }, []);
  const [query, setQuery] = useState('');
  const [internalWalkthrough, setInternalWalkthrough] =
    useState<WalkthroughState | null>(defaultWalkthrough ?? null);
  const path = useMemo(
    () =>
      resolveWalkthrough(
        graph,
        walkthrough === undefined ? internalWalkthrough : walkthrough,
      ),
    [graph, walkthrough, internalWalkthrough],
  );
  const changeWalkthrough = (state: WalkthroughState | null) => {
    if (walkthrough === undefined) setInternalWalkthrough(state);
    onWalkthroughChange?.(state);
  };
  const [internalEdgeKey, setInternalEdgeKey] = useState<string | null>(
    defaultSelectedEdgeKey ?? null,
  );
  const [focusRequest, setFocusRequest] = useState<{
    id: string;
    token: number;
  } | null>(null);
  const edgeKeys = useMemo(
    () =>
      new Map(
        graph.edges.map((edge, index) => [edge, getEdgeKey(edge, index)]),
      ),
    [graph],
  );
  const captureRef = useRef<
    ArchitectureViewerHandle['captureScreenshot'] | null
  >(null);
  const [captureReady, setCaptureReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const onCaptureReady = useCallback(
    (capture: ArchitectureViewerHandle['captureScreenshot'] | null) => {
      captureRef.current = capture;
      setCaptureReady(capture !== null);
    },
    [],
  );
  const captureScreenshot = useCallback<
    ArchitectureViewerHandle['captureScreenshot']
  >((options) => {
    if (!captureRef.current)
      return Promise.reject(
        new Error('The 3D view is not ready for a screenshot.'),
      );
    return captureRef.current(options);
  }, []);
  const download = async () => {
    setCapturing(true);
    setCaptureError(null);
    try {
      downloadScreenshot(await captureScreenshot());
    } catch (error) {
      setCaptureError(
        error instanceof Error ? error.message : 'Screenshot export failed.',
      );
    } finally {
      setCapturing(false);
    }
  };
  const filtered = useFilteredGraph(graph, effectiveFilters);
  const [internalCollapsed, setInternalCollapsed] = useState<readonly string[]>(
    defaultCollapsedGroupIds,
  );
  const collapsed = collapsedGroupIds ?? internalCollapsed;
  const changeCollapsed = (ids: readonly string[]) => {
    const next = [...new Set(ids)].filter((id) =>
      graph.groups.some((group) => group.id === id),
    );
    if (collapsedGroupIds === undefined) setInternalCollapsed(next);
    onCollapsedGroupsChange?.(next);
  };
  const expandGroup = (id: string) =>
    changeCollapsed(collapsed.filter((groupId) => groupId !== id));
  const [internalPositions, setInternalPositions] = useState<NodePositions>(
    () => retainNodePositions(graph, defaultNodePositions),
  );
  useEffect(() => {
    setInternalPositions((previous) => retainNodePositions(graph, previous));
  }, [graph]);
  const overrides = useMemo(
    () => retainNodePositions(graph, nodePositions ?? internalPositions),
    [graph, nodePositions, internalPositions],
  );
  // Lay out the whole graph: filtering changes visibility, not saved coordinates.
  const basePositions = useMemo(
    () => computeLayout(graph, layout),
    [graph, layout],
  );
  const layoutPositions = useMemo(
    () =>
      new Map(
        filtered.nodes.map((node) => [node.id, basePositions.get(node.id)!]),
      ),
    [filtered, basePositions],
  );
  const individualPositions = useMemo(
    () => resolveNodePositions(layoutPositions, overrides),
    [layoutPositions, overrides],
  );
  const projection = useMemo(
    () =>
      projectGroups(
        filtered,
        collapsed,
        individualPositions,
        graph.nodes.map((node) => node.id),
      ),
    [filtered, collapsed, individualPositions, graph],
  );
  const visible = projection.graph;
  const positions = projection.positions;
  const sceneEdgeKeys = new Map(
    visible.edges.map((edge) => [
      edge,
      edgeKeys.get(projection.originals.get(edge)!)!,
    ]),
  );
  const changePositions = useCallback(
    (next: NodePositions) => {
      if (nodePositions === undefined) setInternalPositions(next);
      onNodePositionsChange?.(next);
    },
    [nodePositions, onNodePositionsChange],
  );
  const moveNode = (node: ArchitectureNode, position: Position3) => {
    if (getNode(graph, node.id))
      changePositions({ ...overrides, [node.id]: [...position] });
  };
  const resetLayout = useCallback(() => changePositions({}), [changePositions]);
  const candidate = selectedNodeId === undefined ? internalId : selectedNodeId;
  const inspectedId = path?.currentNodeId ?? candidate;
  const selected = inspectedId ? (getNode(visible, inspectedId) ?? null) : null;
  const edgeCandidate =
    selectedEdgeKey === undefined ? internalEdgeKey : selectedEdgeKey;
  const selectedEdge = path
    ? null
    : (filtered.edges.find((edge) => edgeKeys.get(edge) === edgeCandidate) ??
      null);
  const selectEdge = (edge: ArchitectureEdge | null) => {
    edge = edge ? (projection.originals.get(edge) ?? edge) : null;
    const key = edge ? edgeKeys.get(edge)! : null;
    if (selectedEdgeKey === undefined) setInternalEdgeKey(key);
    onEdgeSelect?.(edge, key);
    if (edge) {
      changeWalkthrough(null);
      if (selectedNodeId === undefined) setInternalId(null);
      onNodeSelect?.(null);
    }
  };
  const focusNode = (id: string) => {
    if (!getNode(visible, id)) return false;
    setFocusRequest((previous) => ({ id, token: (previous?.token ?? 0) + 1 }));
    return true;
  };
  const resetCamera = () => {
    setCameraRequest(null);
    setFocusRequest(null);
    setReset((value) => value + 1);
  };
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const searchResults = visible.nodes.filter(
    (node) =>
      !normalizedQuery ||
      [
        node.id,
        node.label,
        node.type,
        node.description ?? '',
        ...(node.tags ?? []),
      ]
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery),
  );
  const select = (node: ArchitectureNode | null) => {
    const group = node ? projection.proxies.get(node.id) : undefined;
    if (group) {
      expandGroup(group.id);
      return;
    }
    if (path) changeWalkthrough(null);
    selectEdge(null);
    if (selectedNodeId === undefined) setInternalId(node?.id ?? null);
    onNodeSelect?.(node);
  };
  const getViewState = (): ViewerViewState => {
    if (effectiveFilters.predicate)
      throw new Error(
        'Predicate filters cannot be saved. Use serializable filters.',
      );
    return parseViewState({
      version: 1,
      collapsedGroupIds: collapsed.filter((id) =>
        graph.groups.some((group) => group.id === id),
      ),
      camera: cameraReader.current?.() ?? null,
      nodePositions: overrides,
      filters: Object.fromEntries(
        Object.entries(effectiveFilters).filter(
          ([key, value]) => key !== 'predicate' && value !== undefined,
        ),
      ),
      selectedNodeId: candidate && getNode(graph, candidate) ? candidate : null,
      selectedEdgeKey: graph.edges.some(
        (edge) => edgeKeys.get(edge) === edgeCandidate,
      )
        ? edgeCandidate
        : null,
      walkthrough: path?.state ?? null,
    });
  };
  const restoreViewState = (input: unknown) => {
    const state = parseViewState(input);
    // Validate everything before invoking callbacks or changing any state.
    const retained = retainNodePositions(graph, state.nodePositions);
    if (filters === undefined) setInternalFilters(state.filters);
    onFiltersChange?.(state.filters);
    changePositions(retained);
    changeCollapsed(state.collapsedGroupIds);
    const node = state.selectedNodeId
      ? (getNode(graph, state.selectedNodeId) ?? null)
      : null;
    if (selectedNodeId === undefined) setInternalId(node?.id ?? null);
    onNodeSelect?.(node);
    const edge =
      graph.edges.find(
        (edge) => edgeKeys.get(edge) === state.selectedEdgeKey,
      ) ?? null;
    const key = edge ? edgeKeys.get(edge)! : null;
    if (selectedEdgeKey === undefined) setInternalEdgeKey(key);
    onEdgeSelect?.(edge, key);
    changeWalkthrough(
      resolveWalkthrough(graph, state.walkthrough)?.state ?? null,
    );
    setFocusRequest(null);
    setCameraRequest((previous) =>
      state.camera
        ? { state: state.camera, token: (previous?.token ?? 0) + 1 }
        : null,
    );
  };
  useImperativeHandle(ref, () => ({
    resetCamera,
    focusNode,
    getViewState,
    restoreViewState,
    captureScreenshot,
    resetLayout,
  }));
  const detailsProps = {
    graph,
    node: selected,
    onNodeSelect: select,
    visibleNodeIds: visible.nodes.map((node) => node.id),
  };
  return (
    <div
      className={`av-viewer ${className}`}
      style={style}
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'Escape') select(null);
      }}
    >
      <div className="av-viewport">
        <SceneBoundary key={reset}>
          <GraphScene
            graph={visible}
            onCaptureReady={onCaptureReady}
            focusRequest={focusRequest}
            onCameraReady={onCameraReady}
            cameraRequest={cameraRequest}
            edgeKeys={sceneEdgeKeys}
            groupSummaries={
              new Map(
                [...projection.proxies].map(([id, group]) => [
                  id,
                  `${projection.members.get(group.id)!.length} nodes · Click to expand`,
                ]),
              )
            }
            selectedEdgeKey={selectedEdge ? edgeCandidate : null}
            onEdgeSelect={selectEdge}
            highlightedEdgeKeys={[
              ...highlightedEdgeKeys,
              ...(path?.state.edgeKeys ?? []),
            ]}
            pathActive={!!path}
            positions={positions}
            layoutPositions={layoutPositions}
            draggableNodes={draggableNodes}
            onNodeMove={moveNode}
            onNodeDragEnd={onNodeDragEnd}
            selectedId={selected?.id ?? null}
            onSelect={select}
            reset={reset}
            highlightedNodeIds={[
              ...highlightedNodeIds,
              ...(path?.nodeIds ?? []),
            ]}
            nodeRenderers={nodeRenderers}
            edgeStyle={
              edgeStyle
                ? (edge) => edgeStyle(projection.originals.get(edge) ?? edge)
                : undefined
            }
            showEdgeLabels={showEdgeLabels}
          />
        </SceneBoundary>
        {!visible.nodes.length && (
          <p className="av-empty" role="status">
            No nodes match the current filters.
          </p>
        )}
        <div className="av-toolbar">
          <span>
            {visible.nodes.length} nodes · {visible.edges.length} relationships
          </span>
          <div className="av-toolbar-actions">
            {showWalkthrough && selected && !path && (
              <button
                type="button"
                onClick={() => {
                  selectEdge(null);
                  changeWalkthrough({ startNodeId: selected.id, edgeKeys: [] });
                }}
              >
                Start walkthrough
              </button>
            )}
            {selected && (
              <button type="button" onClick={() => focusNode(selected.id)}>
                Focus node
              </button>
            )}
            {(draggableNodes || Object.keys(overrides).length > 0) && (
              <button type="button" onClick={resetLayout}>
                Reset layout
              </button>
            )}
            {showScreenshotButton && (
              <button
                type="button"
                disabled={!captureReady || capturing}
                onClick={download}
              >
                {capturing ? 'Exporting…' : 'Download PNG'}
              </button>
            )}
            <button type="button" onClick={resetCamera}>
              Reset camera
            </button>
          </div>
        </div>
        {captureError && (
          <p role="alert" className="av-export-error">
            {captureError}
          </p>
        )}
        <details className="av-node-list">
          <summary>Browse nodes ({visible.nodes.length})</summary>
          {!!graph.groups.length && (
            <details className="av-group-list">
              <summary>Groups ({graph.groups.length})</summary>
              {graph.groups.map((group) => (
                <button
                  type="button"
                  key={group.id}
                  aria-expanded={!collapsed.includes(group.id)}
                  onClick={() =>
                    collapsed.includes(group.id)
                      ? expandGroup(group.id)
                      : changeCollapsed([...collapsed, group.id])
                  }
                >
                  {collapsed.includes(group.id) ? 'Expand' : 'Collapse'}{' '}
                  {group.label}
                  {group.parent && (
                    <small>
                      {' '}
                      ·{' '}
                      {
                        graph.groups.find(
                          (parent) => parent.id === group.parent,
                        )?.label
                      }
                    </small>
                  )}
                </button>
              ))}
            </details>
          )}
          <div>
            {showSearch && (
              <input
                type="search"
                aria-label="Search nodes"
                placeholder="Search nodes…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            )}
            {!!normalizedQuery && !searchResults.length && (
              <p role="status">No matching nodes in this view.</p>
            )}
            {searchResults.map((node) => (
              <button
                type="button"
                key={node.id}
                aria-pressed={node.id === selected?.id}
                onClick={() => select(node)}
              >
                {projection.proxies.has(node.id)
                  ? `Expand ${node.label}`
                  : node.label}
              </button>
            ))}
          </div>
          <details className="av-edge-list">
            <summary>Relationships ({visible.edges.length})</summary>
            {visible.edges.map((edge) => (
              <button
                type="button"
                key={sceneEdgeKeys.get(edge)}
                aria-pressed={selectedEdge === projection.originals.get(edge)}
                onClick={() => selectEdge(edge)}
              >
                {getNode(visible, edge.source)?.label} →{' '}
                {getNode(visible, edge.target)?.label} ·{' '}
                {edge.label ?? edge.type ?? 'relationship'}
              </button>
            ))}
          </details>
        </details>
        {showWalkthrough && path && (
          <Walkthrough
            graph={graph}
            path={path}
            visibleIds={
              new Set(
                visible.nodes
                  .filter((node) => !projection.proxies.has(node.id))
                  .map((node) => node.id),
              )
            }
            onChange={changeWalkthrough}
          />
        )}
        <p className="av-controls-hint">
          {draggableNodes
            ? 'Drag nodes to move · Drag background to orbit · Right-drag to pan · Scroll to zoom · Esc to cancel/clear'
            : 'Drag to orbit · Right-drag to pan · Scroll to zoom · Esc to clear'}
        </p>
      </div>
      {showDetailsPanel &&
        (selectedEdge ? (
          renderEdgeDetails ? (
            renderEdgeDetails({
              graph,
              edge: selectedEdge,
              visibleNodeIds: detailsProps.visibleNodeIds,
              onClear: () => selectEdge(null),
              onNodeSelect: select,
            })
          ) : (
            <DefaultEdgeDetailsPanel
              graph={graph}
              edge={selectedEdge}
              visibleNodeIds={detailsProps.visibleNodeIds}
              onClear={() => selectEdge(null)}
              onNodeSelect={select}
            />
          )
        ) : renderDetails ? (
          renderDetails(detailsProps)
        ) : (
          <DefaultDetailsPanel
            key={selected?.id ?? 'empty'}
            {...detailsProps}
          />
        ))}
    </div>
  );
});
/** Validates at the public boundary; malformed input never reaches the scene. */
export const ArchitectureViewer = forwardRef<
  ArchitectureViewerHandle,
  ArchitectureViewerProps
>(function ArchitectureViewer(props, ref) {
  const validation = useMemo(() => validateGraph(props.graph), [props.graph]);
  if (!validation.valid)
    return (
      <div className="av-validation" role="alert">
        <h2>Invalid architecture graph</h2>
        <ul>
          {validation.issues
            .filter((issue) => issue.severity === 'error')
            .map((issue, index) => (
              <li key={index}>
                {issue.path ? `${issue.path}: ` : ''}
                {issue.message}
              </li>
            ))}
        </ul>
      </div>
    );
  return <ValidViewer {...props} graph={validation.graph} ref={ref} />;
});
