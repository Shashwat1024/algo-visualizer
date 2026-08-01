export type TraceFrame = {
  line: number;
  locals: Record<string, unknown>;
};

type WorkerResponse =
  | { id: number; ok: true; trace: TraceFrame[] }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  { resolve: (trace: TraceFrame[]) => void; reject: (error: Error) => void }
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
        pending.resolve(event.data.trace);
      } else {
        pending.reject(new Error(event.data.error));
      }
    };
  }
  return worker;
}

export function runTraceSpike(): Promise<TraceFrame[]> {
  const id = nextRequestId++;
  const request = new Promise<TraceFrame[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });
  getWorker().postMessage({ id, type: "run-trace-spike" });
  return request;
}
