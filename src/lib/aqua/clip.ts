import type { Evidence, Incident, OperatorAction } from "@/lib/aqua/db";

function slug(label: string) {
  return label.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Renders stored evidence frames into a WebM clip and downloads it, so the
 * footage survives after the incident is removed from the live application.
 */
export async function exportIncidentClip(
  frames: Evidence[],
  label: string,
  fps = 4,
): Promise<boolean> {
  const ordered = [...frames]
    .filter((f) => Boolean(f.image_url))
    .sort((a, b) => +new Date(a.captured_at) - +new Date(b.captured_at));
  if (ordered.length === 0) return false;

  const images = await Promise.all(
    ordered.map(
      (f) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error("frame failed to load"));
          img.src = f.image_url ?? "";
        }),
    ),
  );

  const first = images[0]!;
  const canvas = document.createElement("canvas");
  canvas.width = first.naturalWidth || 480;
  canvas.height = first.naturalHeight || 270;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");

  const stream = canvas.captureStream(fps);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
    ? "video/webm;codecs=vp9"
    : "video/webm";
  const recorder = new MediaRecorder(stream, { mimeType: mime });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });
  recorder.start();
  for (const img of images) {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    await new Promise((r) => setTimeout(r, 1000 / fps));
  }
  recorder.stop();
  saveBlob(await done, `aquasentinel-${slug(label)}-replay.webm`);
  return true;
}

/** Downloads the incident record, metrics, evidence index and action trail as JSON. */
export function exportIncidentReport(
  incident: Incident,
  label: string,
  frames: Evidence[],
  actions: OperatorAction[],
) {
  const report = {
    exported_at: new Date().toISOString(),
    zone: label,
    incident,
    evidence: frames.map(({ id, captured_at, water_coverage, severity_score, caption }) => ({
      id,
      captured_at,
      water_coverage,
      severity_score,
      caption,
    })),
    actions,
  };
  saveBlob(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    `aquasentinel-${slug(label)}-report.json`,
  );
}
