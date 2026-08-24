import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/aqua/AppShell";
import { BenchmarkPanel } from "@/components/aqua/BenchmarkPanel";
import { evalsQuery, frameMetricsQuery, incidentsQuery } from "@/lib/aqua/db";


export const Route = createFileRoute("/evaluation")({
  head: () => ({
    meta: [
      { title: "Model Evaluation — AquaSentinel AI" },
      {
        name: "description",
        content:
          "Measured precision, recall and latency of the AquaSentinel waterlogging detector, plus live counts of frames analysed in this deployment.",
      },
      { property: "og:title", content: "Model Evaluation — AquaSentinel AI" },
      {
        property: "og:description",
        content: "Precision, recall, latency and live throughput of the waterlogging detector.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EvaluationRoute,
});

function EvaluationRoute() {
  const { data: evals = [] } = useQuery(evalsQuery);
  const { data: metrics = [] } = useQuery(frameMetricsQuery);
  const { data: incidents = [] } = useQuery(incidentsQuery);

  const flagged = metrics.filter((m) => m.verdict === "waterlogged").length;
  const byVersion = evals.reduce<Record<string, typeof evals>>((acc, e) => {
    (acc[e.model_version] ??= []).push(e);
    return acc;
  }, {});

  return (
    <AppShell
      title="Evaluation"
      subtitle="Honest reporting: rule-based vision stage + AI verification, scored on a held-out sample"
    >
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Frames analysed (logged)" value={String(metrics.length)} />
          <Tile label="Frames flagged waterlogged" value={String(flagged)} />
          <Tile label="Incidents opened" value={String(incidents.length)} />
        </div>

        <BenchmarkPanel />

        <h2 className="font-display text-sm font-semibold">Recorded runs in the model registry</h2>



        {Object.entries(byVersion).map(([version, rows]) => (
          <section key={version} className="panel p-4">
            <h2 className="font-display text-sm font-semibold">{version}</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-md text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Split</th>
                    <th className="py-2 pr-3">Metric</th>
                    <th className="py-2 pr-3">Value</th>
                    <th className="py-2 pr-3">Samples</th>
                    <th className="py-2">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3">{r.split}</td>
                      <td className="py-2 pr-3">{r.metric_name}</td>
                      <td className="py-2 pr-3 font-mono">{Number(r.metric_value).toFixed(3)}</td>
                      <td className="py-2 pr-3 font-mono">{r.sample_count ?? "—"}</td>
                      <td className="py-2 text-xs text-muted-foreground">{r.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section className="panel p-4 text-sm text-muted-foreground">
          <h2 className="font-display text-sm font-semibold text-foreground">
            What this system does and does not claim
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Stage 1, the in-browser detector, is a deterministic HSV + texture-gradient
              estimator with a temporal persistence gate — not a trained segmentation network.
              It is tuned for recall and used as a cheap screening filter: on hard negatives
              (rain-wet asphalt, night reflections, bright dry concrete) it over-flags, which
              the measured stage-1 false-alert rate above reports openly.
            </li>
            <li>
              Stage 2 is the AI frame verification: only screened-in frames are sent to the
              vision model, and its verdict decides the alert. The end-to-end precision,
              recall, F1 and false-alert rate shown above are the numbers an operator actually
              experiences. People, vehicle and depth figures come from this stage only.
            </li>
            <li>
              Severity is a documented weighted formula; every contribution is shown in the live
              monitor so an operator can audit a score.
            </li>
            <li>
              Night, heavy rain, glare and freshly wet asphalt remain the dominant error sources.
              Raise the detection threshold for glare-prone cameras.
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}
