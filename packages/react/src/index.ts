// Load R3F's React JSX augmentation for consumer-defined node renderers.
import '@react-three/fiber';
import './styles.css';
export { ArchitectureViewer } from './ArchitectureViewer.js';
export { DefaultDetailsPanel } from './DetailsPanel.js';
export { DefaultNodeRenderer, getNodeColor } from './Node.js';
export { defaultEdgeStyle } from './Edge.js';
export { layeredLayout, computeLayout } from './layout.js';
export type {
  Layout,
  LayoutFunction,
  LayoutResult,
  Position3,
} from './layout.js';
export { useFilteredGraph } from './hooks.js';
export type {
  ArchitectureViewerProps,
  ArchitectureViewerHandle,
  ScreenshotOptions,
  NodeRendererProps,
  NodeRendererRegistry,
  EdgeStyle,
  DetailsPanelProps,
} from './types.js';
