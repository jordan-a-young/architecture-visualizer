# AGENTS.md — Architecture Visualizer

AI agent context for the `architecture-visualizer` monorepo. This file is `.gitignore`d — personal/local only.

---

## Project Overview

Provider-independent TypeScript + React toolkit for visualizing software architecture as an interactive 3D graph. Distributed as two npm packages:

- **`archgraph-core`** — Graph model, Zod schemas, validation, pure traversal utilities. Zero UI dependencies.
- **`archgraph-react`** — React/Three.js 3D viewer component. Depends on `archgraph-core`.

**Hard boundary:** These packages never discover, fetch, or connect to anything. Consumers produce the graph JSON; the packages only consume it.

---

## Workspace Structure

```
architecture-visualizer/
├── packages/core/        archgraph-core — schema, validation, graph utilities
├── packages/react/       archgraph-react — 3D viewer, layout, details panel
├── apps/demo/            Vite app exercising the packages (not published)
├── examples/             distributed-system.json + custom-renderer.tsx
├── tests/                Playwright browser tests (demo.spec.ts)
├── scripts/              consumer-smoke.mjs — tarball smoke test
└── docs/                 PUBLISHING.md, VERIFICATION.md, demo-preview.png
```

---

## Toolchain

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥22.12.0 | 24 used in CI |
| pnpm | 11.19.0 | Pinned via `packageManager` field |
| TypeScript | ~5.9.3 | Shared `tsconfig.base.json` |
| Vite | ^7.2.2 | React package + demo app |
| Vitest | ^3.2.4 | Unit tests |
| Playwright | 1.62.1 | Browser integration tests |
| ESLint | ^9.39.0 | Flat config, `@typescript-eslint` |
| Prettier | 3.6.2 | `.prettierrc.json` |

Registry is explicitly pointed at `https://registry.npmjs.org/` via `.npmrc`.

---

## Commands

```bash
# Install
pnpm install --frozen-lockfile

# Dev server (builds packages first, then starts Vite)
pnpm dev                        # http://127.0.0.1:5173

# Full check (CI equivalent — run before committing)
pnpm check                      # lint + typecheck + coverage + build

# Individual steps
pnpm lint                       # ESLint, zero warnings allowed
pnpm typecheck                  # tsc --noEmit across all packages + tools
pnpm test                       # Vitest unit tests (run once)
pnpm test:watch                 # Vitest watch mode
pnpm test:coverage              # Vitest with v8 coverage
pnpm build                      # Recursive build (core → react → demo)
pnpm format                     # Prettier write
pnpm format:check               # Prettier check (CI)

# Package / consumer smoke
pnpm pack:packages              # Produces artifacts/archgraph-{core,react}-0.1.0.tgz
pnpm test:consumer              # Pack + run scripts/consumer-smoke.mjs

# Browser tests (requires Chromium installed)
pnpm exec playwright install chromium
pnpm test:browser
```

### Watch mode for package development

When editing package sources, run in separate terminals after initial build:

```bash
pnpm --filter archgraph-core exec tsc -p tsconfig.build.json --watch
pnpm --filter archgraph-react exec vite build --watch
```

---

## Build Details

### `archgraph-core`

- Built with `tsc -p tsconfig.build.json`
- Output: `packages/core/dist/` — ESM only, `.d.ts` declarations
- No CommonJS output
- Single Zod dependency

### `archgraph-react`

- Built with `vite build` (library mode) + `tsc -p tsconfig.build.json` for declarations
- Output: `packages/react/dist/` — ESM + `styles.css`
- CSS export is a side effect: `archgraph-react/styles.css`
- Peer deps externalized: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`
- React peer range: `>=19.0.0 <19.3.0` (19.3 excluded — R3F doesn't declare support)

### Demo app

- Vite app, `base: './'` for relative asset paths
- Imports packages from workspace (not tarballs)
- Has no source aliases into package internals

---

## Testing

### Unit tests (Vitest)

- Scope: `packages/**/*.test.{ts,tsx}`
- Environment: `jsdom` (configured in `vitest.config.ts`)
- Coverage: v8, core package only, thresholds: lines 90%, functions 90%, branches 85%, statements 90%
- Key test files:
  - `packages/core/src/core.test.ts` — schema, validation, graph utilities
  - `packages/react/src/viewer.test.tsx` — viewer component behavior
  - `packages/react/src/layout.test.ts` — layout algorithm

### Browser tests (Playwright)

- `tests/demo.spec.ts` — real canvas, selection, filtering, links, reset
- Chromium only, single worker
- Uses SwiftShader for software WebGL in CI (`--use-gl=angle --use-angle=swiftshader`)
- Base URL: `http://127.0.0.1:5173` (starts `pnpm dev` as web server)
- Env var `ARCHVIZ_CHROMIUM_PATH` overrides the Chromium executable path

### Consumer smoke test

- `scripts/consumer-smoke.mjs` — standalone Vite/TS app consuming the packed tarballs
- Run via `pnpm test:consumer` — validates public API surface without workspace symlinks

---

## TypeScript Configuration

