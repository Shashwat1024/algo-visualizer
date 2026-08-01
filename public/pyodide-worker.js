import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";

let pyodideReadyPromise = null;
let tracerModuleLoaded = false;

function getPyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
    });
  }
  return pyodideReadyPromise;
}

// Generic tracer. Runs arbitrary user code under sys.settrace, snapshots every
// visualizable local per line event, then classifies each variable's data
// structure from the values it actually held. Enforces a step limit so a
// runaway loop fails loudly instead of spinning.
const TRACER_MODULE_SCRIPT = `
import sys
import time
import random
import types
from collections import deque

# Runaway protection and payload size are separate concerns. A 500-element
# bubble sort is ~125k legitimate line events, so the step ceiling is high and
# a wall-clock guard does the real work of catching infinite loops quickly.
STEP_LIMIT = 2000000
# Generous because Pyodide runs ~3-5x slower than CPython and a 500-element
# bubble sort is legitimately ~315k traced steps. Tracing happens in a worker,
# so a slow run leaves the UI responsive rather than freezing the tab.
TIME_LIMIT = 20.0
TIME_CHECK_MASK = 8191  # test the clock every 8192 steps

# Frames actually kept. Beyond this the trace is decimated rather than
# truncated, so a long run still animates end to end at coarser resolution.
MAX_FRAMES = 4000

MAX_NODES = 200
MAX_PANELS = 4
USER_FILENAME = "<user_code>"


class StepLimitExceeded(Exception):
    pass


class TimeLimitExceeded(Exception):
    pass


def _is_number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def _is_scalar(value):
    return _is_number(value) or isinstance(value, (str, bool))


# ---------------------------------------------------------------- structures

def _tree_children(node):
    children = []
    if hasattr(node, "children"):
        found = getattr(node, "children")
        if isinstance(found, (list, tuple)):
            children.extend(found)
    for attr in ("left", "right"):
        if hasattr(node, attr):
            children.append(getattr(node, attr))
    return children


def _is_tree_node(value):
    if _is_scalar(value) or value is None:
        return False
    if isinstance(value, (list, dict, set, frozenset, tuple, deque)):
        return False
    return (
        hasattr(value, "left")
        or hasattr(value, "right")
        or hasattr(value, "children")
    )


def _node_label(node):
    for attr in ("val", "value", "key", "data", "name", "id"):
        if hasattr(node, attr):
            found = getattr(node, attr)
            if _is_scalar(found):
                return str(found)
    return type(node).__name__


def _normalize_tree(root):
    nodes = []
    seen = set()
    stack = [(root, None)]
    while stack and len(nodes) < MAX_NODES:
        node, parent = stack.pop()
        if node is None:
            continue
        marker = id(node)
        if marker in seen:
            continue
        seen.add(marker)
        node_id = str(marker)
        nodes.append({
            "id": node_id,
            "label": _node_label(node),
            "parent": parent,
        })
        for child in reversed(_tree_children(node)):
            if child is not None:
                stack.append((child, node_id))
    return nodes


def _is_adjacency_dict(value):
    if not isinstance(value, dict) or not value:
        return False
    for neighbours in value.values():
        if not isinstance(neighbours, (list, set, tuple, frozenset)):
            return False
        for neighbour in neighbours:
            if not _is_scalar(neighbour):
                return False
    return True


def _is_adjacency_matrix(value):
    if not isinstance(value, list) or not value:
        return False
    size = len(value)
    for row in value:
        if not isinstance(row, list) or len(row) != size:
            return False
        for cell in row:
            if not _is_number(cell) or cell not in (0, 1):
                return False
    return True


def _graph_from_dict(value):
    nodes = []
    edges = []
    seen = set()

    def add(key):
        label = str(key)
        if label not in seen:
            seen.add(label)
            nodes.append(label)
        return label

    for key, neighbours in value.items():
        source = add(key)
        for neighbour in neighbours:
            edges.append([source, add(neighbour)])
    return {"nodes": nodes, "edges": edges}


def _graph_from_matrix(value):
    nodes = [str(i) for i in range(len(value))]
    edges = []
    for i, row in enumerate(value):
        for j, cell in enumerate(row):
            if cell:
                edges.append([str(i), str(j)])
    return {"nodes": nodes, "edges": edges}


def _snapshot(value):
    """Normalize a live value into a JSON-safe shape, or None if it is not
    something worth showing."""
    if isinstance(value, deque):
        items = list(value)
        if all(_is_scalar(item) for item in items):
            return {
                "kind": "list",
                "items": [i if _is_number(i) else str(i) for i in items],
                "numeric": bool(items) and all(_is_number(i) for i in items),
                "hint": "queue",
            }
        return None

    if _is_adjacency_matrix(value):
        snapshot = {"kind": "graph"}
        snapshot.update(_graph_from_matrix(value))
        return snapshot

    if isinstance(value, list):
        if all(_is_scalar(item) for item in value):
            return {
                "kind": "list",
                "items": [i if _is_number(i) else str(i) for i in value],
                "numeric": bool(value) and all(_is_number(i) for i in value),
                "hint": None,
            }
        return None

    if _is_adjacency_dict(value):
        snapshot = {"kind": "graph"}
        snapshot.update(_graph_from_dict(value))
        return snapshot

    if isinstance(value, (set, frozenset)):
        items = [item for item in value if _is_scalar(item)]
        if len(items) != len(value):
            return None
        return {"kind": "set", "items": sorted(str(item) for item in items)}

    if _is_tree_node(value):
        return {"kind": "tree", "nodes": _normalize_tree(value)}

    if _is_scalar(value):
        return {
            "kind": "scalar",
            "value": value if _is_number(value) else str(value),
        }

    return None


# ------------------------------------------------------------------- roles

def _classify_list(series):
    """Distinguish stack / queue / array by how the list was mutated.
    A value alone cannot tell them apart - only the access pattern can."""
    if any(state.get("hint") == "queue" for state in series):
        return "queue"

    tail_pop = False
    head_pop = False
    for before, after in zip(series, series[1:]):
        a = before["items"]
        b = after["items"]
        if a == b:
            continue
        if len(b) == len(a) + 1 and b[:-1] == a:
            continue                  # append - on its own, tells us nothing
        elif len(b) == len(a) - 1 and b == a[:-1]:
            tail_pop = True           # pop()
        elif len(b) == len(a) - 1 and b == a[1:]:
            head_pop = True           # pop(0) / popleft()
        else:
            return "array"            # arbitrary rearrangement - a sort
    if head_pop:
        return "queue"
    if tail_pop:
        return "stack"
    # Append-only: an accumulating result list, not a stack.
    return "array"


def _role_for(series):
    kinds = {state["kind"] for state in series}
    if "graph" in kinds:
        return "graph"
    if "tree" in kinds:
        return "tree"
    if "set" in kinds:
        return "set"
    if "scalar" in kinds:
        return "scalar"
    if "list" in kinds:
        return _classify_list([s for s in series if s["kind"] == "list"])
    return "other"


def _transitions(series):
    return sum(1 for a, b in zip(series, series[1:]) if a != b)


def _node_universe(series, role):
    """Largest set of node ids a structural variable ever held, used to spot
    aliases and subtrees that should not each get their own panel."""
    best = set()
    for snapshot in series:
        if snapshot is None:
            continue
        if role == "graph" and snapshot["kind"] == "graph":
            found = set(snapshot["nodes"])
        elif role == "tree" and snapshot["kind"] == "tree":
            found = {node["id"] for node in snapshot["nodes"]}
        else:
            continue
        if len(found) > len(best):
            best = found
    return best


# ------------------------------------------------------------------- runner

def _pick_entry(user_globals):
    candidates = [
        (name, obj)
        for name, obj in user_globals.items()
        if isinstance(obj, types.FunctionType)
        and obj.__code__.co_filename == USER_FILENAME
    ]
    if not candidates:
        raise ValueError(
            "No function definition found. Define a function, or call one directly."
        )

    def rank(entry):
        index, (name, _fn) = entry
        score = 0
        if name.startswith("_"):
            score += 4
        if "sort" not in name.lower():
            score += 2
        return (score, index)

    return min(enumerate(candidates), key=rank)[1]


def run_user_trace(user_code, array_size=12, seed=None):
    user_globals = {"__name__": "__user__"}
    compiled = compile(user_code, USER_FILENAME, "exec")

    raw = []
    state = {
        "steps": 0,
        "depth": 0,
        "calls": 0,
        "stride": 1,
        "start": time.monotonic(),
    }

    def capture(frame):
        captured = {}
        for name, value in frame.f_locals.items():
            if name.startswith("__"):
                continue
            snapshot = _snapshot(value)
            if snapshot is not None:
                captured[name] = snapshot
        return {
            "line": frame.f_lineno,
            "depth": max(state["depth"], 0),
            "vars": captured,
        }

    def tracer(frame, event, arg):
        # Returning None for non-user frames keeps overhead proportional to
        # the user's own lines rather than the whole interpreter.
        if frame.f_code.co_filename != USER_FILENAME:
            return None
        if event == "call":
            state["depth"] += 1
            # The module body is itself a "call"; only count real functions,
            # otherwise definition-only code looks like it already ran.
            if frame.f_code.co_name != "<module>":
                state["calls"] += 1
            return tracer
        if event == "return":
            state["depth"] -= 1
            # Decimation can drop the true last line event, so record the
            # outermost return: it is the only place the finished state is
            # still reachable, and it costs one snapshot per run.
            if state["depth"] == 0:
                raw.append(capture(frame))
            return tracer
        if event != "line":
            return tracer

        state["steps"] += 1
        steps = state["steps"]
        if steps > STEP_LIMIT:
            raise StepLimitExceeded()
        if (steps & TIME_CHECK_MASK) == 0:
            if time.monotonic() - state["start"] > TIME_LIMIT:
                raise TimeLimitExceeded()

        # Skipped steps cost nothing: the snapshot, not the trace hook, is
        # what makes large inputs expensive.
        if steps % state["stride"] != 0:
            return tracer

        raw.append(capture(frame))

        if len(raw) >= MAX_FRAMES:
            del raw[1::2]           # halve resolution, keep the timeline
            state["stride"] *= 2

        return tracer

    entry_name = None
    try:
        sys.settrace(tracer)
        # Trace module level too, so code that builds its own input and calls
        # the function (the usual shape for graph/tree algorithms) just works.
        exec(compiled, user_globals)

        if state["calls"] == 0:
            # Nothing was invoked - only definitions ran. Fall back to calling
            # the most sort-looking function with a random array.
            raw.clear()
            entry_name, entry_fn = _pick_entry(user_globals)
            rng = random.Random(seed) if seed is not None else random
            entry_fn(rng.sample(range(10, max(99, array_size * 8)), array_size))
    except StepLimitExceeded:
        raise RuntimeError(
            "Step limit of {} exceeded - the code may contain an infinite loop.".format(
                STEP_LIMIT
            )
        )
    except TimeLimitExceeded:
        raise RuntimeError(
            "Gave up after {:.0f} seconds - the code may contain an infinite loop.".format(
                TIME_LIMIT
            )
        )
    except TypeError as exc:
        if entry_name:
            raise RuntimeError(
                "Could not run {}(values): {}".format(entry_name, exc)
            )
        raise
    finally:
        sys.settrace(None)

    if not raw:
        raise RuntimeError("No lines were traced - nothing ran.")

    # Build a per-variable series, carrying the last known value forward so a
    # variable that is out of scope on a given frame still renders.
    names = set()
    for item in raw:
        names.update(item["vars"].keys())

    series_by_name = {}
    for name in names:
        series = []
        last = None
        for item in raw:
            if name in item["vars"]:
                last = item["vars"][name]
            series.append(last)
        series_by_name[name] = series

    roles = {}
    for name, series in series_by_name.items():
        present = [s for s in series if s is not None]
        roles[name] = _role_for(present) if present else "other"

    # Panels are the structural variables; sets and scalars ride along as
    # highlight sources rather than getting their own view.
    structural = [n for n, r in roles.items() if r in ("graph", "tree")]
    sequential = [n for n, r in roles.items() if r in ("array", "stack", "queue")]

    # Aliases of the same graph, and subtrees of the same root, otherwise each
    # claim a panel. Keep the largest and drop anything contained by it.
    universes = {
        name: _node_universe(series_by_name[name], roles[name])
        for name in structural
    }
    structural.sort(key=lambda n: (-len(universes[n]), n))
    kept_structural = []
    for name in structural:
        if any(universes[name] <= universes[k] for k in kept_structural):
            continue
        kept_structural.append(name)

    sequential.sort(
        key=lambda n: (
            -_transitions([s for s in series_by_name[n] if s is not None]),
            n,
        )
    )
    panel_names = (kept_structural + sequential)[:MAX_PANELS]

    frames = []
    for index, item in enumerate(raw):
        panels = {}
        for name in panel_names:
            snapshot = series_by_name[name][index]
            if snapshot is not None:
                panels[name] = snapshot

        sets = {}
        scalars = {}
        for name, role in roles.items():
            snapshot = series_by_name[name][index]
            if snapshot is None:
                continue
            if role == "set" and snapshot["kind"] == "set":
                sets[name] = snapshot["items"]
            elif role == "scalar" and snapshot["kind"] == "scalar":
                scalars[name] = snapshot["value"]

        frames.append({
            "line": item["line"],
            "depth": item["depth"],
            "panels": panels,
            "sets": sets,
            "scalars": scalars,
        })

    return {
        "frames": frames,
        "variables": [
            {"name": name, "role": roles[name]} for name in panel_names
        ],
        "meta": {
            "entry": entry_name or "(module)",
            "steps": state["steps"],
            # >1 means frames were decimated, so the UI can say the timeline
            # is a sample rather than every step.
            "stride": state["stride"],
            "elapsed": round(time.monotonic() - state["start"], 2),
        },
    }
`;

