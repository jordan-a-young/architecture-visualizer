import { StrictMode, useMemo, useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ArchitectureGraphSchema } from 'archgraph-core';
import { createElkLayout } from 'archgraph-react/elk';
import { ArchitectureViewer, getNodeColor } from 'archgraph-react';
import 'archgraph-react/styles.css';
import type { ArchitectureViewerHandle } from 'archgraph-react';
import { SavedViews } from './SavedViews';
import sample from '../../../examples/distributed-system.json';
import './demo.css';
const graph = ArchitectureGraphSchema.parse(sample);
const types = [...new Set(graph.nodes.map((node) => node.type))].sort();
function Demo() {
  const viewer = useRef<ArchitectureViewerHandle>(null);
  const [type, setType] = useState('all');
  const [layoutMode, setLayoutMode] = useState('advanced');
  const [direction, setDirection] = useState<'RIGHT' | 'DOWN'>('RIGHT');
  const [spacing, setSpacing] = useState(3);
  const [boundaries, setBoundaries] = useState(true);
  const layout = useMemo(
    () =>
      layoutMode === 'basic'
        ? ('layered' as const)
        : createElkLayout({ direction, spacing, layerSpacing: spacing + 2 }),
    [layoutMode, direction, spacing],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showLabels, setShowLabels] = useState(false);
  const filters = useMemo(
    () => (type === 'all' ? {} : { types: [type] }),
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
      <div className="layoutbar" role="group" aria-label="Layout settings">
        <label>
          Layout{' '}
          <select
            value={layoutMode}
            onChange={(e) => setLayoutMode(e.target.value)}
          >
            <option value="advanced">Advanced layered</option>
            <option value="basic">Basic layered</option>
          </select>
        </label>
        <label>
          Direction{' '}
          <select
            disabled={layoutMode === 'basic'}
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'RIGHT' | 'DOWN')}
          >
            <option value="RIGHT">Left to right</option>
            <option value="DOWN">Top to bottom</option>
          </select>
        </label>
        <label>
          Spacing{' '}
          <select
            disabled={layoutMode === 'basic'}
            value={spacing}
            onChange={(e) => setSpacing(Number(e.target.value))}
          >
            <option value={3}>Normal</option>
            <option value={5}>Spacious</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={boundaries}
            onChange={(e) => setBoundaries(e.target.checked)}
          />{' '}
          Group boundaries
        </label>
      </div>
      <SavedViews viewer={viewer} />
      <div className="viewer-shell">
        <ArchitectureViewer
          ref={viewer}
          graph={graph}
          layout={layout}
          showGroupBoundaries={boundaries}
          onFiltersChange={(next) =>
            setType(next.types?.length === 1 ? next.types[0]! : 'all')
          }
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
