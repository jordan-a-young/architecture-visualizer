import { describe, expect, it } from 'vitest';
import {
  ArchitectureGraphSchema,
  validateGraph,
  validateGraphSemantics,
  isSafeHref,
  getNode,
  getOutgoingEdges,
  getIncomingEdges,
  getDependencies,
  getDependents,
  getNeighbors,
  getConnectedSubgraph,
  filterGraph,
} from './index.js';
import type { ArchitectureGraph } from './index.js';
const fixture = (): ArchitectureGraph => ({
  version: '1.0',
  metadata: { owner: 'demo' },
  groups: [
    { id: 'root', label: 'Root' },
    { id: 'team', label: 'Team', parent: 'root' },
    { id: 'unused', label: 'Unused' },
  ],
  nodes: [
    {
      id: 'a',
      label: 'Application',
      type: 'app',
      group: 'team',
      tags: ['public'],
    },
    {
      id: 'b',
      label: 'Service',
      type: 'service',
      description: 'Business logic',
    },
    { id: 'c', label: 'Store', type: 'database' },
    { id: 'd', label: 'Detached', type: 'custom' },
  ],
  edges: [
    { source: 'a', target: 'b', type: 'calls' },
    { source: 'a', target: 'b', type: 'observes' },
    { source: 'b', target: 'c' },
    { source: 'c', target: 'a' },
  ],
});
describe('schema', () => {
  it('accepts arbitrary types, nested metadata, visual config and generic links', () => {
    const graph = fixture();
    graph.nodes[0] = {
      ...graph.nodes[0]!,
      type: 'anything/custom',
      metadata: { nested: { array: [1, null] } },
      visual: { color: '#abcdef', size: 1.2 },
      links: [{ label: 'Readme', href: '/docs', external: false }],
    };
    graph.edges[0]!.visual = { color: '#123456', width: 2, dashed: true };
    expect(ArchitectureGraphSchema.parse(graph)).toEqual(graph);
  });
  it.each([
    null,
    {},
    { ...fixture(), version: '2.0' },
    { ...fixture(), nodes: [{ label: 'no id', type: 'x' }] },
    { ...fixture(), edges: [{ source: 'a' }] },
    { ...fixture(), groups: null },
  ])('rejects malformed input %j', (input) => {
    const result = validateGraph(input);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.type).toBe('schema');
  });
  it.each([
    'javascript:alert(1)',
    'data:text/html,hi',
    '//evil.test',
    ' https://example.com',
    'java\nscript:alert(1)',
    'https://',
    '\\evil.test',
    'https://example.com/a b',
  ])('rejects unsafe or malformed href %s', (href) => {
    const graph = fixture();
    graph.nodes[0]!.links = [{ label: 'Unsafe', href }];
    expect(validateGraph(graph).valid).toBe(false);
  });
  it.each([
    'https://example.com',
    'http://localhost:3000',
    '/docs/a',
    './readme',
    '../docs',
    '#part',
    'mailto:team@example.com',
  ])('accepts safe link %s', (href) => expect(isSafeHref(href)).toBe(true));
  it('rejects unknown structural fields and invalid visual values', () => {
    expect(
      ArchitectureGraphSchema.safeParse({ ...fixture(), awsRegion: 'x' })
        .success,
    ).toBe(false);
    const graph = fixture();
    graph.nodes[0]!.visual = { size: -1 };
    expect(validateGraph(graph).valid).toBe(false);
  });
});
describe('semantic validation', () => {
  it('allows directed cycles and reports orphans as info', () => {
    const result = validateGraph(fixture());
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([
      {
        severity: 'info',
        type: 'orphan-node',
        nodeId: 'd',
        message: 'Node has no relationships.',
      },
    ]);
  });
  it('reports all invalid references and duplicate identifiers', () => {
    const graph = fixture();
    graph.nodes.push(
      { ...graph.nodes[0]! },
      { id: 'e', label: 'E', type: 'x', group: 'missing' },
    );
    graph.groups.push({ id: 'team', label: 'Duplicate', parent: 'missing' });
    graph.edges.push(
      { id: 'e', source: 'missing', target: 'a' },
      { id: 'e', source: 'a', target: 'missing' },
    );
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.type)).toEqual(
      expect.arrayContaining([
        'duplicate-node-id',
        'duplicate-group-id',
        'duplicate-edge-id',
        'missing-source',
        'missing-target',
        'unknown-group',
        'unknown-parent-group',
      ]),
    );
  });
  it('warns for duplicate and self edges without invalidating graph', () => {
    const graph = fixture();
    graph.edges.push({ ...graph.edges[0]! }, { source: 'a', target: 'a' });
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
    expect(
      result.issues.filter((i) => i.severity === 'warning').map((i) => i.type),
    ).toEqual(['duplicate-edge', 'self-edge']);
  });
  it('allows parallel relationships with different types or labels', () => {
    const graph = fixture();
    graph.edges.push({
      source: 'a',
      target: 'b',
      type: 'calls',
      label: 'admin',
    });
    expect(
      validateGraphSemantics(graph).some((i) => i.type === 'duplicate-edge'),
    ).toBe(false);
  });
  it('rejects group ancestry cycles, including self parents', () => {
    const graph = fixture();
    graph.groups[0]!.parent = 'team';
    expect(validateGraph(graph).valid).toBe(false);
    graph.groups[0]!.parent = 'root';
    expect(
      validateGraphSemantics(graph).some((i) => i.type === 'group-cycle'),
    ).toBe(true);
  });
  it('does not count a dangling relationship as connectivity', () => {
    const graph = fixture();
    graph.edges.push({ source: 'd', target: 'unknown' });
    expect(
      validateGraphSemantics(graph).some(
        (i) => i.nodeId === 'd' && i.type === 'orphan-node',
      ),
    ).toBe(true);
  });
});
describe('utilities', () => {
  it('looks up nodes and directional edges', () => {
    const graph = fixture();
    expect(getNode(graph, 'a')?.label).toBe('Application');
    expect(getNode(graph, 'missing')).toBeUndefined();
    expect(getOutgoingEdges(graph, 'a')).toHaveLength(2);
    expect(getIncomingEdges(graph, 'a')).toHaveLength(1);
  });
  it('deduplicates dependencies, dependents and neighbors', () => {
    const graph = fixture();
    expect(getDependencies(graph, 'a').map((n) => n.id)).toEqual(['b']);
    expect(getDependents(graph, 'b').map((n) => n.id)).toEqual(['a']);
    expect(getNeighbors(graph, 'a').map((n) => n.id)).toEqual(['b', 'c']);
    graph.edges.push({ source: 'a', target: 'a' });
    expect(getNeighbors(graph, 'a').map((n) => n.id)).toEqual(['b', 'c']);
  });
  it('traverses cyclic components with depth bounds and missing roots', () => {
    const graph = fixture();
    expect(getConnectedSubgraph(graph, 'a').nodes.map((n) => n.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(getConnectedSubgraph(graph, 'a', 0).nodes.map((n) => n.id)).toEqual([
      'a',
    ]);
    expect(getConnectedSubgraph(graph, 'a', 1).nodes).toHaveLength(3);
    expect(getConnectedSubgraph(graph, 'missing').nodes).toEqual([]);
    expect(getConnectedSubgraph(graph, 'd').nodes).toHaveLength(1);
    for (const depth of [-1, 0.5, NaN])
      expect(() => getConnectedSubgraph(graph, 'a', depth)).toThrow(RangeError);
  });
  it('ignores dangling edges during traversal', () => {
    const graph = fixture();
    graph.edges.push({ source: 'a', target: 'missing' });
    expect(getConnectedSubgraph(graph, 'a').edges).toHaveLength(4);
  });
  it('retains induced edges and all ancestor groups', () => {
    const result = filterGraph(fixture(), { nodeIds: ['a', 'b'] });
    expect(result.edges).toHaveLength(2);
    expect(result.groups.map((g) => g.id)).toEqual(['root', 'team']);
    expect(result.metadata).toEqual({ owner: 'demo' });
  });
  it('filters by type, group, tag, query and predicate', () => {
    const graph = fixture();
    expect(
      filterGraph(graph, { types: ['service'], query: ' BUSINESS ' }).nodes.map(
        (n) => n.id,
      ),
    ).toEqual(['b']);
    expect(
      filterGraph(graph, {
        groupIds: ['team'],
        tags: ['public'],
        predicate: (n) => n.id === 'a',
      }).nodes.map((n) => n.id),
    ).toEqual(['a']);
    expect(filterGraph(graph, { tags: ['missing'] }).nodes).toEqual([]);
    expect(filterGraph(graph, { predicate: () => false }).nodes).toEqual([]);
    expect(filterGraph(graph, { types: [] }).nodes).toEqual([]);
    expect(filterGraph(graph).nodes).toHaveLength(4);
  });
  it('terminates on invalid group cycles and does not mutate input', () => {
    const graph = fixture();
    graph.groups[0]!.parent = 'team';
    const before = structuredClone(graph);
    filterGraph(graph, { nodeIds: ['a'] });
    getConnectedSubgraph(graph, 'a');
    expect(graph).toEqual(before);
  });
});
