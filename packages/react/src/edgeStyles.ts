import type { ArchitectureEdge } from 'archgraph-core';
import type {
  EdgeLineStyle,
  EdgeStyle,
  RelationshipStyleRegistry,
} from './types.js';

const palette = ['#8394ab', '#6c9693', '#a59375', '#9383a4'];
export function defaultEdgeStyle(type = ''): EdgeStyle {
  let hash = 0;
  for (const char of type) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return { color: palette[hash % palette.length], width: 1.4, dashed: false };
}
export interface ResolvedEdgeStyle {
  color: string;
  width: number;
  lineStyle: EdgeLineStyle;
}

/** Apply each layer independently so a later legacy dashed flag can override a pattern. */
export function resolveEdgeStyle(
  edge: ArchitectureEdge,
  registry?: RelationshipStyleRegistry,
  override?: EdgeStyle,
): ResolvedEdgeStyle {
  const defaults = defaultEdgeStyle(edge.type);
  const result: ResolvedEdgeStyle = {
    color: defaults.color!,
    width: defaults.width!,
    lineStyle: 'solid',
  };
  const configured =
    edge.type !== undefined && registry && Object.hasOwn(registry, edge.type)
      ? registry[edge.type]
      : undefined;
  const layers: readonly (EdgeStyle | undefined)[] = [
    configured,
    edge.visual,
    override,
  ];
  for (const layer of layers) {
    if (!layer) continue;
    if (layer.color !== undefined) result.color = layer.color;
    if (layer.width !== undefined) result.width = layer.width;
    if (layer.dashed !== undefined)
      result.lineStyle = layer.dashed ? 'dashed' : 'solid';
    if (layer.lineStyle !== undefined) result.lineStyle = layer.lineStyle;
  }
  return result;
}

export interface RelationshipLegendEntry {
  id: string;
  label: string;
  description?: string;
  style: ResolvedEdgeStyle;
  edgeKeys: string[];
}

/** Derive swatches from final visible styles, including original per-edge overrides. */
export function getRelationshipLegend(
  edges: readonly ArchitectureEdge[],
  edgeKeys: ReadonlyMap<ArchitectureEdge, string>,
  styles: ReadonlyMap<ArchitectureEdge, ResolvedEdgeStyle>,
  registry?: RelationshipStyleRegistry,
): RelationshipLegendEntry[] {
  const entries = new Map<string, RelationshipLegendEntry>();
  for (const edge of edges) {
    const style = styles.get(edge)!;
    const id = JSON.stringify([
      edge.type ?? null,
      style.color,
      style.width,
      style.lineStyle,
    ]);
    let entry = entries.get(id);
    if (!entry) {
      const configured =
        edge.type !== undefined &&
        registry &&
        Object.hasOwn(registry, edge.type)
          ? registry[edge.type]
          : undefined;
      entry = {
        id,
        label: configured?.label ?? edge.type ?? 'Relationship',
        description: configured?.description,
        style,
        edgeKeys: [],
      };
      entries.set(id, entry);
    }
    entry.edgeKeys.push(edgeKeys.get(edge)!);
  }
  return [...entries.values()].sort((a, b) =>
    a.label < b.label ? -1 : a.label > b.label ? 1 : a.id < b.id ? -1 : 1,
  );
}
