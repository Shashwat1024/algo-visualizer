import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";

let pyodideReadyPromise = null;
let sortModuleLoaded = false;

function getPyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
    });
  }
  return pyodideReadyPromise;
}

const SORT_MODULE_SCRIPT = `
import sys
import random

TRACKED_FUNCS = {"bubble_sort", "merge_sort", "_merge", "quick_sort"}

def _compared_indices_for(name, local_vars):
    if name == "bubble_sort":
        j = local_vars.get("j")
        return [j, j + 1] if j is not None else None
    if name in ("merge_sort", "_merge"):
        i = local_vars.get("i")
        j = local_vars.get("j")
        return [i, j] if i is not None and j is not None else None
    if name == "quick_sort":
        j = local_vars.get("j")
        hi = local_vars.get("hi")
        return [j, hi] if j is not None and hi is not None else None
    return None

def bubble_sort(values):
    n = len(values)
    for i in range(n - 1):
        for j in range(n - i - 1):
            if values[j] > values[j + 1]:
                values[j], values[j + 1] = values[j + 1], values[j]
    return values

def _merge(values, lo, mid, hi):
    left = values[lo:mid + 1]
    right = values[mid + 1:hi + 1]
    i = j = 0
    k = lo
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            values[k] = left[i]
            i += 1
        else:
            values[k] = right[j]
            j += 1
        k += 1
    while i < len(left):
        values[k] = left[i]
        i += 1
        k += 1
    while j < len(right):
        values[k] = right[j]
        j += 1
        k += 1

def merge_sort(values, lo=0, hi=None):
    if hi is None:
        hi = len(values) - 1
    if lo >= hi:
        return values
    mid = (lo + hi) // 2
    merge_sort(values, lo, mid)
    merge_sort(values, mid + 1, hi)
    _merge(values, lo, mid, hi)
    return values

def quick_sort(values, lo=0, hi=None):
    if hi is None:
        hi = len(values) - 1
    if lo >= hi:
        return values
    pivot = values[hi]
    i = lo - 1
    for j in range(lo, hi):
        if values[j] <= pivot:
            i += 1
            values[i], values[j] = values[j], values[i]
    values[i + 1], values[hi] = values[hi], values[i + 1]
    pivot_index = i + 1
    quick_sort(values, lo, pivot_index - 1)
    quick_sort(values, pivot_index + 1, hi)
    return values

def run_sort_trace(algorithm):
    frames = []
    depth = 0
    prev_array_state = None

    def tracer(frame, event, arg):
        nonlocal depth, prev_array_state
        name = frame.f_code.co_name

        if event == "call":
            if name in TRACKED_FUNCS:
                depth += 1
            return tracer
        if event == "return":
            if name in TRACKED_FUNCS:
                depth -= 1
            return tracer
        if event != "line" or name not in TRACKED_FUNCS:
            return tracer

        current_values = frame.f_locals.get("values")
        if current_values is None:
            return tracer

        array_state = list(current_values)
        compared_indices = _compared_indices_for(name, frame.f_locals)
        swapped = prev_array_state is not None and array_state != prev_array_state

        frames.append({
            "line": frame.f_lineno,
            "arrayState": array_state,
            "comparedIndices": compared_indices,
            "swapped": swapped,
            "depth": depth,
        })
        prev_array_state = array_state
        return tracer

    values = random.sample(range(10, 99), 12)

    sys.settrace(tracer)
    if algorithm == "bubble":
        bubble_sort(values)
    elif algorithm == "merge":
        merge_sort(values)
    elif algorithm == "quick":
        quick_sort(values)
    else:
        sys.settrace(None)
        raise ValueError(f"Unknown algorithm: {algorithm}")
    sys.settrace(None)

    return frames
`;

async function ensureSortModule(pyodide) {
  if (!sortModuleLoaded) {
    pyodide.runPython(SORT_MODULE_SCRIPT);
    sortModuleLoaded = true;
  }
}

const VALID_ALGORITHMS = new Set(["bubble", "merge", "quick"]);

self.onmessage = async (event) => {
  const { id, type, algorithm } = event.data ?? {};

  if (type !== "run-sort-trace") {
    return;
  }

  if (!VALID_ALGORITHMS.has(algorithm)) {
    self.postMessage({ id, ok: false, error: `Unknown algorithm: ${algorithm}` });
    return;
  }

  try {
    const pyodide = await getPyodide();
    await ensureSortModule(pyodide);
    pyodide.globals.set("_requested_algorithm", algorithm);
    const framesProxy = pyodide.runPython("run_sort_trace(_requested_algorithm)");
    const frames = framesProxy.toJs({ dict_converter: Object.fromEntries });
    framesProxy.destroy();
    self.postMessage({ id, ok: true, frames });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
