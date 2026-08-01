import { loadPyodide } from "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.mjs";

let pyodideReadyPromise = null;

function getPyodide() {
  if (!pyodideReadyPromise) {
    pyodideReadyPromise = loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/",
    });
  }
  return pyodideReadyPromise;
}

const BUBBLE_SORT_TRACE_SCRIPT = `
import sys
import random

def _bubble_sort_trace(values):
    frames = []
    prev_array_state = None

    def tracer(frame, event, arg):
        nonlocal prev_array_state
        if event != "line" or frame.f_code.co_name != "bubble_sort":
            return tracer

        current_values = frame.f_locals.get("values")
        if current_values is None:
            return tracer

        array_state = list(current_values)
        j = frame.f_locals.get("j")
        compared_indices = (
            [j, j + 1] if j is not None and j + 1 < len(array_state) else None
        )
        swapped = prev_array_state is not None and array_state != prev_array_state

        frames.append({
            "line": frame.f_lineno,
            "arrayState": array_state,
            "comparedIndices": compared_indices,
            "swapped": swapped,
        })
        prev_array_state = array_state
        return tracer

    def bubble_sort(values):
        n = len(values)
        for i in range(n - 1):
            for j in range(n - i - 1):
                if values[j] > values[j + 1]:
                    values[j], values[j + 1] = values[j + 1], values[j]
        return values

    sys.settrace(tracer)
    bubble_sort(values)
    sys.settrace(None)

    return frames

_input_array = random.sample(range(10, 99), 12)
_bubble_sort_trace(_input_array)
`;

self.onmessage = async (event) => {
  const { id, type } = event.data ?? {};

  if (type !== "run-bubble-sort-trace") {
    return;
  }

  try {
    const pyodide = await getPyodide();
    const framesProxy = pyodide.runPython(BUBBLE_SORT_TRACE_SCRIPT);
    const frames = framesProxy.toJs({ dict_converter: Object.fromEntries });
    framesProxy.destroy();
    self.postMessage({ id, ok: true, frames });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
