# DSA Algorithm Visualizer — Implementation Plan

**Vision:** A web-hosted visualizer where a user pastes real algorithm code and sees it animate — starting with sorting algorithms, ending with a general "paste any algorithm, auto-detect the data structure, auto-visualize" system.

**Deployment target:** Next.js (App Router) on Vercel. All code execution happens client-side via Pyodide (Python-in-WASM) — no sandboxed backend needed for running untrusted code. The app is **fully client-side**: there are no API routes and no server compute.

> **Removed:** an earlier draft included a Phase 6 that called an LLM server-side to classify each variable's data-structure role. It was dropped — the same classification is achievable by inspecting values at runtime in the tracer, which is deterministic, free, offline, and avoids introducing an API key and a server dependency into an otherwise static app. Structure detection now lives in Phase 6 (Generic Animation Engine).

---

## Phase 0: Documentation Discovery (consolidated findings)

### Allowed APIs — Pyodide

| API | Signature / usage | Source |
|---|---|---|
| `loadPyodide()` | `await loadPyodide({ indexURL, packages, stdout, stderr })` — async factory, not a constructor | pyodide.org/en/stable/usage/index.html |
| Web Worker pattern | Must be a **module worker** (`{ type: "module" }`) since `pyodide.mjs` is ESM; classic workers via `importScripts()` are unsupported | pyodide.org/en/stable/usage/webworker.html |
| `pyodide.runPython(code, {globals}?)` | Synchronous, returns value of last expression | same |
| `pyodide.runPythonAsync(code, {globals}?)` | Supports top-level `await`; required for I/O-bound code | same |
| `pyodide.loadPackagesFromImports(code)` | Scans code for imports and lazy-fetches only what's needed | same |
| `PyProxy.toJs({depth, dict_converter})` | Converts Python object returned to JS. Use `dict_converter: Object.fromEntries` to get plain JS objects instead of `Map` | github.com/pyodide/pyodide docs/usage/type-conversions.md |
| `pyodide.ffi.to_js(obj, dict_converter=...)` | Python-side equivalent, convert before returning from `runPython` | same |

**Anti-patterns to avoid:**
- Do NOT run Pyodide on the main thread for anything beyond a trivial spike — always use a module Web Worker.
- Do NOT assume Pyodide instances share state across workers/main thread — each is an isolated VM; pass data via `postMessage`.
- Do NOT load the full Pyodide distribution (200+MB) — use `pyodide-core` + `loadPackagesFromImports()`.

