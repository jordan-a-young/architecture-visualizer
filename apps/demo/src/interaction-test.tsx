// Development-only browser fixture. Not an entry point in the production build.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArchitectureViewer } from 'archgraph-react';
import type {
  ArchitectureViewerHandle,
  NodeRendererProps,
  NodePositions,
} from 'archgraph-react';
import type { ArchitectureGraph } from 'archgraph-core';
import 'archgraph-react/styles.css';

const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [],
  nodes: [
    { id: 'a', label: 'Custom node', type: 'custom' },
    { id: 'b', label: 'Database', type: 'database' },
    { id: 'c', label: 'Independent', type: 'service' },
  ],
  edges: [{ source: 'a', target: 'b', label: 'reads', type: 'reads' }],
};
function Custom({ color, opacity }: NodeRendererProps) {
  return (
    <mesh>
      <sphereGeometry args={[0.6, 24, 24]} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}
function Fixture() {
  const viewer = useRef<ArchitectureViewerHandle>(null);
  const [error, setError] = useState('');
  const [filtered, setFiltered] = useState(false);
  const [positions, setPositions] = useState<NodePositions>({});
  const [dragEnds, setDragEnds] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const controlled = new URLSearchParams(location.search).has('controlled');
  const accept = !new URLSearchParams(location.search).has('reject');
  const exportScene = async () => {
    try {
      const blob = await viewer.current!.captureScreenshot({
        includeLabels: false,
      });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = 'scene.png';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(String(error));
    }
  };
  return (
    <>
      <button onClick={exportScene}>Export without labels</button>
      <button onClick={() => setFiltered(!filtered)}>Toggle filter</button>
      <button onClick={() => setEnabled(!enabled)}>Toggle dragging</button>
      <output aria-label="Export error">{error}</output>
      <output style={{ display: 'none' }} aria-label="Positions">
        {JSON.stringify(positions)}
      </output>
      <output style={{ display: 'none' }} aria-label="Drag ends">
        {dragEnds}
      </output>
      <div style={{ height: 640, width: '100%' }}>
        <ArchitectureViewer
          ref={viewer}
          graph={graph}
          draggableNodes={enabled}
          nodePositions={controlled ? positions : undefined}
          onNodePositionsChange={(next) => {
            if (accept) setPositions(next);
          }}
          onNodeDragEnd={() => setDragEnds((count) => count + 1)}
          showEdgeLabels
          filters={filtered ? { types: ['custom', 'database'] } : undefined}
          nodeRenderers={{ custom: Custom }}
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
