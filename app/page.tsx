"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckIcon, Link2Icon, Loader2Icon, PlayIcon, XIcon } from "lucide-react";

import {
  runUserTrace,
  TraceError,
  type TraceResult,
} from "./lib/pyodide-client";
import { buildPanelStructures } from "./lib/structures";
import { buildShareUrl, readSharedState } from "./lib/share";
import { EXAMPLES } from "./lib/examples";
import VariablePanel from "./components/VariablePanel";
import PlaybackControls from "./components/PlaybackControls";
import CodeEditor from "./components/CodeEditor";
import TraceErrorAlert from "./components/TraceErrorAlert";
import RaceLane from "./components/RaceLane";
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
  { value: "64", label: "64 items" },
  { value: "128", label: "128 items" },
  { value: "500", label: "500 items" },
];

/** Both racers must sort the same list for the comparison to mean anything. */
const RACE_SEED = 20260801;

export default function Home() {
  const [code, setCode] = useState(EXAMPLES[0].code);
  const [challenger, setChallenger] = useState<string | null>(null);
  const [arraySize, setArraySize] = useState(12);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [result, setResult] = useState<TraceResult | null>(null);
  const [challengerResult, setChallengerResult] = useState<TraceResult | null>(
    null
  );
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorLine, setErrorLine] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const racing = challenger !== null;

  // A shared link carries the snippets themselves. Load them into the editors
  // but do not auto-run: that would pull down the Pyodide runtime unprompted.
  useEffect(() => {
    readSharedState().then((shared) => {
      if (shared.code) setCode(shared.code);
      if (shared.challenger) setChallenger(shared.challenger);
      if (shared.arraySize) setArraySize(shared.arraySize);
    });
  }, []);

  function reset() {
    setStatus("idle");
    setResult(null);
    setChallengerResult(null);
    setFrameIndex(0);
    setIsPlaying(false);
  }

  async function handleShare() {
    const url = await buildShareUrl(code, arraySize, challenger);
    window.history.replaceState(null, "", url);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked by permissions; the URL bar holds the link
      // either way, so this is not worth surfacing as an error.
    }
  }

  async function handleRun() {
    setStatus("running");
    setIsPlaying(false);
    setErrorMessage(null);
    setErrorLine(null);
    try {
      // Seed only when racing, so both sides get an identical input list.
      // A single run stays random, so repeated runs explore different inputs.
      const seed = challenger ? RACE_SEED : undefined;
      const [primary, secondary] = await Promise.all([
        runUserTrace(code, arraySize, seed),
        challenger
          ? runUserTrace(challenger, arraySize, seed)
          : Promise.resolve(null),
      ]);
      setResult(primary);
      setChallengerResult(secondary);
      setFrameIndex(0);
      setStatus("done");
    } catch (error) {
      console.error("trace failed:", error);
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setErrorLine(error instanceof TraceError ? error.line : null);
      setStatus("error");
    }
  }

  // In a race the timeline runs as long as the slower side.
  const frameCount = Math.max(
    result?.frames.length ?? 0,
    challengerResult?.frames.length ?? 0
  );

  useEffect(() => {
    if (!isPlaying || frameIndex >= frameCount - 1) return;
    const timer = setTimeout(() => {
      setFrameIndex((index) => {
        const next = Math.min(index + 1, frameCount - 1);
        if (next >= frameCount - 1) setIsPlaying(false);
        return next;
      });
    }, speed);
    return () => clearTimeout(timer);
  }, [isPlaying, frameIndex, frameCount, speed]);

  // Layouts are derived from the whole trace, so they stay put while scrubbing.
  const structures = useMemo(
    () => buildPanelStructures(result?.frames ?? [], result?.variables ?? []),
    [result]
  );
  const challengerStructures = useMemo(
    () =>
      buildPanelStructures(
        challengerResult?.frames ?? [],
        challengerResult?.variables ?? []
      ),
    [challengerResult]
  );

  const currentFrame =
    result && result.frames.length > 0
      ? result.frames[Math.min(frameIndex, result.frames.length - 1)]
      : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
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

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle>{racing ? "Race" : "Your code"}</CardTitle>
                <CardDescription>
                  {racing
                    ? "Both run on the same input, stepped together"
                    : "Arrays, graphs, trees, stacks and queues are detected automatically"}
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
                <ExampleSelect
                  onPick={(picked) => {
                    setCode(picked);
                    reset();
                  }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className={racing ? "grid gap-4 lg:grid-cols-2" : undefined}>
              <div className="space-y-2">
                {racing && (
                  <p className="font-mono text-xs text-muted-foreground">A</p>
                )}
                <CodeEditor
                  value={code}
                  onChange={setCode}
                  readOnly={status === "running"}
                />
              </div>
              {racing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-muted-foreground">B</p>
                    <ExampleSelect
                      onPick={(picked) => {
                        setChallenger(picked);
                        reset();
                      }}
                    />
                  </div>
                  <CodeEditor
                    value={challenger}
                    onChange={setChallenger}
                    readOnly={status === "running"}
                  />
                </div>
              )}
            </div>

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
              <Button variant="outline" onClick={handleShare}>
                {copied ? (
                  <>
                    <CheckIcon className="size-4" /> Link copied
                  </>
                ) : (
                  <>
                    <Link2Icon className="size-4" /> Share
                  </>
                )}
              </Button>
              {racing ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setChallenger(null);
                    reset();
                  }}
                >
                  <XIcon className="size-4" /> Exit race
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setChallenger(EXAMPLES[3].code);
                    reset();
                  }}
                >
                  Race another
                </Button>
              )}
              {result && status === "done" && !racing && (
                <p className="font-mono text-xs text-muted-foreground">
                  {result.meta.entry} · {result.meta.steps.toLocaleString()}{" "}
                  steps in {result.meta.elapsed}s ·{" "}
                  <span className="text-foreground">
                    {result.variables.length || "no"}{" "}
                    {result.variables.length === 1 ? "variable" : "variables"}
                  </span>
                  {result.meta.stride > 1 && (
                    <> · sampled every {result.meta.stride} steps</>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Visualization</CardTitle>
              {currentFrame && !racing && (
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
              {status === "error" && errorMessage && (
                <div className="px-2 py-8">
                  <TraceErrorAlert message={errorMessage} line={errorLine} />
                </div>
              )}

              {status === "done" && result && racing && challengerResult && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <RaceLane
                    title="A"
                    result={result}
                    frameIndex={frameIndex}
                    structures={structures}
                  />
                  <RaceLane
                    title="B"
                    result={challengerResult}
                    frameIndex={frameIndex}
                    structures={challengerStructures}
                  />
                </div>
              )}

              {status === "done" &&
                result &&
                !racing &&
                currentFrame &&
                result.variables.length === 0 && (
                  <p className="py-24 text-center text-sm text-muted-foreground">
                    Traced {result.frames.length} steps, but found no array,
                    graph, tree, stack, or queue to visualize.
                  </p>
                )}

              {status === "done" &&
                result &&
                !racing &&
                currentFrame &&
                result.variables.length > 0 && (
                  <div
                    className={`grid gap-4 ${
                      result.variables.length > 1
                        ? "sm:grid-cols-2"
                        : "grid-cols-1"
                    }`}
                  >
                    {result.variables.map((variable) => (
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

            {status === "done" && frameCount > 0 && (
              <>
                <Separator />
                <PlaybackControls
                  frameIndex={frameIndex}
                  frameCount={frameCount}
                  isPlaying={isPlaying}
                  speed={speed}
                  onTogglePlay={() => setIsPlaying((playing) => !playing)}
                  onStep={(delta) =>
                    setFrameIndex((index) =>
                      Math.min(Math.max(index + delta, 0), frameCount - 1)
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

function ExampleSelect({ onPick }: { onPick: (code: string) => void }) {
  return (
    <Select
      items={EXAMPLES}
      value=""
      onValueChange={(value) => {
        const example = EXAMPLES.find((entry) => entry.value === value);
        if (example) onPick(example.code);
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
  );
}
