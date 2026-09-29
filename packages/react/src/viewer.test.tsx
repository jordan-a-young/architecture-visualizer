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
import type { LayoutGeometry } from './layout.js';
import type { GraphSceneProps } from './Scene.js';
import type { ArchitectureViewerHandle } from './types.js';
vi.mock('./Scene.js', () => ({
  GraphScene: ({
    graph,
    onSelect,
    selectedId,
    reset,
    positions,
    onNodeMove,
    focusRequest,
    selectedEdgeKey,
  }: GraphSceneProps) => (
    <div
      data-testid="scene"
      data-selected={selectedId ?? ''}
      data-edge={selectedEdgeKey ?? ''}
      data-focus={focusRequest?.id ?? ''}
      data-reset={reset}
      data-positions={JSON.stringify(Object.fromEntries(positions))}
    >
      {graph.nodes.map((node) => (
        <button key={node.id} onClick={() => onSelect(node)}>
          scene:{node.id}
        </button>
      ))}
      <button onClick={() => onSelect(null)}>empty space</button>
      <button onClick={() => onNodeMove(graph.nodes[0]!, [7, 0, 8])}>
        move first
      </button>
    </div>
  ),
}));
import { ArchitectureViewer } from './ArchitectureViewer.js';
import { getEdgeKey } from './edgeKey.js';
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

describe('manual positions', () => {
  const positions = () =>
    JSON.parse(screen.getByTestId('scene').getAttribute('data-positions')!);
  it('retains uncontrolled positions through selection, filters and camera reset, then resets layout', () => {
    const original = JSON.stringify(graph);
    const ref = createRef<ArchitectureViewerHandle>();
    const changed = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        draggableNodes
        onNodePositionsChange={changed}
      />,
    );
    const automatic = positions();
    fireEvent.click(screen.getByText('move first'));
    expect(positions().a).toEqual([7, 0, 8]);
    expect(changed).toHaveBeenLastCalledWith({ a: [7, 0, 8] });
    fireEvent.click(screen.getByText('scene:b'));
    act(() => ref.current?.resetCamera());
    expect(positions().a).toEqual([7, 0, 8]);
    rerender(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        draggableNodes
        filters={{ types: ['service'] }}
      />,
    );
    expect(positions().a).toBeUndefined();
    rerender(<ArchitectureViewer ref={ref} graph={graph} draggableNodes />);
    expect(positions().a).toEqual([7, 0, 8]);
    fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }));
    expect(positions()).toEqual(automatic);
    expect(JSON.stringify(graph)).toBe(original);
  });
  it('honors controlled positions until the consumer accepts a proposal', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    const changed = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        nodePositions={{ a: [1, 2, 3] }}
        onNodePositionsChange={changed}
      />,
    );
    fireEvent.click(screen.getByText('move first'));
    expect(positions().a).toEqual([1, 2, 3]);
    expect(changed).toHaveBeenLastCalledWith({ a: [7, 0, 8] });
    rerender(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        nodePositions={{ a: [7, 0, 8] }}
        onNodePositionsChange={changed}
      />,
    );
    expect(positions().a).toEqual([7, 0, 8]);
    act(() => ref.current?.resetLayout());
    expect(changed).toHaveBeenLastCalledWith({});
    expect(positions().a).toEqual([7, 0, 8]);
  });
  it('forgets overrides for removed nodes without forgetting filtered nodes', () => {
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        defaultNodePositions={{ a: [9, 0, 9] }}
      />,
    );
    expect(positions().a).toEqual([9, 0, 9]);
    rerender(
      <ArchitectureViewer
        graph={{ ...graph, nodes: [graph.nodes[1]!], edges: [] }}
      />,
    );
    rerender(<ArchitectureViewer graph={graph} />);
    expect(positions().a).not.toEqual([9, 0, 9]);
  });
});

