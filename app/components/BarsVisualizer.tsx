import type { SortTraceFrame } from "../lib/pyodide-client";

export default function BarsVisualizer({ frame }: { frame: SortTraceFrame }) {
  const max = Math.max(...frame.arrayState, 1);
  const [comparedA, comparedB] = frame.comparedIndices ?? [-1, -1];

  return (
    <div className="flex h-64 w-full items-end justify-center gap-2 px-4">
      {frame.arrayState.map((value, index) => {
        const isCompared = index === comparedA || index === comparedB;
        return (
          <div
            key={index}
            className={`flex w-full max-w-10 flex-col items-center justify-end rounded-t transition-all duration-150 ${
              isCompared
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-zinc-800 dark:bg-zinc-300"
            }`}
            style={{ height: `${(value / max) * 100}%` }}
          >
            <span className="mb-1 text-xs text-white mix-blend-difference">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
