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

## Fullscreen and browser support

**Enter fullscreen** expands this viewer, including its legend and inspector, using the standard Fullscreen API. **Exit fullscreen**, Escape or the browser's fullscreen control restores the embedded view. Fullscreen changes resize the canvas; PNG capture uses its current pixel resolution. Selection, manual positions and graph data stay intact. Escape while the viewer is fullscreen is reserved for exiting fullscreen; outside fullscreen it clears selection as usual.

The button is hidden when the standard API is unavailable or disabled by browser policy. In embedded applications, the host must permit fullscreen on the containing iframe. A rejected entry/exit request shows an inline error and can be retried. Multiple viewers track their own fullscreen state; controls on other viewers are disabled while another element is fullscreen. Fullscreen is transient browser state and is not stored in `ViewerViewState`. On narrow screens the fullscreen viewer scrolls so the inspector remains reachable.

The installed Three.js renderer requires **WebGL2**. A WebGL1-only browser uses the keyboard-accessible inspector fallback; the package does not attempt an unsupported WebGL1 renderer. Fullscreen and graph inspection can still work without a 3D canvas. No extra browser polyfills or dependencies are included.

## Node labels

Node captions are compact, single-line names placed beside the projected node geometry. They stay a readable screen size as you zoom, rather than growing with the mesh. Long names use an ellipsis; the full name remains in the native tooltip, accessible button name, Browse nodes list and inspector. Type and group context remain in the tooltip and inspector instead of a second caption line.

```tsx
import type { NodeLabelMode } from 'archgraph-react';
const labelMode: NodeLabelMode = 'auto';
<ArchitectureViewer graph={graph} nodeLabelMode={labelMode} />;
```

- `auto` (default): show captions where a nearby slot fits, hide ordinary captions when the node projects to less than 8 pixels, and prioritize keyboard focus, selection, hover and highlighted nodes.
- `selected`: show only hovered, selected, keyboard-focused or highlighted node captions.
- `none`: hide all node captions. Geometry selection, dragging, Browse nodes and the inspector remain available.

Placement reserves screen-space bounds for all visible node geometry, including meshes returned by `nodeRenderers`, and avoids previously placed node captions. It tries nearby sides without moving nodes and retains a valid side to avoid jumping on hover. When no slot fits, even a selected caption may hide; zoom in, focus the node, or use the keyboard-accessible Browse nodes list. This conservative bounding-box approach does not promise optimal labeling for arbitrarily dense graphs. Group captions are secondary and yield to nodes/captions; group collapse controls remain in Browse nodes. Edge labels are controlled separately by `showEdgeLabels` and may still overlap.

The demo exposes a **Node labels** selector. The library prop belongs to host configuration and is not saved in `ViewerViewState`. PNG exports use the current visible captions, positions and truncation; `includeLabels: false` omits all built-in labels. No graph or layout schema changes are required.

## Relationship styles and legend

Configure arbitrary relationship types with `relationshipStyles`. The library assigns no meaning to a pattern; consumers choose the names and conventions for their graph.

```tsx
import type { RelationshipStyleRegistry } from 'archgraph-react';

const relationshipStyles: RelationshipStyleRegistry = {
  calls: { label: 'Synchronous call', color: '#597ca8', lineStyle: 'solid' },
  publishes: {
    label: 'Event publication',
    description: 'Asynchronous messaging',
    color: '#89729e',
    lineStyle: 'dashed',
  },
  'depends-on': {
    label: 'Code dependency',
    color: '#7c8796',
    lineStyle: 'dotted',
  },
};

<ArchitectureViewer
  graph={graph}
  relationshipStyles={relationshipStyles}
  showRelationshipLegend
  edgeStyle={(edge) => (edge.metadata?.critical ? { width: 2.5 } : {})}
/>;
```

`RelationshipStyle` extends `EdgeStyle` with optional `label` and `description`. `EdgeStyle` supports `color`, `width`, `lineStyle: 'solid' | 'dashed' | 'dotted'`, and the existing `dashed` boolean. All styles retain arrowheads, selection and continuous click targets, including the gaps between dashes or dots. Dots have a minimum diameter of 2 screen pixels. Pattern spacing follows world distance, so gaps change with zoom; very distant routes may appear continuous. Dot allocation is bounded for unusually long routes.

