// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('./Scene.js', () => ({ GraphScene: () => null }));
import { ArchitectureViewer } from './ArchitectureViewer.js';

const graph = {
  version: '1.0' as const,
  nodes: [{ id: 'a', label: 'A', type: 'service' }],
  edges: [],
  groups: [],
};
const restore: (() => void)[] = [];
function property(
  target: object,
  name: string,
  descriptor: PropertyDescriptor,
) {
  const before = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, ...descriptor });
  restore.push(() => {
    if (before) Object.defineProperty(target, name, before);
    else Reflect.deleteProperty(target, name);
  });
}
function installFullscreen() {
  let current: Element | null = null;
  const change = (element: Element | null) => {
    current = element;
    document.dispatchEvent(new Event('fullscreenchange'));
  };
  const request = vi.fn(function (this: HTMLElement) {
    change(this);
    return Promise.resolve();
  });
  const exit = vi.fn(() => {
    change(null);
    return Promise.resolve();
  });
  property(document, 'fullscreenEnabled', { value: true });
  property(document, 'fullscreenElement', { get: () => current });
  property(document, 'exitFullscreen', { value: exit });
  property(HTMLElement.prototype, 'requestFullscreen', { value: request });
  return { request, exit, change };
}
afterEach(() => {
  cleanup();
  restore
    .splice(0)
    .reverse()
    .forEach((reset) => reset());
});

describe('viewer fullscreen', () => {
  it('hides unavailable or policy-disabled fullscreen controls', () => {
    const { unmount } = render(<ArchitectureViewer graph={graph} />);
    expect(
      screen.queryByRole('button', { name: 'Enter fullscreen' }),
    ).not.toBeInTheDocument();
    unmount();
    installFullscreen();
    property(document, 'fullscreenEnabled', { value: false });
    render(<ArchitectureViewer graph={graph} />);
    expect(
      screen.queryByRole('button', { name: 'Enter fullscreen' }),
    ).not.toBeInTheDocument();
  });
  it('scopes state to each viewer and preserves selection when Escape exits fullscreen', async () => {
    const api = installFullscreen();
    const select = vi.fn();
    render(
      <>
        <ArchitectureViewer
          graph={graph}
          ariaLabel="First viewer"
          selectedNodeId="a"
          onNodeSelect={select}
        />
        <ArchitectureViewer graph={graph} ariaLabel="Second viewer" />
      </>,
    );
    const first = screen.getByLabelText('First viewer');
    const second = screen.getByLabelText('Second viewer');
    await act(async () =>
      fireEvent.click(
        within(first).getByRole('button', { name: 'Enter fullscreen' }),
      ),
    );
    expect(
      within(first).getByRole('button', { name: 'Exit fullscreen' }),
    ).toBeEnabled();
    expect(
      within(second).getByRole('button', { name: 'Enter fullscreen' }),
    ).toBeDisabled();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(select).not.toHaveBeenCalled();
    act(() => api.change(null));
    expect(
      within(first).getByRole('button', { name: 'Enter fullscreen' }),
    ).toBeEnabled();
    expect(
      within(second).getByRole('button', { name: 'Enter fullscreen' }),
    ).toBeEnabled();
    fireEvent.keyDown(first, { key: 'Escape' });
    expect(select).toHaveBeenCalledWith(null);
    expect(api.exit).not.toHaveBeenCalled();
  });
  it('handles entry and exit rejections and allows retry', async () => {
    const api = installFullscreen();
    api.request.mockRejectedValueOnce(new Error('Entry denied'));
    render(<ArchitectureViewer graph={graph} />);
    const enter = screen.getByRole('button', { name: 'Enter fullscreen' });
    await act(async () => fireEvent.click(enter));
    expect(screen.getByRole('alert')).toHaveTextContent('Entry denied');
    expect(enter).toBeEnabled();
    await act(async () => fireEvent.click(enter));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    api.exit.mockRejectedValueOnce(new Error('Exit denied'));
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' })),
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Exit denied');
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' })),
    );
    expect(
      screen.getByRole('button', { name: 'Enter fullscreen' }),
    ).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
