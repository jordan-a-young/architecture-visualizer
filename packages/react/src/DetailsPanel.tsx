import {
  getDependencies,
  getDependents,
  getIncomingEdges,
  getOutgoingEdges,
  isSafeHref,
} from 'archgraph-core';
import type { ArchitectureEdge, ArchitectureNode } from 'archgraph-core';
import type { DetailsPanelProps } from './types.js';
function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return '[Unserializable value]';
  }
}
function Metadata({ value }: { value?: Record<string, unknown> }) {
  return value && Object.keys(value).length > 0 ? (
    <dl className="av-metadata">
      {Object.entries(value).map(([key, item]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>
            <pre>{formatValue(item)}</pre>
          </dd>
        </div>
      ))}
    </dl>
  ) : null;
}
export function DefaultDetailsPanel({
  graph,
  node,
  onNodeSelect,
  visibleNodeIds,
}: DetailsPanelProps) {
  if (!node)
    return (
      <aside className="av-details" aria-label="Node details">
        <p className="av-eyebrow">INSPECT ARCHITECTURE</p>
        <h2>Explore your system</h2>
        <p>
          Select a node to see its role, relationships, metadata, and
          documentation.
        </p>
        <p className="av-muted">
          Drag to orbit · Right-drag to pan · Scroll to zoom
        </p>
      </aside>
    );
  const relationshipList = (
    title: string,
    nodes: ArchitectureNode[],
    edges: ArchitectureEdge[],
    direction: 'out' | 'in',
  ) => (
    <section>
      <h3>
        {title} <span className="av-count">{nodes.length}</span>
      </h3>
      {!nodes.length && <p className="av-muted">None</p>}
      {nodes.map((related) => (
        <div className="av-relationship" key={related.id}>
          <button
            type="button"
            disabled={
              visibleNodeIds !== undefined &&
              !visibleNodeIds.includes(related.id)
            }
            title={
              visibleNodeIds !== undefined &&
              !visibleNodeIds.includes(related.id)
                ? 'Hidden by current filters'
                : undefined
            }
            onClick={() => onNodeSelect(related)}
          >
            {related.label} <span aria-hidden="true">↗</span>
          </button>
          {edges
            .filter(
              (edge) =>
                (direction === 'out' ? edge.target : edge.source) ===
                related.id,
            )
            .map((edge, index) => (
              <div key={edge.id ?? index}>
                <p className="av-muted">
                  {edge.label ?? edge.type ?? 'relationship'}
                  {edge.label && edge.type ? ` · ${edge.type}` : ''}
                </p>
                <Metadata value={edge.metadata} />
              </div>
            ))}
        </div>
      ))}
    </section>
  );
  return (
    <aside className="av-details" aria-label="Node details">
      <div className="av-details-heading">
        <span className="av-eyebrow">{node.type}</span>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={() => onNodeSelect(null)}
        >
          ×
        </button>
      </div>
      <h2>{node.label}</h2>
      <p className="av-muted">
        {node.id}
        {node.group
          ? ` / ${graph.groups.find((group) => group.id === node.group)?.label ?? node.group}`
          : ''}
      </p>
      {node.description && <p>{node.description}</p>}
      {!!node.tags?.length && (
        <ul className="av-tags" aria-label="Tags">
          {node.tags.map((tag, index) => (
            <li key={`${tag}-${index}`}>{tag}</li>
          ))}
        </ul>
      )}
      {!!node.links?.length && (
        <section>
          <h3>Links</h3>
          <ul className="av-links">
            {node.links.map((link, index) => (
              <li key={link.id ?? index}>
                {isSafeHref(link.href) ? (
                  <a
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                  >
                    {link.label}
                    <span>{link.type ?? 'link'} ↗</span>
                  </a>
                ) : (
                  <span>{link.label} (unsupported URL)</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <section>
          <h3>Metadata</h3>
          <Metadata value={node.metadata} />
        </section>
      )}
      {relationshipList(
        'Dependencies',
        getDependencies(graph, node.id),
        getOutgoingEdges(graph, node.id),
        'out',
      )}
      {relationshipList(
        'Dependents',
        getDependents(graph, node.id),
        getIncomingEdges(graph, node.id),
        'in',
      )}
    </aside>
  );
}
