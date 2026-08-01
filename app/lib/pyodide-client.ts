export type SortAlgorithm = "bubble" | "merge" | "quick";

export type SortTraceFrame = {
  line: number;
  arrayState: number[];
  comparedIndices: [number, number] | null;
  swapped: boolean;
  depth: number;
};

type WorkerResponse =
  | { id: number; ok: true; frames: SortTraceFrame[] }
  | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<
  number,
  { resolve: (frames: SortTraceFrame[]) => void; reject: (error: Error) => void }
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
        pending.resolve(event.data.frames);
      } else {
        pending.reject(new Error(event.data.error));
      }
    };
  }
  return worker;
}

export function runSortTrace(algorithm: SortAlgorithm): Promise<SortTraceFrame[]> {
  const id = nextRequestId++;
  const request = new Promise<SortTraceFrame[]>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
  });
  getWorker().postMessage({ id, type: "run-sort-trace", algorithm });
  return request;
}
