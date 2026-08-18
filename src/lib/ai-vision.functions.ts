import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const VerifyInput = z.object({
  /** JPEG/PNG frame as a data URL, produced by the browser canvas. */
  image: z.string().min(64),
  contextLabel: z.string().max(200).optional(),
  ruleCoverage: z.number().min(0).max(1).optional(),
});

export type FrameVerification = {
  waterlogged: boolean;
  waterCoveragePct: number;
  roadBlockedPct: number;
  peopleCount: number;
  vehicleCount: number;
  depthEstimate: "none" | "ankle" | "knee" | "above-knee" | "unknown";
  confidence: number;
  severityBandSuggestion: "low" | "moderate" | "high" | "critical";
  summary: string;
  model: string;
};

const SYSTEM_PROMPT = `You are AquaSentinel's vision verifier for urban road waterlogging in Indian cities.
You receive a single video frame from a CCTV pole camera, a drone sortie, or a field phone camera.
Report only what is visible. Never invent counts. If the scene is unclear, lower the confidence.
Return strict JSON only, no markdown.`;

const RESPONSE_SHAPE = `{
 "waterlogged": boolean,
 "water_coverage_pct": number 0-100 (share of the visible road surface covered by standing water),
 "road_blocked_pct": number 0-100 (share of drivable lane width blocked/impassable),
 "people_count": integer (people visible),
 "vehicle_count": integer (vehicles visible),
 "depth_estimate": "none" | "ankle" | "knee" | "above-knee" | "unknown",
 "confidence": number 0-1,
 "severity_band": "low" | "moderate" | "high" | "critical",
 "summary": string, max 220 chars, operator-facing
}`;

export const verifyFrame = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => VerifyInput.parse(input))
  .handler(async ({ data }): Promise<FrameVerification> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI verification is not configured (missing gateway key).");

    const model = "google/gemini-3.7-flash";
    const userText = [
      `Analyse this frame for road waterlogging and civic impact.`,
      data.contextLabel ? `Camera/context: ${data.contextLabel}.` : "",
      typeof data.ruleCoverage === "number"
        ? `The rule-based estimator measured ${(data.ruleCoverage * 100).toFixed(1)}% water coverage in the road region; judge the frame independently.`
        : "",
      `Respond with JSON exactly in this shape: ${RESPONSE_SHAPE}`,
    ]
      .filter(Boolean)
      .join(" ");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              { type: "image_url", image_url: { url: data.image } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) throw new Error("AI verification rate limited — retry in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted for this workspace — top up to continue verification.");
      if (res.status === 403)
        throw new Error("AI verification is blocked by workspace policy for this project.");
      throw new Error(`AI verification failed (${res.status}): ${body.slice(0, 300)}`);
    }

    const payload = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = payload.choices?.[0]?.message?.content ?? "{}";

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]) as Record<string, unknown>;
    }

    const num = (v: unknown, fallback = 0) => (typeof v === "number" && isFinite(v) ? v : fallback);
    const band = String(parsed["severity_band"] ?? "low");

    return {
      waterlogged: Boolean(parsed["waterlogged"]),
      waterCoveragePct: Math.min(100, Math.max(0, num(parsed["water_coverage_pct"]))),
      roadBlockedPct: Math.min(100, Math.max(0, num(parsed["road_blocked_pct"]))),
      peopleCount: Math.max(0, Math.round(num(parsed["people_count"]))),
      vehicleCount: Math.max(0, Math.round(num(parsed["vehicle_count"]))),
      depthEstimate: (["none", "ankle", "knee", "above-knee", "unknown"].includes(
        String(parsed["depth_estimate"]),
      )
        ? String(parsed["depth_estimate"])
        : "unknown") as FrameVerification["depthEstimate"],
      confidence: Math.min(1, Math.max(0, num(parsed["confidence"], 0.5))),
      severityBandSuggestion: (["low", "moderate", "high", "critical"].includes(band)
        ? band
        : "low") as FrameVerification["severityBandSuggestion"],
      summary: String(parsed["summary"] ?? "No summary returned.").slice(0, 400),
      model,
    };
  });
