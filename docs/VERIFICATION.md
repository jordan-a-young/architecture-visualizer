# Verification record

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
