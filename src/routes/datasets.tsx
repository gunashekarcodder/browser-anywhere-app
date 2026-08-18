import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";

import flood01 from "@/assets/flood-01.jpg.asset.json";
import flood02 from "@/assets/flood-02.jpg.asset.json";
import flood03 from "@/assets/flood-03.jpg.asset.json";
import flood04 from "@/assets/flood-04.jpg.asset.json";
import floodClip from "@/assets/flood-clip.mp4.asset.json";
import { AppShell } from "@/components/aqua/AppShell";
import { datasetsQuery } from "@/lib/aqua/db";

export const Route = createFileRoute("/datasets")({
  head: () => ({
    meta: [
      { title: "Datasets — AquaSentinel AI Waterlogging Detection" },
      {
        name: "description",
        content:
          "Open flood and waterlogging datasets used by AquaSentinel, plus the sample Wikimedia Commons clips and frames bundled with the app for live testing.",
      },
      { property: "og:title", content: "Datasets — AquaSentinel AI" },
      {
        property: "og:description",
        content: "Open flood imagery datasets and bundled sample media for waterlogging detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DatasetsRoute,
});

const BUNDLED = [
  { url: flood01.url, label: "Flooded street" },
  { url: flood02.url, label: "Waterlogged road" },
  { url: flood03.url, label: "Urban flood with vehicles" },
  { url: flood04.url, label: "Submerged carriageway" },
];

function DatasetsRoute() {
  const { data: datasets = [] } = useQuery(datasetsQuery);

  return (
    <AppShell
      title="Datasets"
      subtitle="Open imagery used for tuning thresholds and for the bundled live-test media"
    >
      <div className="space-y-6">
        <section className="panel p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Bundled sample media (Wikimedia Commons, freely licensed)
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            These ship with the app so detection can be demonstrated on real flood footage without
            any upload. The live monitor loads them directly.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <figure className="overflow-hidden rounded-lg border border-border">
              <video
                src={floodClip.url}
                className="h-40 w-full object-cover"
                muted
                loop
                playsInline
                controls
              />
              <figcaption className="p-2 text-xs text-muted-foreground">
                Sample flood video clip (22 s)
              </figcaption>
            </figure>
            {BUNDLED.map((b) => (
              <figure key={b.url} className="overflow-hidden rounded-lg border border-border">
                <img src={b.url} alt={b.label} className="h-40 w-full object-cover" loading="lazy" />
                <figcaption className="p-2 text-xs text-muted-foreground">{b.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Open datasets catalogue
          </h2>
          {datasets.map((d) => (
            <div key={d.id} className="panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-semibold">{d.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.licence ?? "licence unknown"} · {d.images_count ?? 0} images ·{" "}
                    {d.videos_count ?? 0} videos · {d.status}
                  </p>
                  {d.purpose && <p className="mt-2 text-sm text-muted-foreground">{d.purpose}</p>}
                  {d.notes && <p className="mt-1 text-xs text-muted-foreground">{d.notes}</p>}
                </div>
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  Source <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          ))}
          {datasets.length === 0 && (
            <p className="text-sm text-muted-foreground">No datasets catalogued yet.</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
