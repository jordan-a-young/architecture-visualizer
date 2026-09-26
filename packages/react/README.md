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

## Node dragging

Enable `draggableNodes` to move nodes by dragging their geometry or label with a mouse, pen, or touch. Movement follows the horizontal world plane at the node's starting height. Connected edges follow immediately. A short click still selects; dragging does not navigate or change selection. Orbit controls pause during a drag and resume afterward. Escape, pointer cancellation, or losing focus rolls back the active gesture. Drag the background to orbit as before.

```tsx
import { useState } from 'react';
import type { NodePositions } from 'archgraph-react';

const [positions, setPositions] = useState<NodePositions>({});
<ArchitectureViewer
  graph={graph}
  draggableNodes
  nodePositions={positions}
  onNodePositionsChange={setPositions}
  onNodeDragEnd={(node, position) => console.log(node.id, position)}
/>;
```

Omit `nodePositions` for internal state; `defaultNodePositions` supplies initial overrides. Positions are finite `[x, y, z]` tuples keyed by node ID, separate from `ArchitectureGraph`. Controlled consumers receive proposals and must update `nodePositions` to accept them. `onNodePositionsChange` fires during movement and cancellation rollback; `onNodeDragEnd` reports the final proposed position only after a completed drag. No callback writes to the graph or persists data externally.

The automatic/custom layout runs on the full graph. Filtering only hides nodes, so existing coordinates and manual overrides survive filters. Overrides survive camera reset; removing a node discards its internal override. **Reset layout** and `ref.resetLayout()` clear overrides (proposing `{}` in controlled mode). **Reset camera** fits the currently visible, moved nodes. Moving nodes never automatically reframes the camera. Custom geometry inherits dragging from the viewer's wrapper unless it stops pointer propagation.

Dragging defaults to off in the library and on in the demo. V1 supports one pointer and a horizontal plane, without collision avoidance, snapping, axis handles, or keyboard movement. Near-horizontal camera rays leave a node in place to avoid unstable intersections. The existing keyboard node list and selection remain available.
