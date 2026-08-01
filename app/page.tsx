"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircleIcon, Loader2Icon, PlayIcon } from "lucide-react";

import {
  runUserTrace,
  type TraceFrame,
  type TraceMeta,
  type VariableInfo,
} from "./lib/pyodide-client";
import { buildPanelStructures } from "./lib/structures";
import { EXAMPLES } from "./lib/examples";
import VariablePanel from "./components/VariablePanel";
import PlaybackControls from "./components/PlaybackControls";
import CodeEditor from "./components/CodeEditor";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SIZES = [
  { value: "8", label: "8 items" },
  { value: "12", label: "12 items" },
  { value: "20", label: "20 items" },
  { value: "32", label: "32 items" },
];

export default function Home() {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [arraySize, setArraySize] = useState(12);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [frames, setFrames] = useState<TraceFrame[]>([]);
  const [variables, setVariables] = useState<VariableInfo[]>([]);
  const [meta, setMeta] = useState<TraceMeta | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRun() {
    setStatus("running");
    setIsPlaying(false);
    setErrorMessage(null);
    try {
      const result = await runUserTrace(code, arraySize);
      setFrames(result.frames);
      setVariables(result.variables);
      setMeta(result.meta);
      setFrameIndex(0);
      setStatus("done");
    } catch (error) {
      console.error("trace failed:", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setStatus("error");
    }
  }

  useEffect(() => {
    if (!isPlaying || frameIndex >= frames.length - 1) return;
    const timer = setTimeout(() => {
      setFrameIndex((index) => {
        const next = Math.min(index + 1, frames.length - 1);
        if (next >= frames.length - 1) {
          setIsPlaying(false);
        }
        return next;
      });
    }, speed);
    return () => clearTimeout(timer);
  }, [isPlaying, frameIndex, frames.length, speed]);

  const hasFrames = frames.length > 0;
  const currentFrame = hasFrames ? frames[frameIndex] : null;

  // Layouts are derived from the whole trace, so they stay put while scrubbing.
  const structures = useMemo(
    () => buildPanelStructures(frames, variables),
    [frames, variables]
  );

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              Algo Visualizer
            </h1>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Paste Python, watch the data move
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>Your code</CardTitle>
                <CardDescription>
                  Arrays, graphs, trees, stacks and queues are detected
                  automatically
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  items={SIZES}
                  value={String(arraySize)}
                  onValueChange={(value) => setArraySize(Number(value))}
                >
                  <SelectTrigger size="sm" aria-label="Input size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  items={EXAMPLES}
                  value=""
                  onValueChange={(value) => {
                    const example = EXAMPLES.find((e) => e.value === value);
                    if (!example) return;
                    setCode(example.code);
                    setStatus("idle");
                    setFrames([]);
                    setMeta(null);
                    setFrameIndex(0);
                    setIsPlaying(false);
                  }}
                >
                  <SelectTrigger size="sm" aria-label="Load an example">
                    <span className="text-muted-foreground">Examples</span>
                  </SelectTrigger>
                  <SelectContent>
                    {EXAMPLES.map((example) => (
                      <SelectItem key={example.value} value={example.value}>
                        {example.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeEditor
              value={code}
              onChange={setCode}
              readOnly={status === "running"}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleRun} disabled={status === "running"}>
                {status === "running" ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" /> Tracing…
                  </>
                ) : (
                  <>
                    <PlayIcon className="size-4" /> Run
                  </>
                )}
              </Button>
              {meta && status === "done" && (
                <p className="font-mono text-xs text-muted-foreground">
                  {meta.entry} · {meta.steps} steps ·{" "}
                  <span className="text-foreground">
                    {variables.length || "no"}{" "}
                    {variables.length === 1 ? "variable" : "variables"}
                  </span>
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Visualization</CardTitle>
              {currentFrame && (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-mono text-xs">
                    line {currentFrame.line}
                  </Badge>
                  <Badge variant="secondary" className="font-mono text-xs">
                    depth {currentFrame.depth}
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex min-h-72 flex-col justify-center">
              {status === "idle" && (
                <p className="py-24 text-center text-sm text-muted-foreground">
                  Press Run to trace your code.
                </p>
              )}
              {status === "running" && (
                <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
                  <Loader2Icon className="size-5 animate-spin" />
                  <p className="text-sm">Loading Pyodide and tracing…</p>
                </div>
              )}
              {status === "error" && (
                <div className="flex flex-col items-center gap-2 px-6 py-24 text-destructive">
                  <AlertCircleIcon className="size-5 shrink-0" />
                  <p className="text-center font-mono text-xs break-all">
                    {errorMessage}
                  </p>
                </div>
              )}
              {status === "done" && currentFrame && variables.length === 0 && (
                <p className="py-24 text-center text-sm text-muted-foreground">
                  Traced {frames.length} steps, but found no array, graph, tree,
                  stack, or queue to visualize.
                </p>
              )}
              {status === "done" && currentFrame && variables.length > 0 && (
                <div
                  className={`grid gap-4 ${
                    variables.length > 1 ? "sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {variables.map((variable) => (
                    <VariablePanel
                      key={variable.name}
                      variable={variable}
                      frame={currentFrame}
                      structure={structures[variable.name]}
                    />
                  ))}
                </div>
              )}
            </div>

            {status === "done" && hasFrames && (
              <>
                <Separator />
                <PlaybackControls
                  frameIndex={frameIndex}
                  frameCount={frames.length}
                  isPlaying={isPlaying}
                  speed={speed}
                  onTogglePlay={() => setIsPlaying((playing) => !playing)}
                  onStep={(delta) =>
                    setFrameIndex((index) =>
                      Math.min(Math.max(index + delta, 0), frames.length - 1)
                    )
                  }
                  onScrub={(index) => {
                    setIsPlaying(false);
                    setFrameIndex(index);
                  }}
                  onSpeedChange={setSpeed}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
