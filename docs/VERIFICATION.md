# Verification record

## Toolchain migration — 2026-11-12

Development uses Node 26.13.1 and pnpm 12.18.0, with Vite+ and its core alias
pinned to 1.6.0 and Vitest/coverage to 5.1.0 in the workspace catalog.
TypeScript remains 5.9.3. The standalone packed consumer deliberately uses Vite 7.
Peer exceptions accept core's 1.6.0 alias version only for the verified
`vitest@5.1.0` and `@vitest/mocker@5.1.0` Vite peers; `pnpm peers check` passes.

The Vite 7/Vitest 3 baseline passed `pnpm check` (109 tests in 13 files).
Before Vite+ migration, Vitest 4.1.12 passed coverage and TypeScript checks.
Vitest 4's AST-based coverage changed core branch coverage from 98.13% to
97.87%; statements, lines, and functions remain 100%. The same source inventory
and thresholds are retained on Vitest 5.1.0. The generated `clearMocks: false`
compatibility settings were removed after the same 109 tests passed with defaults.
The fullscreen mock is a method, not a constructor, so its behavior is unchanged.

Oxlint correctness rules and explicit TypeScript safeguards replace ESLint;
Oxfmt preserves single quotes and trailing commas. Explicit TypeScript checks
and declaration builds remain authoritative rather than adopting the optional
Go checker. Vite 7's browser targets remain explicit across the Rolldown upgrade.
`pnpm check`, `pnpm format:check`, `pnpm exec vp check`, and
`TMPDIR=/tmp/opencode pnpm test:consumer` passed locally. Existing large-chunk
advisories and the standalone consumer's Zod annotation warnings remain nonfatal.

A clean `pnpm install --frozen-lockfile` passed. Chromium/SwiftShader exercised
all 43 browser tests on an isolated loopback server: 41 passed initially; two
tests assumed port 5173. After switching those tests to Playwright's configured
base URL, all seven tests in their two files passed on port 5281. This retains
WebGL2/fallback, offline requests, desktop/mobile interaction, and PNG gates.
The first suite took 1.6 minutes; the focused rerun took 18.2 seconds.

Primary CI uses pinned Node 26.13.1; a separate packed-consumer job retains
Node 24.18.0 compatibility coverage. Locally,
`TMPDIR=/tmp/opencode fnm exec --using 24.18.0 pnpm test:consumer` also passed.

Migration references: [Vite 8](https://vite.dev/guide/migration),
[Vitest 4](https://v4.vitest.dev/guide/migration),
[Vitest 5](https://vitest.dev/guide/migration/), and
[Vite+ migration rules](https://viteplus.dev/guide/migrate-rules).

## Original verification

Verified locally on 2026-09-19 with Node 24.19.0 and pnpm 11.19.0.

| Check                               | Result                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| ESLint                              | Passed with zero lint warnings                                                                               |
| TypeScript                          | Core, React, demo and browser/tooling configurations passed                                                  |
| Vitest                              | 46 tests passed across 3 files                                                                               |
| Core statements / lines / functions | 100% / 100% / 100%                                                                                           |
| Core branch coverage                | 98.13%                                                                                                       |
| Production build                    | Both packages and Vite demo passed                                                                           |
| Formatting                          | Prettier passed                                                                                              |
| Standalone package consumer         | Fresh tarball install, TypeScript custom R3F renderer, Vite production build and Node ESM core import passed |
| Browser                             | Desktop interaction, mobile layout, and no-WebGL inspector checks passed                                     |
| External runtime requests           | Zero before explicit user navigation                                                                         |
| npm publishing / remote creation    | Neither performed                                                                                            |

Browser verification uses a real Chromium browser with software WebGL. The standard Playwright browser download timed out in this environment, so the same test suite was executed with a separately installed Chromium 153 binary via `ARCHVIZ_CHROMIUM_PATH`. This binary and its installation are not project or library dependencies. Normally use `pnpm exec playwright install chromium` followed by `pnpm test:browser`.

The desktop test exercises node selection, metadata and relationship inspection, selection through a dependency, camera reset, empty-space clearing, filtering, Escape, relationship labels and generic-link navigation. Documentation navigation is intercepted with a local test response; no live example.com page is required. The mobile test checks selection and horizontal overflow. The no-WebGL test disables WebGL and verifies that the node list and inspector remain usable.

Public API review confirmed that core contains no React/Three/provider dependency; graph types and metadata have no provider semantics; layout is a separate function contract; selection supports controlled and uncontrolled use; renderers are keyed by arbitrary type strings; and links are generic. The library source contains no fetch, XHR, or WebSocket calls. React's R3F JSX augmentation is exposed to external TypeScript consumers, verified through packed artifacts.

The React package's runtime bundle is approximately 20 kB before gzip, excluding external dependencies and CSS. The full demo is approximately 1.23 MB JavaScript / 346 kB gzip because it includes React, Three, R3F, Drei and Zod. Vite emits its usual large-chunk advisory. Zod's published comments also produce non-fatal Rollup annotation warnings. These did not fail the build. The install reports deprecation notices for the ESLint 9 line and a few transitive development dependencies; upgrade the lint/tooling baseline before maintaining a long-lived release line.

No large-graph performance guarantee is asserted. Manual visual review confirmed legible desktop graph framing and inspector scroll reset on changing selection. Dense-graph layout, edge selection, controlled camera state and collapsible groups remain future work.

## Package rename — 2026-09-20

Renamed the public packages to `archgraph-core` and `archgraph-react`, and the private demo workspace to `archgraph-demo`. Updated imports, exports documentation, workspace dependencies, lockfile, CLI filters, tarball names and the isolated consumer check. Private-registry documentation now uses a default registry/proxy for unscoped dependencies. The user approved deferring npm collision checks; these exact names have not been verified or reserved.

After the rename, lint, TypeScript checks, all 46 unit/behavior tests, package/demo builds, and the standalone tarball consumer passed. Browser interaction results above are from the original implementation; browser tests were not rerun for this package-only rename. No remote repository or npm package was created.
