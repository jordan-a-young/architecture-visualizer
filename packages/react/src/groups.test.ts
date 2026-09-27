import { expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import { projectGroups } from './groups.js';
import type { Position3 } from './layout.js';
const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [
    { id: 'parent', label: 'Domain' },
    { id: 'child', label: 'Services', parent: 'parent' },
    { id: 'empty', label: 'Empty' },
  ],
  nodes: [
    { id: 'a', label: 'A', type: 'service', group: 'child' },
    { id: 'b', label: 'B', type: 'service', group: 'parent' },
    { id: 'group:parent', label: 'C', type: 'database' },
  ],
  edges: [
    { source: 'a', target: 'b' },
    { source: 'a', target: 'group:parent', type: 'reads' },
    { source: 'b', target: 'group:parent', type: 'writes' },
    { source: 'group:parent', target: 'group:parent' },
  ],
};
const positions = new Map<string, Position3>([
  ['a', [0, 0, 0]],
  ['b', [4, 0, 0]],
  ['group:parent', [8, 0, 0]],
]);
it('collapses the outermost ancestor, keeps parallel boundary edges and real self loops, without mutating input', () => {
  const before = JSON.stringify(graph);
  const projected = projectGroups(
    graph,
    ['parent', 'child', 'empty'],
    positions,
    graph.nodes.map((n) => n.id),
  );
  expect(projected.graph.nodes.map((n) => n.id)).toEqual([
    'group:parent',
    '_group:parent',
  ]);
  expect(projected.positions.get('_group:parent')).toEqual([2, 0, 0]);
  expect(projected.graph.edges).toHaveLength(3);
  expect(projected.graph.edges.slice(0, 2).map((e) => e.source)).toEqual([
    '_group:parent',
    '_group:parent',
  ]);
  expect(projected.originals.get(projected.graph.edges[0]!)).toBe(
    graph.edges[1],
  );
  expect(JSON.stringify(graph)).toBe(before);
  expect(positions.size).toBe(3);
});
it('retains nested collapse when a parent expands and only summarizes filtered members', () => {
  const child = projectGroups(
    graph,
    ['child'],
    positions,
    graph.nodes.map((n) => n.id),
  );
  expect(child.graph.nodes.map((n) => n.id)).toEqual([
    'b',
    'group:parent',
    'group:child',
  ]);
  expect(child.graph.edges).toHaveLength(4);
  const filtered = { ...graph, nodes: [graph.nodes[0]!], edges: [] };
  const projected = projectGroups(
    filtered,
    ['parent'],
    new Map([['a', [0, 0, 0]]]),
    graph.nodes.map((n) => n.id),
  );
  expect(projected.members.get('parent')).toHaveLength(1);
  expect(projected.proxies.has('_group:parent')).toBe(true);
  expect(projectGroups(graph, [], positions, []).graph).toEqual(graph);
});
