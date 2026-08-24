import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/aqua/AppShell";
import { IncidentReplay } from "@/components/aqua/IncidentReplay";
import { SeverityBadge, StatusBadge } from "@/components/aqua/SeverityBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { ensureOperator } from "@/lib/aqua/auth";
import { exportIncidentClip, exportIncidentReport } from "@/lib/aqua/clip";
import {
  actionsQuery,
  camerasQuery,
  evidenceQuery,
  type Incident,
  incidentsQuery,
  zonesQuery,
} from "@/lib/aqua/db";
import { BAND_ADVICE, type SeverityBand } from "@/lib/aqua/severity";

export const Route = createFileRoute("/incidents")({
  head: () => ({
    meta: [
      { title: "Incident Log — AquaSentinel AI" },
      {
        name: "description",
        content:
          "Every confirmed waterlogging incident with severity score, AI verification notes, captured evidence and the civic actions taken by operators.",
      },
      { property: "og:title", content: "Incident Log — AquaSentinel AI" },
      {
        property: "og:description",
        content: "Confirmed waterlogging incidents, evidence snapshots and operator action trail.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IncidentsRoute,
});

function IncidentsRoute() {
  const qc = useQueryClient();
  const { data: incidents = [], isLoading } = useQuery(incidentsQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: cameras = [] } = useQuery(camerasQuery);
  const { data: evidence = [] } = useQuery(evidenceQuery);
  const { data: actions = [] } = useQuery(actionsQuery);

  const [statusFilter, setStatusFilter] = useState("all");
  const [bandFilter, setBandFilter] = useState("all");
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const zoneName = (id: string | null) => zones.find((z) => z.id === id)?.name ?? "Unassigned zone";
  const cameraName = (id: string | null) => cameras.find((c) => c.id === id)?.name ?? "Manual entry";

  const filtered = incidents.filter(
    (i) =>
      (statusFilter === "all" || i.status === statusFilter) &&
      (bandFilter === "all" || i.severity_band === bandFilter),
  );

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["incidents"] });
    void qc.invalidateQueries({ queryKey: ["operator_actions"] });
  };

  /** Downloads the footage + report, then moves the incident to the recycling bin. */
  const archiveAndRemove = async (incident: Incident) => {
    if (!(await ensureOperator("archive an incident"))) return;
    const label = `${zoneName(incident.zone_id)}-${new Date(incident.first_seen).toISOString().slice(0, 16)}`;
    const shots = evidence.filter((e) => e.incident_id === incident.id);
    setBusy(incident.id);
    try {
      exportIncidentReport(incident, label, shots, actions.filter((a) => a.incident_id === incident.id));
      const hadClip = await exportIncidentClip(shots, label);
      const stamp = new Date().toISOString();
      const { error } = await supabase
        .from("incidents")
        .update({ archived_at: stamp, deleted_at: stamp })
        .eq("id", incident.id);
      if (error) throw new Error(error.message);
      toast.success(
        hadClip
          ? "Footage and report downloaded — incident moved to the recycling bin"
          : "Report downloaded (no footage stored) — incident moved to the recycling bin",
      );
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not archive the incident");
    } finally {
      setBusy(null);
    }
  };

  const moveToBin = async (incident: Incident) => {
    if (!(await ensureOperator("delete an incident"))) return;
    const { error } = await supabase
      .from("incidents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", incident.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Moved to recycling bin");
    refresh();
  };

  const logAction = async (incidentId: string, actionType: string, text?: string) => {
    if (!(await ensureOperator("log a response action"))) return false;
    const { error } = await supabase.from("operator_actions").insert({
      incident_id: incidentId,
      action_type: actionType,
      actor: "control-room operator",
      note: text ?? null,
    });
    if (error) {
      toast.error(error.message);
      return false;
    }
    if (actionType === "resolved") {
      await supabase
        .from("incidents")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution_note: text ?? "Cleared by field crew",
        })
        .eq("id", incidentId);
    }
    toast.success("Action recorded");
    void qc.invalidateQueries({ queryKey: ["operator_actions"] });
    void qc.invalidateQueries({ queryKey: ["incidents"] });
  };

  return (
    <AppShell
      title="Incident log"
      subtitle={`${incidents.length} incidents recorded · ${incidents.filter((i) => i.status === "active").length} active now`}
      actions={
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="monitoring">Monitoring</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bandFilter} onValueChange={setBandFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severity</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading incidents…</p>
      ) : filtered.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-base font-semibold">No incidents match this filter</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Open the live monitor and run a feed — confirmed waterlogging is written here
            automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((incident) => {
            const shots = evidence.filter((e) => e.incident_id === incident.id);
            const trail = actions.filter((a) => a.incident_id === incident.id);
            return (
              <article key={incident.id} className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-base font-semibold">
                        {zoneName(incident.zone_id)}
                      </h2>
                      <SeverityBadge band={incident.severity_band} score={incident.severity_score} />
                      <StatusBadge status={incident.status} />
                      {incident.ai_verified && (
                        <span className="rounded-full border border-primary/35 bg-primary/12 px-2.5 py-0.5 text-xs text-primary">
                          AI verified
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {cameraName(incident.camera_id)} · first seen{" "}
                      {new Date(incident.first_seen).toLocaleString()} · last seen{" "}
                      {new Date(incident.last_seen).toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void logAction(incident.id, "crew_dispatched", "Pump crew dispatched")}
                    >
                      Dispatch crew
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void logAction(incident.id, "traffic_diverted", "Traffic diverted")}
                    >
                      Divert traffic
                    </Button>
                    {incident.status !== "resolved" && (
                      <Button
                        size="sm"
                        onClick={() => void logAction(incident.id, "resolved", note[incident.id])}
                      >
                        Mark resolved
                      </Button>
                    )}
                  </div>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {incident.ai_summary ?? BAND_ADVICE[incident.severity_band as SeverityBand]}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                  <Cell label="Water coverage" value={`${(incident.water_coverage * 100).toFixed(1)}%`} />
                  <Cell label="Road blocked" value={`${(incident.road_blocked_ratio * 100).toFixed(0)}%`} />
                  <Cell label="Persistence" value={`${incident.persistence_seconds}s`} />
                  <Cell label="People" value={String(incident.people_count)} />
                  <Cell label="Vehicles" value={String(incident.vehicle_count)} />
                </dl>

                {shots.length > 0 && (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {shots.slice(0, 4).map((s) => (
                        <img
                          key={s.id}
                          src={s.image_url ?? ""}
                          alt={s.caption ?? "Incident evidence"}
                          className="h-20 w-32 rounded-md border border-border object-cover"
                        />
                      ))}
                    </div>
                    <IncidentReplay
                      frames={shots}
                      label={`${zoneName(incident.zone_id)}-${new Date(incident.first_seen).toISOString().slice(0, 16)}`}
                    />
                  </>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Add a resolution / field note"
                    value={note[incident.id] ?? ""}
                    onChange={(e) => setNote((n) => ({ ...n, [incident.id]: e.target.value }))}
                    className="max-w-sm"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const text = note[incident.id];
                      if (!text) return;
                      void logAction(incident.id, "note", text);
                      setNote((n) => ({ ...n, [incident.id]: "" }));
                    }}
                  >
                    Save note
                  </Button>
                </div>

                {trail.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                    {trail.map((a) => (
                      <li key={a.id}>
                        <span className="font-mono">
                          {new Date(a.created_at).toLocaleTimeString()}
                        </span>{" "}
                        · {a.action_type.replace(/_/g, " ")} · {a.actor}
                        {a.note ? ` — ${a.note}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}
