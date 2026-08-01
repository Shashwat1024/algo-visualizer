"use client";

import { useMemo } from "react";
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";

type LayoutNode = SimulationNodeDatum & { id: string };
type LayoutLink = { source: LayoutNode; target: LayoutNode };

const RADIUS = 16;

export default function GraphRenderer({
  nodes,
  edges,
  visited,
  current,
}: {
  nodes: string[];
  edges: [string, string][];
  visited: Set<string>;
  current: Set<string>;
}) {
  const nodeKey = nodes.join(",");
  const edgeKey = edges.map(([a, b]) => `${a}>${b}`).join(",");

  // The simulation is run to completion once and then frozen, so scrubbing
  // through frames never reshuffles the layout.
  const layout = useMemo(() => {
    const simNodes: LayoutNode[] = nodes.map((id) => ({ id }));
    const simLinks = edges
      .filter(([from, to]) => from !== to)
      .map(([source, target]) => ({ source, target }));

    forceSimulation(simNodes)
      .force(
        "link",
        forceLink(simLinks)
          .id((node) => (node as LayoutNode).id)
          .distance(80)
      )
      .force("charge", forceManyBody().strength(-320))
      .force("center", forceCenter(0, 0))
      .stop()
      .tick(300);

    const xs = simNodes.map((node) => node.x ?? 0);
    const ys = simNodes.map((node) => node.y ?? 0);
    const pad = RADIUS * 2.5;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    const width = Math.max(Math.max(...xs) + pad - minX, 1);
    const height = Math.max(Math.max(...ys) + pad - minY, 1);

    return {
      nodes: simNodes,
      links: simLinks as unknown as LayoutLink[],
      viewBox: `${minX} ${minY} ${width} ${height}`,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeKey, edgeKey]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        empty graph
      </div>
    );
  }

  return (
    <svg
      viewBox={layout.viewBox}
      className="h-56 w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {layout.links.map((link, index) => (
        <line
          key={index}
          x1={link.source.x ?? 0}
          y1={link.source.y ?? 0}
          x2={link.target.x ?? 0}
          y2={link.target.y ?? 0}
          className="stroke-border"
          strokeWidth={2}
        />
      ))}
      {layout.nodes.map((node) => {
        const isCurrent = current.has(node.id);
        const isVisited = visited.has(node.id);
        return (
          <g key={node.id}>
            <circle
              cx={node.x ?? 0}
              cy={node.y ?? 0}
              r={RADIUS}
              className={
                isCurrent
                  ? "fill-bar-compare"
                  : isVisited
                    ? "fill-bar-visited"
                    : "fill-bar"
              }
            />
            <text
              x={node.x ?? 0}
              y={node.y ?? 0}
              dy="0.35em"
              textAnchor="middle"
              className="fill-background font-mono text-[11px]"
            >
              {node.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
