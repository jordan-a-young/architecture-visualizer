import { describe, expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import { computeLayout, layeredLayout } from './layout.js';
const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [],
  nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id, label: id, type: 'custom' })),
  edges: [
    { source: 'a', target: 'b' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'a' },
  ],
};
describe('layout', () => {
  it('is deterministic, cycle-safe, unique, and complete for disconnected graphs', () => {
    const before = structuredClone(graph);
    const result = layeredLayout(graph);
    expect(result).toEqual(layeredLayout(graph));
    expect(result.size).toBe(4);
    expect(
      new Set([...result.values()].map((p) => JSON.stringify(p))).size,
    ).toBe(4);
    expect(graph).toEqual(before);
  });
  it('orders acyclic dependencies from left to right and handles empty graphs', () => {
    const result = layeredLayout({ ...graph, edges: graph.edges.slice(0, 2) });
    expect(result.get('a')![0]).toBeLessThan(result.get('b')![0]);
    expect(result.get('b')![0]).toBeLessThan(result.get('c')![0]);
    expect(layeredLayout({ ...graph, nodes: [], edges: [] }).size).toBe(0);
  });
  it('supports custom layout and rejects missing or invalid positions', () => {
    expect(
      computeLayout(
        graph,
        () => new Map(graph.nodes.map((n) => [n.id, [1, 2, 3]])),
      ),
    ).toHaveProperty('size', 4);
    expect(() => computeLayout(graph, () => new Map())).toThrow(
      'Layout must return',
    );
    expect(() =>
      computeLayout(
        graph,
        () => new Map(graph.nodes.map((n) => [n.id, [NaN, 2, 3]])),
      ),
    ).toThrow('finite');
  });
});
