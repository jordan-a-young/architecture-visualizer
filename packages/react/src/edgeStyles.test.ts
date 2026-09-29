import { describe, expect, it } from 'vitest';
import type { ArchitectureEdge } from 'archgraph-core';
import {
  defaultEdgeStyle,
  getRelationshipLegend,
  resolveEdgeStyle,
} from './edgeStyles.js';
import { getEdgeKey } from './edgeKey.js';
import type { RelationshipStyleRegistry } from './types.js';

const edge: ArchitectureEdge = {
  source: 'a',
  target: 'b',
  type: 'custom-flow',
};
const styles: RelationshipStyleRegistry = {
  'custom-flow': {
    label: 'Custom flow',
    description: 'Application-defined meaning',
    color: '#123456',
    width: 2,
    lineStyle: 'dotted',
  },
};
describe('relationship styles', () => {
  it('retains deterministic solid defaults and the exported legacy dashed flag', () => {
    expect(defaultEdgeStyle(edge.type)).toEqual(defaultEdgeStyle(edge.type));
    expect(defaultEdgeStyle(edge.type).dashed).toBe(false);
    expect(resolveEdgeStyle(edge).lineStyle).toBe('solid');
    expect(resolveEdgeStyle({ source: 'a', target: 'b' }).lineStyle).toBe(
      'solid',
    );
  });
  it('resolves type, graph visual and callback overrides without mutating input', () => {
    const visualEdge = { ...edge, visual: { color: '#abcdef', width: 3 } };
    const before = JSON.stringify([styles, visualEdge]);
    expect(resolveEdgeStyle(visualEdge, styles, { width: 4 })).toEqual({
      color: '#abcdef',
      width: 4,
      lineStyle: 'dotted',
    });
    expect(JSON.stringify([styles, visualEdge])).toBe(before);
  });
  it('allows later legacy flags to override patterns and explicit patterns to win within a layer', () => {
    expect(
      resolveEdgeStyle({ ...edge, visual: { dashed: true } }, styles).lineStyle,
    ).toBe('dashed');
    expect(
      resolveEdgeStyle({ ...edge, visual: { dashed: false } }, styles)
        .lineStyle,
    ).toBe('solid');
    expect(resolveEdgeStyle(edge, styles, { dashed: false }).lineStyle).toBe(
      'solid',
    );
    expect(
      resolveEdgeStyle(edge, styles, { dashed: true, lineStyle: 'dotted' })
        .lineStyle,
    ).toBe('dotted');
    expect(
      resolveEdgeStyle(edge, styles, {
        color: '#fedcba',
        lineStyle: undefined,
        dashed: undefined,
      }).lineStyle,
    ).toBe('dotted');
  });
  it('accepts arbitrary type names without consulting registry prototypes', () => {
    const inherited = Object.create({ 'custom-flow': { color: '#ffffff' } });
    expect(resolveEdgeStyle(edge, inherited)).toEqual(resolveEdgeStyle(edge));
    expect(resolveEdgeStyle({ ...edge, type: 'constructor' }, {})).toEqual(
      resolveEdgeStyle({ ...edge, type: 'constructor' }),
    );
    expect(
      resolveEdgeStyle(
        { ...edge, type: '__proto__' },
        JSON.parse('{"__proto__":{"lineStyle":"dotted"}}'),
      ).lineStyle,
    ).toBe('dotted');
  });
});

describe('legend style consistency', () => {
  it('groups actual visual variants and counts anonymous or parallel edges separately', () => {
    const edges: ArchitectureEdge[] = [
      edge,
      { ...edge },
      { ...edge, visual: { dashed: true } },
      { source: 'a', target: 'a' },
    ];
    const keys = new Map(edges.map((e, i) => [e, getEdgeKey(e, i)]));
    const resolved = new Map(
      edges.map((e) => [e, resolveEdgeStyle(e, styles)]),
    );
    const entries = getRelationshipLegend(edges, keys, resolved, styles);
    expect(entries).toHaveLength(3);
    expect(entries.find((e) => e.style.lineStyle === 'dotted')).toMatchObject({
      label: 'Custom flow',
      description: 'Application-defined meaning',
      edgeKeys: [keys.get(edges[0]!), keys.get(edges[1]!)],
    });
    expect(
      entries.find((e) => e.style.lineStyle === 'dashed')!.edgeKeys,
    ).toEqual([keys.get(edges[2]!)]);
    expect(
      entries.find((e) => e.label === 'Relationship')!.edgeKeys,
    ).toHaveLength(1);
  });
  it('reflects callback overrides and omits unused definitions', () => {
    const keys = new Map([[edge, 'key']]);
    const resolved = new Map([
      [
        edge,
        resolveEdgeStyle(edge, styles, {
          color: '#aabbcc',
          lineStyle: 'solid',
        }),
      ],
    ]);
    const entries = getRelationshipLegend([edge], keys, resolved, styles);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.style).toEqual({
      color: '#aabbcc',
      width: 2,
      lineStyle: 'solid',
    });
    expect(getRelationshipLegend([], new Map(), new Map(), styles)).toEqual([]);
  });
});
