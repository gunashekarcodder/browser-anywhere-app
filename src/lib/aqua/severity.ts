/**
 * Explainable severity engine (Version 1).
 *
 * This is deterministic weighted arithmetic — NOT a trained ML model. Every
 * contribution is returned so the operator can see exactly why a score was
 * produced. A learned severity model can replace this only once labelled
 * incident-level features exist.
 */

export type SeverityBand = "low" | "moderate" | "high" | "critical";

export type SeverityInput = {
  waterCoverage: number; // 0-1 of road ROI
  roadBlockedRatio: number; // 0-1
  persistenceSeconds: number;
  peopleCount: number;
  vehicleCount: number;
  drainageRisk?: "low" | "medium" | "high" | "critical" | string | null;
};

export type SeverityContribution = {
  key: string;
  label: string;
  weight: number;
  normalised: number;
  points: number;
};

export type SeverityResult = {
  score: number; // 0-100
  band: SeverityBand;
  contributions: SeverityContribution[];
};

const WEIGHTS = {
  coverage: 0.4,
  blocked: 0.18,
  persistence: 0.17,
  vehicles: 0.12,
  people: 0.08,
  drainage: 0.05,
} as const;

const DRAINAGE_RISK: Record<string, number> = {
  low: 0.15,
  medium: 0.45,
  high: 0.75,
  critical: 1,
};

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

export function scoreSeverity(input: SeverityInput): SeverityResult {
  const coverageNorm = clamp01(input.waterCoverage / 0.6); // 60% of ROI = saturated
  const blockedNorm = clamp01(input.roadBlockedRatio);
  const persistenceNorm = clamp01(input.persistenceSeconds / 120); // 2 min = saturated
  const vehicleNorm = clamp01(input.vehicleCount / 12);
  const peopleNorm = clamp01(input.peopleCount / 10);
  const drainageNorm = DRAINAGE_RISK[String(input.drainageRisk ?? "medium")] ?? 0.45;

  const contributions: SeverityContribution[] = [
    {
      key: "coverage",
      label: "Water coverage of road area",
      weight: WEIGHTS.coverage,
      normalised: coverageNorm,
      points: WEIGHTS.coverage * coverageNorm * 100,
    },
    {
      key: "blocked",
      label: "Share of water sitting on drivable surface",
      weight: WEIGHTS.blocked,
      normalised: blockedNorm,
      points: WEIGHTS.blocked * blockedNorm * 100,
    },
    {
      key: "persistence",
      label: "Temporal persistence",
      weight: WEIGHTS.persistence,
      normalised: persistenceNorm,
      points: WEIGHTS.persistence * persistenceNorm * 100,
    },
    {
      key: "vehicles",
      label: "Vehicles affected",
      weight: WEIGHTS.vehicles,
      normalised: vehicleNorm,
      points: WEIGHTS.vehicles * vehicleNorm * 100,
    },
    {
      key: "people",
      label: "People exposed",
      weight: WEIGHTS.people,
      normalised: peopleNorm,
      points: WEIGHTS.people * peopleNorm * 100,
    },
    {
      key: "drainage",
      label: "Zone drainage risk",
      weight: WEIGHTS.drainage,
      normalised: drainageNorm,
      points: WEIGHTS.drainage * drainageNorm * 100,
    },
  ];

  const score = Math.round(contributions.reduce((sum, c) => sum + c.points, 0));
  return { score, band: bandForScore(score), contributions };
}

export function bandForScore(score: number): SeverityBand {
  if (score >= 75) return "critical";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

export const BAND_LABEL: Record<SeverityBand, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export const BAND_ADVICE: Record<SeverityBand, string> = {
  low: "Log and keep monitoring. No civic action required yet.",
  moderate: "Notify the ward engineer; check drain inlets in this zone.",
  high: "Dispatch a de-watering pump crew and place traffic warning signage.",
  critical: "Close the stretch, divert traffic and escalate to the city control room now.",
};
