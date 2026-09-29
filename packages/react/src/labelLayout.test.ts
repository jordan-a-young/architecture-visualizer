import { describe, expect, it } from 'vitest';
import { overlaps, placeNodeLabel } from './labelLayout.js';
const viewport = { left: 0, top: 0, right: 500, bottom: 400 };
const node = { left: 200, top: 150, right: 240, bottom: 190 };
describe('compact caption placement', () => {
  it('keeps a caption adjacent to its node without covering geometry', () => {
    const rect = placeNodeLabel(node, 100, 22, viewport, [node])!;
    expect(rect.top).toBe(node.bottom + 7);
    expect(overlaps(rect, node)).toBe(false);
  });
  it('tries another side when a neighboring node occupies the first slot', () => {
    const neighbor = { left: 180, right: 280, top: 195, bottom: 245 };
    const rect = placeNodeLabel(node, 100, 22, viewport, [node, neighbor])!;
    expect(rect.bottom).toBe(node.top - 7);
    expect(overlaps(rect, neighbor)).toBe(false);
  });
  it('keeps a valid previous side when selection or hover changes priority', () => {
    const rect = placeNodeLabel(node, 100, 22, viewport, [node], 1)!;
    expect(rect.bottom).toBe(node.top - 7);
    const blocked = { left: 0, right: 500, top: 0, bottom: 145 };
    expect(
      placeNodeLabel(node, 100, 22, viewport, [node, blocked], 1)!.top,
    ).toBe(node.bottom + 7);
  });
  it('hides instead of covering geometry or other placed captions when no slot fits', () => {
    expect(placeNodeLabel(node, 100, 22, viewport, [viewport])).toBeNull();
    expect(placeNodeLabel(viewport, 100, 22, viewport, [])).toBeNull();
  });
  it('keeps captions inside viewport edges while reserving custom shapes', () => {
    const large = { left: 2, right: 85, top: 15, bottom: 250 };
    const rect = placeNodeLabel(large, 160, 22, viewport, [large])!;
    expect(rect.left).toBeGreaterThanOrEqual(4);
    expect(rect.bottom).toBeLessThanOrEqual(viewport.bottom);
    expect(overlaps(rect, large)).toBe(false);
  });
});
