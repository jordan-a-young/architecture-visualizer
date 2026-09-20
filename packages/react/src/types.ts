import type { ComponentType, CSSProperties, ReactNode } from 'react';
import type {
  ArchitectureEdge,
  ArchitectureGraph,
  ArchitectureNode,
  GraphFilterOptions,
} from 'archgraph-core';
import type { Layout } from './layout.js';
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
  nodeRenderers?: NodeRendererRegistry;
  edgeStyle?: (edge: ArchitectureEdge) => EdgeStyle;
  showEdgeLabels?: boolean;
  showDetailsPanel?: boolean;
  renderDetails?: (props: DetailsPanelProps) => ReactNode;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}
export interface ArchitectureViewerHandle {
  resetCamera: () => void;
}
