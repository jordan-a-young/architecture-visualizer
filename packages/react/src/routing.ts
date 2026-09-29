import type { ArchitectureGraph } from 'archgraph-core';
import type { LayoutResult, NodeSize, Position3 } from './layout.js';
import { defaultNodeSize } from './layout.js';
import { getEdgeKey } from './edgeKey.js';
export interface Footprint {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export function nodeFootprints(
  graph: ArchitectureGraph,
  positions: LayoutResult,
  sizes?: ReadonlyMap<string, NodeSize>,
  margin = 0,
): Footprint[] {
  return graph.nodes.map((node) => {
    const p = positions.get(node.id)!;
    const size = sizes?.get(node.id) ?? defaultNodeSize(node);
    return {
      id: node.id,
      minX: p[0] - size.width / 2 - margin,
      maxX: p[0] + size.width / 2 + margin,
      minZ: p[2] - size.depth / 2 - margin,
      maxZ: p[2] + size.depth / 2 + margin,
    };
  });
}
/** Open rectangle intersection: following a clearance boundary is valid. */
export function segmentHitsFootprint(a: Position3, b: Position3, r: Footprint) {
  let lo = 0,
    hi = 1;
  for (const [axis, min, max] of [
    [0, r.minX, r.maxX],
    [2, r.minZ, r.maxZ],
  ] as const) {
    const delta = b[axis] - a[axis];
    if (Math.abs(delta) < 1e-9) {
      if (a[axis] <= min + 1e-7 || a[axis] >= max - 1e-7) return false;
    } else {
      const p = (min + 1e-7 - a[axis]) / delta,
        q = (max - 1e-7 - a[axis]) / delta;
      lo = Math.max(lo, Math.min(p, q));
      hi = Math.min(hi, Math.max(p, q));
    }
  }
  return lo < hi && hi > 0 && lo < 1;
}
function clear(path: readonly Position3[], obstacles: readonly Footprint[]) {
  return path
    .slice(1)
    .every((p, i) =>
      obstacles.every((r) => !segmentHitsFootprint(path[i]!, p, r)),
    );
}
function crossing(a: Position3, b: Position3, c: Position3, d: Position3) {
  const cross = (p: Position3, q: Position3, r: Position3) =>
    (q[0] - p[0]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[0] - p[0]);
  return (
    cross(a, b, c) * cross(a, b, d) < -1e-8 &&
    cross(c, d, a) * cross(c, d, b) < -1e-8
  );
}
/** Useful for comparing routes in the fixed horizontal reference plane. */
export function countRouteCrossings(paths: readonly (readonly Position3[])[]) {
  let total = 0;
  paths.forEach((path, i) => {
    for (const other of paths.slice(i + 1))
      for (let a = 1; a < path.length; a++)
        for (let b = 1; b < other.length; b++)
          if (crossing(path[a - 1]!, path[a]!, other[b - 1]!, other[b]!))
            total++;
  });
  return total;
}
type Entry = { key: number; cost: number; priority: number };
class Queue {
  items: Entry[] = [];
  push(value: Entry) {
    const a = this.items;
    a.push(value);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]!.priority <= value.priority) break;
      a[i] = a[p]!;
      i = p;
    }
    a[i] = value;
  }
  pop() {
    const a = this.items,
      top = a[0]!,
      last = a.pop()!;
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) {
        let c = i * 2 + 1;
        if (c + 1 < a.length && a[c + 1]!.priority < a[c]!.priority) c++;
        if (a[c]!.priority >= last.priority) break;
        a[i] = a[c]!;
        i = c;
      }
      a[i] = last;
    }
    return top;
  }
}
function simplify(path: Position3[]) {
  return path.filter((p, i) => {
    const a = path[i - 1],
      b = path[i + 1];
    return (
      !a ||
      !b ||
      !(
        (Math.abs(a[0] - p[0]) < 1e-8 && Math.abs(b[0] - p[0]) < 1e-8) ||
        (Math.abs(a[2] - p[2]) < 1e-8 && Math.abs(b[2] - p[2]) < 1e-8)
      )
    );
  });
}
function routeGrid(
  start: Position3,
  end: Position3,
  obstacles: Footprint[],
  prior: readonly (readonly Position3[])[],
) {
  const xs = [
    ...new Set([
      start[0],
      end[0],
      ...obstacles.flatMap((r) => [r.minX, r.maxX]),
    ]),
  ].sort((a, b) => a - b);
  const zs = [
    ...new Set([
      start[2],
      end[2],
      ...obstacles.flatMap((r) => [r.minZ, r.maxZ]),
    ]),
  ].sort((a, b) => a - b);
  const w = xs.length;
  const point = (key: number): Position3 => {
    const cell = Math.floor(key / 3);
    return [xs[cell % w]!, 0, zs[Math.floor(cell / w)]!];
  };
  const startKey = (zs.indexOf(start[2]) * w + xs.indexOf(start[0])) * 3;
  const endCell = zs.indexOf(end[2]) * w + xs.indexOf(end[0]);
  const scores = new Map([[startKey, 0]]),
    previous = new Map<number, number>();
  const queue = new Queue();
  queue.push({ key: startKey, cost: 0, priority: 0 });
  const blocked = new Map<string, boolean>();
  let visited = 0;
  while (queue.items.length && visited++ < 30000) {
    const { key, cost } = queue.pop();
    if (scores.get(key)! < cost) continue;
    const cell = Math.floor(key / 3),
      x = cell % w,
      z = Math.floor(cell / w),
      a = point(key);
    if (cell === endCell) {
      const path: Position3[] = [a];
      let k = key;
      while (previous.has(k)) {
        k = previous.get(k)!;
        path.unshift(point(k));
      }
      return simplify(path);
    }
    for (const [nx, nz, dir] of [
      [x - 1, z, 1],
      [x + 1, z, 1],
      [x, z - 1, 2],
      [x, z + 1, 2],
    ]) {
      if (nx! < 0 || nz! < 0 || nx! >= w || nz! >= zs.length) continue;
      const next = (nz! * w + nx!) * 3 + dir!,
        b = point(next);
      const segment = [cell, Math.floor(next / 3)]
        .sort((a, b) => a - b)
        .join(':');
      if (!blocked.has(segment))
        blocked.set(
          segment,
          obstacles.some((r) => segmentHitsFootprint(a, b, r)),
        );
      if (blocked.get(segment)) continue;
      let crossings = 0;
      for (const path of prior)
        for (let i = 1; i < path.length; i++)
          if (crossing(a, b, path[i - 1]!, path[i]!)) crossings++;
      const score =
        cost +
        Math.abs(a[0] - b[0]) +
        Math.abs(a[2] - b[2]) +
        (key % 3 && key % 3 !== dir ? 0.8 : 0) +
        crossings * 4;
      if (score >= (scores.get(next) ?? Infinity)) continue;
      scores.set(next, score);
      previous.set(next, key);
      queue.push({
        key: next,
        cost: score,
        priority: score + Math.abs(b[0] - end[0]) + Math.abs(b[2] - end[2]),
      });
    }
  }
  return null;
}
export interface RoutingOptions {
  nodeSizes?: ReadonlyMap<string, NodeSize>;
  edgeKeys?: ReadonlyMap<ArchitectureGraph['edges'][number], string>;
  preferredPaths?: ReadonlyMap<string, readonly Position3[]>;
  basePositions?: LayoutResult;
}
/** Pure routing after manual overrides/group projection. Does not move nodes. */
export function routeEdges(
  graph: ArchitectureGraph,
  positions: LayoutResult,
  options: RoutingOptions = {},
) {
  const footprints = nodeFootprints(graph, positions, options.nodeSizes);
  const obstacles = nodeFootprints(graph, positions, options.nodeSizes, 0.4);
  const rects = new Map(footprints.map((r) => [r.id, r]));
  const paths = new Map<string, readonly Position3[]>();
  const edges = graph.edges
    .map((edge, i) => ({
      edge,
      key: options.edgeKeys?.get(edge) ?? getEdgeKey(edge, i),
    }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const siblings = new Map<string, string[]>();
  for (const { edge, key } of edges) {
    const pair = JSON.stringify([edge.source, edge.target].sort());
    siblings.set(pair, [...(siblings.get(pair) ?? []), key]);
  }
  for (const { edge, key } of edges) {
    const source = positions.get(edge.source)!,
      target = positions.get(edge.target)!;
    const unrelated = footprints.filter(
      (r) => r.id !== edge.source && r.id !== edge.target,
    );
    const preferred = options.preferredPaths?.get(key);
    const unmoved = [edge.source, edge.target].every((id) =>
      positions
        .get(id)
        ?.every((v, i) => v === options.basePositions?.get(id)?.[i]),
    );
    if (preferred && unmoved && clear(preferred, unrelated)) {
      paths.set(key, preferred);
      continue;
    }
    const a = rects.get(edge.source)!,
      b = rects.get(edge.target)!;
    const family = siblings.get(
      JSON.stringify([edge.source, edge.target].sort()),
    )!;
    const order = family.indexOf(key),
      fraction = (order + 1) / (family.length + 1);
    const horizontal =
      Math.abs(target[0] - source[0]) >= Math.abs(target[2] - source[2]);
    const sign =
      (horizontal ? target[0] - source[0] : target[2] - source[2]) >= 0
        ? 1
        : -1;
    const port = (r: Footprint, p: Position3, side: number): Position3 =>
      horizontal
        ? [
            side > 0 ? r.maxX : r.minX,
            p[1],
            r.minZ + (r.maxZ - r.minZ) * (0.2 + fraction * 0.6),
          ]
        : [
            r.minX + (r.maxX - r.minX) * (0.2 + fraction * 0.6),
            p[1],
            side > 0 ? r.maxZ : r.minZ,
          ];
    const from = port(a, source, sign),
      to = port(b, target, -sign);
    const escapeA: [number, number, number] = [...from],
      escapeB: [number, number, number] = [...to];
    escapeA[horizontal ? 0 : 2] += sign * 0.4;
    escapeB[horizontal ? 0 : 2] -= sign * 0.4;
    const middle = routeGrid(escapeA, escapeB, obstacles, [...paths.values()]);
    if (
      middle &&
      clear([from, escapeA], unrelated) &&
      clear([escapeB, to], unrelated)
    ) {
      const path = [
        from,
        ...middle.map(
          (p, i): Position3 => [
            p[0],
            source[1] +
              ((target[1] - source[1]) * i) / Math.max(1, middle.length - 1),
            p[2],
          ],
        ),
        to,
      ];
      paths.set(key, path);
    } else {
      // Overlapping footprints or exhausted search: explicit overhead fallback, never move pinned nodes.
      const height =
        Math.max(...[...positions.values()].map((p) => p[1]), 0) +
        3 +
        order * 0.35;
      paths.set(key, [
        from,
        [from[0], height, from[2]],
        [to[0], height, to[2]],
        to,
      ]);
    }
  }
  return paths;
}
