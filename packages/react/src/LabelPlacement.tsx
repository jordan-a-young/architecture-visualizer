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
