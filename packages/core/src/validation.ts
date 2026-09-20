import { ArchitectureGraphSchema } from './schema.js';
import type { ArchitectureGraph } from './schema.js';
export type ValidationSeverity = 'error' | 'warning' | 'info';
export type ValidationIssueType =
  | 'schema'
  | 'duplicate-node-id'
  | 'duplicate-group-id'
  | 'duplicate-edge-id'
  | 'missing-source'
  | 'missing-target'
  | 'unknown-group'
  | 'unknown-parent-group'
  | 'group-cycle'
  | 'self-edge'
  | 'orphan-node'
  | 'duplicate-edge';
export interface GraphValidationIssue {
  severity: ValidationSeverity;
  type: ValidationIssueType;
  message: string;
  path?: string;
  nodeId?: string;
  groupId?: string;
  edgeId?: string;
  edgeIndex?: number;
}
export type GraphValidationResult =
  | { valid: true; graph: ArchitectureGraph; issues: GraphValidationIssue[] }
  | { valid: false; issues: GraphValidationIssue[] };
/** Validates untrusted input before semantic checks; only errors prevent rendering. */
export function validateGraph(input: unknown): GraphValidationResult {
  const parsed = ArchitectureGraphSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      issues: parsed.error.issues.map((issue) => ({
        severity: 'error',
        type: 'schema',
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  const graph = parsed.data;
  const issues = validateGraphSemantics(graph);
  return issues.some((issue) => issue.severity === 'error')
    ? { valid: false, issues }
    : { valid: true, graph, issues };
}
/** Requires schema-valid input. Directed relationship cycles are deliberately allowed. */
export function validateGraphSemantics(
  graph: ArchitectureGraph,
): GraphValidationIssue[] {
  const issues: GraphValidationIssue[] = [];
  const nodes = new Set<string>();
  const groups = new Map(graph.groups.map((group) => [group.id, group]));
  const groupIds = new Set<string>();
  for (const node of graph.nodes) {
    if (nodes.has(node.id))
      issues.push({
        severity: 'error',
        type: 'duplicate-node-id',
        nodeId: node.id,
        message: `Duplicate node ID: ${node.id}.`,
      });
    nodes.add(node.id);
    if (node.group && !groups.has(node.group))
      issues.push({
        severity: 'error',
        type: 'unknown-group',
        nodeId: node.id,
        groupId: node.group,
        message: `Unknown group: ${node.group}.`,
      });
  }
  for (const group of graph.groups) {
    if (groupIds.has(group.id))
      issues.push({
        severity: 'error',
        type: 'duplicate-group-id',
        groupId: group.id,
        message: `Duplicate group ID: ${group.id}.`,
      });
    groupIds.add(group.id);
    if (group.parent && !groups.has(group.parent))
      issues.push({
        severity: 'error',
        type: 'unknown-parent-group',
        groupId: group.id,
        message: `Unknown parent group: ${group.parent}.`,
      });
    const visited = new Set<string>([group.id]);
    let parent = group.parent;
    while (parent && groups.has(parent)) {
      if (visited.has(parent)) {
        issues.push({
          severity: 'error',
          type: 'group-cycle',
          groupId: group.id,
          message: `Group ancestry contains a cycle: ${group.id}.`,
        });
        break;
      }
      visited.add(parent);
      parent = groups.get(parent)?.parent;
    }
  }
  const incident = new Set<string>();
  const edges = new Set<string>();
  const edgeIds = new Set<string>();
  graph.edges.forEach((edge, edgeIndex) => {
    const context = { edgeId: edge.id, edgeIndex };
    if (edge.id && edgeIds.has(edge.id))
      issues.push({
        ...context,
        severity: 'error',
        type: 'duplicate-edge-id',
        message: `Duplicate edge ID: ${edge.id}.`,
      });
    if (edge.id) edgeIds.add(edge.id);
    if (!nodes.has(edge.source))
      issues.push({
        ...context,
        severity: 'error',
        type: 'missing-source',
        nodeId: edge.source,
        message: `Unknown edge source: ${edge.source}.`,
      });
    if (!nodes.has(edge.target))
      issues.push({
        ...context,
        severity: 'error',
        type: 'missing-target',
        nodeId: edge.target,
        message: `Unknown edge target: ${edge.target}.`,
      });
    if (edge.source === edge.target)
      issues.push({
        ...context,
        severity: 'warning',
        type: 'self-edge',
        nodeId: edge.source,
        message: 'Node has a self-referencing relationship.',
      });
    if (nodes.has(edge.source) && nodes.has(edge.target)) {
      incident.add(edge.source);
      incident.add(edge.target);
    }
    const key = JSON.stringify([
      edge.source,
      edge.target,
      edge.type ?? '',
      edge.label ?? '',
    ]);
    if (edges.has(key))
      issues.push({
        ...context,
        severity: 'warning',
        type: 'duplicate-edge',
        message: 'Duplicate source, target, type, and label.',
      });
    edges.add(key);
  });
  for (const node of graph.nodes)
    if (!incident.has(node.id))
      issues.push({
        severity: 'info',
        type: 'orphan-node',
        nodeId: node.id,
        message: 'Node has no relationships.',
      });
  return issues;
}
