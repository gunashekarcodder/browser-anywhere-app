import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/aqua/AppShell";
import { StatusBadge } from "@/components/aqua/SeverityBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { camerasQuery, frameMetricsQuery, zonesQuery } from "@/lib/aqua/db";

export const Route = createFileRoute("/cameras")({
  head: () => ({
    meta: [
      { title: "Camera Network — AquaSentinel AI" },
      {
        name: "description",
        content:
          "Register CCTV poles, drone sorties and field phones as waterlogging sensors, and review the frames each source has contributed.",
      },
      { property: "og:title", content: "Camera Network — AquaSentinel AI" },
      {
        property: "og:description",
        content: "Manage the CCTV, drone and field-camera network feeding waterlogging detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CamerasRoute,
});

function CamerasRoute() {
  const qc = useQueryClient();
  const { data: cameras = [] } = useQuery(camerasQuery);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: metrics = [] } = useQuery(frameMetricsQuery);

  const [form, setForm] = useState({
    name: "",
    camera_type: "cctv",
    source_url: "",
    zone_id: "",
    lat: "",
    lng: "",
  });

  const add = async () => {
    if (!form.name.trim()) {
      toast.error("Give the camera a name.");
      return;
    }
    const { error } = await supabase.from("cameras").insert({
      name: form.name.trim(),
      camera_type: form.camera_type,
      source_url: form.source_url.trim() || null,
      zone_id: form.zone_id || null,
      lat: form.lat ? Number(form.lat) : null,
      lng: form.lng ? Number(form.lng) : null,
      status: "online",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Camera registered");
    setForm({ name: "", camera_type: "cctv", source_url: "", zone_id: "", lat: "", lng: "" });
    void qc.invalidateQueries({ queryKey: ["cameras"] });
  };

  return (
    <AppShell title="Camera network" subtitle={`${cameras.length} registered sources`}>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {cameras.map((c) => {
            const frames = metrics.filter((m) => m.camera_id === c.id);
            const flagged = frames.filter((m) => m.verdict === "waterlogged").length;
            const protocol = detectFeedProtocol(c.source_url);
            return (
              <div key={c.id} className="panel p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-sm font-semibold">{c.name}</h2>
                      <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                        {c.camera_type}
                      </span>
                      <StatusBadge status={c.status} />
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {PROTOCOL_LABEL[protocol]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {zones.find((z) => z.id === c.zone_id)?.name ?? "No zone"} ·{" "}
                      {c.lat != null ? `${Number(c.lat).toFixed(4)}, ${Number(c.lng).toFixed(4)}` : "no GPS"}
                    </p>
                    {c.source_url && (
                      <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                        {c.source_url}
                      </p>
                    )}
                    {c.source_url && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setPreview((p) => ({ ...p, [c.id]: !p[c.id] }))
                          }
                        >
                          {preview[c.id] ? "Hide feed" : "Preview feed"}
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link to="/monitor" search={{ camera: c.id }}>
                            Analyse in monitor
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p className="font-mono text-base text-foreground">{frames.length}</p>
                    <p>frames logged</p>
                    <p className="mt-1 font-mono text-sm text-foreground">{flagged}</p>
                    <p>flagged waterlogged</p>
                  </div>
                </div>
                {c.source_url && preview[c.id] && <CameraFeedPreview url={c.source_url} />}
              </div>
            );
          })}
          {cameras.length === 0 && (
            <p className="text-sm text-muted-foreground">No cameras registered yet.</p>
          )}
        </div>

        <div className="panel space-y-3 p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Register a source
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="cam-name">Name</Label>
            <Input
              id="cam-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Silk Board Junction — pole 4"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={form.camera_type}
              onValueChange={(v) => setForm((f) => ({ ...f, camera_type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cctv">CCTV pole</SelectItem>
                <SelectItem value="drone">Drone sortie</SelectItem>
                <SelectItem value="phone">Field phone</SelectItem>
                <SelectItem value="dashcam">Dashcam</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cam-zone">Zone</Label>
            <Select value={form.zone_id} onValueChange={(v) => setForm((f) => ({ ...f, zone_id: v }))}>
              <SelectTrigger id="cam-zone">
                <SelectValue placeholder="Select zone" />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cam-url">Feed URL (optional)</Label>
            <Input
              id="cam-url"
              value={form.source_url}
              onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value }))}
              placeholder="https://…/live.mp4"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cam-lat">Latitude</Label>
              <Input
                id="cam-lat"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                placeholder="12.9166"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cam-lng">Longitude</Label>
              <Input
                id="cam-lng"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                placeholder="77.6101"
              />
            </div>
          </div>
          <Button className="w-full" onClick={() => void add()}>
            Register camera
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
