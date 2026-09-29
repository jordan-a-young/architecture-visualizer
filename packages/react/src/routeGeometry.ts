import type { Position3 } from './layout.js';
const distance = (a: Position3, b: Position3) =>
  Math.hypot(...a.map((v, i) => v - b[i]!));
const lerp = (a: Position3, b: Position3, t: number): Position3 =>
  a.map((v, i) => v + (b[i]! - v) * t) as Position3;
/** Small bounded corner rounding; routing clearance remains larger than the radius. */
export function roundRoute(
  input: readonly Position3[],
  radius = 0.18,
): Position3[] {
  const path = input.filter(
    (p, i) => i === 0 || distance(p, input[i - 1]!) > 1e-8,
  );
  if (path.length < 3) return path.map((p) => [...p]);
  const result: Position3[] = [[...path[0]!]];
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1]!,
      b = path[i]!,
      c = path[i + 1]!;
    const r = Math.min(radius, distance(a, b) / 3, distance(b, c) / 3);
    const start = lerp(b, a, r / distance(a, b)),
      end = lerp(b, c, r / distance(b, c));
    result.push(start);
    for (let step = 1; step <= 6; step++) {
      const t = step / 6;
      result.push(lerp(lerp(start, b, t), lerp(b, end, t), t));
    }
  }
  result.push([...path.at(-1)!]);
  return result;
}
export function routeLabelPosition(path: readonly Position3[]): Position3 {
  let index = 1,
    longest = -1;
  for (let i = 1; i < path.length; i++) {
    const length = distance(path[i - 1]!, path[i]!);
    if (length > longest) {
      longest = length;
      index = i;
    }
  }
  return lerp(path[index - 1]!, path[index]!, 0.5);
}
