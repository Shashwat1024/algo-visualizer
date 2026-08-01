export type VariableRole = "array" | "stack" | "queue" | "graph" | "tree";

export type TreeNode = { id: string; label: string; parent: string | null };

export type Snapshot =
  | {
      kind: "list";
      items: (number | string)[];
      numeric: boolean;
      hint: string | null;
    }
  | { kind: "graph"; nodes: string[]; edges: [string, string][] }
  | { kind: "tree"; nodes: TreeNode[] }
  | { kind: "set"; items: string[] }
  | { kind: "scalar"; value: number | string };

export type TraceFrame = {
  line: number;
  depth: number;
  /** Structural variables, each rendered in its own panel. */
  panels: Record<string, Snapshot>;
  /** Set variables, used as highlight sources (e.g. `visited`). */
  sets: Record<string, string[]>;
  /** Scalar locals, used for index highlighting and "current node". */
  scalars: Record<string, number | string>;
};

export type VariableInfo = { name: string; role: VariableRole };

export type TraceMeta = {
  /** Entry function called, or "(module)" when the code called it itself. */
  entry: string;
  steps: number;
};

export type TraceResult = {
  frames: TraceFrame[];
  variables: VariableInfo[];
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
        pending.resolve({
          frames: event.data.frames,
          variables: event.data.variables,
          meta: event.data.meta,
        });
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
