// Development-only fixture using the public package API; excluded from the demo build.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArchitectureViewer } from 'archgraph-react';
import type {
  ArchitectureViewerHandle,
  LayoutEngine,
  LayoutGeometry,
  NodePositions,
  ViewerViewState,
} from 'archgraph-react';
import type { ArchitectureGraph } from 'archgraph-core';
import 'archgraph-react/styles.css';

const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [],
  nodes: [
    { id: 'a', label: 'Alpha', type: 'service' },
    { id: 'b', label: 'Beta', type: 'database' },
    { id: 'c', label: 'Gamma', type: 'queue' },
  ],
  edges: [
    { id: 'edge-1', source: 'a', target: 'b', label: 'First' },
    { source: 'b', target: 'c', label: 'Second' },
  ],
};
const geometry: LayoutGeometry = {
  positions: new Map([
    ['a', [0, 0, 8]],
    ['b', [8, 0, 8]],
    ['c', [16, 0, 8]],
  ]),
};
const saved: ViewerViewState = {
  version: 1,
  collapsedGroupIds: [],
  camera: { position: [3, 12, 21], target: [3, 0, 4] },
  nodePositions: {},
  filters: {},
  selectedNodeId: null,
  selectedEdgeKey: null,
  walkthrough: null,
};
function Fixture() {
  const viewer = useRef<ArchitectureViewerHandle>(null);
  const resolveLayout = useRef<(geometry: LayoutGeometry) => void>(undefined);
  const [delayed] = useState<LayoutEngine>(() => ({
    compute: () =>
      new Promise((resolve) => {
        resolveLayout.current = resolve;
      }),
  }));
  const [dump, setDump] = useState('');
  const [filtered, setFiltered] = useState(false);
  const [positions, setPositions] = useState<NodePositions>({});
  const params = new URLSearchParams(location.search);
  return (
    <>
      <button
        onClick={() => setDump(JSON.stringify(viewer.current!.getViewState()))}
      >
        Read state
      </button>
      <button onClick={() => viewer.current!.restoreViewState(saved)}>
        Restore known camera
      </button>
      <button onClick={() => viewer.current!.focusNode('a')}>
        Focus Alpha
      </button>
      <button onClick={() => resolveLayout.current?.(geometry)}>
        Finish layout
      </button>
      <button onClick={() => setFiltered(!filtered)}>Toggle filter</button>
      <output aria-label="View state" style={{ display: 'none' }}>
        {dump}
      </output>
      <div style={{ height: 640 }}>
        <ArchitectureViewer
          ref={viewer}
          graph={graph}
          layout={params.has('async') ? delayed : 'layered'}
          filters={filtered ? { nodeIds: ['b', 'c'] } : undefined}
          nodePositions={params.has('controlled') ? positions : undefined}
          onNodePositionsChange={setPositions}
          draggableNodes
          showEdgeLabels
        />
      </div>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Fixture />
  </StrictMode>,
);
