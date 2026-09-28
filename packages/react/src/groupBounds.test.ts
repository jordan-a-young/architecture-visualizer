import { describe, expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import type { Position3 } from './layout.js';
import { getGroupBoundaries } from './groupBounds.js';
import { projectGroups } from './groups.js';
const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [
    { id: 'deployment', label: 'Deployment' },
    { id: 'services', label: 'Services', parent: 'deployment' },
    { id: 'empty', label: 'Empty' },
  ],
  nodes: [
    { id: 'a', label: 'A', type: 'service', group: 'services' },
    { id: 'b', label: 'B', type: 'service', group: 'deployment' },
    { id: 'c', label: 'C', type: 'service' },
  ],
  edges: [],
};
const positions = new Map<string, Position3>([
  ['a', [0, 0, 0]],
  ['b', [6, 0, 0]],
  ['c', [12, 0, 0]],
]);
describe('generic deployment boundaries', () => {
  it('encloses descendants with nested padding and excludes ungrouped nodes', () => {
    const boundaries = getGroupBoundaries(graph, positions);
    expect(boundaries.map((b) => b.id)).toEqual(['deployment', 'services']);
    const [parent, child] = boundaries;
    expect(parent!.minX).toBeLessThan(child!.minX);
    expect(parent!.maxZ).toBeGreaterThan(child!.maxZ);
    expect(parent!.maxX).toBeLessThan(positions.get('c')![0]);
    expect(parent!.floor).toBeLessThan(child!.floor);
  });
  it('follows dragged nodes, filters and nested collapsed summaries', () => {
    const moved = new Map(positions);
    moved.set('a', [-20, 0, 4]);
    expect(getGroupBoundaries(graph, moved)[0]!.minX).toBeLessThan(-20);
    const projected = projectGroups(
      graph,
      ['services'],
      positions,
      graph.nodes.map((n) => n.id),
    );
    expect(
      getGroupBoundaries(
        projected.graph,
        projected.positions,
        projected.proxies,
      ).map((b) => b.id),
    ).toEqual(['deployment']);
    const all = projectGroups(
      graph,
      ['deployment'],
      positions,
      graph.nodes.map((n) => n.id),
    );
    expect(getGroupBoundaries(all.graph, all.positions, all.proxies)).toEqual(
      [],
    );
    expect(
      getGroupBoundaries({ ...graph, nodes: graph.nodes.slice(2) }, positions),
    ).toEqual([]);
  });
});