Style precedence, from lowest to highest, is **deterministic defaults → relationship type configuration → original `edge.visual` → `edgeStyle(edge)`**. Omitted properties preserve earlier values. Within one layer, `lineStyle` wins over `dashed`; a later legacy `dashed: true` or `false` overrides an earlier layer's pattern. Unknown and untyped relationships keep the existing default treatment. Callbacks receive original edges even when groups are collapsed. Replace configuration references when changing styles.

`showRelationshipLegend` defaults to `false`; the demo enables it with a checkbox. The collapsible, scrollable legend sits below the canvas and derives its swatches and counts from visible relationships after filtering and group collapse. Per-edge overrides produce separate swatches when their effective styles differ, so one type can have multiple entries. Unused configuration entries are omitted. Labels fall back to the edge type, or “Relationship” for an untyped edge; descriptions appear in native tooltips.

Hover or keyboard focus previews a style; click, Enter or Space pins/unpins it. Matching edges brighten while others fade, preserving selected/highlighted edges and walkthrough emphasis. This never changes selection, filters, node appearance or which edge labels are shown. Escape inside an active legend clears its highlight without clearing selection. Closing/hiding the legend or removing an entry clears the corresponding highlight. Controls also work in the WebGL inspector fallback.

Style configuration and legend highlighting are not included in `ViewerViewState`. The core JSON schema is unchanged: graph `edge.visual` still supports `color`, `width` and `dashed`; configure new `lineStyle` values through React props. PNG captures retain rendered line patterns and current emphasis, but omit the DOM legend below the canvas.

## Screenshot export

The **Download PNG** button saves the current camera view, including visible nodes, relationships, selection styling, and built-in labels. It excludes the toolbar, relationship legend and details panel. Set `showScreenshotButton={false}` to hide the button. Capture uses the current canvas pixel resolution (including its device pixel ratio), with no network requests or persistent drawing buffer.

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

## Optional advanced layout

Install `elkjs@^0.11.1` and import the adapter from `archgraph-react/elk`. Keep the engine reference stable (for example with `useMemo`):

```tsx
import { createElkLayout } from 'archgraph-react/elk';
const layout = useMemo(() => createElkLayout({ direction: 'RIGHT' }), []);
<ArchitectureViewer graph={graph} layout={layout} />;
```

ELK reorders layers to reduce crossings, respects nested groups, and computes orthogonal edge paths. Cycles, self-loops and parallel relationships remain valid. It receives a new, provider-independent geometry graph; input architecture data is never mutated. Stable input ordering and a fixed seed give repeatable layouts for a fixed engine version. Zero crossings cannot be guaranteed for every graph or camera angle.

Options are `direction` (`RIGHT` or `DOWN`), `spacing` (default 3 world units), `layerSpacing` (5), `respectGroups` (true), and `nodeSize(node)` returning a positive `{ width, depth }` footprint in the horizontal plane. Custom geometry larger than the defaults should supply its footprint. Footprints reserve geometry space; camera-dependent HTML label dimensions are not measured by the engine.

Existing synchronous `LayoutFunction` callbacks and `computeLayout` still return position maps. A new `LayoutEngine.compute(graph)` may return or resolve `LayoutGeometry`: `positions`, optional `nodeSizes`, and optional `edgePaths` keyed by `getEdgeKey`. `validateLayoutGeometry` checks finite coordinates, positive sizes and valid paths. The viewer shows a basic layout while waiting or on failure and ignores stale results after graph/engine changes. Manual position overrides survive layout completion. Filters continue to hide nodes without recomputing the layout.

The optional subpath is externalized and ELK is an optional peer; the main viewer entry does not import it. ELK is distributed under its own EPL-2.0 license. The default adapter uses its bundled local implementation, with no asset downloads or provider access. The Promise API does not itself move work off the UI thread. For large graphs, provide a host-owned `runner: { layout(graph): Promise<ElkNode> }` backed by a locally bundled worker; the host owns its lifetime. Custom functions/engine configuration are not serialized in saved views.

