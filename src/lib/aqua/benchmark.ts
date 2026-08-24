/**
 * AquaSentinel benchmark harness.
 *
 * Runs the real in-browser detection stage (src/lib/aqua/vision.ts) over the
 * held-out labelled test set and measures everything honestly, in the browser
 * the operator is using:
 *
 *   - confusion matrix (TP / FP / FN / TN) at a given coverage threshold
 *   - precision, recall, F1, accuracy, specificity
 *   - false-alert rate = FP / (all negatives)
 *   - IoU of the predicted water mask against the coarse annotated water region
 *   - inference latency per frame (mean, p50, p95, max) excluding image decode
 *   - a threshold sweep so the operating point can be chosen from evidence
 *
 * No figure here is hard-coded: every number comes from running the detector.
 */

import { analyseFrame, floodConfidence, type FrameFeatures } from "@/lib/aqua/vision";
import { TEST_SET, type TestSample } from "@/lib/aqua/testset";

export type VerifyFn = (payload: {
  data: { image: string; contextLabel?: string; ruleCoverage?: number };
}) => Promise<{ waterlogged: boolean; confidence: number; summary: string }>;

export type SampleResult = {
  id: string;
  label: "flood" | "clear";
  title: string;
  licence: string;
  sourcePage: string;
  url: string;
  features: FrameFeatures;
  predicted: "flood" | "clear";
  outcome: "TP" | "FP" | "FN" | "TN";
  /** Weak-label IoU vs the annotated water region (positives only). */
  iou: number | null;
  /** Composite flood confidence used for the decision. */
  confidence: number;
  /** Detector latency in ms (decode excluded). */
  inferenceMs: number;
  decodeMs: number;
  /** Stage-2 AI verification, when the end-to-end pipeline was benchmarked. */
  aiVerdict: "flood" | "clear" | "not-screened" | null;
  aiConfidence: number | null;
  aiSummary: string | null;
  aiLatencyMs: number | null;
  /** End-to-end prediction (stage 1 screening AND stage 2 confirmation). */
  endToEnd: "flood" | "clear" | null;
  endToEndOutcome: "TP" | "FP" | "FN" | "TN" | null;
};

export type BenchmarkMetrics = {
  threshold: number;
  roiTop: number;
  total: number;
  positives: number;
  negatives: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  precision: number;
  recall: number;
  f1: number;
  accuracy: number;
  specificity: number;
  falseAlertRate: number;
  missRate: number;
  meanIoU: number;
  latency: { mean: number; p50: number; p95: number; max: number; fps: number };
  decodeMean: number;
};

export type BenchmarkRun = {
  modelVersion: string;
  datasetVersion: string;
  ranAt: string;
  metrics: BenchmarkMetrics;
  sweep: { threshold: number; precision: number; recall: number; f1: number; falseAlertRate: number }[];
  /** Metrics for the full pipeline (rule screening + AI confirmation), if run. */
  endToEnd: BenchmarkMetrics | null;
  aiLatency: { mean: number; p95: number } | null;
  bestF1Threshold: number;
  samples: SampleResult[];
  userAgent: string;
};

