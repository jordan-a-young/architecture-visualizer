import type {
  ArchitectureGraph,
  ArchitectureNode,
  ArchitectureEdge,
  ArchitectureGroup,
} from 'archgraph-core';
import type { LayoutResult, Position3 } from './layout.js';

/** Scene-only projection. Original node/edge objects remain the inspection source. */
export function projectGroups(
  graph: ArchitectureGraph,
  collapsedIds: readonly string[],
  positions: LayoutResult,
  reservedNodeIds: readonly string[],
) {
  const groups = new Map(graph.groups.map((group) => [group.id, group]));
  const collapsed = new Set(collapsedIds);
  const members = new Map<string, ArchitectureNode[]>();
  const owners = new Map<string, string>();
  for (const node of graph.nodes) {
    let current = node.group;
    let owner: string | undefined;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      if (collapsed.has(current) && groups.has(current)) owner = current;
      current = groups.get(current)?.parent;
    }
    if (owner) {
      owners.set(node.id, owner);
      members.set(owner, [...(members.get(owner) ?? []), node]);
    }
  }
  const used = new Set(reservedNodeIds);
  const proxies = new Map<string, ArchitectureGroup>();
  const proxyIds = new Map<string, string>();
  const resultPositions = new Map(positions);
  const nodes = graph.nodes.filter((node) => !owners.has(node.id));
  for (const [groupId, children] of members) {
    let id = `group:${groupId}`;
    while (used.has(id)) id = `_${id}`;
    used.add(id);
    proxyIds.set(groupId, id);
    const group = groups.get(groupId)!;
    proxies.set(id, group);
    nodes.push({
      id,
      label: group.label,
      type: 'group',
      description: group.description,
      visual: { size: 1.4, color: '#78899e' },
    });
    const center: Position3 = [0, 0, 0];
    for (const node of children) {
      const p = positions.get(node.id)!;
      for (let i = 0; i < 3; i++) center[i]! += p[i]! / children.length;
      resultPositions.delete(node.id);
    }
    resultPositions.set(id, center);
  }
  const originals = new Map<ArchitectureEdge, ArchitectureEdge>();
  const edges = graph.edges.flatMap((edge) => {
    const source = proxyIds.get(owners.get(edge.source) ?? '') ?? edge.source;
    const target = proxyIds.get(owners.get(edge.target) ?? '') ?? edge.target;
    if (source === target && (source !== edge.source || target !== edge.target))
      return [];
    const projected =
      source === edge.source && target === edge.target
        ? edge
        : { ...edge, source, target };
    originals.set(projected, edge);
    return [projected];
  });
  return {
    graph: { ...graph, nodes, edges },
    positions: resultPositions,
    proxies,
    members,
    originals,
  };
}
