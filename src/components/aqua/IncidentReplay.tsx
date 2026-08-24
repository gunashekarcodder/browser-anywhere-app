import { ChevronLeft, ChevronRight, Download, Loader2, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { exportIncidentClip } from "@/lib/aqua/clip";
import type { Evidence } from "@/lib/aqua/db";

const SPEEDS = [2, 4, 8] as const;

/**
 * Frame-sequence replay of an incident. Evidence frames are stored inline in the
 * database (not on a CDN), so the footage stays watchable and downloadable for
 * as long as the incident exists.
 */
export function IncidentReplay({
  frames,
  label,
}: {
  frames: Evidence[];
  label: string;
}) {
  const ordered = useMemo(
    () =>
      [...frames]
        .filter((f) => Boolean(f.image_url))
        .sort((a, b) => +new Date(a.captured_at) - +new Date(b.captured_at)),
    [frames],
  );

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [fps, setFps] = useState<number>(4);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (index > ordered.length - 1) setIndex(0);
  }, [ordered.length, index]);

  useEffect(() => {
    if (!playing || ordered.length < 2) return;
    const handle = window.setInterval(() => {
      setIndex((i) => (i + 1) % ordered.length);
    }, 1000 / fps);
    return () => window.clearInterval(handle);
  }, [playing, fps, ordered.length]);

  const current = ordered[Math.min(index, ordered.length - 1)];

  const exportClip = useCallback(async () => {
    if (ordered.length === 0) return;
    setExporting(true);
    try {
      await exportIncidentClip(ordered, label, fps);
      toast.success("Replay clip downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export the clip");
    } finally {
      setExporting(false);
    }
  }, [fps, label, ordered]);

  if (ordered.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No footage captured for this incident yet.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-2 rounded-lg border border-border bg-muted/25 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Footage replay · {ordered.length} frames
        </h3>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => setFps(s)}
              className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                fps === s ? "border-primary text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {s}fps
            </button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-md border border-border bg-black">
        <img
          src={current?.image_url ?? ""}
          alt={current?.caption ?? "Incident replay frame"}
          className="block max-h-72 w-full object-contain"
        />
        <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[11px]">
          {current ? new Date(current.captured_at).toLocaleTimeString() : ""} ·{" "}
          {((current?.water_coverage ?? 0) * 100).toFixed(1)}% water
        </span>
        <span className="absolute right-2 top-2 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[11px]">
          {index + 1}/{ordered.length}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="secondary" onClick={() => setPlaying((p) => !p)}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIndex((i) => (i - 1 + ordered.length) % ordered.length)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={() => setIndex((i) => (i + 1) % ordered.length)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <div className="min-w-40 flex-1">
          <Slider
            value={[index]}
            min={0}
            max={Math.max(0, ordered.length - 1)}
            step={1}
            onValueChange={([v]) => {
              setPlaying(false);
              setIndex(v ?? 0);
            }}
          />
        </div>
        <Button size="sm" variant="ghost" onClick={() => void exportClip()} disabled={exporting}>
          {exporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download clip
        </Button>
      </div>
      {current?.caption && <p className="text-[11px] text-muted-foreground">{current.caption}</p>}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
