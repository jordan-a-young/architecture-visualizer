import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/** Browser fullscreen belongs to this viewer, never to another fullscreen element. */
export function useFullscreen(viewer: RefObject<HTMLDivElement | null>) {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);
  const [otherActive, setOtherActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    setAvailable(
      typeof viewer.current?.requestFullscreen === 'function' &&
        typeof document.exitFullscreen === 'function' &&
        document.fullscreenEnabled !== false,
    );
    const sync = () => {
      setActive(document.fullscreenElement === viewer.current);
      setOtherActive(
        !!document.fullscreenElement &&
          document.fullscreenElement !== viewer.current,
      );
      setError('');
    };
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => {
      mounted.current = false;
      document.removeEventListener('fullscreenchange', sync);
    };
  }, [viewer]);

  const toggle = async () => {
    const element = viewer.current;
    if (!available || !element || busy.current) return;
    // Recheck at activation time in case another element entered fullscreen.
    if (document.fullscreenElement && document.fullscreenElement !== element)
      return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      if (document.fullscreenElement === element)
        await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch (cause) {
      if (mounted.current)
        setError(
          `Could not change fullscreen: ${cause instanceof Error ? cause.message : 'request failed.'}`,
        );
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  };
  return { available, active, otherActive, pending, error, toggle };
}
