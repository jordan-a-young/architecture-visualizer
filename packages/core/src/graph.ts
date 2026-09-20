import type { ArchitectureGraph, ArchitectureNode } from './schema.js';
export const getNode = (graph: ArchitectureGraph, id: string) =>
  graph.nodes.find((node) => node.id === id);
export const getOutgoingEdges = (graph: ArchitectureGraph, id: string) =>
  graph.edges.filter((edge) => edge.source === id);
export const getIncomingEdges = (graph: ArchitectureGraph, id: string) =>
  graph.edges.filter((edge) => edge.target === id);
const byIds = (graph: ArchitectureGraph, ids: Set<string>) =>
  graph.nodes.filter((node) => ids.has(node.id));
/** Direct outgoing targets, deduplicated in graph node order. */
export const getDependencies = (graph: ArchitectureGraph, id: string) =>
  byIds(graph, new Set(getOutgoingEdges(graph, id).map((edge) => edge.target)));
/** Direct incoming sources, deduplicated in graph node order. */
export const getDependents = (graph: ArchitectureGraph, id: string) =>
  byIds(graph, new Set(getIncomingEdges(graph, id).map((edge) => edge.source)));
export const getNeighbors = (graph: ArchitectureGraph, id: string) =>
  byIds(
    graph,
    new Set(
      [...getDependencies(graph, id), ...getDependents(graph, id)]
        .map((node) => node.id)
        .filter((nodeId) => nodeId !== id),
    ),
  );
export interface GraphFilterOptions {
  nodeIds?: readonly string[];
  types?: readonly string[];
  groupIds?: readonly string[];
  tags?: readonly string[];
  query?: string;
  predicate?: (node: ArchitectureNode) => boolean;
}
/** AND across filters; OR within each list. Empty lists match nothing. Preserves ancestor groups. */
export function filterGraph(
  graph: ArchitectureGraph,
  options: GraphFilterOptions = {},
): ArchitectureGraph {
  const query = options.query?.trim().toLowerCase();
  const nodes = graph.nodes.filter(
    (node) =>
      (!options.nodeIds || options.nodeIds.includes(node.id)) &&
      (!options.types || options.types.includes(node.type)) &&
      (!options.groupIds ||
        (node.group !== undefined && options.groupIds.includes(node.group))) &&
      (!options.tags || options.tags.some((tag) => node.tags?.includes(tag))) &&
      (!query ||
        `${node.label} ${node.type} ${node.description ?? ''}`
          .toLowerCase()
          .includes(query)) &&
      (!options.predicate || options.predicate(node)),
  );
  const ids = new Set(nodes.map((node) => node.id));
  const groupIds = new Set(
    nodes.flatMap((node) => (node.group ? [node.group] : [])),
  );
  const groupMap = new Map(graph.groups.map((group) => [group.id, group]));
  for (const id of groupIds) {
    const parent = groupMap.get(id)?.parent;
    if (parent) groupIds.add(parent);
  }
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter(
      (edge) => ids.has(edge.source) && ids.has(edge.target),
    ),
    groups: graph.groups.filter((group) => groupIds.has(group.id)),
  };
}
/** Undirected breadth-first neighborhood. Depth 0 returns the seed; omitted depth returns its component. */
export function getConnectedSubgraph(
  graph: ArchitectureGraph,
  id: string,
  depth = Infinity,
): ArchitectureGraph {
  if (depth !== Infinity && (!Number.isInteger(depth) || depth < 0))
    throw new RangeError('depth must be a non-negative integer or Infinity');
  if (!getNode(graph, id)) return filterGraph(graph, { nodeIds: [] });
  const adjacency = new Map(
    graph.nodes.map((node) => [node.id, new Set<string>()]),
  );
  for (const edge of graph.edges) {
    if (adjacency.has(edge.source) && adjacency.has(edge.target)) {
      adjacency.get(edge.source)?.add(edge.target);
      adjacency.get(edge.target)?.add(edge.source);
    }
  }
  const visited = new Set([id]);
  const queue: [string, number][] = [[id, 0]];
  for (let index = 0; index < queue.length; index++) {
    const [current, distance] = queue[index]!;
    if (distance >= depth) continue;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, distance + 1]);
      }
    }
  }
  return filterGraph(graph, { nodeIds: [...visited] });
}
