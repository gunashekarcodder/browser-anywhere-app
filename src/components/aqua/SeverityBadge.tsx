import { BAND_LABEL, type SeverityBand } from "@/lib/aqua/severity";
import { cn } from "@/lib/utils";

const BAND_CLASS: Record<SeverityBand, string> = {
  low: "bg-low/15 text-low border-low/35",
  moderate: "bg-moderate/15 text-moderate border-moderate/35",
  high: "bg-high/15 text-high border-high/35",
  critical: "bg-critical/18 text-critical border-critical/40",
};

export function SeverityBadge({
  band,
  score,
  className,
}: {
  band: string;
  score?: number;
  className?: string;
}) {
  const key = (["low", "moderate", "high", "critical"].includes(band) ? band : "low") as SeverityBand;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        BAND_CLASS[key],
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {BAND_LABEL[key]}
      {typeof score === "number" && <span className="font-mono opacity-80">{Math.round(score)}</span>}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-critical/15 text-critical border-critical/35",
    monitoring: "bg-moderate/15 text-moderate border-moderate/35",
    resolved: "bg-low/15 text-low border-low/35",
    online: "bg-low/15 text-low border-low/35",
    offline: "bg-muted text-muted-foreground border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize",
        map[status] ?? "bg-muted text-muted-foreground border-border",
      )}
    >
      {status}
    </span>
  );
}
