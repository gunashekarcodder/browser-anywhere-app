import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Cctv, Droplets, Radar } from "lucide-react";

import flood01 from "@/assets/flood-01.jpg.asset.json";
import { AppShell } from "@/components/aqua/AppShell";
import { SeverityBadge, StatusBadge } from "@/components/aqua/SeverityBadge";
import { Button } from "@/components/ui/button";
import {
  camerasQuery,
  evidenceQuery,
  frameMetricsQuery,
  incidentsQuery,
  zonesQuery,
} from "@/lib/aqua/db";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AquaSentinel AI — Urban Waterlogging Detection Dashboard" },
      {
        name: "description",
        content:
          "Detect urban road waterlogging in real time from drone, CCTV and phone camera feeds, score severity explainably and drive civic response — all in the browser.",
      },
      { property: "og:title", content: "AquaSentinel AI — Urban Waterlogging Detection" },
      {
        property: "og:description",
        content:
          "Real-time waterlogging detection, explainable severity scoring and incident response for city control rooms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { data: incidents = [] } = useQuery(incidentsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: cameras = [] } = useQuery(camerasQuery);
  const { data: metrics = [] } = useQuery(frameMetricsQuery);
  const { data: evidence = [] } = useQuery(evidenceQuery);

  const active = incidents.filter((i) => i.status === "active");
  const critical = incidents.filter(
    (i) => i.status !== "resolved" && (i.severity_band === "critical" || i.severity_band === "high"),
  );
  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unassigned";

  return (
    <AppShell
      title="Operations dashboard"
      subtitle="City-wide waterlogging status, updated live from every connected feed"
      actions={
        <Button asChild>
          <Link to="/monitor">
            <Radar className="mr-2 h-4 w-4" /> Open live monitor
          </Link>
        </Button>
      }
    >
      <section className="panel grid-scanlines relative overflow-hidden p-0">
        <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <div className="p-6 md:p-8">
            <p className="text-xs uppercase tracking-[0.18em] text-primary">
              Drone + CCTV waterlogging intelligence
            </p>
            <h2 className="mt-3 font-display text-2xl font-semibold leading-tight md:text-3xl">
              Find the flooded stretch before the traffic does.
            </h2>
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              AquaSentinel analyses any video feed in the browser — sample footage, an upload, a
              network camera or the device camera on a drone controller — measures how much of the
              road is under standing water, holds the detection through a persistence gate so
              passing vehicles do not trigger it, then cross-checks the frame with a vision model and
              opens a scored incident for the control room.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/monitor">Start detecting</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/incidents">View incident log</Link>
              </Button>
            </div>
          </div>
          <div className="relative min-h-48">
            <img
              src={flood01.url}
              alt="Flooded urban street with vehicles wading through standing water"
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-linear-to-l from-transparent to-background" />
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={AlertTriangle}
          label="Active incidents"
          value={String(active.length)}
          hint={`${critical.length} at high or critical severity`}
        />
        <Kpi
          icon={Droplets}
          label="Frames analysed"
          value={String(metrics.length)}
          hint={`${metrics.filter((m) => m.verdict === "waterlogged").length} flagged waterlogged`}
        />
        <Kpi
          icon={Cctv}
          label="Camera sources"
          value={String(cameras.length)}
          hint={`${zones.length} monitored zones`}
        />
        <Kpi
          icon={Radar}
          label="Evidence captured"
          value={String(evidence.length)}
          hint="Snapshots attached to incidents"
        />
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="panel p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Latest incidents
            </h2>
            <Link to="/incidents" className="text-xs text-primary hover:underline">
              See all
            </Link>
          </div>
          {incidents.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Nothing detected yet. Run a feed in the live monitor and confirmed waterlogging will
              appear here.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {incidents.slice(0, 6).map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{zoneName(i.zone_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {(i.water_coverage * 100).toFixed(1)}% water · {i.persistence_seconds}s
                      persistence · {new Date(i.last_seen).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={i.status} />
                    <SeverityBadge band={i.severity_band} score={i.severity_score} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent evidence
          </h2>
          {evidence.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Evidence snapshots captured during detection appear here.
            </p>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {evidence.slice(0, 6).map((e) => (
                <figure key={e.id} className="overflow-hidden rounded-md border border-border">
                  <img
                    src={e.image_url ?? ""}
                    alt={e.caption ?? "Waterlogging evidence snapshot"}
                    className="h-24 w-full object-cover"
                  />
                  <figcaption className="px-2 py-1 text-[11px] text-muted-foreground">
                    {(e.water_coverage * 100).toFixed(0)}% · score {e.severity_score}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Radar;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
