// Load R3F's React JSX augmentation for consumer-defined node renderers.
import '@react-three/fiber';
import './styles.css';
export { ArchitectureViewer } from './ArchitectureViewer.js';
export { DefaultDetailsPanel } from './DetailsPanel.js';
export { DefaultNodeRenderer, getNodeColor } from './Node.js';
export { defaultEdgeStyle } from './Edge.js';
export {
  layeredLayout,
  computeLayout,
  validateLayoutGeometry,
  defaultNodeSize,
} from './layout.js';
export type {
  Layout,
  LayoutFunction,
  LayoutResult,
  Position3,
  LayoutEngine,
  LayoutGeometry,
  NodeSize,
} from './layout.js';
export { useFilteredGraph } from './hooks.js';
export type {
  ArchitectureViewerProps,
  ArchitectureViewerHandle,
  ScreenshotOptions,
  NodePositions,
  NodeRendererProps,
  NodeRendererRegistry,
  EdgeStyle,
  GroupStyle,
  DetailsPanelProps,
} from './types.js';

export { getEdgeKey } from './edgeKey.js';
export { DefaultEdgeDetailsPanel } from './EdgeDetailsPanel.js';
export type { EdgeDetailsPanelProps } from './types.js';

export type { WalkthroughState } from './types.js';

export { parseViewState } from './viewState.js';
export type {
  CameraState,
  ViewerViewState,
  SerializableGraphFilters,
} from './viewState.js';

export { routeEdges, countRouteCrossings } from './routing.js';
export type { RoutingOptions } from './routing.js';
