import { describe, expect, it } from 'vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import { resolveWalkthrough } from './walkthrough.js';
import { getEdgeKey } from './edgeKey.js';
const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [],
  nodes: ['a', 'b', 'c'].map((id) => ({ id, label: id, type: 'service' })),
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'ba', source: 'b', target: 'a' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
};
const keys = graph.edges.map(getEdgeKey);
describe('walkthrough paths', () => {
  it('preserves loops and repeated steps without changing input', () => {
    const state = {
      startNodeId: 'a',
      edgeKeys: [keys[0]!, keys[1]!, keys[0]!],
    };
    expect(resolveWalkthrough(graph, state)?.nodeIds).toEqual([
      'a',
      'b',
      'a',
      'b',
    ]);
    expect(state.edgeKeys).toHaveLength(3);
  });
  it('truncates invalid, disconnected and removed edges and rejects missing starts', () => {
    expect(
      resolveWalkthrough(graph, {
        startNodeId: 'a',
        edgeKeys: [keys[0]!, 'missing', keys[2]!],
      })?.state.edgeKeys,
    ).toEqual([keys[0]]);
    expect(
      resolveWalkthrough(graph, { startNodeId: 'a', edgeKeys: [keys[2]!] })
        ?.nodeIds,
    ).toEqual(['a']);
    expect(
      resolveWalkthrough(graph, { startNodeId: 'missing', edgeKeys: [] }),
    ).toBeNull();
  });
});
