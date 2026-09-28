import ELK from 'elkjs/lib/elk.bundled.js';
import type { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api.js';
import type { ArchitectureNode } from 'archgraph-core';
import type {
  LayoutEngine,
  LayoutGeometry,
  NodeSize,
  Position3,
} from './layout.js';
import { getEdgeKey } from './edgeKey.js';
import { defaultNodeSize } from './layout.js';

export interface ElkLayoutOptions {
  direction?: 'RIGHT' | 'DOWN';
  /** World units, at least 1. Defaults to 3 between nodes and 5 between layers. */
  spacing?: number;
  layerSpacing?: number;
  respectGroups?: boolean;
  nodeSize?: (node: ArchitectureNode) => NodeSize;
  /** Host-owned runner, e.g. a bundled Web Worker. No worker URL is fetched here. */
  runner?: { layout: (graph: ElkNode) => Promise<ElkNode> };
}
const scale = 50;
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Optional subpath: importing archgraph-react never imports ELK. */
export function createElkLayout(options: ElkLayoutOptions = {}): LayoutEngine {
  const {
    direction = 'RIGHT',
    spacing = 3,
    layerSpacing = 5,
    respectGroups = true,
    nodeSize = defaultNodeSize,
  } = options;
  if (
    ![spacing, layerSpacing].every(
      (value) => Number.isFinite(value) && value >= 1,
    )
  )
    throw new Error('Layout spacing must be finite and at least 1.');
  const runner = options.runner ?? new ELK({ algorithms: ['layered'] });
  return {
    async compute(graph): Promise<LayoutGeometry> {
      const nodes = [...graph.nodes].sort((a, b) => compare(a.id, b.id));
      const groups = [...graph.groups].sort((a, b) => compare(a.id, b.id));
      const ids = new Map(nodes.map((node, i) => [node.id, `n${i}`]));
      const groupIds = new Map(groups.map((group, i) => [group.id, `g${i}`]));
      const sizes = new Map(nodes.map((node) => [node.id, nodeSize(node)]));
      for (const size of sizes.values())
        if (
          ![size.width, size.depth].every(
            (value) => Number.isFinite(value) && value > 0,
          )
        )
          throw new Error('Layout node sizes must be finite and positive.');
      if (!nodes.length)
        return { positions: new Map(), nodeSizes: sizes, edgePaths: new Map() };
      const root: ElkNode = {
        id: 'root',
        children: [],
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': direction,
          'elk.edgeRouting': 'ORTHOGONAL',
          'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
          'elk.randomSeed': '1',
          'elk.spacing.nodeNode': String(spacing * scale),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(
            layerSpacing * scale,
          ),
          'elk.spacing.edgeNode': '25',
          'elk.spacing.edgeEdge': '20',
          'elk.padding': '[top=100,left=80,bottom=80,right=80]',
        },
      };
      const containers = new Map(
        groups.map((group) => [
          group.id,
          {
            id: groupIds.get(group.id)!,
            children: [],
            layoutOptions: { ...root.layoutOptions },
          } as ElkNode,
        ]),
      );
      if (respectGroups)
        for (const group of groups)
          (containers.get(group.parent ?? '') ?? root).children!.push(
            containers.get(group.id)!,
          );
      for (const node of nodes) {
        const size = sizes.get(node.id)!;
        const parent = respectGroups
          ? (containers.get(node.group ?? '') ?? root)
          : root;
        parent.children!.push({
          id: ids.get(node.id)!,
          width: size.width * scale,
          height: size.depth * scale,
        });
      }
      const prune = (parent: ElkNode) => {
        parent.children = parent.children?.filter((child) => {
          if (!child.children) return true;
          prune(child);
          return child.children!.length > 0;
        });
      };
      prune(root);
      const edges = graph.edges
        .map((edge, i) => ({ edge, key: getEdgeKey(edge, i) }))
        .sort((a, b) => compare(a.key, b.key));
      root.edges = edges.map(({ edge }, i) => ({
        id: `e${i}`,
        sources: [ids.get(edge.source)!],
        targets: [ids.get(edge.target)!],
      }));
      const result = await runner.layout(root);
      const positions = new Map<string, Position3>();
      const origins = new Map<string, [number, number]>();
      const reverseIds = new Map(
        [...ids].map(([id, internal]) => [internal, id]),
      );
      const paths = new Map<string, Position3[]>();
      const returnedEdges: { edge: ElkExtendedEdge; parent: string }[] = [];
      const centerX = (result.width ?? 0) / 2;
      const centerZ = (result.height ?? 0) / 2;
      const walk = (parent: ElkNode, x = 0, z = 0) => {
        x += parent.x ?? 0;
        z += parent.y ?? 0;
        origins.set(parent.id, [x, z]);
        const id = reverseIds.get(parent.id);
        if (id)
          positions.set(id, [
            (x + (parent.width ?? 0) / 2 - centerX) / scale,
            0,
            (z + (parent.height ?? 0) / 2 - centerZ) / scale,
          ]);
        for (const edge of parent.edges ?? [])
          returnedEdges.push({ edge, parent: parent.id });
        for (const child of parent.children ?? []) walk(child, x, z);
      };
      walk(result);
      for (const { edge, parent } of returnedEdges) {
        const index = Number(edge.id.slice(1));
        const key = edges[index]?.key;
        // Binary relationships normally have one section. Leave complex section trees to the fallback router.
        if (!key || edge.sections?.length !== 1) continue;
        const section = edge.sections[0]!;
        const [x, z] = origins.get(edge.container ?? parent) ?? [0, 0];
        paths.set(
          key,
          [
            section.startPoint,
            ...(section.bendPoints ?? []),
            section.endPoint,
          ].map((p) => [
            (p.x + x - centerX) / scale,
            0,
            (p.y + z - centerZ) / scale,
          ]),
        );
      }
      return { positions, nodeSizes: sizes, edgePaths: paths };
    },
  };
}