**Confirmed prior art:** [livinNector/live-py-tutor](https://github.com/livinNector/live-py-tutor) — a Python-Tutor-style visualizer built on Pyodide, using a `PGLogger(bdb.Bdb)` class that subclasses `bdb.Bdb` (built on `sys.settrace`) to build a frame-by-frame trace list. This is direct proof the `sys.settrace`/`bdb` approach works inside Pyodide. Also: Pyodide's own team blogged a similar architecture for ["Pandas Tutor"](https://blog.pyodide.org/posts/pandastutor/) — client-side-only tracing, no server compute.

**Unverified — must be spiked in Phase 2 before committing further:**
- No official Pyodide doc explicitly confirms `sys.settrace` support/limitations. Treat as high-confidence-but-unverified until Phase 2's spike passes.
- Exact current `loadPyodide()` full parameter list — verify against the live docs page for whatever version you pin.

**Performance notes to design around:**
- Pyodide-executed Python is ~3-5x slower than native CPython; `sys.settrace` firing on every line adds further overhead. Cap iteration counts / add a step-limit safeguard for user-submitted code.
- Load Pyodide lazily (on first "Run" click, inside the worker), not on page load.

### Allowed APIs — Next.js / Vercel

| API | Signature / usage | Source |
|---|---|---|
| Static assets | Files in `public/` are served from the site root; the Pyodide worker lives here so it loads as a real module worker without bundler interference | nextjs.org/docs/app/api-reference/file-conventions/public-folder |
| Deploy | Connect GitHub repo on vercel.com/new → auto-deploy on push; zero config needed for a static Next.js app | vercel.com/docs/getting-started-with-vercel |

**Anti-patterns to avoid:**
- Do NOT add API routes or server compute — the app is deliberately fully client-side, which keeps it deployable as static output and means untrusted user code never touches a server.

---

## Phase 1: Project Scaffolding

**What to implement:**
- `npx create-next-app@latest algo-visualizer --typescript --app --tailwind --eslint` in `C:\Users\shash\algo-visualizer`.
- Initialize git repo, initial commit, push to a new GitHub repo (`gh repo create`).
- Connect the repo to Vercel (`vercel link` or dashboard import) and confirm a default deploy succeeds.
- Basic page shell: a code textarea, a "Run" button (no logic yet), a placeholder canvas area.

**Verification checklist:**
- `npm run dev` serves the shell locally.
- Vercel deploy succeeds and the shell is reachable at a public URL.
- Repo is on GitHub under the authenticated account.

---

## Phase 2: Pyodide Integration Spike (de-risk before building on it)

**What to implement:**
- A module Web Worker (`public/pyodide-worker.js` or `app/workers/pyodide-worker.ts` served correctly per Next.js static asset rules) that loads Pyodide via CDN (`https://cdn.jsdelivr.net/pyodide/vX.Y.Z/full/pyodide.mjs`), per the exact worker template in Phase 0.
- Spike script: define a tiny Python function with a `for` loop, install a `sys.settrace` callback, and confirm `'line'` events fire with correct `frame.f_lineno` and `frame.f_locals` inside the worker.
- Wire worker → main thread messaging (`postMessage`/`onmessage` with request `id` correlation, per Phase 0 template).

**Verification checklist:**
- Console log of captured trace frames for a simple loop, showing line numbers and local variable values changing per iteration.
- If `sys.settrace` does NOT behave as expected inside Pyodide, fall back to the `bdb.Bdb`-based approach from `live-py-tutor` (Phase 0 prior art) instead — this is the documented fallback, not a new risk.

**Anti-pattern guards:**
- Do not proceed to Phase 3 until this spike passes — it's the single biggest technical risk in the whole plan (unverified in Phase 0).

---

## Phase 3: Smallest Buildable Slice — Bubble Sort, Hardcoded Detection

**What to implement:**
- A Python tracer module (built on the Phase 2 spike) that runs a **hardcoded bubble sort implementation** (not yet arbitrary user code) and emits a list of frame dicts: `{line, array_state: [...], compared_indices: [i,j] | null, swapped: bool}`.
- Explicitly tag comparison/swap operations in the reference implementation (simplest possible: the tracer just diffs the array variable between consecutive `'line'` events to detect swaps — no manual tagging needed if the diffing approach works; prefer this over hardcoded tagging since it's a stepping stone to Phase 5's generalization).
- Convert the Python trace list to JS via `pyodide.ffi.to_js(trace, dict_converter=js.Object.fromEntries)` per Phase 0.
- Bars visualization: a `<canvas>` or SVG bar chart rendering `array_state`, highlighting `compared_indices`, driven by a simple frame-index state variable.
- Playback controls: play/pause, step forward/back, scrub slider, speed control — all just walking the frame-index through the trace array (no re-execution needed once traced).

**Verification checklist:**
- Paste/run bubble sort → bars render and animate, highlighting compares/swaps, end-to-end in the browser.
- Scrubbing the timeline slider correctly jumps to the right array state at any frame.

**Anti-pattern guards:**
- Do not invent a "diff detection" API — this is your own code, not a library call; keep it simple (array equality check per frame is enough for the sorting case).

---

## Phase 4: Extend to Merge Sort & Quick Sort (still hardcoded, still array-only)

**What to implement:**
- Add merge sort and quick sort reference implementations through the same tracer.
- Handle recursion in the trace: `sys.settrace`'s `'call'`/`'return'` events + a call-stack-depth field per frame, so the visualization can show recursive structure if desired later (store it now even if not rendered yet — cheap to capture, expensive to retrofit).
- A dropdown/selector for which algorithm to run (still bundled/hardcoded code, not yet a free-text editor).

**Verification checklist:**
- All three algorithms animate correctly end-to-end.
- Trace frames include call-stack depth without breaking the Phase 3 array-diff visualization.

---

## Phase 5: Generalize — Arbitrary User-Submitted Sorting Code

**What to implement:**
- Replace the hardcoded algorithm dropdown with a free-text code editor (e.g. Monaco or CodeMirror) where the user pastes their own Python sorting function.
- Generic tracer: no longer assumes a specific variable name — detect the "primary array" heuristically (e.g., the first `list[int]`/`list[float]` local variable that changes across frames) and diff it the same way as Phase 3.
- Basic safety: step-count limit (per Phase 0 performance notes) to kill runaway loops in user code; run inside the worker so a hang doesn't freeze the UI thread.

**Verification checklist:**
- A user-typed bubble/insertion/selection sort (not one of your reference implementations) visualizes correctly without code changes.
- A deliberately infinite loop is caught by the step-limit and surfaced as an error, not a hung tab.

**Anti-pattern guards:**
- Do not attempt full static analysis/AST parsing here — heuristic runtime detection (which variable is a list that mutates) is sufficient for sorting-only scope and is generalized in Phase 6.

---

## Phase 6: Generic Animation Engine — Graph, Tree, Stack Primitives

**What to implement:**
- **Runtime structure detection** (replaces the dropped LLM classification step). In the tracer, assign each captured variable a `role` by inspecting its actual value:
  - `list` of numbers → `array`
  - `dict` mapping keys → lists/sets of keys, or a square 0/1 matrix → `graph_adjacency`
  - object with `left`/`right`/`children` attributes, or nested dicts with those keys → `tree`
  - `collections.deque`, or a list mutated via `pop(0)`/`popleft` → `queue`
  - list mutated only via `append`/`pop()` at the tail → `stack`
  - `int`/`float`/`str` → `scalar`
  Detection runs per variable on the values already snapshotted per frame, so it costs no extra execution.
- Extend the Phase 3 diff-based playback engine to a plugin-style set of renderers keyed by `role`: `BarsRenderer` (exists), `GraphRenderer` (D3 force-directed), `TreeRenderer` (D3 tree layout), `StackRenderer` (box stack).
- Generic tracer updated to capture *any* variable's state per frame (not just the one "primary array"), keyed by name, so each variable can be routed to its renderer.
- Derive highlight events from frame-to-frame diffs rather than a line-pattern mapping: a key appearing in a `visited` set → `visit`, a tail append → `push`/`enqueue`, a head removal → `dequeue`.

**Verification checklist:**
- BFS/DFS on a graph animates node visits correctly.
- A tree traversal (in-order/pre-order) animates node visits on a rendered tree.
- Sorting algorithms from Phase 3-5 still work unchanged (regression check).
- Structure detection is exercised directly against sample values (adjacency dict, tree node, deque) rather than only through the UI.

---

## Phase 7: Polish

**What to implement:**
- Shareable permalink: serialize `{code, trace}` (or just `code`, re-tracing on load) into a URL param or a lightweight KV store (Vercel KV / Upstash) for a shortened link.
- Algorithm racing (optional, from earlier brainstorm): run two pasted algorithms on the same input side-by-side with live comparison/swap counters.
- Error states: syntax errors in pasted code, unsupported constructs, undetectable structures — all surfaced clearly in the UI rather than silent failures.

---

## Final Phase: Verification

1. **Cross-browser check**: Pyodide + Web Workers on Chrome, Firefox, Safari (Safari has historically had WASM/worker quirks — explicitly test).
2. **Performance check**: large inputs (e.g. 500-element array) don't freeze the UI; step-limit safeguard fires correctly on runaway code.
3. **Doc-conformance check**: confirm the Pyodide worker is constructed with `{ type: "module" }`, and that the app still builds with no API routes and no server-only env vars (it should deploy as fully static).
4. **Regression pass**: all algorithms from every phase still animate correctly after Phase 6's generalization.
