import type { ArchitectureGraph, ArchitectureGroup } from 'archgraph-core';
import type { LayoutResult, NodeSize } from './layout.js';
import { nodeFootprints } from './routing.js';
import type { Footprint } from './routing.js';
export interface GroupBoundary extends Footprint {
  group: ArchitectureGroup;
  depth: number;
  floor: number;
  count: number;
}
/** Bounds follow current visible positions, including collapsed child summaries. */
export function getGroupBoundaries(
  graph: ArchitectureGraph,
  positions: LayoutResult,
  proxies: ReadonlyMap<string, ArchitectureGroup> = new Map(),
  sizes?: ReadonlyMap<string, NodeSize>,
): GroupBoundary[] {
  const footprints = new Map(
    nodeFootprints(graph, positions, sizes).map((r) => [r.id, r]),
  );
  const result: GroupBoundary[] = [];
  const build = (
    group: ArchitectureGroup,
    depth: number,
  ): GroupBoundary | null => {
    const children = graph.groups
      .filter((g) => g.parent === group.id)
      .map((g) => build(g, depth + 1))
      .filter((v): v is GroupBoundary => v !== null);
    const members = graph.nodes.filter(
      (n) =>
        (proxies.get(n.id)?.parent ??
          (proxies.has(n.id) ? undefined : n.group)) === group.id,
    );
    const rectangles = [
      ...children,
      ...members.map((n) => footprints.get(n.id)!),
    ];
    if (!rectangles.length) return null;
    const minY = Math.min(
      0,
      ...members.map((n) => positions.get(n.id)![1]),
      ...children.map((c) => c.floor + 0.65),
    );
    const boundary: GroupBoundary = {
      id: group.id,
      group,
      depth,
      count: members.length + children.reduce((n, c) => n + c.count, 0),
      minX: Math.min(...rectangles.map((r) => r.minX)) - 1.15,
      maxX: Math.max(...rectangles.map((r) => r.maxX)) + 1.15,
      minZ: Math.min(...rectangles.map((r) => r.minZ)) - 1.8,
      maxZ: Math.max(...rectangles.map((r) => r.maxZ)) + 1.15,
      floor: minY - 0.65 - (graph.groups.length - depth) * 0.015,
    };
    // A collapsed group's summary belongs to its parent, with no expanded boundary of its own.
    if ([...proxies.values()].some((p) => p.id === group.id)) return null;
    result.push(boundary);
    return boundary;
  };
  for (const group of graph.groups.filter((g) => !g.parent)) build(group, 0);
  return result.sort((a, b) => a.depth - b.depth || (a.id < b.id ? -1 : 1));
}
