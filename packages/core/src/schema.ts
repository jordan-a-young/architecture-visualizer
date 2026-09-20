import { z } from 'zod';
const nonEmpty = z.string().trim().min(1);
const metadata = z.record(z.string(), z.unknown());
/** Relative links, fragments, HTTP(S), and mailto are supported. No executable schemes. */
export function isSafeHref(href: string): boolean {
  if (
    !href ||
    href !== href.trim() ||
    [...href].some(
      (char) =>
        char === '\\' || char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127,
    )
  )
    return false;
  if (href.startsWith('//')) return false;
  try {
    const url = new URL(href, 'https://archviz.invalid/');
    return ['https:', 'http:', 'mailto:'].includes(url.protocol);
  } catch {
    return false;
  }
}
export const ArchitectureLinkSchema = z
  .object({
    id: nonEmpty.optional(),
    label: nonEmpty,
    href: z
      .string()
      .refine(isSafeHref, 'Use a safe HTTP(S), mailto, or relative URL.'),
    type: nonEmpty.optional(),
    icon: nonEmpty.optional(),
    external: z.boolean().optional(),
  })
  .strict();
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
export const NodeVisualSchema = z
  .object({
    color: color.optional(),
    size: z.number().finite().min(0.25).max(2).optional(),
  })
  .strict();
export const EdgeVisualSchema = z
  .object({
    color: color.optional(),
    width: z.number().finite().min(0.5).max(8).optional(),
    dashed: z.boolean().optional(),
  })
  .strict();
export const ArchitectureNodeSchema = z
  .object({
    id: nonEmpty,
    label: nonEmpty,
    type: nonEmpty,
    description: z.string().optional(),
    group: nonEmpty.optional(),
    tags: z.array(nonEmpty).optional(),
    links: z.array(ArchitectureLinkSchema).optional(),
    metadata: metadata.optional(),
    visual: NodeVisualSchema.optional(),
  })
  .strict();
export const ArchitectureEdgeSchema = z
  .object({
    id: nonEmpty.optional(),
    source: nonEmpty,
    target: nonEmpty,
    type: nonEmpty.optional(),
    label: z.string().optional(),
    metadata: metadata.optional(),
    visual: EdgeVisualSchema.optional(),
  })
  .strict();
export const ArchitectureGroupSchema = z
  .object({
    id: nonEmpty,
    label: nonEmpty,
    parent: nonEmpty.optional(),
    description: z.string().optional(),
    metadata: metadata.optional(),
  })
  .strict();
export const ArchitectureGraphSchema = z
  .object({
    version: z.literal('1.0'),
    nodes: z.array(ArchitectureNodeSchema),
    edges: z.array(ArchitectureEdgeSchema),
    groups: z.array(ArchitectureGroupSchema),
    metadata: metadata.optional(),
  })
  .strict();
export type ArchitectureGraph = z.infer<typeof ArchitectureGraphSchema>;
export type ArchitectureNode = z.infer<typeof ArchitectureNodeSchema>;
export type ArchitectureEdge = z.infer<typeof ArchitectureEdgeSchema>;
export type ArchitectureGroup = z.infer<typeof ArchitectureGroupSchema>;
export type ArchitectureLink = z.infer<typeof ArchitectureLinkSchema>;
export type NodeVisual = z.infer<typeof NodeVisualSchema>;
export type EdgeVisual = z.infer<typeof EdgeVisualSchema>;