## Deployment and group boundaries

Expanded groups display a subtle floor, outline, and label. These are generic groups: a consumer can label one "Checkout deployment", "Team A", or "Production" without changing the schema. `parent` creates nested boundaries. A node has one direct group; use ancestors for containment. Overlapping memberships (such as independent team and deployment memberships) are not modeled as multiple boundaries.

```tsx
<ArchitectureViewer
  graph={graph}
  showGroupBoundaries
  groupStyle={(group) => ({
    color: group.id === 'checkout' ? '#527e91' : '#788b9f',
    fillOpacity: 0.06,
  })}
/>
```

`showGroupBoundaries` defaults to true; false hides the visual outlines without removing grouping or collapse controls. `groupStyle(group)` controls color and fill opacity. Boundary labels collapse groups, using the existing controlled/uncontrolled collapse API; summary labels expand them. Floors and outlines do not intercept node/edge clicks or orbit gestures. Labels are keyboard-accessible and included in PNG exports; geometry-only exports keep the floors/outlines but omit labels.

Bounds enclose visible member footprints and nested children, update while dragging, and disappear for empty/fully filtered or collapsed groups. A collapsed child summary remains enclosed by its parent. Boundary labels do not assert deployment facts: consumers are responsible for choosing the grouping. Arbitrary manual placements or custom layouts can create overlapping boundaries; enable a group-aware layout to arrange separate regions. The camera only reframes on layout changes or explicit reset, not on every drag.

## Relationship routing

`edgeRouting="auto"` uses paths supplied by a layout engine and keeps the existing curved rendering for position-only layouts. `"orthogonal"` opts any layout into routing; `"curved"` explicitly retains curves. Routed edges use attachment points on node footprints, rounded bends, directed arrows and labels on their longest segment. Layout and routing remain separate from rendering.

After dragging or collapse, the pure `routeEdges(graph, positions, options?)` helper reuses valid paths and recomputes paths that are stale or intersect a moved node. It preserves original edge keys for selection, parallel relationships and walkthroughs. The bounded orthogonal search prefers short routes, fewer bends and fewer crossings with earlier routes. It never moves manually placed nodes. Overlapping footprints or an exhausted search use a raised fallback; this is not a guarantee of collision-free routing for arbitrary custom 3D geometry. Node captions use geometry-aware screen-space placement without moving nodes; crowded node/group captions hide when no nearby slot fits. Labels remain camera-dependent and edge labels may still overlap.

`RoutingOptions` accepts optional `nodeSizes`, `edgeKeys`, `preferredPaths`, and `basePositions`. `countRouteCrossings(paths)` counts proper segment crossings in the horizontal reference plane; shared endpoints and collinear overlaps are excluded. Engine footprints must match custom geometry. Rendering uses the routed geometry for both visible lines and hit testing. Provider models and graph JSON are unchanged.

## Arrangement and camera controls

**Top view** or `ref.setCameraPreset('top')` fits the visible graph from above using the existing perspective camera. Orbit/pan/zoom remain available. **Reset camera** and `ref.setCameraPreset('perspective')` restore the angled overview. Presets do not change node positions; saved views retain the exact camera position and target.

**Arrange visible** or `await ref.arrangeVisibleGraph()` explicitly lays out the filtered graph. Existing position overrides remain fixed. New calculated positions become overrides, so they survive filters and are included in saved views; **Reset layout** releases them. Collapsed groups are arranged using their retained member nodes, then projected into summaries. Changing filters alone still preserves the layout. Controlled hosts receive `onNodePositionsChange` and may decline the proposal. Results are discarded if graph, layout, filters or overrides change during calculation; failures preserve current positions and reject the imperative Promise. The built-in control displays errors.

The demo offers advanced/basic layouts, left-to-right/top-to-bottom direction, normal/spacious spacing, a boundary toggle and node label modes. These configuration controls belong to the demo; consuming applications may expose their own. Layout settings are not serialized by the viewer. Keep the same settings when restoring a saved view, or explicitly reset/rearrange it.
