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
