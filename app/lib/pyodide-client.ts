export type SortTraceFrame = {
  line: number;
  arrayState: number[];
  comparedIndices: [number, number] | null;
  swapped: boolean;
  depth: number;
};

export type TraceMeta = {
  /** Name of the function the tracer chose as the entry point. */
  entry: string;
  /** Name of the variable being visualized, or "(input)" for in-place sorts. */
  primary: string;
  /** Number of traced line events, for comparison against the step limit. */
  steps: number;
};

export type TraceResult = {
  frames: SortTraceFrame[];
  meta: TraceMeta;
};

type WorkerResponse =
  | ({ id: number; ok: true } & TraceResult)
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  { resolve: (result: TraceResult) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("/pyodide-worker.js", window.location.origin), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id } = event.data;
      const pending = pendingRequests.get(id);
      if (!pending) return;
      pendingRequests.delete(id);
      if (event.data.ok) {
        pending.resolve({ frames: event.data.frames, meta: event.data.meta });
      } else {
        pending.reject(new Error(event.data.error));
      }
    };
  }
  return worker;
}

export function runUserTrace(
  code: string,
  arraySize = 12
): Promise<TraceResult> {
  const id = nextRequestId++;
  const request = new Promise<TraceResult>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });
  getWorker().postMessage({ id, type: "run-user-trace", code, arraySize });
  return request;
}
