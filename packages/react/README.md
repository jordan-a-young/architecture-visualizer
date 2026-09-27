# archgraph-react

A composable React Three Fiber architecture viewer. Supply a normalized graph; inspect nodes, directed relationships, metadata and generic links. No provider connections, discovery, remote assets, or library network calls.

```tsx
import { ArchitectureViewer } from 'archgraph-react';
import 'archgraph-react/styles.css';
<ArchitectureViewer graph={graph} onNodeSelect={(node) => console.log(node)} />;
```

Give the parent a height (for example 700px). Peer dependencies: React and React DOM 19.0–19.2, R3F 9.4+, Three 0.170–0.183. Tested with React 19.2 and Three 0.182. Install matching React/Three type packages when using TypeScript.

Selection may be controlled with `selectedNodeId` (null for none), or internal with optional `defaultSelectedNodeId`. Supports `highlightedNodeIds`, `filters`, custom `nodeRenderers`, `edgeStyle`, `layout`, `renderDetails`, and `ref.resetCamera()`. `DefaultDetailsPanel`, `DefaultNodeRenderer`, `useFilteredGraph`, `computeLayout`, `layeredLayout`, and their types are exported.

Custom renderers are R3F components receiving node, selected/highlighted/dimmed flags, color and opacity. The viewer owns positioning and selection. Custom layouts map every node ID to a finite `[x,y,z]` tuple. Core data stays provider-independent. ESM with declarations and an explicit styles export. MIT licensed.

## Screenshot export

The **Download PNG** button saves the current camera view, including visible nodes, relationships, selection styling, and built-in labels. It excludes the toolbar and details panel. Set `showScreenshotButton={false}` to hide the button. Capture uses the current canvas pixel resolution (including its device pixel ratio), with no network requests or persistent drawing buffer.

```tsx
const viewer = useRef<ArchitectureViewerHandle>(null);
// After the scene is ready, in a user-initiated handler:
const png = await viewer.current!.captureScreenshot();
const geometryOnly = await viewer.current!.captureScreenshot({
  includeLabels: false,
});
// The consuming application owns storage/sharing of these PNG Blobs.
<ArchitectureViewer ref={viewer} graph={graph} />;
```

`captureScreenshot(options?: ScreenshotOptions): Promise<Blob>` rejects if the scene is unavailable, unmounted, hidden, or PNG encoding fails. The built-in button reports errors without losing the inspector. Export includes custom WebGL node geometry. Built-in HTML label backgrounds, borders, text, colors and opacity are composited in their displayed positions; CSS shadows and arbitrary custom DOM overlays are not exported. No external assets or screenshot library are required.
