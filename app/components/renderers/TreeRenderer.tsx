"use client";

import { useMemo } from "react";
import { stratify, tree, type HierarchyPointNode } from "d3-hierarchy";

import type { TreeNode } from "../../lib/pyodide-client";

const RADIUS = 15;

export default function TreeRenderer({
  nodes,
  activeIds,
  visited,
}: {
  nodes: TreeNode[];
  /** Ids present in the current frame - the subtree recursion is inside. */
  activeIds: Set<string>;
  visited: Set<string>;
}) {
  const nodeKey = nodes.map((node) => `${node.id}:${node.parent}`).join(",");

  const layout = useMemo(() => {
    if (nodes.length === 0) return null;
    try {
      const root = stratify<TreeNode>()
        .id((node) => node.id)
        .parentId((node) => node.parent)(nodes);
      const laidOut = tree<TreeNode>().nodeSize([56, 64])(root);

      const points = laidOut.descendants();
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      const pad = RADIUS * 2.5;
      const minX = Math.min(...xs) - pad;
      const minY = Math.min(...ys) - pad;
      const width = Math.max(Math.max(...xs) + pad - minX, 1);
      const height = Math.max(Math.max(...ys) + pad - minY, 1);

      return { points, viewBox: `${minX} ${minY} ${width} ${height}` };
    } catch {
      // stratify throws on a disconnected or multi-root shape; fall back to
      // rendering nothing rather than taking the page down.
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey]);

  if (!layout) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        no tree to show
      </div>
    );
  }

  return (
    <svg
      viewBox={layout.viewBox}
      className="h-56 w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {layout.points
        .filter((point) => point.parent)
        .map((point) => {
          const parent = point.parent as HierarchyPointNode<TreeNode>;
          return (
            <line
              key={point.data.id}
              x1={parent.x}
              y1={parent.y}
              x2={point.x}
              y2={point.y}
              className="stroke-border"
              strokeWidth={2}
            />
          );
        })}
      {layout.points.map((point) => {
        const isActive = activeIds.has(point.data.id);
        const isVisited = visited.has(point.data.label);
        return (
          <g key={point.data.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r={RADIUS}
              className={
                isActive
                  ? "fill-bar-compare"
                  : isVisited
                    ? "fill-bar-visited"
                    : "fill-bar"
              }
            />
            <text
              x={point.x}
              y={point.y}
              dy="0.35em"
              textAnchor="middle"
              className="fill-background font-mono text-[11px]"
            >
              {point.data.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
