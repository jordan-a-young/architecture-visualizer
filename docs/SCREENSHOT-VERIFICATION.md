# Screenshot export verification

Verified on 2026-09-26 before opening the feature PR.

- `pnpm check`: lint, TypeScript, all 46 unit/behavior tests, coverage thresholds, and package/demo builds passed.
- `pnpm format:check`: passed.
- `pnpm test:consumer`: packed packages installed in an isolated Vite/TypeScript project; the new screenshot handle type, custom renderer, production build, and Node ESM import passed.
- `ARCHVIZ_CHROMIUM_PATH=/tmp/archgraph-browser/runtime/chromium pnpm test:browser`: 7 browser tests passed, including the 3 existing scenarios.
- New browser checks: PNG pixels match the current rendered canvas after camera movement; node and relationship label regions are present; export preserves the camera; filters; custom geometry; high-DPI mobile dimensions; unavailable WebGL; and encoder failure followed by successful retry.
- Visually inspected the exported PNG itself: labels, selected-node ring, relationship arrow and dimming are present, with no inspector or toolbar.
- Browser test observed no external application requests.

The Playwright browser download failed in this environment. Tests used a separate Chromium 153 binary with software WebGL via the existing executable-path override. This binary is not a project dependency. CI uses Playwright's standard Chromium installation.

Exports include built-in HTML labels. CSS shadows and arbitrary custom HTML overlays are excluded; custom WebGL geometry is included. Existing non-fatal Vite bundle-size and Zod annotation advisories remain.
