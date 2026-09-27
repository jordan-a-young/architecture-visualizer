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
import { computeLayout } from './layout.js';
import { useFilteredGraph } from './hooks.js';
import { GraphScene } from './Scene.js';
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
  const visible = useFilteredGraph(graph, filters);
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
        visible.nodes.map((node) => [node.id, basePositions.get(node.id)!]),
      ),
    [visible, basePositions],
  );
  const positions = useMemo(
    () => resolveNodePositions(layoutPositions, overrides),
    [layoutPositions, overrides],
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
    : (visible.edges.find((edge) => edgeKeys.get(edge) === edgeCandidate) ??
      null);
  const selectEdge = (edge: ArchitectureEdge | null) => {
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
    if (path) changeWalkthrough(null);
    selectEdge(null);
    if (selectedNodeId === undefined) setInternalId(node?.id ?? null);
    onNodeSelect?.(node);
  };
  useImperativeHandle(
    ref,
    () => ({
      resetCamera,
      focusNode,
      captureScreenshot,
      resetLayout,
    }),
    [captureScreenshot, resetLayout, visible],
  );
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
            edgeKeys={edgeKeys}
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
            edgeStyle={edgeStyle}
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
                {node.label}
              </button>
            ))}
          </div>
          <details className="av-edge-list">
            <summary>Relationships ({visible.edges.length})</summary>
            {visible.edges.map((edge) => (
              <button
                type="button"
                key={edgeKeys.get(edge)}
                aria-pressed={selectedEdge === edge}
                onClick={() => selectEdge(edge)}
              >
                {getNode(graph, edge.source)?.label} →{' '}
                {getNode(graph, edge.target)?.label} ·{' '}
                {edge.label ?? edge.type ?? 'relationship'}
              </button>
            ))}
          </details>
        </details>
        {showWalkthrough && path && (
          <Walkthrough
            graph={graph}
            path={path}
            visibleIds={new Set(visible.nodes.map((node) => node.id))}
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
              onClear: () => selectEdge(null),
              onNodeSelect: select,
            })
          ) : (
            <DefaultEdgeDetailsPanel
              graph={graph}
              edge={selectedEdge}
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
