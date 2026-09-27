import { expect, it } from 'vitest';
import { parseViewState } from './viewState.js';
const view = {
  version: 1,
  camera: { position: [0, 10, 10], target: [0, 0, 0] },
  filters: { types: ['service'] },
  nodePositions: { a: [1, 0, 2] },
  selectedNodeId: 'a',
  selectedEdgeKey: null,
  walkthrough: { startNodeId: 'a', edgeKeys: [] },
};
it('parses saved JSON into detached data without prototype-sensitive writes', () => {
  const parsed = parseViewState(view);
  parsed.nodePositions.a![0] = 9;
  expect(view.nodePositions.a).toEqual([1, 0, 2]);
  expect(parseViewState(JSON.parse(JSON.stringify(view)))).toEqual({
    ...view,
    collapsedGroupIds: [],
  });
  const special = parseViewState({
    ...view,
    nodePositions: JSON.parse('{"__proto__":[1,2,3]}'),
  });
  expect(Object.hasOwn(special.nodePositions, '__proto__')).toBe(true);
});
it('rejects invalid versions, camera state, positions, functions and unknown fields', () => {
  for (const invalid of [
    { ...view, version: 2 },
    { ...view, camera: { position: [0, 0, 0], target: [0, 0, 0] } },
    { ...view, nodePositions: { a: [NaN, 0, 1] } },
    { ...view, filters: { predicate: () => true } },
    { ...view, extra: 1 },
    { ...view, walkthrough: { startNodeId: 1, edgeKeys: [] } },
  ])
    expect(() => parseViewState(invalid)).toThrow();
});
