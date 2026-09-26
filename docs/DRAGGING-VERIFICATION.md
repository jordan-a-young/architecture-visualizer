# Node dragging verification

Verified on 2026-09-26 before opening the feature PR, on top of screenshot export.

- `pnpm check`: lint, TypeScript, all 51 unit/behavior tests, core coverage thresholds, and package/demo builds passed.
- `pnpm format:check`: passed.
- `pnpm test:consumer`: packed packages installed in an isolated Vite/TypeScript project; `NodePositions`, dragging callbacks, `resetLayout`, screenshot export, custom rendering, production build, and Node ESM import passed.
- `ARCHVIZ_CHROMIUM_PATH=/tmp/archgraph-browser/runtime/chromium pnpm test:browser`: all 12 browser tests passed, including existing demo and screenshot scenarios.
- Real WebGL interaction checks cover dragging labels and custom geometry; attached edge movement; stable camera and selection; filtering; camera/layout reset; controlled acceptance and rejection; disabling dragging; Escape and pointer cancellation rollback; restored orbit controls; and touch input without page scrolling.
- Unit/React tests cover position copying and validation, removed-node cleanup, filter persistence, and controlled proposals/reset.
- Visually inspected the moved-node scene with its attached relationship and inspector. Screenshot tests independently compare PNG pixels against the canvas and verify built-in label regions.

Browser testing used the same separate Chromium 153/software-WebGL workaround documented in [screenshot verification](SCREENSHOT-VERIFICATION.md), because the standard Playwright download failed here. No browser binary or additional runtime dependency was added to the project. CI uses standard Playwright Chromium. Existing non-fatal Vite bundle-size and Zod annotation advisories remain.

V1 dragging is opt-in, uses one pointer on a horizontal plane, and keeps positions outside the graph schema. It does not provide snapping, collision avoidance, axis handles, or keyboard movement. Controlled hosts must accept position proposals. Review the screenshot PR first; this PR is based on that feature branch so its diff contains only dragging changes.
