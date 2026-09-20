import { useMemo } from 'react';
import { filterGraph } from 'archgraph-core';
import type { ArchitectureGraph, GraphFilterOptions } from 'archgraph-core';
export function useFilteredGraph(
  graph: ArchitectureGraph,
  filters?: GraphFilterOptions,
): ArchitectureGraph {
  return useMemo(() => filterGraph(graph, filters), [graph, filters]);
}
