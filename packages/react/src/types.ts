import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
  GraphFilterOptions,
} from 'archgraph-core';
import type { Layout, Position3 } from './layout.js';
export type NodePositions = Readonly<Record<string, Position3>>;
export interface NodeRendererProps {
  node: ArchitectureNode;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  color: string;
  opacity: number;
}
export type NodeRendererRegistry = Readonly<
  Record<string, ComponentType<NodeRendererProps>>
>;
export interface EdgeStyle {
  color?: string;
  width?: number;
  dashed?: boolean;
}
export interface DetailsPanelProps {
  graph: ArchitectureGraph;
  node: ArchitectureNode | null;
  visibleNodeIds?: readonly string[];
  onNodeSelect: (node: ArchitectureNode | null) => void;
}
export interface ArchitectureViewerProps {
  graph: ArchitectureGraph;
  /** undefined = uncontrolled; null = controlled with no selection. */
  selectedNodeId?: string | null;
  defaultSelectedNodeId?: string;
  onNodeSelect?: (node: ArchitectureNode | null) => void;
  highlightedNodeIds?: readonly string[];
  filters?: GraphFilterOptions;
  layout?: Layout;
  /** Opt in to moving nodes on the horizontal plane at their current height. */
  draggableNodes?: boolean;
  /** Controlled manual position overrides, keyed by node ID. */
  nodePositions?: NodePositions;
  /** Initial overrides for uncontrolled usage. */
  defaultNodePositions?: NodePositions;
  /** Proposed overrides during drag and an empty map on reset. */
  onNodePositionsChange?: (positions: NodePositions) => void;
  /** Final proposed position after a completed drag, not a click or cancellation. */
  onNodeDragEnd?: (node: ArchitectureNode, position: Position3) => void;
  nodeRenderers?: NodeRendererRegistry;
  edgeStyle?: (edge: ArchitectureEdge) => EdgeStyle;
  showEdgeLabels?: boolean;
  showDetailsPanel?: boolean;
  /** Show the PNG download button. The imperative capture API remains available. */
  showScreenshotButton?: boolean;
  renderDetails?: (props: DetailsPanelProps) => ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}
export interface ArchitectureViewerHandle {
  resetCamera: () => void;
  /** Clear manual overrides. Controlled consumers must apply onNodePositionsChange. */
  resetLayout: () => void;
  /** Current camera view at canvas resolution, excluding viewer chrome and inspector. */
  captureScreenshot: (options?: ScreenshotOptions) => Promise<Blob>;
}
export interface ScreenshotOptions {
  /** Include built-in node and relationship labels. Defaults to true. */
  includeLabels?: boolean;
}
