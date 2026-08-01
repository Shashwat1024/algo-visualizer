# Changelog

All notable changes to this project are documented here, newest first. Format loosely follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Phase 3 — Bubble sort tracer & visualization** (2026-08-01): hardcoded bubble sort run through `sys.settrace` inside the Pyodide worker, emitting `{line, arrayState, comparedIndices, swapped}` per frame (swap detection via array diffing between consecutive line events, no manual tagging). `BarsVisualizer` renders the current frame with compare highlighting. `PlaybackControls` adds play/pause, step forward/back, scrub slider, and speed selection over the captured frame list.
- **Phase 2 — Pyodide Web Worker spike** (2026-08-01): `public/pyodide-worker.js`, a module Web Worker that loads Pyodide (v0.28.3) and confirmed `sys.settrace` fires correctly with accurate line numbers and locals inside the worker sandbox — de-risking the core tracing approach the whole project depends on.
- **Phase 1 — Project scaffolding** (2026-08-01): Next.js App Router shell (TypeScript, Tailwind, ESLint) via `create-next-app`; page shell with code textarea, Run button, visualization area; GitHub repo created and pushed ([Shashwat1024/algo-visualizer](https://github.com/Shashwat1024/algo-visualizer)); Vercel project linked and deployed to production.

<!--
When adding an entry:
- Group under Added / Changed / Fixed / Removed as needed.
- Reference the PLAN.md phase it corresponds to, and the date.
- Move entries out of [Unreleased] into a dated version section only if/when this project starts cutting releases.
-->
