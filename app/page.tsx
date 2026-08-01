"use client";

import { useEffect, useState } from "react";
import { runBubbleSortTrace, type SortTraceFrame } from "./lib/pyodide-client";
import BarsVisualizer from "./components/BarsVisualizer";
import PlaybackControls from "./components/PlaybackControls";

export default function Home() {
  const [code, setCode] = useState(
    "def bubble_sort(values):\n    n = len(values)\n    for i in range(n - 1):\n        for j in range(n - i - 1):\n            if values[j] > values[j + 1]:\n                values[j], values[j + 1] = values[j + 1], values[j]\n    return values\n"
  );
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );
  const [frames, setFrames] = useState<SortTraceFrame[]>([]);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(200);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRun() {
    setStatus("running");
    setIsPlaying(false);
    setErrorMessage(null);
    try {
      const trace = await runBubbleSortTrace();
      setFrames(trace);
      setFrameIndex(0);
      setStatus("done");
    } catch (error) {
      console.error("bubble sort trace failed:", error);
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

  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Algo Visualizer
        </h1>
        <textarea
          value={code}
          onChange={(event) => setCode(event.target.value)}
          spellCheck={false}
          className="h-48 w-full rounded-lg border border-black/10 bg-white p-4 font-mono text-sm text-black outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleRun}
          disabled={status === "running"}
          className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {status === "running" ? "Running…" : "Run"}
        </button>

        <div className="flex min-h-64 w-full flex-col justify-end gap-4 rounded-lg border border-dashed border-black/15 py-6 dark:border-white/15">
          {status === "idle" && (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Click Run to trace and animate a bubble sort.
            </p>
          )}
          {status === "running" && (
            <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              Loading Pyodide and tracing…
            </p>
          )}
          {status === "error" && (
            <p className="text-center text-sm text-red-500">{errorMessage}</p>
          )}
          {status === "done" && hasFrames && (
            <BarsVisualizer frame={frames[frameIndex]} />
          )}
        </div>

        {status === "done" && hasFrames && (
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
        )}
      </main>
    </div>
  );
}
