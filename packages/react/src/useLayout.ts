import { useEffect, useMemo, useState } from 'react';
import type { ArchitectureGraph } from 'archgraph-core';
import { computeLayout, validateLayoutGeometry } from './layout.js';
import type { Layout, LayoutGeometry } from './layout.js';

/** Keep inspection available while computing; never apply a stale engine result. */
export function useLayout(graph: ArchitectureGraph, layout: Layout) {
  const fallback = useMemo<LayoutGeometry>(
    () => ({
      positions: computeLayout(
        graph,
        typeof layout === 'object' ? 'layered' : layout,
      ),
    }),
    [graph, layout],
  );
  const [result, setResult] = useState<{
    graph: ArchitectureGraph;
    layout: Layout;
    geometry?: LayoutGeometry;
    error?: string;
  } | null>(null);
  useEffect(() => {
    if (typeof layout !== 'object') return;
    let active = true;
    Promise.resolve()
      .then(() => layout.compute(graph))
      .then((geometry) => {
        const validated = validateLayoutGeometry(graph, geometry);
        if (active) setResult({ graph, layout, geometry: validated });
      })
      .catch((error: unknown) => {
        if (active)
          setResult({
            graph,
            layout,
            error:
              error instanceof Error
                ? error.message
                : 'Layout computation failed.',
          });
      });
    return () => {
      active = false;
    };
  }, [graph, layout]);
  const current =
    result?.graph === graph && result.layout === layout ? result : null;
  return {
    geometry: current?.geometry ?? fallback,
    pending: typeof layout === 'object' && !current,
    error: typeof layout === 'object' ? current?.error : undefined,
  };
}
