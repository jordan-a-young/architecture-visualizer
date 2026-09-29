import { describe, expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import type { Position3 } from './layout.js';
import { layeredLayout } from './layout.js';
import {
  routeEdges,
  nodeFootprints,
  segmentHitsFootprint,
  countRouteCrossings,
} from './routing.js';
import { getEdgeKey } from './edgeKey.js';
import { createElkLayout } from './elk.js';
import { roundRoute, routeLabelPosition } from './routeGeometry.js';
const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [],
  nodes: ['a', 'b', 'obstacle'].map((id) => ({
    id,
    label: id,
    type: 'service',
  })),
  edges: [{ id: 'ab', source: 'a', target: 'b' }],
};
const positions = new Map<string, Position3>([
  ['a', [-5, 0, 0]],
  ['b', [5, 0, 0]],
  ['obstacle', [0, 0, 0]],
]);
describe('routing geometry', () => {
  it('routes around intervening nodes and keeps rounded paths outside their footprints', () => {
    const before = structuredClone(graph);
    const route = [...routeEdges(graph, positions).values()][0]!;
    expect(route.some((p) => Math.abs(p[2]) >= 1)).toBe(true);
    const obstacle = nodeFootprints(graph, positions).find(
      (r) => r.id === 'obstacle',
    )!;
    const rounded = roundRoute(route);
    expect(
      rounded
        .slice(1)
        .some((p, i) => segmentHitsFootprint(rounded[i]!, p, obstacle)),
    ).toBe(false);
    expect(graph).toEqual(before);
    expect(routeLabelPosition(route).every(Number.isFinite)).toBe(true);
  });
  it('keeps parallel, reverse and self-loop routes distinct and deterministic', () => {
    const g = {
      ...graph,
      edges: [
        ...graph.edges,
        { id: 'reverse', source: 'b', target: 'a' },
        { id: 'parallel', source: 'a', target: 'b' },
        { id: 'self', source: 'a', target: 'a' },
      ],
    };
    const paths = routeEdges(g, positions);
    expect(
      new Set([...paths.values()].map((p) => JSON.stringify(p))).size,
    ).toBe(4);
    expect(
      routeEdges({ ...g, edges: [...g.edges].reverse() }, positions),
    ).toEqual(paths);
    for (const path of paths.values())
      expect(path.flat().every(Number.isFinite)).toBe(true);
  });
  it('reuses valid engine paths and reroutes after an unrelated obstacle moves into them', () => {
    const base = new Map(positions);
    base.set('obstacle', [0, 0, 5]);
    const key = getEdgeKey(graph.edges[0]!, 0);
    const preferred: Position3[] = [
      [-4.3, 0, 0],
      [4.3, 0, 0],
    ];
    const options = {
      basePositions: base,
      preferredPaths: new Map([[key, preferred]]),
    };
    expect(routeEdges(graph, base, options).get(key)).toBe(preferred);
    expect(routeEdges(graph, positions, options).get(key)).not.toBe(preferred);
    const moved = new Map(base);
    moved.set('a', [-8, 0, 2]);
    expect(routeEdges(graph, moved, options).get(key)![0]![0]).toBeCloseTo(
      -7.3,
    );
  });
  it('handles overlapping pinned nodes with a finite overhead fallback', () => {
    const overlap = new Map(positions);
    overlap.set('obstacle', [-4.6, 0, 0]);
    const route = [...routeEdges(graph, overlap).values()][0]!;
    expect(route.some((p) => p[1] > 0)).toBe(true);
  });
  it('reduces crossings on a branching fixture compared with ID-ordered layers', async () => {
    const g: ArchitectureGraph = {
      version: '1.0',
      groups: [],
      nodes: ['root', 'a', 'b', 'c', 'd'].map((id) => ({
        id,
        label: id,
        type: 'service',
      })),
      edges: [
        { source: 'root', target: 'a' },
        { source: 'root', target: 'b' },
        { source: 'a', target: 'd' },
        { source: 'b', target: 'c' },
      ],
    };
    const old = layeredLayout(g);
    const baseline = g.edges.map((e) => [
      old.get(e.source)!,
      old.get(e.target)!,
    ]);
    const geometry = await createElkLayout().compute(g);
    expect(countRouteCrossings(baseline)).toBe(1);
    expect(countRouteCrossings([...geometry.edgePaths!.values()])).toBe(0);
  });
});
