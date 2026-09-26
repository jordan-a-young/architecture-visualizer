import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArchitectureGraphSchema } from 'archgraph-core';
import { ArchitectureViewer, getNodeColor } from 'archgraph-react';
import 'archgraph-react/styles.css';
import sample from '../../../examples/distributed-system.json';
import './demo.css';
const graph = ArchitectureGraphSchema.parse(sample);
const types = [...new Set(graph.nodes.map((node) => node.type))].sort();
function Demo() {
  const [type, setType] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const filters = useMemo(
    () => (type === 'all' ? undefined : { types: [type] }),
    [type],
  );
  return (
    <main>
      <header>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            A
          </span>
          <div>
            <strong>Architecture Visualizer</strong>
            <span>PROVIDER-INDEPENDENT · OPEN SOURCE</span>
          </div>
        </div>
        <span className="version">V0.1 / INTERACTIVE DEMO</span>
      </header>
      <section className="page-heading">
        <div>
          <p className="eyebrow">SYSTEM EXPLORER</p>
          <h1>Commerce Platform</h1>
          <p>One graph. A shared understanding of your system.</p>
        </div>
        <div className="sample-badge">
          <span />
          Example architecture
        </div>
      </section>
      <div className="filterbar">
        <div>
          <span className="filter-title">VIEW</span>
          <label htmlFor="type-filter">Node type</label>
          <select
            id="type-filter"
            value={type}
            onChange={(event) => {
              setType(event.target.value);
              setSelectedId(null);
            }}
          >
            <option value="all">All types</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(event) => setShowLabels(event.target.checked)}
            />
            Relationship labels
          </label>
        </div>
        <span>Click to inspect · Drag to rearrange</span>
      </div>
      <div className="viewer-shell">
        <ArchitectureViewer
          graph={graph}
          draggableNodes
          selectedNodeId={selectedId}
          onNodeSelect={(node) => setSelectedId(node?.id ?? null)}
          filters={filters}
          showEdgeLabels={showLabels}
        />
      </div>
      <footer>
        <ul aria-label="Node type legend">
          {types.map((type) => (
            <li key={type}>
              <i style={{ background: getNodeColor(type) }} />
              {type}
            </li>
          ))}
        </ul>
        <span>Graph supplied by the application · No provider connections</span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Demo />
  </StrictMode>,
);
