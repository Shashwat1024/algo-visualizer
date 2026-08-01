"use client";

import { useEffect, useState } from "react";
import { AlertCircleIcon, Loader2Icon, PlayIcon } from "lucide-react";

import {
  runSortTrace,
  type SortAlgorithm,
  type SortTraceFrame,
} from "./lib/pyodide-client";
import BarsVisualizer from "./components/BarsVisualizer";
import PlaybackControls from "./components/PlaybackControls";
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

const ALGORITHMS: {
  value: SortAlgorithm;
  label: string;
  complexity: string;
  code: string;
}[] = [
  {
    value: "bubble",
    label: "Bubble Sort",
    complexity: "O(n²)",
    code: "def bubble_sort(values):\n    n = len(values)\n    for i in range(n - 1):\n        for j in range(n - i - 1):\n            if values[j] > values[j + 1]:\n                values[j], values[j + 1] = values[j + 1], values[j]\n    return values\n",
  },
  {
    value: "merge",
    label: "Merge Sort",
    complexity: "O(n log n)",
    code: "def merge_sort(values, lo=0, hi=None):\n    if hi is None:\n        hi = len(values) - 1\n    if lo >= hi:\n        return values\n    mid = (lo + hi) // 2\n    merge_sort(values, lo, mid)\n    merge_sort(values, mid + 1, hi)\n    _merge(values, lo, mid, hi)\n    return values\n\ndef _merge(values, lo, mid, hi):\n    left = values[lo:mid + 1]\n    right = values[mid + 1:hi + 1]\n    i = j = 0\n    k = lo\n    while i < len(left) and j < len(right):\n        if left[i] <= right[j]:\n            values[k] = left[i]\n            i += 1\n        else:\n            values[k] = right[j]\n            j += 1\n        k += 1\n    while i < len(left):\n        values[k] = left[i]\n        i += 1\n        k += 1\n    while j < len(right):\n        values[k] = right[j]\n        j += 1\n        k += 1\n",
  },
  {
    value: "quick",
    label: "Quick Sort",
    complexity: "O(n log n) avg",
    code: "def quick_sort(values, lo=0, hi=None):\n    if hi is None:\n        hi = len(values) - 1\n    if lo >= hi:\n        return values\n    pivot = values[hi]\n    i = lo - 1\n    for j in range(lo, hi):\n        if values[j] <= pivot:\n            i += 1\n            values[i], values[j] = values[j], values[i]\n    values[i + 1], values[hi] = values[hi], values[i + 1]\n    pivot_index = i + 1\n    quick_sort(values, lo, pivot_index - 1)\n    quick_sort(values, pivot_index + 1, hi)\n    return values\n",
  },
];

export default function Home() {
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>("bubble");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [frames, setFrames] = useState<SortTraceFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selected = ALGORITHMS.find((a) => a.value === algorithm)!;

  async function handleRun() {
    setStatus("running");
    setIsPlaying(false);
    setErrorMessage(null);
    try {
      const trace = await runSortTrace(algorithm);
      setFrames(trace);
      setFrameIndex(0);
      setStatus("done");
    } catch (error) {
      console.error("sort trace failed:", error);
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

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold tracking-tight">
              Algo Visualizer
            </h1>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Watch sorting algorithms run, step by step
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
                <CardTitle>{selected.label}</CardTitle>
                <CardDescription>
                  Traced line-by-line in Python via Pyodide
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {selected.complexity}
                </Badge>
                <Select
                  items={ALGORITHMS}
                  value={algorithm}
                  onValueChange={(value) => {
                    setAlgorithm(value as SortAlgorithm);
                    setStatus("idle");
                    setFrames([]);
                    setFrameIndex(0);
                    setIsPlaying(false);
                  }}
                >
                  <SelectTrigger aria-label="Select algorithm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALGORITHMS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="max-h-72 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">
              <code>{selected.code}</code>
            </pre>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Visualization</CardTitle>
            {currentFrame && (
              <CardDescription className="font-mono text-xs">
                line {currentFrame.line} · depth {currentFrame.depth}
                {currentFrame.swapped ? " · swapped" : ""}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex min-h-72 flex-col justify-end">
              {status === "idle" && (
                <p className="py-24 text-center text-sm text-muted-foreground">
                  Press Run to trace {selected.label}.
                </p>
              )}
              {status === "running" && (
                <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
                  <Loader2Icon className="size-5 animate-spin" />
                  <p className="text-sm">Loading Pyodide and tracing…</p>
                </div>
              )}
              {status === "error" && (
                <div className="flex flex-col items-center gap-2 py-24 text-destructive">
                  <AlertCircleIcon className="size-5" />
                  <p className="text-sm">{errorMessage}</p>
                </div>
              )}
              {status === "done" && currentFrame && (
                <BarsVisualizer frame={currentFrame} />
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
