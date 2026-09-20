import type { ArchitectureGraph } from 'archgraph-core';
export type Position3 = [number, number, number];
export type LayoutResult = ReadonlyMap<string, Position3>;
export type LayoutFunction = (graph: ArchitectureGraph) => LayoutResult;
export type Layout = 'layered' | LayoutFunction;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
/** Stable breadth-first layers. Cyclic/disconnected components get a deterministic seed. */
export const layeredLayout: LayoutFunction = (graph) => {
  const ordered = [...graph.nodes].sort(
    (a, b) => compare(a.group ?? '', b.group ?? '') || compare(a.id, b.id),
  );
  const outgoing = new Map(ordered.map((node) => [node.id, [] as string[]]));
  const incoming = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.source !== edge.target && outgoing.has(edge.target)) {
      outgoing.get(edge.source)?.push(edge.target);
      incoming.add(edge.target);
    }
  }
  const levels = new Map<string, number>();
  const queue: string[] = [];
  for (const node of ordered)
    if (!incoming.has(node.id)) {
      levels.set(node.id, 0);
      queue.push(node.id);
    }
  let cursor = 0;
  const drain = () => {
    while (cursor < queue.length) {
      const source = queue[cursor++]!;
      for (const target of outgoing.get(source) ?? [])
        if (!levels.has(target)) {
          levels.set(target, levels.get(source)! + 1);
          queue.push(target);
        }
    }
  };
  drain();
  for (const node of ordered)
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
      queue.push(node.id);
      drain();
    }
  const layers = new Map<number, string[]>();
  for (const node of ordered) {
    const level = levels.get(node.id)!;
    layers.set(level, [...(layers.get(level) ?? []), node.id]);
  }
  const positions = new Map<string, Position3>();
  const maxLevel = Math.max(0, ...layers.keys());
  for (const [level, ids] of layers)
    ids.forEach((id, row) =>
      positions.set(id, [
        (level - maxLevel / 2) * 5,
        0,
        (row - (ids.length - 1) / 2) * 4,
      ]),
    );
  return positions;
};
/** Fail clearly if a consumer's custom layout omits nodes or returns non-finite coordinates. */
export function computeLayout(
  graph: ArchitectureGraph,
  layout: Layout = 'layered',
): LayoutResult {
  const result =
    typeof layout === 'function' ? layout(graph) : layeredLayout(graph);
  for (const node of graph.nodes) {
    const position = result.get(node.id);
    if (!position || position.length !== 3 || !position.every(Number.isFinite))
      throw new Error(
        `Layout must return a finite [x, y, z] position for node "${node.id}".`,
      );
  }
  return result;
}
