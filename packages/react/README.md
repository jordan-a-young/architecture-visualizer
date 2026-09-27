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

## Search, focus and relationships

Browse nodes includes a case-insensitive search over visible node IDs, labels, types, descriptions, and tags. Search narrows the list while preserving the scene and its context; `showSearch={false}` hides the input. Select a result and use **Focus node** to center the camera. `ref.focusNode(id): boolean` focuses without selecting and returns false for a missing/filtered node. Reset camera fits the visible graph again.

Click an edge or its label, or use the keyboard-accessible Relationships list, to inspect direction, type, label and metadata. `selectedEdgeKey` controls selection (`null` clears it); `defaultSelectedEdgeKey` initializes internal selection. `onEdgeSelect(edge, key)` reports intent. `getEdgeKey(edge, indexInFullGraph)` produces collision-safe keys: explicit edge IDs survive reorder; anonymous keys are tied to full-graph array indices, so use IDs for persistent selection. `highlightedEdgeKeys` emphasizes additional edges. Filtering hides a selected relationship without emitting a synthetic callback. Selecting nodes proposes clearing edge selection and vice versa; controlled hosts should accept both callbacks to maintain exclusive selection. If both are controlled as selected, the edge inspector takes precedence.

`DefaultEdgeDetailsPanel` and `renderEdgeDetails` support custom inspection. Custom renderers that stop pointer propagation own that behavior. No graph fields or runtime dependencies are added.

## Connection walkthrough

Select a node and choose **Start walkthrough**. **Next** follows a single outgoing relationship or presents explicit choices for branches, including parallel edges. **Previous** returns along the visited path; numbered breadcrumbs return to an earlier visit. Cycles, retries, and self-loops may be followed repeatedly. Dead ends disable Next. Reset walkthrough clears the path. This is a user-chosen architectural route, not evidence of a runtime request.

`walkthrough?: WalkthroughState | null`, `defaultWalkthrough`, and `onWalkthroughChange` support controlled/internal state. A state is `{ startNodeId, edgeKeys }`, using `getEdgeKey` from the full graph. While active, the walkthrough determines the inspected node and highlights its path. It does not change the camera automatically. Clicking another node/edge proposes ending it; controlled hosts must accept that proposal. `showWalkthrough={false}` hides the controls so hosts can supply their own navigation.

Filtered targets are disabled rather than silently revealing hidden data. A hidden current step can be revisited with Previous. After graph changes the viewer displays only the longest valid prefix without synthetic callbacks; missing start nodes hide the walkthrough. Use explicit edge IDs for paths that must survive graph reorder. No discovery or additional flow schema is involved.

## Saved view state

`ref.getViewState(): ViewerViewState` returns a detached, JSON-serializable snapshot of camera position/target, manual node positions, filters, selection, and walkthrough. `ref.restoreViewState(unknown)` validates the complete versioned snapshot before making changes. `parseViewState(unknown)` is exported for validating stored data. Camera is `null` before WebGL is ready or when unavailable; other view fields remain usable. Capture once the scene is ready to include its camera.

Persistence belongs to the consuming application. The package does not read or write localStorage, files, URLs, or a backend. The demo provides named browser-local views with explicit save/restore/delete actions.

Filters now support `defaultFilters` and `onFiltersChange` as well as controlled `filters`. Restoring proposes updates for controlled filters, positions, node/edge selection, and walkthrough; the host must apply their callbacks. Uncontrolled fields update internally. Camera restoration is imperative. A snapshot is not a transaction across host callbacks: hosts should apply their proposals together. Invalid snapshots change nothing.

Predicate filters cannot be serialized: capture rejects them with a clear error instead of dropping their meaning. Custom layout functions/renderers, graph data, transient highlighting, search text, and label visibility are not saved; supply the same graph and layout when restoring. Missing node/edge references and removed position overrides are discarded; walkthroughs retain their valid prefix. Camera tuples must be finite, with at least 3 units between position and target. Use explicit edge IDs for saved edge selection and paths across graph reorder.

## Collapsible groups

Use Browse nodes → Groups or provide `collapsedGroupIds`, `defaultCollapsedGroupIds`, and `onCollapsedGroupsChange`. Controlled hosts must accept proposed changes, including expansion clicks and saved-view restoration.

```tsx
const [collapsed, setCollapsed] = useState<readonly string[]>([]);
<ArchitectureViewer
  graph={graph}
  collapsedGroupIds={collapsed}
  onCollapsedGroupsChange={setCollapsed}
/>;
```

Collapse projects visible group members into a neutral summary at their average position. The outermost collapsed ancestor wins; expanding a parent preserves a collapsed child's state. Empty/fully filtered groups produce no summary. Counts reflect members remaining after filtering. Cross-boundary edges retain individual identities, direction, style and original inspector data; internal relationships are hidden from the scene. Parallel relationships remain separate.

Summary clicks expand the group without selecting a synthetic architecture node. Summaries use built-in geometry and cannot be dragged. Original manual positions and selection survive collapse/expand. Hidden nodes cannot be focused or visited by Next until their group expands. Hiding the current step also hides any pending branch choices. The edge inspector disables hidden endpoints until their groups expand; custom edge panels receive `visibleNodeIds` to apply the same rule. The graph schema, node renderer callbacks, edge callbacks and custom details panels continue to use original architecture data. There are no provider-specific grouping rules or automatic discovery.

Saved views include `collapsedGroupIds`; older version-1 snapshots without this field restore with all groups expanded. The library performs no persistence or network requests.
