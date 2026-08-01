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

const TRACE_SPIKE_SCRIPT = `
import sys

def _collect_trace():
    trace = []

    def tracer(frame, event, arg):
        if event == "line" and frame.f_code.co_name == "bubble_pass":
            locals_snapshot = {
                k: v for k, v in frame.f_locals.items()
                if isinstance(v, (int, float, str, bool, list))
            }
            trace.append({"line": frame.f_lineno, "locals": locals_snapshot})
        return tracer

    def bubble_pass(values):
        n = len(values)
        for i in range(n - 1):
            if values[i] > values[i + 1]:
                values[i], values[i + 1] = values[i + 1], values[i]
        return values

    sys.settrace(tracer)
    bubble_pass([5, 3, 4, 1, 2])
    sys.settrace(None)

    return trace

_collect_trace()
`;

self.onmessage = async (event) => {
  const { id, type } = event.data ?? {};

  if (type !== "run-trace-spike") {
    return;
  }

  try {
    const pyodide = await getPyodide();
    const traceProxy = pyodide.runPython(TRACE_SPIKE_SCRIPT);
    const trace = traceProxy.toJs({ dict_converter: Object.fromEntries });
    traceProxy.destroy();
    self.postMessage({ id, ok: true, trace });
  } catch (error) {
    self.postMessage({ id, ok: false, error: String(error) });
  }
};
