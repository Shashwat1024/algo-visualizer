export default function PlaybackControls({
  frameIndex,
  frameCount,
  isPlaying,
  speed,
  onTogglePlay,
  onStep,
  onScrub,
  onSpeedChange,
}: {
  frameIndex: number;
  frameCount: number;
  isPlaying: boolean;
  speed: number;
  onTogglePlay: () => void;
  onStep: (delta: number) => void;
  onScrub: (index: number) => void;
  onSpeedChange: (speed: number) => void;
}) {
  return (
    <div className="flex w-full flex-col gap-3">
      <input
        type="range"
        min={0}
        max={Math.max(frameCount - 1, 0)}
        value={frameIndex}
        onChange={(event) => onScrub(Number(event.target.value))}
        className="w-full"
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStep(-1)}
            disabled={frameIndex === 0}
            className="rounded-full border border-black/15 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-white/15"
          >
            ◀ Step
          </button>
          <button
            onClick={onTogglePlay}
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            onClick={() => onStep(1)}
            disabled={frameIndex === frameCount - 1}
            className="rounded-full border border-black/15 px-3 py-1.5 text-sm disabled:opacity-40 dark:border-white/15"
          >
            Step ▶
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <span>
            Frame {frameIndex + 1} / {frameCount}
          </span>
          <label className="flex items-center gap-1.5">
            Speed
            <select
              value={speed}
              onChange={(event) => onSpeedChange(Number(event.target.value))}
              className="rounded border border-black/15 bg-transparent px-1.5 py-1 dark:border-white/15"
            >
              <option value={400}>0.5x</option>
              <option value={200}>1x</option>
              <option value={80}>2x</option>
              <option value={30}>4x</option>
            </select>
          </label>
        </div>
      </div>
    </div>
  );
}
