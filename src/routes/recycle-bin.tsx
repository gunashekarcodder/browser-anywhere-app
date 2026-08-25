import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/aqua/AppShell";
import { SeverityBadge } from "@/components/aqua/SeverityBadge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ensureOperator } from "@/lib/aqua/auth";
import { exportIncidentClip, exportIncidentReport } from "@/lib/aqua/clip";
import {
  actionsQuery,
  binnedIncidentsQuery,
  evidenceQuery,
  type Incident,
  zonesQuery,
} from "@/lib/aqua/db";

export const Route = createFileRoute("/recycle-bin")({
  head: () => ({
    meta: [
      { title: "Recycling Bin — AquaSentinel AI" },
      {
        name: "description",
        content:
          "Cleared and deleted waterlogging incidents held in the recycling bin — restore them to the live log, re-download their footage, or purge them permanently.",
      },
      { property: "og:title", content: "Recycling Bin — AquaSentinel AI" },
      {
        property: "og:description",
        content: "Restore, re-download or permanently purge archived waterlogging incidents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RecycleBinRoute,
});

function RecycleBinRoute() {
  const qc = useQueryClient();
  const { data: binned = [], isLoading } = useQuery(binnedIncidentsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: evidence = [] } = useQuery(evidenceQuery);
  const { data: actions = [] } = useQuery(actionsQuery);
  const [busy, setBusy] = useState<string | null>(null);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unassigned zone";
  const labelFor = (i: Incident) =>
    `${zoneName(i.zone_id)}-${new Date(i.first_seen).toISOString().slice(0, 16)}`;

  const refresh = () => void qc.invalidateQueries({ queryKey: ["incidents"] });

  const restore = async (incident: Incident) => {
    if (!(await ensureOperator("restore an incident"))) return;
    const { error } = await supabase
      .from("incidents")
      .update({ deleted_at: null })
      .eq("id", incident.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Restored to the live incident log");
    refresh();
  };

  const download = async (incident: Incident) => {
    const shots = evidence.filter((e) => e.incident_id === incident.id);
    setBusy(incident.id);
    try {
      exportIncidentReport(
        incident,
        labelFor(incident),
        shots,
        actions.filter((a) => a.incident_id === incident.id),
      );
      const hadClip = await exportIncidentClip(shots, labelFor(incident));
      toast.success(hadClip ? "Footage and report downloaded" : "Report downloaded (no footage)");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not download the archive");
    } finally {
      setBusy(null);
    }
  };

  const purge = async (incident: Incident) => {
    if (!(await ensureOperator("permanently delete an incident"))) return;
    if (!window.confirm("Permanently delete this incident, its footage and its action trail?"))
      return;
    setBusy(incident.id);
    try {
      for (const step of [
        supabase.from("evidence").delete().eq("incident_id", incident.id),
        supabase.from("frame_metrics").delete().eq("incident_id", incident.id),
        supabase.from("operator_actions").delete().eq("incident_id", incident.id),
      ]) {
        const { error } = await step;
        if (error) throw new Error(error.message);
      }
      const { error } = await supabase.from("incidents").delete().eq("id", incident.id);
      if (error) throw new Error(error.message);
      toast.success("Permanently deleted");
      refresh();
      void qc.invalidateQueries({ queryKey: ["evidence"] });
      void qc.invalidateQueries({ queryKey: ["operator_actions"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete the incident");
    } finally {
      setBusy(null);
    }
  };

  const emptyBin = async () => {
    if (!(await ensureOperator("empty the recycling bin"))) return;
    if (!window.confirm(`Permanently delete all ${binned.length} binned incidents?`)) return;
    for (const incident of binned) {
      const ids = { incident_id: incident.id };
      await supabase.from("evidence").delete().match(ids);
      await supabase.from("frame_metrics").delete().match(ids);
      await supabase.from("operator_actions").delete().match(ids);
      await supabase.from("incidents").delete().eq("id", incident.id);
    }
    toast.success("Recycling bin emptied");
    refresh();
    void qc.invalidateQueries({ queryKey: ["evidence"] });
    void qc.invalidateQueries({ queryKey: ["operator_actions"] });
  };

  return (
    <AppShell
      title="Recycling bin"
      subtitle={`${binned.length} cleared or deleted incidents · restore, re-download or purge`}
      actions={
        binned.length > 0 ? (
          <Button size="sm" variant="destructive" onClick={() => void emptyBin()}>
            <Trash2 className="mr-2 h-4 w-4" />
            Empty bin
          </Button>
        ) : undefined
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading recycling bin…</p>
      ) : binned.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-base font-semibold">The recycling bin is empty</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Resolved incidents land here after their footage and report are downloaded, so the live
            log only shows current data.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {binned.map((incident) => {
            const shots = evidence.filter((e) => e.incident_id === incident.id);
            return (
              <article
                key={incident.id}
                className="panel flex flex-wrap items-start justify-between gap-3 p-4"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base font-semibold">
                      {zoneName(incident.zone_id)}
                    </h2>
                    <SeverityBadge band={incident.severity_band} score={incident.severity_score} />
                    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
                      {incident.archived_at ? "archived" : "deleted"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    binned {incident.deleted_at ? new Date(incident.deleted_at).toLocaleString() : "—"}{" "}
                    · {shots.length} stored frames ·{" "}
                    {(incident.water_coverage * 100).toFixed(1)}% water
                  </p>
                  {incident.resolution_note && (
                    <p className="mt-1 text-xs text-muted-foreground">{incident.resolution_note}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void restore(incident)}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === incident.id}
                    onClick={() => void download(incident)}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={busy === incident.id}
                    onClick={() => void purge(incident)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete forever
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
