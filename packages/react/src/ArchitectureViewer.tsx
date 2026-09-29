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
import { routeEdges } from './routing.js';
import { getGroupBoundaries } from './groupBounds.js';
import { computeLayout, validateLayoutGeometry } from './layout.js';
import { useLayout } from './useLayout.js';
import { useFilteredGraph } from './hooks.js';
import { GraphScene } from './Scene.js';
import { getRelationshipLegend, resolveEdgeStyle } from './edgeStyles.js';
import {
  RelationshipLegend,
  activeLegendEntry,
  emptyLegendHighlight,
} from './RelationshipLegend.js';
import { parseViewState } from './viewState.js';
import type { CameraState, ViewerViewState } from './viewState.js';
import type { GraphFilterOptions } from 'archgraph-core';
import { Walkthrough } from './WalkthroughPanel.js';
import { useFullscreen } from './useFullscreen.js';
import { resolveWalkthrough } from './walkthrough.js';
import type { WalkthroughState } from './types.js';
import { getEdgeKey } from './edgeKey.js';
import { DefaultEdgeDetailsPanel } from './EdgeDetailsPanel.js';
import { DefaultDetailsPanel } from './DetailsPanel.js';
import { downloadScreenshot } from './screenshot.js';
import { retainNodePositions, resolveNodePositions } from './positions.js';
import type { CameraPreset } from './types.js';
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
    edgeRouting = 'auto',
    showGroupBoundaries = true,
    groupStyle,
    draggableNodes = false,
    nodePositions,
    defaultNodePositions = {},
    onNodePositionsChange,
    onNodeDragEnd,
    nodeRenderers,
    edgeStyle,
    relationshipStyles,
    showRelationshipLegend = false,
    showEdgeLabels = false,
    nodeLabelMode = 'auto',
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
  const [cameraPreset, setPreset] = useState<CameraPreset>('perspective');
  const [arranging, setArranging] = useState(false);
  const [arrangeError, setArrangeError] = useState<string | null>(null);
  const arrangeSequence = useRef(0);
  useEffect(
    () => () => {
      arrangeSequence.current++;
    },
    [],
  );
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
  const viewerRef = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(viewerRef);
  const [legendHighlight, setLegendHighlight] = useState(emptyLegendHighlight);
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
  const computedLayout = useLayout(graph, layout);
  const basePositions = computedLayout.geometry.positions;
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
  const sceneEdgeKeys = useMemo(
    () =>
      new Map(
        visible.edges.map((edge) => [
          edge,
          edgeKeys.get(projection.originals.get(edge)!)!,
        ]),
      ),
    [visible, edgeKeys, projection],
  );
  const edgeStyles = useMemo(
    () =>
      new Map(
        visible.edges.map((edge) => {
          const original = projection.originals.get(edge)!;
          return [
            edge,
            resolveEdgeStyle(
              original,
              relationshipStyles,
              edgeStyle?.(original),
            ),
          ];
        }),
      ),
    [visible, projection, relationshipStyles, edgeStyle],
  );
  const legendEntries = useMemo(
    () =>
      getRelationshipLegend(
        visible.edges,
        sceneEdgeKeys,
        edgeStyles,
        relationshipStyles,
      ),
    [visible, sceneEdgeKeys, edgeStyles, relationshipStyles],
  );
  useEffect(() => {
    setLegendHighlight((previous) => {
      const retained = (id: string | null) =>
        showRelationshipLegend && legendEntries.some((entry) => entry.id === id)
          ? id
          : null;
      const next = {
        hovered: retained(previous.hovered),
        focused: retained(previous.focused),
        pinned: retained(previous.pinned),
      };
      return next.hovered === previous.hovered &&
        next.focused === previous.focused &&
        next.pinned === previous.pinned
        ? previous
        : next;
    });
  }, [legendEntries, showRelationshipLegend]);
  const legendEdges = showRelationshipLegend
    ? (activeLegendEntry(legendEntries, legendHighlight)?.edgeKeys ?? [])
    : [];
  const edgePaths = useMemo(
    () =>
      edgeRouting === 'orthogonal' ||
      (edgeRouting === 'auto' && computedLayout.geometry.edgePaths)
        ? routeEdges(visible, positions, {
            nodeSizes: computedLayout.geometry.nodeSizes,
            edgeKeys: sceneEdgeKeys,
            preferredPaths: computedLayout.geometry.edgePaths,
            basePositions,
          })
        : undefined,
    [
      edgeRouting,
      computedLayout.geometry,
      visible,
      positions,
      sceneEdgeKeys,
      basePositions,
    ],
  );
  const groupBoundaries = useMemo(
    () =>
      showGroupBoundaries
        ? getGroupBoundaries(
            visible,
            positions,
            projection.proxies,
            computedLayout.geometry.nodeSizes,
          )
        : [],
    [
      showGroupBoundaries,
      visible,
      positions,
      projection.proxies,
      computedLayout.geometry,
    ],
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
  const positionContext = useRef({ graph, overrides, changePositions });
  positionContext.current = { graph, overrides, changePositions };
  const beginNodeMove = (node: ArchitectureNode) => {
    const previous = Object.hasOwn(overrides, node.id)
      ? ([...overrides[node.id]!] as Position3)
      : undefined;
    return () => {
      const current = positionContext.current;
      if (!getNode(current.graph, node.id)) return;
      const next = { ...current.overrides };
      if (previous) next[node.id] = [...previous];
      else delete next[node.id];
      current.changePositions(next);
    };
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
    setPreset('perspective');
    setCameraRequest(null);
    setFocusRequest(null);
    setReset((value) => value + 1);
  };
  const setCameraPreset = (preset: CameraPreset) => {
    setPreset(preset);
    setCameraRequest(null);
    setFocusRequest(null);
    setReset((value) => value + 1);
  };
  const arrangementContext = useRef({ graph, filtered, layout, overrides });
  arrangementContext.current = { graph, filtered, layout, overrides };
  const arrangeVisibleGraph = async () => {
    const sequence = ++arrangeSequence.current;
    const context = arrangementContext.current;
    setArranging(true);
    setArrangeError(null);
    try {
      const geometry = validateLayoutGeometry(
        filtered,
        typeof layout === 'object'
          ? await layout.compute(filtered)
          : { positions: computeLayout(filtered, layout) },
      );
      const latest = arrangementContext.current;
      if (
        sequence !== arrangeSequence.current ||
        latest.graph !== context.graph ||
        latest.filtered !== context.filtered ||
        latest.layout !== context.layout ||
        latest.overrides !== context.overrides
      )
        return;
      changePositions({
        ...Object.fromEntries(
          [...geometry.positions].map(([id, p]) => [id, [...p] as Position3]),
        ),
        ...overrides,
      });
    } catch (error) {
      if (sequence === arrangeSequence.current)
        setArrangeError(
          error instanceof Error ? error.message : 'Arrangement failed.',
        );
      throw error;
    } finally {
      if (sequence === arrangeSequence.current) setArranging(false);
    }
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
    setCameraPreset,
    arrangeVisibleGraph,
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
      ref={viewerRef}
      className={`av-viewer ${className}`}
      style={style}
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !fullscreen.active) select(null);
      }}
    >
      <div
        className={`av-scene-column${showRelationshipLegend ? ' av-with-legend' : ''}`}
      >
        <div className="av-viewport">
          {computedLayout.pending && (
            <p role="status" className="av-layout-status">
              Arranging graph…
            </p>
          )}
          {computedLayout.error && (
            <p role="alert" className="av-layout-status">
              Layout failed: {computedLayout.error} Using the basic layout.
            </p>
          )}
          <SceneBoundary key={reset}>
            <GraphScene
              graph={visible}
              cameraPreset={cameraPreset}
              edgePaths={edgePaths}
              groupBoundaries={groupBoundaries}
              groupStyle={groupStyle}
              onCollapseGroup={(id) => changeCollapsed([...collapsed, id])}
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
              onNodeDragStart={beginNodeMove}
              onNodeDragEnd={onNodeDragEnd}
              selectedId={selected?.id ?? null}
              onSelect={select}
              reset={reset}
              highlightedNodeIds={[
                ...highlightedNodeIds,
                ...(path?.nodeIds ?? []),
              ]}
              nodeRenderers={nodeRenderers}
              edgeStyles={edgeStyles}
              legendEdgeKeys={legendEdges}
              showEdgeLabels={showEdgeLabels}
              nodeLabelMode={nodeLabelMode}
            />
          </SceneBoundary>
          {!visible.nodes.length && (
            <p className="av-empty" role="status">
              No nodes match the current filters.
            </p>
          )}
          <div className="av-toolbar">
            <span>
              {visible.nodes.length} nodes · {visible.edges.length}{' '}
              relationships
            </span>
            <div className="av-toolbar-actions">
              <button
                type="button"
                disabled={
                  arranging || computedLayout.pending || !filtered.nodes.length
                }
                onClick={() => {
                  void arrangeVisibleGraph().catch(() => undefined);
                }}
              >
                {arranging ? 'Arranging…' : 'Arrange visible'}
              </button>
              <button type="button" onClick={() => setCameraPreset('top')}>
                Top view
              </button>
              {showWalkthrough && selected && !path && (
                <button
                  type="button"
                  onClick={() => {
                    selectEdge(null);
                    changeWalkthrough({
                      startNodeId: selected.id,
                      edgeKeys: [],
                    });
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
              {fullscreen.available && (
                <button
                  type="button"
                  disabled={fullscreen.pending || fullscreen.otherActive}
                  onClick={() => void fullscreen.toggle()}
                >
                  {fullscreen.active ? 'Exit fullscreen' : 'Enter fullscreen'}
                </button>
              )}
            </div>
          </div>
          {arrangeError && (
            <p role="alert" className="av-layout-status">
              Arrangement failed: {arrangeError}
            </p>
          )}
          {captureError && (
            <p role="alert" className="av-export-error">
              {captureError}
            </p>
          )}
          {fullscreen.error && (
            <p role="alert" className="av-fullscreen-error">
              {fullscreen.error}
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
        {showRelationshipLegend && (
          <RelationshipLegend
            entries={legendEntries}
            highlight={legendHighlight}
            onChange={setLegendHighlight}
          />
        )}
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
