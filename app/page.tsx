"use client";

import { useState } from "react";
import { runTraceSpike } from "./lib/pyodide-client";

export default function Home() {
  const [code, setCode] = useState(
    "def bubble_sort(values):\n    n = len(values)\n    for i in range(n - 1):\n        if values[i] > values[i + 1]:\n            values[i], values[i + 1] = values[i + 1], values[i]\n    return values\n"
  );
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle"
  );

  async function handleRun() {
    setStatus("running");
    try {
      const trace = await runTraceSpike();
      console.log("pyodide trace spike result:", trace);
      setStatus("done");
    } catch (error) {
      console.error("pyodide trace spike failed:", error);
      setStatus("error");
    }
  }

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
          className="h-64 w-full rounded-lg border border-black/10 bg-white p-4 font-mono text-sm text-black outline-none dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          onClick={handleRun}
          disabled={status === "running"}
          className="w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {status === "running" ? "Running…" : "Run"}
        </button>
        <div className="flex min-h-64 w-full items-center justify-center rounded-lg border border-dashed border-black/15 text-sm text-zinc-500 dark:border-white/15 dark:text-zinc-400">
          {status === "idle" && "Visualization canvas — coming in Phase 3"}
          {status === "running" && "Loading Pyodide and tracing…"}
          {status === "done" && "Trace captured — check the browser console"}
          {status === "error" && "Trace failed — check the browser console"}
        </div>
      </main>
    </div>
  );
}
