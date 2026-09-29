import { useFrame, useThree } from '@react-three/fiber';
/** Resolve nearby HTML node labels in screen space without moving architecture nodes. */
export function LabelPlacement() {
  const { gl } = useThree();
  useFrame(() => {
    const viewport = gl.domElement.closest<HTMLElement>('.av-viewport');
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const labels = [
      ...viewport.querySelectorAll<HTMLElement>('.av-node-label'),
    ].sort((a, b) => {
      const selected =
        Number(b.getAttribute('aria-pressed') === 'true') -
        Number(a.getAttribute('aria-pressed') === 'true');
      return selected || (a.dataset.nodeId! < b.dataset.nodeId! ? -1 : 1);
    });
    const placed: {
      left: number;
      right: number;
      top: number;
      bottom: number;
    }[] = [];
    // Keep group names inside the viewport and reserve their space before node labels.
    for (const label of viewport.querySelectorAll<HTMLElement>(
      '.av-group-label',
    )) {
      label.style.setProperty('--av-group-label-x', '0px');
      const box = label.getBoundingClientRect();
      if (!box.width || box.left > bounds.right || box.right < bounds.left)
        continue;
      const offset =
        Math.min(0, bounds.right - 8 - box.right) +
        Math.max(0, bounds.left + 8 - box.left);
      label.style.setProperty('--av-group-label-x', `${offset}px`);
      // On narrow canvases, prioritize node labels; group controls remain in Browse nodes.
      if (bounds.width >= 640)
        placed.push({
          left: box.left + offset - 3,
          right: box.right + offset + 3,
          top: box.top - 3,
          bottom: box.bottom + 3,
        });
    }
    for (const label of labels) {
      label.style.setProperty('--av-label-offset', '0px');
      const box = label.getBoundingClientRect();
      if (!box.width || box.right < bounds.left || box.left > bounds.right)
        continue;
      const step = box.height + 5;
      for (const n of [0, -1, 1, -2, 2, -3, 3, -4, 4]) {
        const offset = n * step,
          rect = {
            left: box.left - 3,
            right: box.right + 3,
            top: box.top + offset - 2,
            bottom: box.bottom + offset + 2,
          };
        if (rect.top < bounds.top || rect.bottom > bounds.bottom) continue;
        if (
          placed.some(
            (p) =>
              rect.left < p.right &&
              rect.right > p.left &&
              rect.top < p.bottom &&
              rect.bottom > p.top,
          )
        )
          continue;
        label.style.setProperty('--av-label-offset', `${offset}px`);
        placed.push(rect);
        break;
      }
    }
  });
  return null;
}
