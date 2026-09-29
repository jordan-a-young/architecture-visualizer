export interface LabelRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export function overlaps(a: LabelRect, b: LabelRect, gap = 0) {
  return (
    a.left < b.right + gap &&
    a.right > b.left - gap &&
    a.top < b.bottom + gap &&
    a.bottom > b.top - gap
  );
}
/** Try nearby slots only. Hiding a caption is preferable to covering geometry. */
export function placeNodeLabel(
  node: LabelRect,
  width: number,
  height: number,
  viewport: LabelRect,
  obstacles: readonly LabelRect[],
  preferredSlot = 0,
): (LabelRect & { slot: number }) | null {
  const x = (node.left + node.right - width) / 2;
  const y = (node.top + node.bottom - height) / 2;
  const gap = 7;
  const slots = [
    [x, node.bottom + gap],
    [x, node.top - gap - height],
    [node.right + gap, y],
    [node.left - gap - width, y],
    [node.left, node.bottom + gap],
    [node.right - width, node.bottom + gap],
    [node.left, node.top - gap - height],
    [node.right - width, node.top - gap - height],
  ];
  const order = slots
    .map((_, i) => i)
    .sort((a, b) => Number(b === preferredSlot) - Number(a === preferredSlot));
  for (const slot of order) {
    const [left, top] = slots[slot]!;
    const rect = {
      slot,
      left: left!,
      top: top!,
      right: left! + width,
      bottom: top! + height,
    };
    // Horizontal clamping keeps labels reachable near the sides without covering their node.
    const dx = Math.max(
      viewport.left + 4 - rect.left,
      Math.min(0, viewport.right - 4 - rect.right),
    );
    rect.left += dx;
    rect.right += dx;
    if (
      rect.left < viewport.left ||
      rect.right > viewport.right ||
      rect.top < viewport.top + 4 ||
      rect.bottom > viewport.bottom - 4 ||
      overlaps(rect, node, 4) ||
      obstacles.some((obstacle) => overlaps(rect, obstacle, 3))
    )
      continue;
    return rect;
  }
  return null;
}
