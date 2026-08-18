import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera as CameraIcon,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import floodClip from "@/assets/flood-clip.mp4.asset.json";
import flood01 from "@/assets/flood-01.jpg.asset.json";
import flood02 from "@/assets/flood-02.jpg.asset.json";
import flood03 from "@/assets/flood-03.jpg.asset.json";
import flood04 from "@/assets/flood-04.jpg.asset.json";
import { SeverityBadge } from "@/components/aqua/SeverityBadge";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { verifyFrame, type FrameVerification } from "@/lib/ai-vision.functions";
import { camerasQuery, zonesQuery } from "@/lib/aqua/db";
import {
  attachHlsFeed,
  bustCache,
  detectFeedProtocol,
  PROTOCOL_LABEL,
} from "@/lib/aqua/feeds";
import { BAND_ADVICE, scoreSeverity, type SeverityResult } from "@/lib/aqua/severity";
import {
  PersistenceGate,
  analyseFrame,
  drawMaskOverlay,
  type FrameFeatures,
} from "@/lib/aqua/vision";

type SourceKind = "sample-video" | "sample-image" | "upload" | "stream" | "webcam" | "camera";

const SAMPLE_IMAGES = [
  { url: flood01.url, label: "Flooded street (Wikimedia Commons)" },
  { url: flood02.url, label: "Waterlogged road (Wikimedia Commons)" },
  { url: flood03.url, label: "Urban flood, vehicles (Wikimedia Commons)" },
  { url: flood04.url, label: "Submerged carriageway (Wikimedia Commons)" },
];

const ANALYSIS_INTERVAL_MS = 250;
const METRIC_WRITE_MS = 5000;
const INCIDENT_UPDATE_MS = 10000;
const REPLAY_FRAME_MS = 3000;
const MJPEG_REFRESH_MS = 1000;
const WORK_WIDTH = 384;

