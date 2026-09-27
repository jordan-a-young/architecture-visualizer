import { useState } from 'react';
import { getNode } from 'archgraph-core';
import type { ArchitectureGraph } from 'archgraph-core';
import type { WalkthroughState } from './types.js';
import type { resolveWalkthrough } from './walkthrough.js';
import { getEdgeKey } from './edgeKey.js';
export function Walkthrough({
  graph,
  path,
  visibleIds,
  onChange,
}: {
  graph: ArchitectureGraph;
  path: NonNullable<ReturnType<typeof resolveWalkthrough>>;
  visibleIds: ReadonlySet<string>;
  onChange: (state: WalkthroughState | null) => void;
}) {
  const [choosingFor, setChoosingFor] = useState<string | null>(null);
  const signature = JSON.stringify(path.state);
  const outgoing = graph.edges.flatMap((edge, index) =>
    edge.source === path.currentNodeId
      ? [{ edge, key: getEdgeKey(edge, index), index }]
      : [],
  );
  const currentVisible = visibleIds.has(path.currentNodeId);
  const advance = (key: string) =>
    onChange({ ...path.state, edgeKeys: [...path.state.edgeKeys, key] });
  return (
    <section className="av-walkthrough" aria-label="Connection walkthrough">
      <strong>Explore connections</strong>
      <p className="av-muted">Your chosen architectural path</p>
      <nav aria-label="Walkthrough path">
        <ol>
          {path.nodeIds.map((id, index) => (
            <li key={index}>
              <button
                type="button"
                aria-current={
                  index === path.nodeIds.length - 1 ? 'step' : undefined
                }
                onClick={() =>
                  onChange({
                    ...path.state,
                    edgeKeys: path.state.edgeKeys.slice(0, index),
                  })
                }
              >
                {index + 1}. {getNode(graph, id)?.label ?? id}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className="av-walk-actions">
        <button
          type="button"
          disabled={!path.state.edgeKeys.length}
          onClick={() =>
            onChange({
              ...path.state,
              edgeKeys: path.state.edgeKeys.slice(0, -1),
            })
          }
        >
          Previous
        </button>
        <button
          type="button"
          disabled={
            !currentVisible ||
            !outgoing.some(({ edge }) => visibleIds.has(edge.target))
          }
          onClick={() =>
            outgoing.length === 1
              ? advance(outgoing[0]!.key)
              : setChoosingFor(signature)
          }
        >
          Next
        </button>
        <button type="button" onClick={() => onChange(null)}>
          Reset walkthrough
        </button>
      </div>
      {!currentVisible && (
        <p role="status">
          Current step is hidden by the view. Go back or adjust filters or
          expand groups.
        </p>
      )}
      {currentVisible && !outgoing.length && (
        <p role="status">End of path. Go back to explore another direction.</p>
      )}
      {currentVisible &&
        outgoing.length > 0 &&
        !outgoing.some(({ edge }) => visibleIds.has(edge.target)) && (
          <p role="status">Next steps are hidden by the view.</p>
        )}
      {choosingFor === signature && (
        <div
          className="av-walk-choices"
          role="group"
          aria-label="Choose next relationship"
        >
          {outgoing.map(({ edge, key, index }) => (
            <button
              type="button"
              key={key}
              disabled={!visibleIds.has(edge.target)}
              onClick={() => advance(key)}
            >
              {edge.label ?? edge.type ?? 'relationship'} →{' '}
              {getNode(graph, edge.target)?.label ?? edge.target} ·{' '}
              {edge.id ?? `#${index + 1}`}
              {!visibleIds.has(edge.target) ? ' (hidden)' : ''}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
