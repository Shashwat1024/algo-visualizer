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

// Generic tracer: runs arbitrary user code under sys.settrace, heuristically
// picks the "primary array" to visualize, and enforces a step limit so a
// runaway loop in pasted code fails loudly instead of spinning forever.
const TRACER_MODULE_SCRIPT = `
import sys
import random
import types

MAX_STEPS = 20000
USER_FILENAME = "<user_code>"

# Names that are conventionally loop/partition indices, preferred when
# choosing which two positions to highlight on a given frame.
INDEX_PRIORITY = [
    "j", "i", "k", "lo", "hi", "mid",
    "left", "right", "low", "high", "start", "end",
]


class StepLimitExceeded(Exception):
    pass


def _is_number_list(value):
    return (
        isinstance(value, list)
        and len(value) > 0
        and all(
            isinstance(item, (int, float)) and not isinstance(item, bool)
            for item in value
        )
    )


def _pick_entry(user_globals):
    candidates = [
        (name, obj)
        for name, obj in user_globals.items()
        if isinstance(obj, types.FunctionType)
        and obj.__code__.co_filename == USER_FILENAME
    ]
    if not candidates:
        raise ValueError(
            "No function definition found. Define a function that takes a list of numbers."
        )

    # Prefer a public, sort-looking name; fall back to definition order.
    def rank(entry):
        index, (name, _fn) = entry
        score = 0
        if name.startswith("_"):
            score += 4
        if "sort" not in name.lower():
            score += 2
        return (score, index)

    return min(enumerate(candidates), key=rank)[1]


def _pick_indices(int_locals, length):
    valid = [
        (name, value)
        for name, value in int_locals.items()
        if 0 <= value < length
    ]
    if not valid:
        return None

    def rank(item):
        name = item[0]
        return (
            INDEX_PRIORITY.index(name)
            if name in INDEX_PRIORITY
            else len(INDEX_PRIORITY)
        )

    valid.sort(key=rank)
    picked = [value for _name, value in valid[:2]]
    if len(picked) == 1:
        picked.append(picked[0])
    return picked


def _transitions(series):
    return sum(1 for a, b in zip(series, series[1:]) if a != b)


def _score(series, size):
    """Rank a candidate variable: ending in a fully sorted array is the
    strongest signal it is the one being sorted, with amount of movement
    as the tiebreak. Without the first term, an algorithm that builds a
    new list would lose to the untouched input it was derived from."""
    present = [s for s in series if s is not None]
    if not present:
        return (0, 0)
    final = present[-1]
    ends_sorted = 1 if len(final) == size and final == sorted(final) else 0
    return (ends_sorted, _transitions(present))


def run_user_trace(user_code, array_size=12):
    user_globals = {"__name__": "__user__"}
    exec(compile(user_code, USER_FILENAME, "exec"), user_globals)

    entry_name, entry_fn = _pick_entry(user_globals)

    input_array = random.sample(range(10, 99), array_size)
    initial = list(input_array)

    raw = []
    state = {"steps": 0, "depth": 0}

    def tracer(frame, event, arg):
        # Returning None for non-user frames disables tracing inside library
        # code, which keeps the overhead proportional to the user's own lines.
        if frame.f_code.co_filename != USER_FILENAME:
            return None
        if event == "call":
            state["depth"] += 1
            return tracer
        if event == "return":
            state["depth"] -= 1
            return tracer
        if event != "line":
            return tracer

        state["steps"] += 1
        if state["steps"] > MAX_STEPS:
            raise StepLimitExceeded()

        arrays = {}
        ints = {}
        for key, value in frame.f_locals.items():
            if _is_number_list(value):
                arrays[key] = list(value)
            elif isinstance(value, int) and not isinstance(value, bool):
                ints[key] = value

        raw.append({
            "line": frame.f_lineno,
            "depth": state["depth"],
            "arrays": arrays,
            "ints": ints,
            "input": list(input_array),
        })
        return tracer

    try:
        sys.settrace(tracer)
        entry_fn(input_array)
    except StepLimitExceeded:
        raise RuntimeError(
            "Step limit of {} exceeded - the code may contain an infinite loop.".format(
                MAX_STEPS
            )
        )
    except TypeError as exc:
        raise RuntimeError(
            "Could not run {}(values): {}".format(entry_name, exc)
        )
    finally:
        sys.settrace(None)

    if not raw:
        raise RuntimeError("No lines were traced - the function body never ran.")

    # Choose the variable to visualize: whichever number-list changes most
    # across the run. In-place sorts win via the input array itself; sorts
    # that build a new list win via one of their locals.
    names = set()
    for item in raw:
        names.update(item["arrays"].keys())

    primary_name = "(input)"
    best_series = [item["input"] for item in raw]
    best_score = _score(best_series, array_size)

    for name in sorted(names):
        series = []
        last = None
        for item in raw:
            if name in item["arrays"]:
                last = item["arrays"][name]
            series.append(last)
        score = _score(series, array_size)
        if score > best_score:
            best_score = score
            primary_name = name
            best_series = series

    best_series = [s if s is not None else initial for s in best_series]

    frames = []
    previous = None
    for item, array_state in zip(raw, best_series):
        frames.append({
            "line": item["line"],
            "arrayState": array_state,
            "comparedIndices": _pick_indices(item["ints"], len(array_state)),
            "swapped": previous is not None and array_state != previous,
            "depth": item["depth"],
        })
        previous = array_state

    return {
        "frames": frames,
        "meta": {
            "entry": entry_name,
            "primary": primary_name,
            "steps": state["steps"],
        },
    }
`;

function ensureTracerModule(pyodide) {
  if (!tracerModuleLoaded) {
    pyodide.runPython(TRACER_MODULE_SCRIPT);
    tracerModuleLoaded = true;
  }
}

self.onmessage = async (event) => {
  const { id, type, code, arraySize } = event.data ?? {};

  if (type !== "run-user-trace") {
    return;
  }

  try {
    const pyodide = await getPyodide();
    ensureTracerModule(pyodide);

    // Pass code through globals rather than string interpolation so user
    // input is never spliced into the Python source.
    pyodide.globals.set("_user_code", code);
    pyodide.globals.set("_array_size", arraySize ?? 12);

    const resultProxy = pyodide.runPython(
      "run_user_trace(_user_code, _array_size)"
    );
    const result = resultProxy.toJs({ dict_converter: Object.fromEntries });
    resultProxy.destroy();

    self.postMessage({ id, ok: true, ...result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