export function MonitorPanel({
  initialCameraId,
  startWithCameraFeed = false,
}: {
  initialCameraId?: string | undefined;
  startWithCameraFeed?: boolean | undefined;
} = {}) {
  const qc = useQueryClient();
  const runVerify = useServerFn(verifyFrame);
  const { data: zones = [] } = useQuery(zonesQuery);
  const { data: cameras = [] } = useQuery(camerasQuery);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const displayRef = useRef<HTMLCanvasElement | null>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const gateRef = useRef(new PersistenceGate());
  const streamRef = useRef<MediaStream | null>(null);
  const lastMetricRef = useRef(0);
  const lastIncidentWriteRef = useRef(0);
  const incidentIdRef = useRef<string | null>(null);
  const verifyRef = useRef<FrameVerification | null>(null);
  const busyRef = useRef(false);
  const lastReplayRef = useRef(0);

  const [sourceKind, setSourceKind] = useState<SourceKind>(
    startWithCameraFeed ? "camera" : "sample-video",
  );
  const [videoSrc, setVideoSrc] = useState<string>(floodClip.url);
  const [imageSrc, setImageSrc] = useState<string>(SAMPLE_IMAGES[0]!.url);
  const [streamInput, setStreamInput] = useState("");
  const [running, setRunning] = useState(false);
  const [roiTop, setRoiTop] = useState(0.42);
  const [threshold, setThreshold] = useState(0.16);
  const [autoLog, setAutoLog] = useState(true);
  const [autoVerify, setAutoVerify] = useState(true);
  const [features, setFeatures] = useState<FrameFeatures | null>(null);
  const [severity, setSeverity] = useState<SeverityResult | null>(null);
  const [persistence, setPersistence] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [verification, setVerification] = useState<FrameVerification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [fps, setFps] = useState(0);
  const [zoneId, setZoneId] = useState<string>("");
  const [cameraId, setCameraId] = useState<string>(initialCameraId ?? "");
  const [feedError, setFeedError] = useState<string | null>(null);
  const [mjpegTick, setMjpegTick] = useState(0);

  useEffect(() => {
    if (!zoneId && zones[0]) setZoneId(zones[0].id);
  }, [zones, zoneId]);
  useEffect(() => {
    if (cameras.length === 0) return;
    if (!cameras.some((c) => c.id === cameraId)) setCameraId(cameras[0]!.id);
  }, [cameras, cameraId]);

  const zone = useMemo(() => zones.find((z) => z.id === zoneId), [zones, zoneId]);
  const camera = useMemo(() => cameras.find((c) => c.id === cameraId), [cameras, cameraId]);
  const feedProtocol = useMemo(
    () => (sourceKind === "camera" ? detectFeedProtocol(camera?.source_url) : "unknown"),
    [camera?.source_url, sourceKind],
  );
  const cameraFeedUrl = sourceKind === "camera" ? (camera?.source_url ?? "") : "";
  const isImage =
    sourceKind === "sample-image" || (sourceKind === "camera" && feedProtocol === "mjpeg");

  useEffect(() => {
    gateRef.current = new PersistenceGate(threshold, 6, 0.7);
  }, [threshold]);

  // ---- real IP camera feeds -----------------------------------------------
  const isSnapshotFeed =
    feedProtocol === "mjpeg" && /snapshot|\.jpe?g/i.test(cameraFeedUrl);

  useEffect(() => {
    setFeedError(null);
    const video = videoRef.current;
    if (!video || sourceKind !== "camera" || feedProtocol !== "hls" || !cameraFeedUrl) return;
    let cancelled = false;
    let cleanup = () => {};
    void attachHlsFeed(video, cameraFeedUrl, setFeedError).then((fn) => {
      if (cancelled) fn();
      else cleanup = fn;
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cameraFeedUrl, feedProtocol, sourceKind]);

  useEffect(() => {
    if (!running || !isSnapshotFeed) return;
    const handle = window.setInterval(() => setMjpegTick((t) => t + 1), MJPEG_REFRESH_MS);
    return () => window.clearInterval(handle);
  }, [isSnapshotFeed, running]);

  const stopWebcam = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopWebcam(), [stopWebcam]);

  const captureSnapshot = useCallback((): string | null => {
    const work = workRef.current;
    if (!work) return null;
    try {
      return work.toDataURL("image/jpeg", 0.6);
    } catch {
      return null;
    }
  }, []);

  const doVerify = useCallback(
    async (coverage: number, silent = false) => {
      const snapshot = captureSnapshot();
      if (!snapshot) {
        if (!silent) toast.error("No frame available to verify yet.");
        return;
      }
      setVerifying(true);
      try {
        const result = await runVerify({
          data: {
            image: snapshot,
            contextLabel: camera ? `${camera.name} (${camera.camera_type})` : "operator feed",
            ruleCoverage: coverage,
          },
        });
        verifyRef.current = result;
        setVerification(result);
        if (incidentIdRef.current) {
          await supabase
            .from("incidents")
            .update({
              ai_verified: result.waterlogged,
              ai_summary: result.summary,
              people_count: result.peopleCount,
              vehicle_count: result.vehicleCount,
            })
            .eq("id", incidentIdRef.current);
          void qc.invalidateQueries({ queryKey: ["incidents"] });
        }
        if (!silent) toast.success("AI verification complete");
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI verification failed";
        if (!silent) toast.error(message);
        else console.error(message);
      } finally {
        setVerifying(false);
      }
    },
    [camera, captureSnapshot, qc, runVerify],
  );

  const persistIncident = useCallback(
    async (feat: FrameFeatures, sev: SeverityResult, persistSeconds: number) => {
      const now = Date.now();
      const payload = {
        zone_id: zoneId || null,
        camera_id: cameraId || null,
        severity_score: sev.score,
        severity_band: sev.band,
        water_coverage: Number(feat.waterCoverage.toFixed(4)),
        road_blocked_ratio: Number(feat.roadBlockedRatio.toFixed(4)),
        persistence_seconds: Math.round(persistSeconds),
        people_count: verifyRef.current?.peopleCount ?? 0,
        vehicle_count: verifyRef.current?.vehicleCount ?? 0,
        model_version: "rules-v1+gemini-verify",
        last_seen: new Date(now).toISOString(),
      };

      if (!incidentIdRef.current) {
        const { data, error } = await supabase
          .from("incidents")
          .insert({ ...payload, status: "active" })
          .select("id")
          .single();
        if (error) {
          console.error(error.message);
          return;
        }
        incidentIdRef.current = data.id;
        toast.warning(`Waterlogging confirmed — incident opened (${sev.band})`);
        const snapshot = captureSnapshot();
        if (snapshot) {
          await supabase.from("evidence").insert({
            incident_id: data.id,
            image_url: snapshot,
            water_coverage: payload.water_coverage,
            severity_score: sev.score,
            caption: `Auto-captured at detection — ${(feat.waterCoverage * 100).toFixed(1)}% coverage`,
          });
          void qc.invalidateQueries({ queryKey: ["evidence"] });
        }
        if (autoVerify) void doVerify(feat.waterCoverage, true);
        lastIncidentWriteRef.current = now;
      } else if (now - lastIncidentWriteRef.current > INCIDENT_UPDATE_MS) {
        lastIncidentWriteRef.current = now;
        await supabase.from("incidents").update(payload).eq("id", incidentIdRef.current);
      }

      // Keep appending replay frames so the incident stays rewatchable later.
      if (incidentIdRef.current && now - lastReplayRef.current > REPLAY_FRAME_MS) {
        lastReplayRef.current = now;
        const frame = captureSnapshot();
        if (frame) {
          await supabase.from("evidence").insert({
            incident_id: incidentIdRef.current,
            image_url: frame,
            water_coverage: payload.water_coverage,
            severity_score: sev.score,
            caption: `Replay frame — ${(feat.waterCoverage * 100).toFixed(1)}% coverage, ${sev.band}`,
          });
          void qc.invalidateQueries({ queryKey: ["evidence"] });
        }
      }
      void qc.invalidateQueries({ queryKey: ["incidents"] });
    },
    [autoVerify, cameraId, captureSnapshot, doVerify, qc, zoneId],
  );

  // ---- analysis loop -------------------------------------------------------
  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let frames = 0;
    let fpsMark = performance.now();

    const tick = async () => {
      if (cancelled || busyRef.current) return;
      busyRef.current = true;
      try {
        const media: HTMLVideoElement | HTMLImageElement | null = isImage
          ? imageRef.current
          : videoRef.current;
        const work = workRef.current;
        const display = displayRef.current;
        if (!media || !work || !display) return;

        const naturalW = isImage
          ? (media as HTMLImageElement).naturalWidth
          : (media as HTMLVideoElement).videoWidth;
        const naturalH = isImage
          ? (media as HTMLImageElement).naturalHeight
          : (media as HTMLVideoElement).videoHeight;
        if (!naturalW || !naturalH) return;

        const w = WORK_WIDTH;
        const h = Math.round((naturalH / naturalW) * WORK_WIDTH);
        if (work.width !== w || work.height !== h) {
          work.width = w;
          work.height = h;
        }
        if (display.width !== w || display.height !== h) {
          display.width = w;
          display.height = h;
        }

        const wctx = work.getContext("2d", { willReadFrequently: true });
        const dctx = display.getContext("2d");
        if (!wctx || !dctx) return;
        wctx.drawImage(media, 0, 0, w, h);
        const frame = wctx.getImageData(0, 0, w, h);

        const { features: feat, mask, maskCols, maskRows } = analyseFrame(frame.data, w, h, {
          roiTop,
        });

        dctx.drawImage(work, 0, 0, w, h);
        drawMaskOverlay(dctx, mask, maskCols, maskRows, w, h, roiTop);

        const gate = gateRef.current;
        const now = Date.now();
        gate.push(feat.waterCoverage, now);
        const persistSeconds = gate.persistenceSeconds(now);
        const isConfirmed = gate.confirmed(now);

        const sev = scoreSeverity({
          waterCoverage: feat.waterCoverage,
          roadBlockedRatio: feat.roadBlockedRatio,
          persistenceSeconds: persistSeconds,
          peopleCount: verifyRef.current?.peopleCount ?? 0,
          vehicleCount: verifyRef.current?.vehicleCount ?? 0,
          drainageRisk: zone?.drainage_risk ?? "medium",
        });

        setFeatures(feat);
        setSeverity(sev);
        setPersistence(persistSeconds);
        setConfirmed(isConfirmed);

        frames += 1;
        if (now - fpsMark > 1000) {
          setFps(Number((frames / ((now - fpsMark) / 1000)).toFixed(1)));
          frames = 0;
          fpsMark = now;
        }

        if (autoLog && now - lastMetricRef.current > METRIC_WRITE_MS) {
          lastMetricRef.current = now;
          void supabase
            .from("frame_metrics")
            .insert({
              camera_id: cameraId || null,
              incident_id: incidentIdRef.current,
              water_coverage: Number(feat.waterCoverage.toFixed(4)),
              road_coverage: Number(feat.roadCoverage.toFixed(4)),
              texture_score: Number(feat.textureScore.toFixed(4)),
              severity_score: sev.score,
              people_count: verifyRef.current?.peopleCount ?? 0,
              vehicle_count: verifyRef.current?.vehicleCount ?? 0,
              verdict: isConfirmed ? "waterlogged" : "clear",
              source_label: sourceLabel(sourceKind, camera?.name),
            })
            .then(() => qc.invalidateQueries({ queryKey: ["frame_metrics"] }));
        }

        if (autoLog && isConfirmed) {
          await persistIncident(feat, sev, persistSeconds);
        }
        if (!isConfirmed && incidentIdRef.current && persistSeconds === 0) {
          const id = incidentIdRef.current;
          incidentIdRef.current = null;
          await supabase.from("incidents").update({ status: "monitoring" }).eq("id", id);
          void qc.invalidateQueries({ queryKey: ["incidents"] });
        }
      } finally {
        busyRef.current = false;
      }
    };

    const handle = window.setInterval(() => void tick(), ANALYSIS_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [autoLog, cameraId, camera?.name, isImage, persistIncident, qc, roiTop, running, sourceKind, zone?.drainage_risk]);

  const start = useCallback(async () => {
    gateRef.current.reset();
    if (sourceKind === "camera") {
      if (!cameraFeedUrl) {
        toast.error("This camera has no feed URL. Add one in the camera registry.");
        return;
      }
      if (feedProtocol === "rtsp") {
        toast.error("RTSP can't play in a browser — restream the camera as HLS (.m3u8).");
        return;
      }
      if (feedProtocol !== "mjpeg" && videoRef.current) {
        try {
          await videoRef.current.play();
        } catch {
          setFeedError("Feed blocked by autoplay or CORS policy.");
        }
      }
      setRunning(true);
      return;
    }
    if (sourceKind === "webcam") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        toast.error("Camera permission denied or unavailable on this device.");
        return;
      }
    } else if (!isImage && videoRef.current) {
      try {
        await videoRef.current.play();
      } catch {
        /* autoplay may need a user gesture; the click already provides it */
      }
    }
    setRunning(true);
  }, [cameraFeedUrl, feedProtocol, isImage, sourceKind]);

  const stop = useCallback(() => {
    setRunning(false);
    videoRef.current?.pause();
    stopWebcam();
    if (videoRef.current) videoRef.current.srcObject = null;
  }, [stopWebcam]);

  const onUpload = (file: File | undefined) => {
    if (!file) return;
    stop();
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("image/")) {
      setSourceKind("sample-image");
      setImageSrc(url);
    } else {
      setSourceKind("upload");
      setVideoSrc(url);
    }
  };

  const coveragePct = features ? features.waterCoverage * 100 : 0;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="panel overflow-hidden p-0">
          <div className="relative bg-black">
            <canvas ref={displayRef} className="block h-auto w-full" />
            {!running && (
              <div className="absolute inset-0 grid place-items-center bg-background/70 px-6 text-center backdrop-blur-sm">
                <div>
                  <p className="font-display text-sm font-semibold">Feed idle</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Pick a source and press Start analysis to begin real-time detection.
                  </p>
                </div>
              </div>
            )}
            {running && (
              <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-background/80 px-2 py-0.5 font-mono">
                  {fps.toFixed(1)} analysis fps
                </span>
                <span className="rounded-full bg-background/80 px-2 py-0.5 font-mono">
                  {coveragePct.toFixed(1)}% water
                </span>
                {confirmed && (
                  <span className="rounded-full bg-critical/85 px-2 py-0.5 font-medium text-background">
                    WATERLOGGING CONFIRMED
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
            {running ? (
              <Button variant="destructive" onClick={stop}>
                <Pause className="mr-2 h-4 w-4" /> Stop
              </Button>
            ) : (
              <Button onClick={() => void start()}>
                <Play className="mr-2 h-4 w-4" /> Start analysis
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => void doVerify(features?.waterCoverage ?? 0)}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Verify frame with AI
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const snapshot = captureSnapshot();
                if (!snapshot || !features || !severity) {
                  toast.error("Nothing to save yet.");
                  return;
                }
                const { error } = await supabase.from("evidence").insert({
                  incident_id: incidentIdRef.current,
                  image_url: snapshot,
                  water_coverage: Number(features.waterCoverage.toFixed(4)),
                  severity_score: severity.score,
                  caption: "Manual operator capture",
                });
                if (error) toast.error(error.message);
                else {
                  toast.success("Evidence saved");
                  void qc.invalidateQueries({ queryKey: ["evidence"] });
                }
              }}
            >
              <CameraIcon className="mr-2 h-4 w-4" /> Save evidence
            </Button>
          </div>
        </div>

        <div className="panel space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={sourceKind}
                onValueChange={(v) => {
                  stop();
                  setSourceKind(v as SourceKind);
                  if (v === "sample-video") setVideoSrc(floodClip.url);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sample-video">Sample flood clip (Commons)</SelectItem>
                  <SelectItem value="sample-image">Still image / dataset frame</SelectItem>
                  <SelectItem value="upload">Uploaded video</SelectItem>
                  <SelectItem value="stream">Stream / camera URL (MP4, HLS-native)</SelectItem>
                  <SelectItem value="camera">Registered IP camera (HLS / MJPEG / MP4)</SelectItem>
                  <SelectItem value="webcam">Device camera (drone/phone feed)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Select value={zoneId} onValueChange={setZoneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select zone" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name} — {z.drainage_risk} risk
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Camera</Label>
              <Select value={cameraId} onValueChange={setCameraId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select camera" />
                </SelectTrigger>
                <SelectContent>
                  {cameras.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.camera_type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="upload-input">Upload video or image</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="upload-input"
                  type="file"
                  accept="video/*,image/*"
                  onChange={(e) => onUpload(e.target.files?.[0])}
                  className="file:mr-2 file:text-xs"
                />
                <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </div>
          </div>

          {sourceKind === "sample-image" && (
            <div className="flex flex-wrap gap-2">
              {SAMPLE_IMAGES.map((img) => (
                <button
                  key={img.url}
                  onClick={() => setImageSrc(img.url)}
                  className={`overflow-hidden rounded-md border ${
                    imageSrc === img.url ? "border-primary" : "border-border"
                  }`}
                  title={img.label}
                >
                  <img src={img.url} alt={img.label} className="h-14 w-24 object-cover" />
                </button>
              ))}
            </div>
          )}

          {sourceKind === "camera" && (
            <div className="rounded-md border border-border bg-muted/25 p-3 text-xs">
              <p className="font-medium text-foreground">
                {camera ? camera.name : "No camera selected"} · {PROTOCOL_LABEL[feedProtocol]}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {cameraFeedUrl || "No feed URL registered for this camera."}
              </p>
              {feedProtocol === "rtsp" && (
                <p className="mt-1 text-muted-foreground">
                  Browsers can&apos;t decode RTSP. Restream it as HLS and update the camera URL.
                </p>
              )}
              {feedError && <p className="mt-1 text-critical">{feedError}</p>}
            </div>
          )}

          {sourceKind === "stream" && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-56 flex-1 space-y-1.5">
                <Label htmlFor="stream-url">Feed URL</Label>
                <Input
                  id="stream-url"
                  placeholder="https://example.org/camera/live.mp4"
                  value={streamInput}
                  onChange={(e) => setStreamInput(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  if (!streamInput.trim()) return;
                  stop();
                  setVideoSrc(streamInput.trim());
                  toast.info("Feed loaded. Press Start analysis.");
                }}
              >
                <Video className="mr-2 h-4 w-4" /> Load feed
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Road ROI starts at</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {(roiTop * 100).toFixed(0)}% of frame height
                </span>
              </Label>
              <Slider
                value={[roiTop]}
                min={0}
                max={0.8}
                step={0.02}
                onValueChange={([v]) => setRoiTop(v ?? 0.42)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Detection threshold</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {(threshold * 100).toFixed(0)}% coverage
                </span>
              </Label>
              <Slider
                value={[threshold]}
                min={0.04}
                max={0.5}
                step={0.01}
                onValueChange={([v]) => setThreshold(v ?? 0.16)}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoLog} onCheckedChange={setAutoLog} />
              Log metrics &amp; open incidents automatically
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={autoVerify} onCheckedChange={setAutoVerify} />
              AI-verify each new incident
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="panel p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Severity engine
            </h2>
            {severity && <SeverityBadge band={severity.band} score={severity.score} />}
          </div>
          {severity ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">{BAND_ADVICE[severity.band]}</p>
              <ul className="mt-4 space-y-2.5">
                {severity.contributions.map((c) => (
                  <li key={c.key} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-muted-foreground">{c.label}</span>
                      <span className="font-mono">
                        +{c.points.toFixed(1)} / {(c.weight * 100).toFixed(0)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.min(100, c.normalised * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Start the feed to compute a live, explainable severity score.
            </p>
          )}
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Frame telemetry
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Metric label="Water coverage" value={`${coveragePct.toFixed(1)}%`} />
            <Metric
              label="Road surface"
              value={`${((features?.roadCoverage ?? 0) * 100).toFixed(1)}%`}
            />
            <Metric
              label="Water on road"
              value={`${((features?.roadBlockedRatio ?? 0) * 100).toFixed(1)}%`}
            />
            <Metric label="Texture (smoothness)" value={(features?.textureScore ?? 0).toFixed(3)} />
            <Metric label="Persistence" value={`${persistence.toFixed(1)} s`} />
            <Metric
              label="Scene light"
              value={
                features == null
                  ? "—"
                  : features.luma < 60
                    ? `Low (${features.luma.toFixed(0)})`
                    : `OK (${features.luma.toFixed(0)})`
              }
            />
          </dl>
        </div>

        <div className="panel p-4">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            AI verification
          </h2>
          {verification ? (
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge band={verification.severityBandSuggestion} />
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    verification.waterlogged
                      ? "border-critical/40 bg-critical/15 text-critical"
                      : "border-low/35 bg-low/15 text-low"
                  }`}
                >
                  {verification.waterlogged ? "Waterlogging present" : "No waterlogging"}
                </span>
                <span className="text-xs text-muted-foreground">
                  confidence {(verification.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-muted-foreground">{verification.summary}</p>
              <dl className="grid grid-cols-2 gap-3">
                <Metric label="AI water coverage" value={`${verification.waterCoveragePct.toFixed(0)}%`} />
                <Metric label="Lane blocked" value={`${verification.roadBlockedPct.toFixed(0)}%`} />
                <Metric label="People" value={String(verification.peopleCount)} />
                <Metric label="Vehicles" value={String(verification.vehicleCount)} />
                <Metric label="Depth estimate" value={verification.depthEstimate} />
                <Metric label="Model" value={verification.model.split("/")[1] ?? verification.model} />
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Run a verification to cross-check the rule-based estimate with a vision model, count
              people and vehicles, and estimate depth.
            </p>
          )}
        </div>
      </div>

      {/* Hidden media elements feeding the analysis canvas. */}
      <video
        ref={videoRef}
        src={
          isImage || sourceKind === "webcam"
            ? undefined
            : sourceKind === "camera"
              ? feedProtocol === "video"
                ? cameraFeedUrl || undefined
                : undefined
              : videoSrc
        }
        className="hidden"
        muted
        loop
        playsInline
        crossOrigin="anonymous"
      />
      <img
        ref={imageRef}
        src={
          !isImage
            ? undefined
            : sourceKind === "camera"
              ? isSnapshotFeed
                ? bustCache(cameraFeedUrl) + "&f=" + mjpegTick
                : cameraFeedUrl
              : imageSrc
        }
        alt=""
        className="hidden"
        crossOrigin="anonymous"
      />
      <canvas ref={workRef} className="hidden" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-mono text-base">{value}</dd>
    </div>
  );
}

function sourceLabel(kind: SourceKind, cameraName?: string) {
  const base: Record<SourceKind, string> = {
    "sample-video": "sample clip",
    "sample-image": "still frame",
    upload: "uploaded video",
    stream: "network feed",
    webcam: "device camera",
    camera: "registered IP camera",
  };
  return cameraName ? `${base[kind]} @ ${cameraName}` : base[kind];
}
