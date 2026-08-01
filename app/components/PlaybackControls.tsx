"use client";

import {
  PauseIcon,
  PlayIcon,
  SkipBackIcon,
  SkipForwardIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SPEEDS = [
  { value: "400", label: "0.5x" },
  { value: "200", label: "1x" },
  { value: "80", label: "2x" },
  { value: "30", label: "4x" },
];

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
    <div className="flex w-full flex-col gap-4">
      <Slider
        min={0}
        max={Math.max(frameCount - 1, 0)}
        value={[frameIndex]}
        onValueChange={(value) =>
          onScrub(Array.isArray(value) ? value[0] : value)
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Step backward"
            onClick={() => onStep(-1)}
            disabled={frameIndex === 0}
          >
            <SkipBackIcon className="size-4" />
          </Button>
          <Button onClick={onTogglePlay} className="min-w-24">
            {isPlaying ? (
              <>
                <PauseIcon className="size-4" /> Pause
              </>
            ) : (
              <>
                <PlayIcon className="size-4" /> Play
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Step forward"
            onClick={() => onStep(1)}
            disabled={frameIndex >= frameCount - 1}
          >
            <SkipForwardIcon className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {frameIndex + 1} / {frameCount}
          </span>
          <Select
            items={SPEEDS}
            value={String(speed)}
            onValueChange={(value) => onSpeedChange(Number(value))}
          >
            <SelectTrigger size="sm" aria-label="Playback speed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPEEDS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
