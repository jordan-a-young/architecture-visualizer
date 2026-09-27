import { useState } from 'react';
import type { RefObject } from 'react';
import { parseViewState } from 'archgraph-react';
import type {
  ArchitectureViewerHandle,
  ViewerViewState,
} from 'archgraph-react';
const storageKey = 'archgraph-demo-views-v1';
type SavedView = { name: string; state: ViewerViewState };
function load(): SavedView[] {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKey) ?? '[]',
    );
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((value) => {
      try {
        return typeof value.name === 'string'
          ? [{ name: value.name, state: parseViewState(value.state) }]
          : [];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}
/** Persistence belongs to this application, never to the visualization package. */
export function SavedViews({
  viewer,
}: {
  viewer: RefObject<ArchitectureViewerHandle | null>;
}) {
  const [views, setViews] = useState(load);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const saveList = (next: SavedView[]) => {
    localStorage.setItem(storageKey, JSON.stringify(next));
    setViews(next);
  };
  const run = (action: () => void) => {
    try {
      action();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Could not update saved views.',
      );
    }
  };
  return (
    <section className="saved-views" aria-label="Saved views">
      <label>
        View name{' '}
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Order processing"
        />
      </label>
      <button
        type="button"
        disabled={!name.trim()}
        onClick={() =>
          run(() => {
            if (!viewer.current) throw new Error('Viewer is not ready.');
            const title = name.trim();
            if (views.some((view) => view.name === title))
              throw new Error('That name already exists. Choose another name.');
            saveList([
              ...views,
              { name: title, state: viewer.current.getViewState() },
            ]);
            setSelected(title);
            setMessage('View saved in this browser.');
          })
        }
      >
        Save view
      </button>
      <label>
        Saved view{' '}
        <select
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
        >
          <option value="">Choose a view</option>
          {views.map((view) => (
            <option key={view.name} value={view.name}>
              {view.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!selected}
        onClick={() =>
          run(() => {
            const saved = views.find((view) => view.name === selected);
            if (saved && viewer.current) {
              viewer.current.restoreViewState(saved.state);
              setMessage('View restored.');
            }
          })
        }
      >
        Restore view
      </button>
      <button
        type="button"
        disabled={!selected}
        onClick={() =>
          run(() => {
            saveList(views.filter((view) => view.name !== selected));
            setSelected('');
            setMessage('Saved view deleted.');
          })
        }
      >
        Delete view
      </button>
      {message && <span role="status">{message}</span>}
    </section>
  );
}
