import { useEffect, useRef, useState } from "react";

import { attachHlsFeed, bustCache, detectFeedProtocol } from "@/lib/aqua/feeds";

/** Small live preview of a registered camera's IP feed. */
export function CameraFeedPreview({ url }: { url: string }) {
  const protocol = detectFeedProtocol(url);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const video = videoRef.current;
    if (!video || protocol === "mjpeg" || protocol === "rtsp") return;
    let cleanup = () => {};
    let cancelled = false;
    if (protocol === "hls") {
      void attachHlsFeed(video, url, setError).then((fn) => {
        if (cancelled) fn();
        else cleanup = fn;
      });
    } else {
      video.src = url;
    }
    void video.play().catch(() => setError("Feed could not start (autoplay or CORS blocked)."));
    return () => {
      cancelled = true;
      cleanup();
      video.pause();
    };
  }, [protocol, url]);

  if (protocol === "rtsp") {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        RTSP cannot be played by a browser. Restream this camera as HLS (for example
        <span className="font-mono"> ffmpeg -i rtsp://… -f hls out.m3u8</span>) and register the
        .m3u8 URL instead.
      </p>
    );
  }

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-black">
      {protocol === "mjpeg" ? (
        <img
          src={bustCache(url)}
          alt="Live camera feed"
          className="block max-h-48 w-full object-contain"
          onError={() => setError("Feed unreachable from this browser (CORS or offline).")}
        />
      ) : (
        <video
          ref={videoRef}
          className="block max-h-48 w-full object-contain"
          muted
          playsInline
          crossOrigin="anonymous"
        />
      )}
      {error && <p className="p-2 text-xs text-critical">{error}</p>}
    </div>
  );
}
