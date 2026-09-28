import { describe, expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import { createElkLayout } from './elk.js';
import { getEdgeKey } from './edgeKey.js';
import { validateLayoutGeometry } from './layout.js';

const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [
    { id: 'root', label: 'Deployment' },
    { id: 'child', label: 'Services', parent: 'root' },
  ],
  nodes: ['root', 'g0', 'n0', 'e0', 'orphan'].map((id, i) => ({
    id,
    label: id,
    type: 'custom',
    group: i < 2 ? 'child' : i < 4 ? 'root' : undefined,
  })),
  edges: [
    { id: '1', source: 'root', target: 'g0' },
    { id: '2', source: 'g0', target: 'n0' },
    { id: '3', source: 'n0', target: 'root' },
    { id: '4', source: 'n0', target: 'n0' },
    { id: '5', source: 'root', target: 'g0' },
    { id: '6', source: 'orphan', target: 'e0' },
  ],
};
describe('optional ELK adapter', () => {
  it('lays out nested, cyclic, parallel and disconnected graphs without mutating input', async () => {
    const before = structuredClone(graph);
    const engine = createElkLayout();
    const result = validateLayoutGeometry(graph, await engine.compute(graph));
    expect(result.positions.size).toBe(5);
    expect(result.edgePaths?.size).toBe(6);
    for (const [i, edge] of graph.edges.entries()) {
      const path = result.edgePaths!.get(getEdgeKey(edge, i))!;
      for (const [id, p] of [
        [edge.source, path[0]!],
        [edge.target, path.at(-1)!],
      ] as const) {
        const center = result.positions.get(id)!;
        expect(Math.abs(p[0] - center[0])).toBeLessThanOrEqual(0.701);
        expect(Math.abs(p[2] - center[2])).toBeLessThanOrEqual(0.701);
      }
    }
    expect(graph).toEqual(before);
    expect(await engine.compute(graph)).toEqual(result);
    expect(
      await engine.compute({
        ...graph,
        nodes: [...graph.nodes].reverse(),
        edges: [...graph.edges].reverse(),
        groups: [...graph.groups].reverse(),
      }),
    ).toEqual(result);
  });
  it('supports direction, spacing, custom footprints and empty groups', async () => {
    const simple = {
      ...graph,
      groups: [],
      nodes: graph.nodes.slice(0, 2).map((n) => ({ ...n, group: undefined })),
      edges: graph.edges.slice(0, 1),
    };
    const right = await createElkLayout({
      nodeSize: () => ({ width: 3, depth: 2 }),
    }).compute(simple);
    const down = await createElkLayout({
      direction: 'DOWN',
      spacing: 4,
      layerSpacing: 8,
    }).compute(simple);
    expect(right.positions.get('g0')![0]).toBeGreaterThan(
      right.positions.get('root')![0],
    );
    expect(down.positions.get('g0')![2]).toBeGreaterThan(
      down.positions.get('root')![2],
    );
    expect(right.nodeSizes!.get('root')).toEqual({ width: 3, depth: 2 });
    expect(
      (await createElkLayout().compute({ ...graph, nodes: [], edges: [] }))
        .positions.size,
    ).toBe(0);
    expect(() => createElkLayout({ spacing: NaN })).toThrow('spacing');
    await expect(
      createElkLayout({ nodeSize: () => ({ width: 0, depth: 2 }) }).compute(
        simple,
      ),
    ).rejects.toThrow('sizes');
  });
  it('exposes host-owned runners and validates invalid geometry', async () => {
    await expect(
      createElkLayout({
        runner: {
          layout: async () => {
            throw new Error('worker stopped');
          },
        },
      }).compute(graph),
    ).rejects.toThrow('worker stopped');
    expect(() =>
      validateLayoutGeometry(
        { ...graph, nodes: [] },
        {
          positions: new Map(),
          edgePaths: new Map([
            [
              'bad',
              [
                [NaN, 0, 0],
                [0, 0, 0],
              ],
            ],
          ]),
        },
      ),
    ).toThrow('paths');
  });
});