/**
 * Pyodide surfaces a full Python traceback. Users care about the final
 * "ExceptionType: message" line and which of *their* lines caused it, so pull
 * those out and drop the interpreter frames.
 */
function describeError(error) {
  const raw = String(error?.message ?? error ?? "Unknown error");
  const lines = raw
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const message = lines.length > 0 ? lines[lines.length - 1] : raw;

  // Last user frame in the traceback is the most relevant one.
  const frames = [...raw.matchAll(/File "<user_code>", line (\d+)/g)];
  let line = frames.length > 0 ? Number(frames[frames.length - 1][1]) : null;

  // SyntaxError reports its position in the message instead of a frame.
  const inline = message.match(/<user_code>, line (\d+)/);
  if (inline) line = Number(inline[1]);

  return { message, line };
}

function ensureTracerModule(pyodide) {
  if (!tracerModuleLoaded) {
    pyodide.runPython(TRACER_MODULE_SCRIPT);
    tracerModuleLoaded = true;
  }
}

self.onmessage = async (event) => {
  const { id, type, code, arraySize, seed } = event.data ?? {};

  if (type !== "run-user-trace") {
    return;
  }

  try {
    const pyodide = await getPyodide();

    // Everything from here to postMessage is synchronous (runPython blocks),
    // so two in-flight requests - a race sends both at once - cannot
    // interleave their globals. Do not introduce an await below this line.
    ensureTracerModule(pyodide);

    // Pass code through globals rather than string interpolation so user
    // input is never spliced into the Python source.
    pyodide.globals.set("_user_code", code);
    pyodide.globals.set("_array_size", arraySize ?? 12);
    pyodide.globals.set("_seed", seed ?? null);

    const resultProxy = pyodide.runPython(
      "run_user_trace(_user_code, _array_size, _seed)"
    );
    const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
    resultProxy.destroy();

    self.postMessage({ id, ok: true, ...result });
  } catch (error) {
    const { message, line } = describeError(error);
    self.postMessage({ id, ok: false, error: message, line });
  }
};
