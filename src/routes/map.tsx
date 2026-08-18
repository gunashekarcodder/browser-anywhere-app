import { useQuery } from "@tanstack/react-query";
import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import { AppShell } from "@/components/aqua/AppShell";
import { SeverityBadge } from "@/components/aqua/SeverityBadge";
import { camerasQuery, incidentsQuery, zonesQuery } from "@/lib/aqua/db";
import { bandForScore } from "@/lib/aqua/severity";

const ZoneMap = lazy(() => import("@/components/aqua/ZoneMap"));

export const Route = createFileRoute("/map")({
  head: () => ({
    meta: [
      { title: "Zone Risk Map — AquaSentinel AI" },
      {
        name: "description",
        content:
          "Live city map of monitored zones and camera positions, coloured by the severity of open waterlogging incidents.",
      },
      { property: "og:title", content: "Zone Risk Map — AquaSentinel AI" },
      {
        property: "og:description",
        content: "City map of monitored waterlogging zones coloured by live incident severity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MapRoute,
});

function MapSkeleton() {
  return (
    <div className="grid h-[70vh] min-h-80 place-items-center rounded-xl border border-border bg-muted/30 text-sm text-muted-foreground">
      Loading map…
    </div>
  );
}

function MapRoute() {
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: cameras = [] } = useQuery(camerasQuery);
  const { data: incidents = [] } = useQuery(incidentsQuery);

  const open = incidents.filter((i) => i.status !== "resolved");

  return (
    <AppShell
      title="Zone risk map"
      subtitle={`${zones.length} monitored zones · ${cameras.length} camera positions · ${open.length} open incidents`}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="panel overflow-hidden p-2">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <ZoneMap zones={zones} cameras={cameras} incidents={incidents} />
            </Suspense>
          </ClientOnly>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Zone status
          </h2>
          <ul className="mt-3 space-y-3">
            {zones.map((z) => {
              const zoneOpen = open.filter((i) => i.zone_id === z.id);
              const worst = zoneOpen.length
                ? zoneOpen.reduce((a, b) => (b.severity_score > a.severity_score ? b : a))
                : null;
              return (
                <li key={z.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0">
                  <div>
                    <p className="text-sm font-medium">{z.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Ward {z.ward ?? "—"} · {z.drainage_risk} drainage risk
                    </p>
                  </div>
                  {worst ? (
                    <SeverityBadge
                      band={bandForScore(worst.severity_score)}
                      score={worst.severity_score}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">clear</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}
