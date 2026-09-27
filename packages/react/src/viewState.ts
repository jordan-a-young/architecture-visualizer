import type { GraphFilterOptions } from 'archgraph-core';
import type { Position3 } from './layout.js';
import type { NodePositions, WalkthroughState } from './types.js';
export interface CameraState {
  position: Position3;
  target: Position3;
}
export type SerializableGraphFilters = Omit<GraphFilterOptions, 'predicate'>;
export interface ViewerViewState {
  version: 1;
  collapsedGroupIds: readonly string[];
  camera: CameraState | null;
  nodePositions: NodePositions;
  filters: SerializableGraphFilters;
  selectedNodeId: string | null;
  selectedEdgeKey: string | null;
  walkthrough: WalkthroughState | null;
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('View state must contain objects.');
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key)))
    throw new Error('Unknown view state field.');
}
function string(value: unknown): string {
  if (typeof value !== 'string')
    throw new Error('View state IDs and filters must be strings.');
  return value;
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value))
    throw new Error('View state lists must be arrays.');
  return value.map(string);
}
function position(value: unknown): Position3 {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    !value.every((v) => typeof v === 'number' && Number.isFinite(v))
  )
    throw new Error('View positions must be finite [x, y, z] tuples.');
  return [...value] as Position3;
}
/** Validate untrusted saved JSON and return a detached, serializable copy. */
export function parseViewState(input: unknown): ViewerViewState {
  const value = object(input);
  keys(value, [
    'version',
    'collapsedGroupIds',
    'camera',
    'nodePositions',
    'filters',
    'selectedNodeId',
    'selectedEdgeKey',
    'walkthrough',
  ]);
  if (value.version !== 1) throw new Error('Unsupported view state version.');
  let camera: CameraState | null = null;
  if (value.camera !== null) {
    const raw = object(value.camera);
    keys(raw, ['position', 'target']);
    camera = { position: position(raw.position), target: position(raw.target) };
    const distance = Math.hypot(
      ...camera.position.map((v, i) => v - camera!.target[i]!),
    );
    if (!Number.isFinite(distance) || distance < 3 - 1e-6)
      throw new Error('Camera must be at least 3 units from its target.');
  }
  const rawFilters = object(value.filters);
  keys(rawFilters, ['nodeIds', 'types', 'groupIds', 'tags', 'query']);
  const filters: SerializableGraphFilters = {};
  for (const key of ['nodeIds', 'types', 'groupIds', 'tags'] as const)
    if (rawFilters[key] !== undefined) filters[key] = strings(rawFilters[key]);
  if (rawFilters.query !== undefined) filters.query = string(rawFilters.query);
  let walkthrough: WalkthroughState | null = null;
  if (value.walkthrough !== null) {
    const raw = object(value.walkthrough);
    keys(raw, ['startNodeId', 'edgeKeys']);
    walkthrough = {
      startNodeId: string(raw.startNodeId),
      edgeKeys: strings(raw.edgeKeys),
    };
  }
  return {
    version: 1,
    collapsedGroupIds:
      value.collapsedGroupIds === undefined
        ? []
        : strings(value.collapsedGroupIds),
    camera,
    filters,
    walkthrough,
    nodePositions: Object.fromEntries(
      Object.entries(object(value.nodePositions)).map(([id, p]) => [
        id,
        position(p),
      ]),
    ),
    selectedNodeId:
      value.selectedNodeId === null ? null : string(value.selectedNodeId),
    selectedEdgeKey:
      value.selectedEdgeKey === null ? null : string(value.selectedEdgeKey),
  };
}
