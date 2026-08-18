import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/aqua/AppShell";
import { MonitorPanel } from "@/components/aqua/MonitorPanel";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "Live Monitor — AquaSentinel AI Waterlogging Detection" },
      {
        name: "description",
        content:
          "Analyse drone, CCTV or phone camera feeds in real time: water coverage, persistence gating, explainable severity scoring and AI frame verification.",
      },
      { property: "og:title", content: "Live Monitor — AquaSentinel AI" },
      {
        property: "og:description",
        content:
          "Real-time urban waterlogging detection on live video with explainable severity scoring.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MonitorRoute,
});

function MonitorRoute() {
  return (
    <AppShell
      title="Live monitor"
      subtitle="Rule-based water detection with temporal persistence gating and AI verification"
    >
      <MonitorPanel />
    </AppShell>
  );
}
