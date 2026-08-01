import type { TraceFrame, TreeNode, VariableInfo } from "./pyodide-client";

export type GraphStructure = {
  kind: "graph";
  nodes: string[];
  edges: [string, string][];
};

export type TreeStructure = { kind: "tree"; nodes: TreeNode[] };

export type PanelStructure = GraphStructure | TreeStructure;

/**
 * Graph and tree layouts must not jump around while scrubbing, so the layout
 * is computed from one fixed structure rather than per frame: the union of
 * every node/edge a graph ever held, and the largest snapshot a tree held.
 * Per-frame data is then only used for highlighting.
 */
export function buildPanelStructures(
  frames: TraceFrame[],
  variables: VariableInfo[]
): Record<string, PanelStructure> {
  const result: Record<string, PanelStructure> = {};

  for (const variable of variables) {
    if (variable.role === "graph") {
      const nodes = new Set<string>();
      const edges = new Map<string, [string, string]>();
      for (const frame of frames) {
        const snapshot = frame.panels[variable.name];
        if (snapshot?.kind !== "graph") continue;
        snapshot.nodes.forEach((node) => nodes.add(node));
        snapshot.edges.forEach(([from, to]) => edges.set(`${from}>${to}`, [from, to]));
      }
      result[variable.name] = {
        kind: "graph",
        nodes: [...nodes],
        edges: [...edges.values()],
      };
    }

    if (variable.role === "tree") {
      let largest: TreeNode[] = [];
      for (const frame of frames) {
        const snapshot = frame.panels[variable.name];
        if (snapshot?.kind !== "tree") continue;
        if (snapshot.nodes.length > largest.length) largest = snapshot.nodes;
      }
      result[variable.name] = { kind: "tree", nodes: largest };
    }
  }

  return result;
}

const INDEX_PRIORITY = [
  "j",
  "i",
  "k",
  "lo",
  "hi",
  "mid",
  "left",
  "right",
  "low",
  "high",
  "start",
  "end",
];

/** Pick up to two integer locals that are valid positions in an array of
 *  `length`, preferring conventional loop-index names. */
export function pickIndices(
  scalars: Record<string, number | string>,
  length: number
): number[] {
  const valid = Object.entries(scalars).filter(
    (entry): entry is [string, number] =>
      typeof entry[1] === "number" &&
      Number.isInteger(entry[1]) &&
      entry[1] >= 0 &&
      entry[1] < length
  );
  if (valid.length === 0) return [];

  const rank = (name: string) => {
    const found = INDEX_PRIORITY.indexOf(name);
    return found === -1 ? INDEX_PRIORITY.length : found;
  };
  valid.sort((a, b) => rank(a[0]) - rank(b[0]));
  return valid.slice(0, 2).map(([, value]) => value);
}

/**
 * How many times the main array actually changed. Counted from kept frames,
 * so when a trace is decimated this is a sample rather than an exact total —
 * fine for comparing two runs that were decimated the same way.
 */
export function countWrites(
  frames: TraceFrame[],
  variables: VariableInfo[]
): number {
  const target = variables.find((variable) => variable.role === "array");
  if (!target) return 0;

  let writes = 0;
  let previous: string | null = null;
  for (const frame of frames) {
    const snapshot = frame.panels[target.name];
    if (snapshot?.kind !== "list") continue;
    const current = snapshot.items.join(",");
    if (previous !== null && current !== previous) writes += 1;
    previous = current;
  }
  return writes;
}

/** Node ids marked as seen, gathered from every set variable in the frame. */
export function collectVisited(frame: TraceFrame): Set<string> {
  const visited = new Set<string>();
  for (const items of Object.values(frame.sets)) {
    items.forEach((item) => visited.add(item));
  }
  return visited;
}

/**
 * Scalars whose value names a node in the structure - the "current" node.
 *
 * Loop counters are excluded deliberately: when node ids are numeric (an
 * adjacency matrix labels them 0..n-1) an ordinary `i` or `j` collides with a
 * node id and would light up an unrelated node on almost every frame.
 */
export function collectCurrent(
  frame: TraceFrame,
  nodeIds: Set<string>
): Set<string> {
  const current = new Set<string>();
  for (const [name, value] of Object.entries(frame.scalars)) {
    if (INDEX_PRIORITY.includes(name)) continue;
    const label = String(value);
    if (nodeIds.has(label)) current.add(label);
  }
  return current;
}
