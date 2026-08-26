/**
 * Camera feed protocol handling for real IP cameras.
 *
 * Browsers cannot open RTSP directly, so the registry accepts the formats a
 * browser can actually decode: HLS (.m3u8), progressive MP4/WebM, and MJPEG
 * (multipart/x-mixed-replace, served by most IP cameras at /video or /mjpg).
 */
export type FeedProtocol = "hls" | "video" | "mjpeg" | "rtsp" | "unknown";

/**
 * Common phone-camera apps expose their MJPEG stream at /video while showing
 * only the server root URL on screen. Resolve that root automatically.
 */
export function resolveFeedUrl(rawUrl: string | null | undefined) {
  const value = (rawUrl ?? "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value);
    if ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.pathname === "/") {
      parsed.pathname = "/video";
      return parsed.toString();
    }
  } catch {
    return value;
  }
  return value;
}

export function getFeedAccessWarning(url: string) {
  if (typeof window === "undefined" || !url) return null;
  if (window.location.protocol === "https:" && url.startsWith("http://")) {
    return "This HTTP phone feed is blocked on the secure HTTPS app. Open Live monitor on the phone and use Device camera, or expose the camera feed through HTTPS.";
  }
  return null;
}

export function detectFeedProtocol(rawUrl: string | null | undefined): FeedProtocol {
  const url = resolveFeedUrl(rawUrl);
  if (!url) return "unknown";
  const lower = url.toLowerCase();
  if (lower.startsWith("rtsp://") || lower.startsWith("rtmp://")) return "rtsp";
  if (lower.includes(".m3u8")) return "hls";
  if (/\.(mp4|webm|ogv|mov)(\?|$)/.test(lower)) return "video";
  if (
    lower.includes("mjpg") ||
    lower.includes("mjpeg") ||
    lower.includes("snapshot") ||
    lower.endsWith(".cgi") ||
    lower.includes("axis-cgi") ||
    lower.includes("/video")
  ) {
    return "mjpeg";
  }
  return "video";
}

export const PROTOCOL_LABEL: Record<FeedProtocol, string> = {
  hls: "HLS live stream",
  video: "MP4 / WebM stream",
  mjpeg: "MJPEG snapshot stream",
  rtsp: "RTSP (needs a restream)",
  unknown: "No feed URL",
};

/** True when the feed must be rendered into an <img> instead of a <video>. */
export function usesImageElement(protocol: FeedProtocol) {
  return protocol === "mjpeg";
}

/**
 * Attaches an HLS feed to a video element, using native playback where
 * available (Safari/iOS) and hls.js elsewhere. Returns a cleanup function.
 */
export async function attachHlsFeed(
  video: HTMLVideoElement,
  url: string,
  onError?: (message: string) => void,
): Promise<() => void> {
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    return () => {
      video.removeAttribute("src");
      video.load();
    };
  }
  const { default: Hls } = await import("hls.js");
  if (!Hls.isSupported()) {
    onError?.("This browser cannot play HLS streams.");
    return () => {};
  }
  const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2 });
  hls.on(Hls.Events.ERROR, (_evt, data) => {
    if (data.fatal) onError?.(`Stream error: ${data.details}`);
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  return () => hls.destroy();
}

/** Cache-busts an MJPEG/snapshot URL so a fresh connection is opened. */
export function bustCache(url: string) {
  return url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
}
