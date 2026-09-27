import type { ArchitectureGraph } from 'archgraph-core';
import type { WalkthroughState } from './types.js';
import { getEdgeKey } from './edgeKey.js';
/** Resolve a user-chosen path, retaining only its valid prefix after graph changes. */
export function resolveWalkthrough(
  graph: ArchitectureGraph,
  state: WalkthroughState | null,
) {
  if (!state || !graph.nodes.some((node) => node.id === state.startNodeId))
    return null;
  const byKey = new Map(
    graph.edges.map((edge, index) => [getEdgeKey(edge, index), edge]),
  );
  const nodeIds = [state.startNodeId];
  const edgeKeys: string[] = [];
  for (const key of state.edgeKeys) {
    const edge = byKey.get(key);
    if (
      !edge ||
      edge.source !== nodeIds.at(-1) ||
      !graph.nodes.some((node) => node.id === edge.target)
    )
      break;
    edgeKeys.push(key);
    nodeIds.push(edge.target);
  }
  return {
    state: { startNodeId: state.startNodeId, edgeKeys },
    nodeIds,
    currentNodeId: nodeIds.at(-1)!,
  };
}
