import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { validateGraph } from 'archgraph-core';
import type { ArchitectureGraph } from 'archgraph-core';

export interface DemoDataset {
  id: string;
  title: string;
  graph: ArchitectureGraph;
  local?: boolean;
}

/** Local file access belongs to the demo; imported graphs never leave this tab. */
export function GraphCatalog({
  sample,
  children,
}: {
  sample: DemoDataset;
  children: (dataset: DemoDataset, controls: ReactNode) => ReactNode;
}) {
  const [datasets, setDatasets] = useState([sample]);
  const [selected, setSelected] = useState(sample.id);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const nextId = useRef(1);
  const active = datasets.find((dataset) => dataset.id === selected)!;
  const load = async (file: File) => {
    setError('');
    setLoading(true);
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error('Choose a JSON file smaller than 5 MiB.');
      const result = validateGraph(JSON.parse(await file.text()));
      if (!result.valid)
        throw new Error(
          result.issues
            .filter((issue) => issue.severity === 'error')
            .slice(0, 3)
            .map((issue) => issue.message)
            .join(' '),
        );
      const id = `local-${nextId.current++}`;
      setDatasets((previous) => [
        ...previous,
        { id, title: file.name, graph: result.graph, local: true },
      ]);
      setSelected(id);
    } catch (cause) {
      setError(
        `Could not load graph: ${cause instanceof Error ? cause.message : 'invalid file.'}`,
      );
    } finally {
      setLoading(false);
    }
  };
  const controls = (
    <section className="graph-picker" aria-label="Graph datasets">
      <label>
        Dataset{' '}
        <select
          value={selected}
          disabled={loading}
          onChange={(event) => setSelected(event.target.value)}
        >
          {datasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Load graph JSON{' '}
        <input
          type="file"
          accept=".json,application/json"
          disabled={loading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (file) void load(file);
          }}
        />
      </label>
      <span>
        {loading
          ? 'Reading graph…'
          : 'Local files stay in this tab and clear on reload.'}
      </span>
      {error && <p role="alert">{error}</p>}
    </section>
  );
  return children(active, controls);
}
