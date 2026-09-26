import { describe, expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import { retainNodePositions, resolveNodePositions } from './positions.js';
import type { Position3 } from './layout.js';

const graph: ArchitectureGraph = {
  version: '1.0',
  nodes: [
    { id: 'a', label: 'A', type: 'custom' },
    { id: '__proto__', label: 'B', type: 'custom' },
  ],
  edges: [],
  groups: [],
};
describe('position overrides', () => {
  it('ignores removed IDs, copies values, and supports arbitrary node IDs', () => {
    const input = JSON.parse('{"a":[2,3,4],"__proto__":[1,2,3],"old":[0,0,0]}');
    const retained = retainNodePositions(graph, input);
    expect(Object.keys(retained)).toEqual(['a', '__proto__']);
    expect(retained.a).not.toBe(input.a);
    const base = new Map<string, Position3>([
      ['a', [0, 0, 0]],
      ['__proto__', [5, 0, 0]],
    ]);
    const result = resolveNodePositions(base, retained);
    expect(result.get('__proto__')).toEqual([1, 2, 3]);
    expect(base.get('a')).toEqual([0, 0, 0]);
    result.get('a')![0] = 20;
    expect(retained.a).toEqual([2, 3, 4]);
  });
  it('rejects non-finite or malformed known-node positions', () => {
    expect(() => retainNodePositions(graph, { a: [NaN, 0, 0] })).toThrow(
      'finite',
    );
    expect(() =>
      retainNodePositions(graph, { a: [0, 1] as unknown as Position3 }),
    ).toThrow('finite');
  });
});
