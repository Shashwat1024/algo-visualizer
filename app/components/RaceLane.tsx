"use client";

import { FlagIcon } from "lucide-react";

import type { TraceResult } from "../lib/pyodide-client";
import { buildPanelStructures, countWrites } from "../lib/structures";
import VariablePanel from "./VariablePanel";
import { Badge } from "@/components/ui/badge";

/**
 * One side of a race. Both lanes advance on the same absolute step index, so
 * whichever finishes first simply stops on its final frame while the other
 * keeps going - that difference is the point of the comparison.
 */
export default function RaceLane({
  title,
  result,
  frameIndex,
  structures,
}: {
  title: string;
  result: TraceResult;
  frameIndex: number;
  structures: ReturnType<typeof buildPanelStructures>;
}) {
  const clamped = Math.min(frameIndex, result.frames.length - 1);
  const frame = result.frames[clamped];
  const finished = frameIndex >= result.frames.length - 1;
  const writes = countWrites(result.frames, result.variables);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {finished && (
            <Badge variant="secondary" className="gap-1 text-[10px]">
              <FlagIcon className="size-3" /> done
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 font-mono text-xs text-muted-foreground">
          <span title="Traced line events">
            {result.meta.steps.toLocaleString()} steps
          </span>
          <span title="Times the array changed">{writes} writes</span>
        </div>
      </div>

      {result.variables.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          nothing to visualize
        </p>
      ) : (
        <div className="space-y-3">
          {result.variables.map((variable) => (
            <VariablePanel
              key={variable.name}
              variable={variable}
              frame={frame}
              structure={structures[variable.name]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
