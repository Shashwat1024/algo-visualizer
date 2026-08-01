# Changelog

All notable changes to this project are documented here, newest first. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **shadcn/ui component system + dark/light mode** (2026-08-01): initialized shadcn/ui (Base UI primitives, Tailwind v4, `new-york` style) and rebuilt the interface around `Card`, `Button`, `Select`, `Slider`, `Badge`, and `Separator` instead of hand-rolled markup. Added a sticky header with a `next-themes` light/dark toggle (defaults to dark, follows system). Playback controls now use icon buttons and a real slider; the visualization surfaces the current frame's line number, recursion depth, and swap state. Introduced `--bar` / `--bar-compare` theme tokens so bar highlighting is legible in both themes rather than hardcoded zinc/amber.

### Changed
- **Mono font swapped to JetBrains Mono** (2026-08-01): replaced Geist Mono with JetBrains Mono (via `next/font/google`) as the project's `--font-mono`, used by the code preview/editor areas.

### Added
- **Phase 4 — Merge sort, quick sort, recursion depth** (2026-08-01): reference merge sort and quick sort implementations added alongside bubble sort, all through the same `sys.settrace` tracer. Recursion depth is now captured per frame via `'call'`/`'return'` events (not yet rendered, but cheap to capture now vs. retrofit later). Algorithm dropdown replaces the free-text editor for this phase — code preview is read-only, reflecting PLAN.md's "still hardcoded" scope; free-text user code lands in Phase 5. Validated the tracer module standalone against CPython (all three algorithms sort correctly; merge sort reaches depth 5, quick sort depth 6 on a 12-element input) before relying on the in-browser Pyodide run.
- **Phase 3 — Bubble sort tracer & visualization** (2026-08-01): hardcoded bubble sort run through `sys.settrace` inside the Pyodide worker, emitting `{line, arrayState, comparedIndices, swapped}` per frame (swap detection via array diffing between consecutive line events, no manual tagging). `BarsVisualizer` renders the current frame with compare highlighting. `PlaybackControls` adds play/pause, step forward/back, scrub slider, and speed selection over the captured frame list.
- **Phase 2 — Pyodide Web Worker spike** (2026-08-01): `public/pyodide-worker.js`, a module Web Worker that loads Pyodide (v0.28.3) and confirmed `sys.settrace` fires correctly with accurate line numbers and locals inside the worker sandbox — de-risking the core tracing approach the whole project depends on.
- **Phase 1 — Project scaffolding** (2026-08-01): Next.js App Router shell (TypeScript, Tailwind, ESLint) via `create-next-app`; page shell with code textarea, Run button, visualization area; GitHub repo created and pushed ([Shashwat1024/algo-visualizer](https://github.com/Shashwat1024/algo-visualizer)); Vercel project linked and deployed to production.

<!--
When adding an entry:
- Group under Added / Changed / Fixed / Removed as needed.
- Reference the PLAN.md phase it corresponds to, and the date.
- Move entries out of [Unreleased] into a dated version section only if/when this project starts cutting releases.
-->
