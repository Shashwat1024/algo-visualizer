"use client";

import type { TraceFrame, VariableInfo } from "../lib/pyodide-client";
import type { PanelStructure } from "../lib/structures";
import { collectCurrent, collectVisited } from "../lib/structures";
import BarsRenderer from "./renderers/BarsRenderer";
import SequenceRenderer from "./renderers/SequenceRenderer";
import GraphRenderer from "./renderers/GraphRenderer";
import TreeRenderer from "./renderers/TreeRenderer";
import { Badge } from "@/components/ui/badge";

export default function VariablePanel({
  variable,
  frame,
  structure,
}: {
  variable: VariableInfo;
  frame: TraceFrame;
  structure?: PanelStructure;
}) {
  const snapshot = frame.panels[variable.name];

  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm">{variable.name}</span>
        <Badge variant="secondary" className="font-mono text-[10px]">
          {variable.role}
        </Badge>
      </div>
      {renderBody()}
    </div>
  );

  function renderBody() {
    if (variable.role === "graph" && structure?.kind === "graph") {
      const nodeIds = new Set(structure.nodes);
      return (
        <GraphRenderer
          nodes={structure.nodes}
          edges={structure.edges}
          visited={collectVisited(frame)}
          current={collectCurrent(frame, nodeIds)}
        />
      );
    }

    if (variable.role === "tree" && structure?.kind === "tree") {
      const activeIds =
        snapshot?.kind === "tree"
          ? new Set(snapshot.nodes.map((node) => node.id))
          : new Set<string>();
      return (
        <TreeRenderer
          nodes={structure.nodes}
          activeIds={activeIds}
          visited={collectVisited(frame)}
        />
      );
    }

    if (snapshot?.kind !== "list") {
      return (
        <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          not in scope
        </div>
      );
    }

    // Numeric arrays get bars; everything else reads better as labelled boxes.
    if (variable.role === "array" && snapshot.numeric) {
      return <BarsRenderer items={snapshot.items} scalars={frame.scalars} />;
    }
    return <SequenceRenderer items={snapshot.items} role={variable.role as "stack" | "queue" | "array"} />;
  }
}
