import "leaflet/dist/leaflet.css";

import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip } from "react-leaflet";

import type { Camera, Incident, Zone } from "@/lib/aqua/db";
import { bandForScore } from "@/lib/aqua/severity";

const BAND_COLOR: Record<string, string> = {
  low: "#34d399",
  moderate: "#facc15",
  high: "#fb923c",
  critical: "#f43f5e",
};

export default function ZoneMap({
  zones,
  cameras,
  incidents,
}: {
  zones: Zone[];
  cameras: Camera[];
  incidents: Incident[];
}) {
  const center: [number, number] = zones[0]
    ? [Number(zones[0].lat), Number(zones[0].lng)]
    : [12.9716, 77.5946];

  const worstFor = (zoneId: string) => {
    const open = incidents.filter((i) => i.zone_id === zoneId && i.status !== "resolved");
    if (open.length === 0) return null;
    return open.reduce((a, b) => (b.severity_score > a.severity_score ? b : a));
  };

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="h-[70vh] min-h-80 w-full rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      {zones.map((z) => {
        const worst = worstFor(z.id);
        const band = worst ? bandForScore(worst.severity_score) : "low";
        const colour = worst ? BAND_COLOR[band]! : "#38bdf8";
        return (
          <CircleMarker
            key={z.id}
            center={[Number(z.lat), Number(z.lng)]}
            radius={worst ? 14 : 9}
            pathOptions={{ color: colour, fillColor: colour, fillOpacity: worst ? 0.35 : 0.15 }}
          >
            <Tooltip>{z.name}</Tooltip>
            <Popup>
              <div className="text-sm">
                <strong>{z.name}</strong>
                <br />
                Ward: {z.ward ?? "—"}
                <br />
                Drainage risk: {z.drainage_risk}
                <br />
                {worst
                  ? `Open incident — ${band} (${worst.severity_score}), ${(worst.water_coverage * 100).toFixed(0)}% water`
                  : "No open incidents"}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      {cameras
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => (
          <CircleMarker
            key={c.id}
            center={[Number(c.lat), Number(c.lng)]}
            radius={5}
            pathOptions={{ color: "#e2e8f0", fillColor: "#e2e8f0", fillOpacity: 0.9 }}
          >
            <Tooltip>
              {c.name} ({c.camera_type})
            </Tooltip>
          </CircleMarker>
        ))}
    </MapContainer>
  );
}
