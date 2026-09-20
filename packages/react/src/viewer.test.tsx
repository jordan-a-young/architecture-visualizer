// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ArchitectureGraph } from 'archgraph-core';
import type { GraphSceneProps } from './Scene.js';
import type { ArchitectureViewerHandle } from './types.js';
vi.mock('./Scene.js', () => ({
  GraphScene: ({ graph, onSelect, selectedId, reset }: GraphSceneProps) => (
    <div
      data-testid="scene"
      data-selected={selectedId ?? ''}
      data-reset={reset}
    >
      {graph.nodes.map((node) => (
        <button key={node.id} onClick={() => onSelect(node)}>
          scene:{node.id}
        </button>
      ))}
      <button onClick={() => onSelect(null)}>empty space</button>
    </div>
  ),
}));
import { ArchitectureViewer } from './ArchitectureViewer.js';
const graph: ArchitectureGraph = {
  version: '1.0',
  groups: [],
  nodes: [
    {
      id: 'a',
      label: 'Frontend',
      type: 'app',
      description: 'A useful description',
      tags: ['public'],
      metadata: { team: 'Experience', nested: { a: 1 } },
      links: [
        { label: 'README', href: 'https://example.com/readme', external: true },
      ],
    },
    { id: 'b', label: 'API', type: 'service' },
  ],
  edges: [
    { source: 'a', target: 'b', type: 'calls', metadata: { protocol: 'HTTP' } },
  ],
};
afterEach(cleanup);
describe('viewer behavior without WebGL', () => {
  it('selects on click without navigating and displays node/relationship context', () => {
    const onNodeSelect = vi.fn();
    render(<ArchitectureViewer graph={graph} onNodeSelect={onNodeSelect} />);
    fireEvent.click(screen.getByText('scene:a'));
    const panel = within(screen.getByRole('complementary'));
    expect(
      panel.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
    expect(panel.getByText('A useful description')).toBeInTheDocument();
    expect(panel.getByText('Experience')).toBeInTheDocument();
    expect(panel.getByText('public')).toBeInTheDocument();
    expect(panel.getByRole('link', { name: /README/ })).toHaveAttribute(
      'href',
      'https://example.com/readme',
    );
    expect(panel.getByRole('link', { name: /README/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    expect(panel.getByText('HTTP')).toBeInTheDocument();
    expect(onNodeSelect).toHaveBeenCalledWith(graph.nodes[0]);
    fireEvent.click(panel.getByRole('button', { name: /API/ }));
    expect(screen.getByRole('heading', { name: 'API' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('empty space'));
    expect(
      screen.getByRole('heading', { name: 'Explore your system' }),
    ).toBeInTheDocument();
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);
  });
  it('honors controlled selection including explicit null', () => {
    const onNodeSelect = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        selectedNodeId={null}
        onNodeSelect={onNodeSelect}
      />,
    );
    fireEvent.click(screen.getByText('scene:a'));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', '');
    expect(onNodeSelect).toHaveBeenCalledWith(graph.nodes[0]);
    rerender(
      <ArchitectureViewer
        graph={graph}
        selectedNodeId="b"
        onNodeSelect={onNodeSelect}
      />,
    );
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', 'b');
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', 'b');
    expect(onNodeSelect).toHaveBeenLastCalledWith(null);
  });
  it('hides filtered selection, retains full relationship context, and handles empty results', () => {
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        defaultSelectedNodeId="a"
        filters={{ types: ['app'] }}
      />,
    );
    expect(screen.queryByText('scene:b')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /API/ })).toBeInTheDocument();
    rerender(
      <ArchitectureViewer
        graph={graph}
        defaultSelectedNodeId="a"
        filters={{ types: [] }}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('No nodes');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', '');
  });
  it('clears removed nodes without firing a synthetic selection callback', () => {
    const onNodeSelect = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        defaultSelectedNodeId="a"
        onNodeSelect={onNodeSelect}
      />,
    );
    rerender(
      <ArchitectureViewer
        graph={{ ...graph, nodes: [graph.nodes[1]!], edges: [] }}
        onNodeSelect={onNodeSelect}
      />,
    );
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', '');
    expect(onNodeSelect).not.toHaveBeenCalled();
  });
  it('supports Escape, reset button and imperative camera reset', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    render(
      <ArchitectureViewer ref={ref} graph={graph} defaultSelectedNodeId="a" />,
    );
    fireEvent.keyDown(screen.getByLabelText('Architecture graph'), {
      key: 'Escape',
    });
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', '');
    fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-reset', '1');
    act(() => ref.current?.resetCamera());
    expect(screen.getByTestId('scene')).toHaveAttribute('data-reset', '2');
  });
  it('supports custom or hidden details', () => {
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        defaultSelectedNodeId="a"
        renderDetails={({ node }) => <aside>Custom {node?.label}</aside>}
      />,
    );
    expect(screen.getByText('Custom Frontend')).toBeInTheDocument();
    rerender(<ArchitectureViewer graph={graph} showDetailsPanel={false} />);
    expect(screen.queryByRole('complementary')).not.toBeInTheDocument();
  });
  it('rejects invalid input before invoking the scene', () => {
    render(
      <ArchitectureViewer
        graph={{ ...graph, edges: [{ source: 'a', target: 'missing' }] }}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown edge target');
    expect(screen.queryByTestId('scene')).not.toBeInTheDocument();
  });
});