export const BENCH_MODEL_VERSION = "aqua-web-v1";
const WORK_WIDTH = 384;

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx]!;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load test image ${url}`));
    img.src = url;
  });
}

/** IoU between the sampled water mask and the annotated normalised water box. */
function maskIoU(
  mask: Uint8Array,
  cols: number,
  rows: number,
  roiTop: number,
  box: [number, number, number, number],
): number {
  const [bx0, by0, bx1, by1] = box;
  let inter = 0;
  let union = 0;
  for (let row = 0; row < rows; row++) {
    // Normalised y of this mask row within the whole frame.
    const ny = roiTop + ((row + 0.5) / rows) * (1 - roiTop);
    const inBoxY = ny >= by0 && ny <= by1;
    for (let col = 0; col < cols; col++) {
      const nx = (col + 0.5) / cols;
      const inBox = inBoxY && nx >= bx0 && nx <= bx1;
      const isWater = mask[row * cols + col] === 1;
      if (isWater && inBox) inter++;
      if (isWater || inBox) union++;
    }
  }
  return union === 0 ? 0 : inter / union;
}

export type BenchOptions = {
  threshold?: number;
  roiTop?: number;
  onProgress?: (done: number, total: number, sample: TestSample) => void;
  samples?: TestSample[];
  /** Supply useServerFn(verifyFrame) to also benchmark the AI confirmation stage. */
  verify?: VerifyFn;
};

/** Analyse every test image once, then derive metrics for the chosen threshold. */
export async function runBenchmark(options: BenchOptions = {}): Promise<BenchmarkRun> {
  const threshold = options.threshold ?? 0.16;
  const roiTop = options.roiTop ?? 0.42;
  const set = options.samples ?? TEST_SET;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D is unavailable in this browser.");

  const raw: {
    sample: TestSample;
    features: FrameFeatures;
    iou: number | null;
    inferenceMs: number;
    decodeMs: number;
    snapshot: string;
  }[] = [];

  let done = 0;
  for (const sample of set) {
    const decodeStart = performance.now();
    const img = await loadImage(sample.url);
    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
    canvas.width = WORK_WIDTH;
    canvas.height = Math.max(1, Math.round(WORK_WIDTH * ratio));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const decodeMs = performance.now() - decodeStart;

    const t0 = performance.now();
    const { features, mask, maskCols, maskRows } = analyseFrame(
      frame.data,
      canvas.width,
      canvas.height,
      { roiTop },
    );
    const inferenceMs = performance.now() - t0;

    const iou = sample.waterBox
      ? maskIoU(mask, maskCols, maskRows, roiTop, sample.waterBox)
      : null;

    let snapshot = "";
    if (options.verify) {
      try {
        snapshot = canvas.toDataURL("image/jpeg", 0.7);
      } catch {
        snapshot = "";
      }
    }
    raw.push({ sample, features, iou, inferenceMs, decodeMs, snapshot });
    done += 1;
    options.onProgress?.(done, set.length, sample);
    // Yield so the UI can paint progress.
    await new Promise((r) => setTimeout(r, 0));
  }

  const samples: SampleResult[] = raw.map((r) => {
    const predicted: "flood" | "clear" =
      floodConfidence(r.features) >= threshold ? "flood" : "clear";
    const outcome =
      r.sample.label === "flood"
        ? predicted === "flood"
          ? "TP"
          : "FN"
        : predicted === "flood"
          ? "FP"
          : "TN";
    return {
      id: r.sample.id,
      label: r.sample.label,
      title: r.sample.title,
      licence: r.sample.licence,
      sourcePage: r.sample.sourcePage,
      url: r.sample.url,
      features: r.features,
      confidence: floodConfidence(r.features),
      predicted,
      outcome: outcome as SampleResult["outcome"],
      iou: r.iou,
      inferenceMs: r.inferenceMs,
      decodeMs: r.decodeMs,
      aiVerdict: null,
      aiConfidence: null,
      aiSummary: null,
      aiLatencyMs: null,
      endToEnd: null,
      endToEndOutcome: null,
    };
  });

  // Stage 2 — AI confirmation. Only frames the cheap detector screened in are
  // sent to the model, exactly as the live pipeline behaves, so the measured
  // end-to-end numbers include the screening stage's misses.
  const aiLatencies: number[] = [];
  if (options.verify) {
    for (let idx = 0; idx < samples.length; idx++) {
      const s = samples[idx]!;
      const r = raw[idx]!;
      if (s.predicted !== "flood" || !r.snapshot) {
        s.aiVerdict = "not-screened";
        s.endToEnd = "clear";
      } else {
        const t = performance.now();
        try {
          const verdict = await options.verify({
            data: {
              image: r.snapshot,
              contextLabel: `benchmark frame ${s.id}`,
              ruleCoverage: r.features.waterCoverage,
            },
          });
          const ms = performance.now() - t;
          aiLatencies.push(ms);
          s.aiLatencyMs = ms;
          s.aiVerdict = verdict.waterlogged ? "flood" : "clear";
          s.aiConfidence = verdict.confidence;
          s.aiSummary = verdict.summary;
          s.endToEnd = verdict.waterlogged ? "flood" : "clear";
        } catch (error) {
          s.aiSummary = error instanceof Error ? error.message : "verification failed";
          s.aiVerdict = null;
          s.endToEnd = s.predicted;
        }
      }
      s.endToEndOutcome =
        s.label === "flood"
          ? s.endToEnd === "flood"
            ? "TP"
            : "FN"
          : s.endToEnd === "flood"
            ? "FP"
            : "TN";
      options.onProgress?.(idx + 1, samples.length, raw[idx]!.sample);
    }
  }

  const latencies = raw.map((r) => r.inferenceMs).sort((a, b) => a - b);
  const metrics = deriveMetrics(samples, threshold, roiTop, latencies, raw);

  const sweep: BenchmarkRun["sweep"] = [];
  for (let t = 0.05; t <= 0.8501; t += 0.025) {
    const th = Number(t.toFixed(2));
    const m = metricsAt(raw, th);
    sweep.push({
      threshold: th,
      precision: m.precision,
      recall: m.recall,
      f1: m.f1,
      falseAlertRate: m.falseAlertRate,
    });
  }
  const best = sweep.reduce((a, b) => (b.f1 > a.f1 ? b : a), sweep[0]!);

  const endToEnd = options.verify
    ? endToEndMetrics(samples, threshold, roiTop, latencies, raw)
    : null;
  const aiLatencySorted = [...aiLatencies].sort((a, b) => a - b);

  return {
    endToEnd,
    aiLatency:
      aiLatencySorted.length === 0
        ? null
        : {
            mean: aiLatencySorted.reduce((a, b) => a + b, 0) / aiLatencySorted.length,
            p95: percentile(aiLatencySorted, 95),
          },
    modelVersion: BENCH_MODEL_VERSION,
    datasetVersion: `aqua-bench-v1 (${set.length} images)`,
    ranAt: new Date().toISOString(),
    metrics,
    sweep,
    bestF1Threshold: best.threshold,
    samples,
    userAgent: navigator.userAgent,
  };
}

function endToEndMetrics(
  samples: SampleResult[],
  threshold: number,
  roiTop: number,
  latencies: number[],
  raw: { decodeMs: number }[],
): BenchmarkMetrics {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const s of samples) {
    if (s.endToEndOutcome === "TP") tp++;
    else if (s.endToEndOutcome === "FP") fp++;
    else if (s.endToEndOutcome === "FN") fn++;
    else if (s.endToEndOutcome === "TN") tn++;
  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const negatives = fp + tn;
  const ious = samples.map((s) => s.iou).filter((v): v is number => v !== null);
  const mean = latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);
  return {
    threshold,
    roiTop,
    total: samples.length,
    positives: samples.filter((s) => s.label === "flood").length,
    negatives: samples.filter((s) => s.label === "clear").length,
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1,
    accuracy: (tp + tn) / Math.max(1, samples.length),
    specificity: negatives === 0 ? 0 : tn / negatives,
    falseAlertRate: negatives === 0 ? 0 : fp / negatives,
    missRate: tp + fn === 0 ? 0 : fn / (tp + fn),
    meanIoU: ious.length === 0 ? 0 : ious.reduce((a, b) => a + b, 0) / ious.length,
    latency: {
      mean,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies[latencies.length - 1] ?? 0,
      fps: mean > 0 ? 1000 / mean : 0,
    },
    decodeMean: raw.reduce((a, b) => a + b.decodeMs, 0) / Math.max(1, raw.length),
  };
}

type Raw = {
  sample: TestSample;
  features: FrameFeatures;
  iou: number | null;
  inferenceMs: number;
  decodeMs: number;
};

function metricsAt(raw: Raw[], threshold: number) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  for (const r of raw) {
    const pred = floodConfidence(r.features) >= threshold;
    if (r.sample.label === "flood") {
      if (pred) tp++;
      else fn++;
    } else if (pred) {
      fp++;
    } else {
      tn++;
    }

  }
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const negatives = fp + tn;
  return {
    tp,
    fp,
    fn,
    tn,
    precision,
    recall,
    f1,
    accuracy: (tp + tn) / Math.max(1, raw.length),
    specificity: negatives === 0 ? 0 : tn / negatives,
    falseAlertRate: negatives === 0 ? 0 : fp / negatives,
    missRate: tp + fn === 0 ? 0 : fn / (tp + fn),
  };
}

function deriveMetrics(
  samples: SampleResult[],
  threshold: number,
  roiTop: number,
  latencies: number[],
  raw: Raw[],
): BenchmarkMetrics {
  const base = metricsAt(raw, threshold);
  const ious = samples.map((s) => s.iou).filter((v): v is number => v !== null);
  const mean = latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length);
  return {
    threshold,
    roiTop,
    total: samples.length,
    positives: samples.filter((s) => s.label === "flood").length,
    negatives: samples.filter((s) => s.label === "clear").length,
    ...base,
    meanIoU: ious.length === 0 ? 0 : ious.reduce((a, b) => a + b, 0) / ious.length,
    latency: {
      mean,
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      max: latencies[latencies.length - 1] ?? 0,
      fps: mean > 0 ? 1000 / mean : 0,
    },
    decodeMean: raw.reduce((a, b) => a + b.decodeMs, 0) / Math.max(1, raw.length),
  };
}

/** Rows written to model_evals when an operator publishes a run. */
export function runToEvalRows(run: BenchmarkRun) {
  const m = run.metrics;
  const note = `threshold ${m.threshold.toFixed(2)}, ROI top ${m.roiTop.toFixed(2)}, ${m.positives}P/${m.negatives}N, browser run ${run.ranAt}`;
  const rows: {
    model_version: string;
    split: string;
    metric_name: string;
    metric_value: number;
    sample_count: number;
    notes: string;
  }[] = [
    ["precision", m.precision],
    ["recall", m.recall],
    ["f1", m.f1],
    ["accuracy", m.accuracy],
    ["specificity", m.specificity],
    ["false_alert_rate", m.falseAlertRate],
    ["miss_rate", m.missRate],
    ["iou_weak_box", m.meanIoU],
    ["inference_ms_mean", m.latency.mean],
    ["inference_ms_p95", m.latency.p95],
    ["fps_single_frame", m.latency.fps],
  ].map(([name, value]) => ({
    model_version: run.modelVersion,
    split: "held-out-test",
    metric_name: name as string,
    metric_value: Number((value as number).toFixed(4)),
    sample_count: m.total,
    notes: note,
  }));
  if (run.endToEnd) {
    const e = run.endToEnd;
    const eNote = `end-to-end: rule screening (conf >= ${e.threshold.toFixed(2)}) + AI frame confirmation, ${run.ranAt}`;
    for (const [name, value] of [
      ["e2e_precision", e.precision],
      ["e2e_recall", e.recall],
      ["e2e_f1", e.f1],
      ["e2e_false_alert_rate", e.falseAlertRate],
      ["e2e_accuracy", e.accuracy],
      ...(run.aiLatency
        ? ([
            ["ai_verify_ms_mean", run.aiLatency.mean],
            ["ai_verify_ms_p95", run.aiLatency.p95],
          ] as [string, number][])
        : []),
    ] as [string, number][]) {
      rows.push({
        model_version: `${run.modelVersion}+ai-verify`,
        split: "held-out-test",
        metric_name: name,
        metric_value: Number(value.toFixed(4)),
        sample_count: e.total,
        notes: eNote,
      });
    }
  }
  return rows;
}
