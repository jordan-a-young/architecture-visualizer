import type { ArchitectureEdge } from 'archgraph-core';
/** Stable for explicit IDs; anonymous edges use their index in the full graph. */
export function getEdgeKey(edge: ArchitectureEdge, index: number): string {
  return JSON.stringify(
    edge.id === undefined ? ['index', index] : ['id', edge.id],
  );
}