describe('search, focus and edge inspection', () => {
  it('searches the visible node list without filtering the scene and focuses without selecting', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    const { rerender } = render(<ArchitectureViewer ref={ref} graph={graph} />);
    fireEvent.click(screen.getByText('Browse nodes (2)'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search nodes' }), {
      target: { value: 'public' },
    });
    const list = screen.getByText('Browse nodes (2)').parentElement!;
    expect(
      within(list).getByRole('button', { name: 'Frontend' }),
    ).toBeInTheDocument();
    expect(
      within(list).queryByRole('button', { name: 'API' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('scene:b')).toBeInTheDocument();
    act(() => {
      expect(ref.current!.focusNode('b')).toBe(true);
    });
    expect(screen.getByTestId('scene')).toHaveAttribute('data-focus', 'b');
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', '');
    rerender(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        filters={{ types: ['app'] }}
      />,
    );
    act(() => {
      expect(ref.current!.focusNode('b')).toBe(false);
    });
  });
  it('inspects anonymous edges, clears on node selection, and respects controlled rejection', () => {
    const selected = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer graph={graph} onEdgeSelect={selected} />,
    );
    fireEvent.click(screen.getByText('Browse nodes (2)'));
    fireEvent.click(screen.getByText('Relationships (1)'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Frontend → API · calls' }),
    );
    expect(screen.getByLabelText('Relationship details')).toHaveTextContent(
      'HTTP',
    );
    expect(selected).toHaveBeenLastCalledWith(
      graph.edges[0],
      getEdgeKey(graph.edges[0]!, 0),
    );
    fireEvent.click(screen.getByText('scene:b'));
    expect(
      screen.queryByLabelText('Relationship details'),
    ).not.toBeInTheDocument();
    rerender(
      <ArchitectureViewer
        graph={graph}
        selectedEdgeKey={null}
        onEdgeSelect={selected}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Frontend → API · calls' }),
    );
    expect(
      screen.queryByLabelText('Relationship details'),
    ).not.toBeInTheDocument();
    rerender(
      <ArchitectureViewer
        graph={graph}
        selectedEdgeKey={getEdgeKey(graph.edges[0]!, 0)}
      />,
    );
    expect(screen.getByLabelText('Relationship details')).toBeInTheDocument();
  });
  it('separates explicit and anonymous keys and preserves explicit IDs across reorder', () => {
    const edge = { id: 'index:0', source: 'a', target: 'b' };
    expect(getEdgeKey(edge, 0)).toBe(getEdgeKey(edge, 8));
    expect(getEdgeKey(edge, 0)).not.toBe(getEdgeKey(graph.edges[0]!, 0));
  });
});

describe('connection walkthrough', () => {
  it('moves forward and back, recognizes dead ends, and resets', () => {
    render(<ArchitectureViewer graph={graph} defaultSelectedNodeId="a" />);
    fireEvent.click(screen.getByRole('button', { name: 'Start walkthrough' }));
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'API' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(
      screen.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reset walkthrough' }));
    expect(
      screen.queryByLabelText('Connection walkthrough'),
    ).not.toBeInTheDocument();
  });
  it('honors controlled walkthrough state and declines steps until accepted', () => {
    const change = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        defaultSelectedNodeId="a"
        walkthrough={null}
        onWalkthroughChange={change}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start walkthrough' }));
    expect(change).toHaveBeenLastCalledWith({ startNodeId: 'a', edgeKeys: [] });
    expect(
      screen.queryByLabelText('Connection walkthrough'),
    ).not.toBeInTheDocument();
    rerender(
      <ArchitectureViewer
        graph={graph}
        walkthrough={{ startNodeId: 'a', edgeKeys: [] }}
        onWalkthroughChange={change}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
    expect(change).toHaveBeenLastCalledWith({
      startNodeId: 'a',
      edgeKeys: [getEdgeKey(graph.edges[0]!, 0)],
    });
  });
  it('does not walk into filtered nodes and truncates removed connections', () => {
    const change = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        defaultWalkthrough={{ startNodeId: 'a', edgeKeys: [] }}
        filters={{ types: ['app'] }}
        onWalkthroughChange={change}
      />,
    );
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    rerender(
      <ArchitectureViewer
        graph={{ ...graph, edges: [] }}
        walkthrough={{
          startNodeId: 'a',
          edgeKeys: [getEdgeKey(graph.edges[0]!, 0)],
        }}
        onWalkthroughChange={change}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
});

describe('saved views', () => {
  it('restores internal selection, filters, positions and walkthrough without mutating input', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    render(
      <ArchitectureViewer ref={ref} graph={graph} defaultSelectedNodeId="a" />,
    );
    const saved = ref.current!.getViewState();
    expect(saved.camera).toBeNull();
    const input = {
      ...saved,
      nodePositions: { b: [8, 0, 7] },
      filters: { types: ['service'] },
      selectedNodeId: 'b',
    };
    const json = JSON.stringify(input);
    act(() => ref.current!.restoreViewState(input));
    expect(screen.getByRole('heading', { name: 'API' })).toBeInTheDocument();
    expect(screen.queryByText('scene:a')).not.toBeInTheDocument();
    expect(ref.current!.getViewState().nodePositions.b).toEqual([8, 0, 7]);
    expect(JSON.stringify(input)).toBe(json);
    act(() => ref.current!.restoreViewState(saved));
    expect(screen.getByText('scene:a')).toBeInTheDocument();
    expect(ref.current!.getViewState().selectedNodeId).toBe('a');
  });
  it('proposes controlled updates and rejects malformed snapshots atomically', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    const selected = vi.fn(),
      filters = vi.fn(),
      positions = vi.fn();
    render(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        selectedNodeId="a"
        filters={{}}
        nodePositions={{}}
        onNodeSelect={selected}
        onFiltersChange={filters}
        onNodePositionsChange={positions}
      />,
    );
    const saved = {
      ...ref.current!.getViewState(),
      selectedNodeId: 'b',
      filters: { types: ['service'] },
      nodePositions: { b: [3, 0, 4] },
    };
    act(() => ref.current!.restoreViewState(saved));
    expect(selected).toHaveBeenLastCalledWith(graph.nodes[1]);
    expect(filters).toHaveBeenLastCalledWith({ types: ['service'] });
    expect(positions).toHaveBeenLastCalledWith({ b: [3, 0, 4] });
    expect(
      screen.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
    expect(screen.getByText('scene:a')).toBeInTheDocument();
    selected.mockClear();
    filters.mockClear();
    positions.mockClear();
    expect(() =>
      ref.current!.restoreViewState({
        ...saved,
        camera: { position: [0, 0, 0], target: [0, 0, 0] },
      }),
    ).toThrow();
    expect(selected).not.toHaveBeenCalled();
    expect(filters).not.toHaveBeenCalled();
    expect(positions).not.toHaveBeenCalled();
  });
  it('rejects predicate filters rather than silently losing them', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    render(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        filters={{ predicate: () => true }}
      />,
    );
    expect(() => ref.current!.getViewState()).toThrow('Predicate filters');
  });
});

describe('collapsible groups', () => {
  const grouped: ArchitectureGraph = {
    ...graph,
    groups: [{ id: 'g', label: 'Services' }],
    nodes: graph.nodes.map((node) => ({ ...node, group: 'g' })),
  };
  it('preserves positions and selection through collapse, expansion and saved views', () => {
    const ref = createRef<ArchitectureViewerHandle>();
    render(
      <ArchitectureViewer
        ref={ref}
        graph={grouped}
        defaultSelectedNodeId="a"
        defaultNodePositions={{ a: [7, 0, 8] }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Services' }));
    expect(screen.queryByText('scene:a')).not.toBeInTheDocument();
    const saved = ref.current!.getViewState();
    expect(saved.collapsedGroupIds).toEqual(['g']);
    expect(saved.selectedNodeId).toBe('a');
    fireEvent.click(screen.getByText('scene:group:g'));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-selected', 'a');
    expect(
      JSON.parse(screen.getByTestId('scene').getAttribute('data-positions')!).a,
    ).toEqual([7, 0, 8]);
    act(() => ref.current!.restoreViewState(saved));
    expect(screen.queryByText('scene:a')).not.toBeInTheDocument();
  });
  it('proposes controlled collapse without applying it when the host declines', () => {
    const change = vi.fn();
    render(
      <ArchitectureViewer
        graph={grouped}
        collapsedGroupIds={[]}
        onCollapsedGroupsChange={change}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Collapse Services' }));
    expect(change).toHaveBeenCalledWith(['g']);
    expect(screen.getByText('scene:a')).toBeInTheDocument();
  });
});

describe('hidden-node navigation regressions', () => {
  it('closes pending branch choices while their current node is hidden', () => {
    const branching = {
      ...graph,
      edges: [...graph.edges, { source: 'a', target: 'b', type: 'publishes' }],
    };
    const change = vi.fn();
    const props = {
      graph: branching,
      defaultWalkthrough: { startNodeId: 'a', edgeKeys: [] },
      onWalkthroughChange: change,
    };
    const { rerender } = render(<ArchitectureViewer {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      screen.getByRole('group', { name: 'Choose next relationship' }),
    ).toBeInTheDocument();
    rerender(<ArchitectureViewer {...props} filters={{ nodeIds: ['b'] }} />);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(
      screen.queryByRole('group', { name: 'Choose next relationship' }),
    ).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
  it('disables collapsed endpoints in the edge inspector until expanded', () => {
    const grouped = {
      ...graph,
      groups: [{ id: 'g', label: 'Services' }],
      nodes: graph.nodes.map((node) =>
        node.id === 'a' ? { ...node, group: 'g' } : node,
      ),
    };
    const select = vi.fn();
    render(
      <ArchitectureViewer
        graph={grouped}
        defaultCollapsedGroupIds={['g']}
        defaultSelectedEdgeKey={getEdgeKey(graph.edges[0]!, 0)}
        onNodeSelect={select}
      />,
    );
    const panel = within(screen.getByLabelText('Relationship details'));
    const endpoint = panel.getByRole('button', {
      name: 'Frontend',
    });
    expect(endpoint).toBeDisabled();
    fireEvent.click(endpoint);
    expect(select).not.toHaveBeenCalled();
    expect(panel.getByRole('button', { name: 'API' })).toBeEnabled();
    fireEvent.click(screen.getByText('scene:group:g'));
    expect(endpoint).toBeEnabled();
    fireEvent.click(endpoint);
    expect(
      screen.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
  });
});

describe('asynchronous layouts', () => {
  it('ignores stale layout results and preserves manual overrides', async () => {
    let finish!: (value: LayoutGeometry) => void;
    const old = {
      compute: () =>
        new Promise<LayoutGeometry>((resolve) => {
          finish = resolve;
        }),
    };
    const current = {
      compute: async () => ({
        positions: new Map(
          graph.nodes.map((n) => [
            n.id,
            [10, 0, 0] as [number, number, number],
          ]),
        ),
      }),
    };
    const { rerender } = render(
      <ArchitectureViewer
        graph={graph}
        layout={old}
        defaultNodePositions={{ a: [7, 0, 8] }}
      />,
    );
    expect(screen.getByText('Arranging graph…')).toBeInTheDocument();
    await act(async () => {
      await Promise.resolve();
    });
    rerender(
      <ArchitectureViewer
        graph={graph}
        layout={current}
        defaultNodePositions={{ a: [7, 0, 8] }}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      JSON.parse(screen.getByTestId('scene').getAttribute('data-positions')!),
    ).toEqual({ a: [7, 0, 8], b: [10, 0, 0] });
    await act(async () => {
      finish({
        positions: new Map(graph.nodes.map((n) => [n.id, [99, 0, 0]])),
      });
    });
    expect(
      JSON.parse(screen.getByTestId('scene').getAttribute('data-positions')!).b,
    ).toEqual([10, 0, 0]);
  });
  it('keeps inspection available when a layout fails or returns invalid positions', async () => {
    const layout = { compute: async () => ({ positions: new Map() }) };
    render(<ArchitectureViewer graph={graph} layout={layout} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Layout failed');
    fireEvent.click(screen.getByText('scene:a'));
    expect(
      screen.getByRole('heading', { name: 'Frontend' }),
    ).toBeInTheDocument();
  });
});

describe('explicit arrangement and camera presets', () => {
  it('arranges filtered nodes while preserving manual and hidden overrides, and saves the result', async () => {
    const ref = createRef<ArchitectureViewerHandle>();
    const filteredGraph = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: 'hidden', label: 'Hidden', type: 'hidden' },
      ],
    };
    render(
      <ArchitectureViewer
        ref={ref}
        graph={filteredGraph}
        filters={{ nodeIds: ['a', 'b'] }}
        defaultNodePositions={{ a: [9, 0, 9], hidden: [20, 0, 0] }}
      />,
    );
    await act(async () => {
      await ref.current!.arrangeVisibleGraph();
    });
    const state = ref.current!.getViewState();
    expect(state.nodePositions.a).toEqual([9, 0, 9]);
    expect(state.nodePositions.hidden).toEqual([20, 0, 0]);
    expect(state.nodePositions.b).toEqual([2.5, 0, 0]);
    act(() => ref.current!.setCameraPreset('top'));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-reset', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Reset camera' }));
    expect(screen.getByTestId('scene')).toHaveAttribute('data-reset', '2');
  });
  it('proposes controlled arrangements without moving nodes when declined', async () => {
    const onChange = vi.fn();
    const ref = createRef<ArchitectureViewerHandle>();
    render(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        filters={{ nodeIds: ['b'] }}
        nodePositions={{}}
        onNodePositionsChange={onChange}
      />,
    );
    const before = screen.getByTestId('scene').getAttribute('data-positions');
    await act(async () => {
      await ref.current!.arrangeVisibleGraph();
    });
    expect(onChange).toHaveBeenCalledWith({ b: [0, 0, 0] });
    expect(screen.getByTestId('scene').getAttribute('data-positions')).toBe(
      before,
    );
  });
  it('discards an arrangement that completes after filters change', async () => {
    const ref = createRef<ArchitectureViewerHandle>();
    let finish!: (value: LayoutGeometry) => void;
    const engine = {
      compute: (g: ArchitectureGraph) =>
        g.nodes.length === 1
          ? new Promise<LayoutGeometry>((resolve) => {
              finish = resolve;
            })
          : {
              positions: new Map(
                g.nodes.map((n) => [
                  n.id,
                  [0, 0, 0] as [number, number, number],
                ]),
              ),
            },
    };
    const onChange = vi.fn();
    const { rerender } = render(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        layout={engine}
        filters={{ nodeIds: ['b'] }}
        onNodePositionsChange={onChange}
      />,
    );
    let pending!: Promise<void>;
    act(() => {
      pending = ref.current!.arrangeVisibleGraph();
    });
    rerender(
      <ArchitectureViewer
        ref={ref}
        graph={graph}
        layout={engine}
        filters={{ nodeIds: ['a'] }}
        onNodePositionsChange={onChange}
      />,
    );
    await act(async () => {
      finish({ positions: new Map([['b', [8, 0, 8]]]) });
      await pending;
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
