import type { ArchitectureGraph } from 'archgraph-core';
import type { LayoutResult, Position3 } from './layout.js';
import type { NodePositions } from './types.js';

/** Drop removed nodes and copy tuples so caller-owned view state is never mutated. */
export function retainNodePositions(
  graph: ArchitectureGraph,
  positions: NodePositions,
): NodePositions {
  return Object.fromEntries(
    graph.nodes.flatMap((node) => {
      if (!Object.hasOwn(positions, node.id)) return [];
      const position = positions[node.id];
      if (
        !position ||
        position.length !== 3 ||
        !position.every(Number.isFinite)
      )
        throw new Error(
          `Position for node "${node.id}" must be a finite [x, y, z] tuple.`,
        );
      return [[node.id, [...position] as Position3]];
    }),
  );
}

export function resolveNodePositions(
  base: LayoutResult,
  overrides: NodePositions,
): LayoutResult {
  return new Map(
    [...base].map(([id, position]) => [
      id,
      Object.hasOwn(overrides, id)
        ? ([...overrides[id]!] as Position3)
        : position,
    ]),
  );
}
