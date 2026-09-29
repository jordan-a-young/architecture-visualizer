import { useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, Vector3 } from 'three';
import type { Group } from 'three';
import type { NodeLabelMode } from './types.js';
import { overlaps, placeNodeLabel } from './labelLayout.js';
import type { LabelRect } from './labelLayout.js';

/** Screen-space captions reserve real geometry, including consumer-supplied meshes. */
export function LabelPlacement({
  geometryObjects,
  mode,
}: {
  geometryObjects: ReadonlyMap<string, Group>;
  mode: NodeLabelMode;
}) {
  const { gl, camera } = useThree();
  const box = useMemo(() => new Box3(), []);
  const point = useMemo(() => new Vector3(), []);
  const slots = useMemo(() => new Map<string, number>(), []);
  useFrame(() => {
    const viewport = gl.domElement.closest<HTMLElement>('.av-viewport');
    if (!viewport) return;
    const bounds = gl.domElement.getBoundingClientRect();
    for (const id of slots.keys())
      if (!geometryObjects.has(id)) slots.delete(id);
    const nodes = new Map<string, LabelRect>();
    for (const [id, object] of geometryObjects) {
      object.updateWorldMatrix(true, true);
      box.setFromObject(object);
      if (box.isEmpty()) continue;
      box.getCenter(point).project(camera);
      if (point.z < -1 || point.z > 1) continue;
      const rect = {
        left: Infinity,
        right: -Infinity,
        top: Infinity,
        bottom: -Infinity,
      };
      for (const x of [box.min.x, box.max.x])
        for (const y of [box.min.y, box.max.y])
          for (const z of [box.min.z, box.max.z]) {
            point.set(x, y, z).project(camera);
            const left = bounds.left + ((point.x + 1) * bounds.width) / 2;
            const top = bounds.top + ((1 - point.y) * bounds.height) / 2;
            rect.left = Math.min(rect.left, left);
            rect.right = Math.max(rect.right, left);
            rect.top = Math.min(rect.top, top);
            rect.bottom = Math.max(rect.bottom, top);
          }
      if (Object.values(rect).every(Number.isFinite) && overlaps(rect, bounds))
        nodes.set(id, rect);
    }
    const labels = [
      ...viewport.querySelectorAll<HTMLButtonElement>('.av-node-label'),
    ];
    const priority = (label: HTMLElement) =>
      Number(label === document.activeElement) * 8 +
      Number(label.getAttribute('aria-pressed') === 'true') * 4 +
      Number(label.dataset.hovered === 'true') * 2 +
      Number(label.dataset.highlighted === 'true');
    labels.sort(
      (a, b) =>
        priority(b) - priority(a) ||
        (a.dataset.nodeId! < b.dataset.nodeId! ? -1 : 1),
    );
    // Reset translations, then read all label sizes before applying the new placements.
    for (const label of labels) {
      label.style.setProperty('--av-label-x', '0px');
      label.style.setProperty('--av-label-y', '0px');
    }
    const measured = labels.map((label) => ({
      label,
      rect: label.getBoundingClientRect(),
    }));
    const occupied: LabelRect[] = [...nodes.values()];
    for (const { label, rect } of measured) {
      const node = nodes.get(label.dataset.nodeId!);
      const important = priority(label) > 0;
      const show =
        mode !== 'none' &&
        node &&
        (important ||
          (mode === 'auto' &&
            Math.max(node.right - node.left, node.bottom - node.top) >= 8));
      const placed = show
        ? placeNodeLabel(
            node,
            rect.width,
            rect.height,
            bounds,
            occupied,
            slots.get(label.dataset.nodeId!),
          )
        : null;
      label.style.visibility = placed ? 'visible' : 'hidden';
      label.tabIndex = placed ? 0 : -1;
      label.setAttribute('aria-hidden', String(!placed));
      if (placed) {
        slots.set(label.dataset.nodeId!, placed.slot);
        label.style.setProperty('--av-label-x', `${placed.left - rect.left}px`);
        label.style.setProperty('--av-label-y', `${placed.top - rect.top}px`);
        occupied.push(placed);
      }
    }
    // Boundary captions are secondary to nodes. Keep them near their corner and out of geometry.
    for (const label of viewport.querySelectorAll<HTMLElement>(
      '.av-group-label',
    )) {
      label.style.setProperty('--av-group-label-x', '0px');
      label.style.setProperty('--av-group-label-y', '0px');
      const rect = label.getBoundingClientRect();
      const dx = Math.max(
        bounds.left + 4 - rect.left,
        Math.min(0, bounds.right - 4 - rect.right),
      );
      let placed: LabelRect | undefined;
      for (const offset of overlaps(rect, bounds) ? [0, -1, 1, -2, 2] : []) {
        const dy = offset * (rect.height + 4);
        const candidate = {
          left: rect.left + dx,
          right: rect.right + dx,
          top: rect.top + dy,
          bottom: rect.bottom + dy,
        };
        if (
          candidate.top < bounds.top ||
          candidate.bottom > bounds.bottom ||
          occupied.some((other) => overlaps(candidate, other, 3))
        )
          continue;
        placed = candidate;
        label.style.setProperty('--av-group-label-y', `${dy}px`);
        break;
      }
      label.style.setProperty('--av-group-label-x', `${dx}px`);
      label.style.visibility = placed ? 'visible' : 'hidden';
      label.tabIndex = placed ? 0 : -1;
      if (placed) occupied.push(placed);
    }
  });
  return null;
}
