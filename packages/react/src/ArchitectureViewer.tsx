import {
  Component,
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import type { ReactNode } from 'react';
import { getNode, validateGraph } from 'archgraph-core';
import type { ArchitectureGraph, ArchitectureNode } from 'archgraph-core';
import { computeLayout } from './layout.js';
import { useFilteredGraph } from './hooks.js';
import { GraphScene } from './Scene.js';
import { DefaultDetailsPanel } from './DetailsPanel.js';
import { downloadScreenshot } from './screenshot.js';
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
    filters,
    layout = 'layered',
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
  const positions = useMemo(
    () => computeLayout(visible, layout),
    [visible, layout],
  );
  const candidate = selectedNodeId === undefined ? internalId : selectedNodeId;
  const selected = candidate ? (getNode(visible, candidate) ?? null) : null;
  const select = (node: ArchitectureNode | null) => {
    if (selectedNodeId === undefined) setInternalId(node?.id ?? null);
    onNodeSelect?.(node);
  };
  useImperativeHandle(
    ref,
    () => ({
      resetCamera: () => setReset((value) => value + 1),
      captureScreenshot,
    }),
    [captureScreenshot],
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
            positions={positions}
            selectedId={selected?.id ?? null}
            onSelect={select}
            reset={reset}
            highlightedNodeIds={highlightedNodeIds}
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
            {showScreenshotButton && (
              <button
                type="button"
                disabled={!captureReady || capturing}
                onClick={download}
              >
                {capturing ? 'Exporting…' : 'Download PNG'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setReset((value) => value + 1)}
            >
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
            {visible.nodes.map((node) => (
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
        </details>
        <p className="av-controls-hint">
          Drag to orbit · Right-drag to pan · Scroll to zoom · Esc to clear
        </p>
      </div>
      {showDetailsPanel &&
        (renderDetails ? (
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
