# Working in Architecture Visualizer

These instructions apply throughout this repository. Read the [README](README.md)
and the relevant package README before changing behavior. Keep this file focused
on contributor guidance; usage examples and API details belong in the READMEs.

## Architectural boundaries

- Accept normalized `ArchitectureGraph` data; discovery and enrichment belong in
  consuming applications or separate projects. Do not add provider SDKs, MCP
  integrations, repository/IaC parsing, backends, authentication, or AI agents.
- Library code must not make network calls or load remote assets. Generic links
  navigate only when users activate them.
- `packages/core` (`archgraph-core`) owns types, Zod schemas, validation, and pure
  graph utilities. It must remain independent of React, Three.js, and the DOM.
- `packages/react` (`archgraph-react`) owns visualization and interaction, using
  core's public API. Keep layout calculations separate from rendering.
- `apps/demo` consumes published package exports, without source aliases or
  imports into package internals. Keep demo-specific data and behavior out of
  the libraries.
- Keep types as open strings, metadata arbitrary, and links generic. Relationship
  cycles are valid; group ancestry must remain a hierarchy. Do not introduce
  provider-specific schema fields or assumptions.

## API and implementation

- Treat graphs and consumer-owned values as immutable. Keep layout, camera,
  selection, and manual position state separate from the architecture schema.
- Preserve controlled and uncontrolled behavior. Controlled callbacks report
  intent; consumers decide whether to update the corresponding props.
- Prefer small, composable TypeScript APIs and minimal dependencies. Preserve
  unknown-type rendering, custom-renderer support, keyboard inspection, and the
  inspector fallback when WebGL is unavailable.
- Preserve ESM exports, generated declarations, and the explicit CSS export.
  Keep React, React DOM, Three.js, and R3F externalized as peer dependencies;
  Drei is an externalized normal dependency. Review dependency changes against
  the README's dependency decisions.
- Update relevant READMEs when public behavior or APIs change. Avoid unrelated
  refactors and preserve existing user changes.

## Verification

Use the Node and pnpm versions specified in `package.json`; install with
`pnpm install --frozen-lockfile`. Run commands from the repository root.

- Code changes: run `pnpm check` (lint, types, unit/behavior coverage, builds) and
  `pnpm format:check`. Add focused regression tests for changed behavior.
- Rendering or interaction changes: also run `pnpm test:browser` and inspect the
  affected view or exported artifact. Install Chromium with
  `pnpm exec playwright install chromium` if needed. Test user-visible behavior,
  not private WebGL implementation details.
- Public API, exports, or dependency changes: also run `pnpm test:consumer` to
  verify packed packages in an independent TypeScript/Vite application.
- Documentation-only changes: check formatting and referenced paths/commands;
  new runtime tests are unnecessary. Existing CI still runs its configured checks.
- Report actual results and any blocked checks. Do not claim unrun tests passed.

## Delivery

- Use a focused branch and PR against the intended base; explain behavior,
  validation, and limitations. Keep unrelated work in separate PRs.
- This repository belongs to the personal account `jordan-a-young`. Do not move
  it into an organization or create remote repositories without user approval.
- Do not merge PRs or publish packages without explicit user authorization.
  Follow [the publishing checklist](docs/PUBLISHING.md), including checking npm
  name availability before publication. Keep credentials and registry settings
  outside the repository.

## Development notes

- Toolchain versions live in `package.json` and `pnpm-lock.yaml`; CI uses Node 24.
  `pnpm dev` builds both packages before starting Vite at `http://127.0.0.1:5173`.
- For package development after the first build, run core's
  `tsc -p tsconfig.build.json --watch` and React's `vite build --watch` through
  `pnpm --filter archgraph-core exec` and `pnpm --filter archgraph-react exec`.
  Regenerate declarations after changing public types.
- Vitest defaults to Node; React behavior files opt into jsdom with a file
  directive. Coverage thresholds apply to core only. Browser tests run separately
  in Chromium with SwiftShader; preserve the GPU flags in `playwright.config.ts`.
  `ARCHVIZ_CHROMIUM_PATH` can select an installed Chromium binary.
- Three.js requires WebGL2. Do not treat a WebGL1 context as proof that the
  installed renderer can mount. Keep the inspector usable without WebGL2.
- Keep filenames distinct on case-insensitive filesystems. The walkthrough UI
  is `WalkthroughPanel.tsx`; pure navigation logic is `walkthrough.ts`.
- Fullscreen is browser state scoped to a viewer element. Handle rejected
  promises, unsupported APIs, browser-initiated exits and multiple viewers.
- Private graph fixtures do not belong in this public repository or its build
  inputs. The demo reads local JSON through its file picker; the libraries
  continue to receive normalized graphs through props.
