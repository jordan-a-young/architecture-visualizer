import { getNode } from 'archgraph-core';
import type { EdgeDetailsPanelProps } from './types.js';
import { Metadata } from './DetailsPanel.js';
export function DefaultEdgeDetailsPanel({
  graph,
  edge,
  onClear,
  onNodeSelect,
  visibleNodeIds,
}: EdgeDetailsPanelProps) {
  return (
    <aside className="av-details" aria-label="Relationship details">
      <div className="av-details-heading">
        <span className="av-eyebrow">RELATIONSHIP</span>
        <button
          type="button"
          aria-label="Clear relationship selection"
          onClick={onClear}
        >
          ×
        </button>
      </div>
      <h2>{edge.label ?? edge.type ?? 'Relationship'}</h2>
      {edge.type && <p>{edge.type}</p>}
      {edge.id && <p className="av-muted">{edge.id}</p>}
      <section>
        <h3>Direction</h3>
        <button
          type="button"
          disabled={
            visibleNodeIds !== undefined &&
            !visibleNodeIds.includes(edge.source)
          }
          title={
            visibleNodeIds !== undefined &&
            !visibleNodeIds.includes(edge.source)
              ? 'Expand the group or adjust filters to select this node.'
              : undefined
          }
          onClick={() => onNodeSelect(getNode(graph, edge.source) ?? null)}
        >
          {getNode(graph, edge.source)?.label ?? edge.source}
        </button>
        <span aria-label="to"> → </span>
        <button
          type="button"
          disabled={
            visibleNodeIds !== undefined &&
            !visibleNodeIds.includes(edge.target)
          }
          title={
            visibleNodeIds !== undefined &&
            !visibleNodeIds.includes(edge.target)
              ? 'Expand the group or adjust filters to select this node.'
              : undefined
          }
          onClick={() => onNodeSelect(getNode(graph, edge.target) ?? null)}
        >
          {getNode(graph, edge.target)?.label ?? edge.target}
        </button>
      </section>
      {edge.metadata && (
        <section>
          <h3>Metadata</h3>
          <Metadata value={edge.metadata} />
        </section>
      )}
    </aside>
  );
}