- `tsconfig.base.json` — shared compiler options (ES2022, strict, noUncheckedIndexedAccess, noUnusedLocals/Parameters)
- `moduleResolution: "Bundler"` — used across packages
- Each package has its own `tsconfig.json` (typecheck) and `tsconfig.build.json` (emit)
- `tsconfig.tools.json` — covers root scripts/configs

---

## Linting

ESLint flat config (`eslint.config.js`):
- `@eslint/js` recommended
- `typescript-eslint` recommended
- `@typescript-eslint/consistent-type-imports: error` — type imports must use `import type`
- Zero warnings allowed (`--max-warnings 0`)

Prettier: single config at `.prettierrc.json`, check runs in CI.

---

## Package Graph / Key Public APIs

### `archgraph-core` exports

```ts
// Schemas (Zod)
ArchitectureGraphSchema, ArchitectureNodeSchema, ArchitectureEdgeSchema
ArchitectureGroupSchema, ArchitectureLinkSchema, NodeVisualSchema, EdgeVisualSchema

// Types
ArchitectureGraph, ArchitectureNode, ArchitectureEdge, ArchitectureGroup
ArchitectureLink, NodeVisual, EdgeVisual

// Validation
validateGraph(unknown)         // → { valid: true, graph, issues } | { valid: false, issues }
validateGraphSemantics(graph)  // → issues[] (schema-valid input only)

// Graph utilities (pure, assume schema-valid input)
getNode, getOutgoingEdges, getIncomingEdges
getDependencies, getDependents, getNeighbors
getConnectedSubgraph(graph, id, depth?)
filterGraph(graph, options)    // nodeIds, types, groupIds, tags, query, predicate
```

### `archgraph-react` exports

```ts
// Primary component
ArchitectureViewer             // Main viewer, props: ArchitectureViewerProps

// Panels / renderers
DefaultDetailsPanel
DefaultNodeRenderer
getNodeColor
defaultEdgeStyle

// Layout
layeredLayout                  // Default deterministic BFS layout
computeLayout

// Hook
useFilteredGraph

// Types
ArchitectureViewerProps, ArchitectureViewerHandle, NodeRendererProps
NodeRendererRegistry, EdgeStyle, DetailsPanelProps, Layout, LayoutFunction
LayoutResult, Position3
```

---

## Data Model Constraints

- `version: '1.0'` is the only valid graph version
- Node/group IDs, labels, types are required and non-empty (trimmed during parse)
- Edge `source`/`target` must reference existing node IDs
- Group `parent` must reference existing group IDs — cycles are errors
- Duplicate node/group IDs or explicit edge IDs are errors
- Self-edges and duplicate `(source, target, type, label)` tuples are warnings
- Orphan nodes (no incident edges) are informational
- `metadata` is `Record<string, unknown>` — use JSON-serializable values
- Node `visual.size`: 0.25–2; Edge `visual.width`: 0.5–8
- Colors: six-digit hex only (`#RRGGBB`)
- Links: HTTP(S), mailto, relative paths, fragments allowed; no executable schemes, no `//` protocol-relative URLs, no backslashes, no control chars

---

## What Does NOT Belong in These Packages

- Cloud SDK / provider integrations
- Source control clients
- IaC parsers (Terraform, CDK, etc.)
- MCP clients or server connections
- Authentication or backend services
- AI agent code
- Remote font, texture, or model fetching
- Discovery plugins of any kind

These belong in separate adapter/consumer projects.

---

## CI

GitHub Actions (`.github/workflows/ci.yml`):
- Triggers: push + pull_request
- Node 24, pnpm 11.19.0
- Steps: `pnpm install` → `pnpm check` → `pnpm format:check` → `pnpm test:consumer` → Playwright install → `pnpm test:browser`

---

## Publication

- Packages not yet published to npm
- Names (`archgraph-core`, `archgraph-react`) are provisional — check npm for collisions before publishing
- `publishConfig.access: "public"` on both packages
- Owner approval required before publishing
- See `docs/PUBLISHING.md` and `docs/VERIFICATION.md` for checklist

---

## Common Gotchas

- **Build order matters.** `archgraph-react` depends on `archgraph-core`. Always build core first. `pnpm dev` and `pnpm build` handle ordering; manual builds must respect it.
- **Declarations regeneration.** After changing public types in a package, rebuild that package to refresh `.d.ts` files so consumers (demo, tests) see updates.
- **React peer range.** `19.3` is excluded. Don't bump the peer range without verifying R3F support.
- **CSS is a side effect.** Import `archgraph-react/styles.css` explicitly. It won't be tree-shaken.
- **No CommonJS.** ESM only. Don't add CJS output without a clear consumer requirement.
- **Coverage scope.** Vitest coverage only covers `packages/core/src/**`. React package tests run but don't contribute to the thresholds.
- **Playwright SwiftShader.** Browser tests need software rendering flags. If adding new Playwright config, preserve the GPU args.
- **Consumer smoke test uses tarballs.** It does not use workspace symlinks — this is intentional to catch packaging issues.
- **`noUncheckedIndexedAccess` is on.** Array/object index access returns `T | undefined`. Handle accordingly.
- **`consistent-type-imports`.** All type-only imports must use `import type { ... }` syntax.
