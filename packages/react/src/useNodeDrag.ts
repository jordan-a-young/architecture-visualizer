import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import { Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { Position3 } from './layout.js';

interface DragOptions {
  enabled: boolean;
  position: Position3;
  lock: RefObject<boolean>;
  onMove: (position: Position3) => void;
  onEnd: (position: Position3) => void;
  onSelect: () => void;
}

/** One pointer, horizontal world plane, shared by mesh and HTML-label gestures. */
export function useNodeDrag(options: DragOptions) {
  const { camera, gl, controls, invalidate } = useThree();
  const latest = useRef(options);
  latest.current = options;
  const cancel = useRef<(() => void) | null>(null);
  useEffect(() => () => cancel.current?.(), [options.enabled]);

  return (event: PointerEvent): boolean => {
    const current = latest.current;
    if (
      !current.enabled ||
      current.lock.current ||
      event.button !== 0 ||
      !event.isPrimary
    )
      return false;
    const canvas = gl.domElement;
    const viewport = canvas.closest('.av-viewport');
    const origin = new Vector3(...current.position);
    const plane = new Plane(new Vector3(0, 1, 0), -origin.y);
    const raycaster = new Raycaster();
    const point = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      raycaster.setFromCamera(
        new Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      // Near a horizon the intersection is unstable; leave the node where it is.
      if (Math.abs(raycaster.ray.direction.y) < 0.02) return null;
      return raycaster.ray.intersectPlane(plane, new Vector3());
    };
    const start = point(event);
    if (!start) return false;
    event.preventDefault();
    const label =
      event.target instanceof Element ? event.target.closest('button') : null;
    if (label instanceof HTMLButtonElement)
      label.focus({ preventScroll: true });
    else {
      canvas.tabIndex = 0;
      canvas.focus({ preventScroll: true });
    }
    const pointerId = event.pointerId;
    const initial = [...current.position] as Position3;
    let last = initial;
    let moved = false;
    let finished = false;
    const orbit = controls as { enabled: boolean } | null;
    const wasEnabled = orbit?.enabled;
    if (orbit) orbit.enabled = false;
    current.lock.current = true;
    canvas.setPointerCapture(pointerId);
    const suppressClick = (click: MouseEvent) => {
      if (viewport?.contains(click.target as Node)) {
        click.preventDefault();
        click.stopImmediatePropagation();
      }
    };
    const finish = (cancelled: boolean) => {
      if (finished) return;
      finished = true;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', abortPointer, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', abort);
      canvas.removeEventListener('lostpointercapture', abort);
      if (canvas.hasPointerCapture(pointerId))
        canvas.releasePointerCapture(pointerId);
      if (orbit) orbit.enabled = wasEnabled!;
      current.lock.current = false;
      cancel.current = null;
      // Pointer-up synthesizes a click. Handle selection explicitly once so a
      // drag release on empty canvas cannot clear it, and labels work with capture.
      window.addEventListener('click', suppressClick, true);
      window.setTimeout(
        () => window.removeEventListener('click', suppressClick, true),
        0,
      );
      if (cancelled) {
        if (moved) latest.current.onMove(initial);
      } else if (moved) latest.current.onEnd([...last]);
      else latest.current.onSelect();
      invalidate();
    };
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      next.preventDefault();
      next.stopPropagation();
      if (
        !moved &&
        Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) <
          4
      )
        return;
      const hit = point(next);
      if (!hit) return;
      last = origin.clone().add(hit.sub(start)).toArray() as Position3;
      moved = true;
      latest.current.onMove([...last]);
      invalidate();
    };
    const up = (next: PointerEvent) => {
      if (next.pointerId === pointerId) finish(false);
    };
    const abortPointer = (next: PointerEvent) => {
      if (next.pointerId === pointerId) finish(true);
    };
    const abort = () => finish(true);
    const key = (key: KeyboardEvent) => {
      if (key.key === 'Escape') {
        key.preventDefault();
        key.stopPropagation();
        finish(true);
      }
    };
    cancel.current = abort;
    window.addEventListener('pointermove', move, {
      capture: true,
      passive: false,
    });
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', abortPointer, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('blur', abort);
    canvas.addEventListener('lostpointercapture', abort);
    return true;
  };
}
