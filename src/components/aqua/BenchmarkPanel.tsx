import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { ensureOperator } from "@/lib/aqua/auth";
import {
  runBenchmark,
  runToEvalRows,
  type BenchmarkRun,
  type SampleResult,
} from "@/lib/aqua/benchmark";
import { TEST_SET } from "@/lib/aqua/testset";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const ms = (v: number) => `${v.toFixed(1)} ms`;

export function BenchmarkPanel() {
  const qc = useQueryClient();
  const [threshold, setThreshold] = useState(0.35);
  const [roiTop, setRoiTop] = useState(0.42);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState<BenchmarkRun | null>(null);
  const [saving, setSaving] = useState(false);

  async function execute() {
    setRunning(true);
    setProgress(0);
    try {
      const result = await runBenchmark({
        threshold,
        roiTop,
        onProgress: (done, total) => setProgress(done / total),
      });
      setRun(result);
      toast.success(
        `Benchmark complete — F1 ${pct(result.metrics.f1)} on ${result.metrics.total} held-out frames`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Benchmark failed");
    } finally {
      setRunning(false);
    }
  }

  async function publish() {
    if (!run) return;
    if (!(await ensureOperator("publish benchmark results"))) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("model_evals").insert(runToEvalRows(run));
      if (error) throw new Error(error.message);
      await qc.invalidateQueries({ queryKey: ["model_evals"] });
      toast.success("Run recorded in the model registry");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record run");
    } finally {
      setSaving(false);
    }
  }

  const m = run?.metrics;

  return (
    <div className="space-y-6">
      <section className="panel p-4">
        <div className="flex flex-wrap items-end gap-6">
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Decision threshold — flood confidence {threshold.toFixed(2)}
            </Label>
            <Slider
              className="mt-3"
              min={0.05}
              max={0.85}
              step={0.01}
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v ?? 0.16)}
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Road ROI top {roiTop.toFixed(2)}
            </Label>
            <Slider
              className="mt-3"
              min={0.1}
              max={0.7}
              step={0.02}
              value={[roiTop]}
              onValueChange={([v]) => setRoiTop(v ?? 0.42)}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={execute} disabled={running}>
              {running ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Play className="mr-2 size-4" />
              )}
              {running ? `Scoring ${(progress * 100).toFixed(0)}%` : "Run benchmark"}
            </Button>
            <Button variant="outline" onClick={publish} disabled={!run || saving}>
              {saving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Save className="mr-2 size-4" />
              )}
              Publish to registry
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          The benchmark runs the exact detector used by the live monitor over{" "}
          {TEST_SET.length} held-out, openly licensed photographs (
          {TEST_SET.filter((s) => s.label === "flood").length} waterlogged,{" "}
          {TEST_SET.filter((s) => s.label === "clear").length} hard negatives: dry roads,
          rain-wet asphalt, night reflections). Every number below is measured in this
          browser at run time — nothing is hard-coded.
        </p>
      </section>

      {m && run ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Precision" value={pct(m.precision)} hint={`${m.tp} TP / ${m.tp + m.fp} alerts`} />
            <Metric label="Recall (sensitivity)" value={pct(m.recall)} hint={`${m.tp}/${m.positives} floods caught`} />
            <Metric label="F1 score" value={m.f1.toFixed(3)} hint={`best F1 at threshold ${run.bestF1Threshold.toFixed(2)}`} />
            <Metric label="IoU (weak box)" value={m.meanIoU.toFixed(3)} hint="mask vs annotated water region" />
            <Metric label="False-alert rate" value={pct(m.falseAlertRate)} hint={`${m.fp}/${m.negatives} negatives flagged`} />
            <Metric label="Miss rate" value={pct(m.missRate)} hint={`${m.fn} floods missed`} />
            <Metric label="Inference latency" value={ms(m.latency.mean)} hint={`p50 ${ms(m.latency.p50)} · p95 ${ms(m.latency.p95)} · max ${ms(m.latency.max)}`} />
            <Metric label="Throughput" value={`${m.latency.fps.toFixed(0)} fps`} hint={`decode ${ms(m.decodeMean)} excluded`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
            <section className="panel p-4">
              <h3 className="font-display text-sm font-semibold">Confusion matrix</h3>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-sm">
                <div />
                <div className="text-xs uppercase text-muted-foreground">pred flood</div>
                <div className="text-xs uppercase text-muted-foreground">pred clear</div>
                <div className="text-xs uppercase text-muted-foreground self-center">flood</div>
                <Cell v={m.tp} tone="good" tag="TP" />
                <Cell v={m.fn} tone="bad" tag="FN" />
                <div className="text-xs uppercase text-muted-foreground self-center">clear</div>
                <Cell v={m.fp} tone="bad" tag="FP" />
                <Cell v={m.tn} tone="good" tag="TN" />
              </div>
              <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
                <Row k="Accuracy" v={pct(m.accuracy)} />
                <Row k="Specificity" v={pct(m.specificity)} />
                <Row k="Model version" v={run.modelVersion} />
                <Row k="Test set" v={run.datasetVersion} />
                <Row k="Ran at" v={new Date(run.ranAt).toLocaleString()} />
              </dl>
            </section>

            <section className="panel p-4">
              <h3 className="font-display text-sm font-semibold">
                Threshold sweep — precision / recall / F1 and false alerts
              </h3>
              <Sweep run={run} threshold={m.threshold} />
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="text-[hsl(190_90%_55%)]">precision</span>
                <span className="text-[hsl(45_95%_60%)]">recall</span>
                <span className="text-[hsl(140_70%_55%)]">F1</span>
                <span className="text-[hsl(0_75%_60%)]">false-alert rate</span>
              </div>
            </section>
          </div>

          <section className="panel p-4">
            <h3 className="font-display text-sm font-semibold">
              Per-frame results and test data used
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Ground-truth label, prediction, measured coverage, weak-box IoU, latency and the
              exact source photograph with its licence.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-3xl text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Frame</th>
                    <th className="py-2 pr-3">Truth</th>
                    <th className="py-2 pr-3">Pred</th>
                    <th className="py-2 pr-3">Outcome</th>
                    <th className="py-2 pr-3">Confidence</th>
                    <th className="py-2 pr-3">Coverage</th>
                    <th className="py-2 pr-3">Road block</th>
                    <th className="py-2 pr-3">Reflect σ</th>
                    <th className="py-2 pr-3">IoU</th>
                    <th className="py-2 pr-3">Latency</th>
                    <th className="py-2">Source / licence</th>
                  </tr>
                </thead>
                <tbody>
                  {run.samples.map((s) => (
                    <SampleRow key={s.id} s={s} />
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="panel p-4 text-sm text-muted-foreground">
          Run the benchmark to measure precision, recall, F1, IoU, false-alert rate and
          inference latency against the held-out test set.
        </section>
      )}
    </div>
  );
}

function SampleRow({ s }: { s: SampleResult }) {
  const tone =
    s.outcome === "TP" || s.outcome === "TN"
      ? "text-[hsl(140_70%_55%)]"
      : "text-[hsl(0_75%_65%)]";
  return (
    <tr className="border-b border-border/60 align-middle last:border-0">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <img
            src={s.url}
            alt={s.title}
            loading="lazy"
            className="h-10 w-16 rounded object-cover"
          />
          <span className="font-mono text-xs">{s.id}</span>
        </div>
      </td>
      <td className="py-2 pr-3 text-xs uppercase">{s.label}</td>
      <td className="py-2 pr-3 text-xs uppercase">{s.predicted}</td>
      <td className={`py-2 pr-3 font-mono text-xs ${tone}`}>{s.outcome}</td>
      <td className="py-2 pr-3 font-mono">{s.confidence.toFixed(2)}</td>
      <td className="py-2 pr-3 font-mono">{(s.features.waterCoverage * 100).toFixed(1)}%</td>
      <td className="py-2 pr-3 font-mono">{(s.features.roadBlockedRatio * 100).toFixed(0)}%</td>
      <td className="py-2 pr-3 font-mono">{s.features.waterLumaStd.toFixed(3)}</td>
      <td className="py-2 pr-3 font-mono">{s.iou === null ? "—" : s.iou.toFixed(3)}</td>
      <td className="py-2 pr-3 font-mono">{s.inferenceMs.toFixed(1)} ms</td>
      <td className="py-2 text-xs text-muted-foreground">
        <a
          href={s.sourcePage}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted"
        >
          {s.title.slice(0, 40)}
        </a>{" "}
        · {s.licence}
      </td>
    </tr>
  );
}

function Sweep({ run, threshold }: { run: BenchmarkRun; threshold: number }) {
  const w = 520;
  const h = 180;
  const xs = (t: number) => ((t - 0.05) / (0.85 - 0.05)) * w;
  const ys = (v: number) => h - v * h;
  const path = (key: "precision" | "recall" | "f1" | "falseAlertRate") =>
    run.sweep
      .map((p, i) => `${i === 0 ? "M" : "L"}${xs(p.threshold).toFixed(1)},${ys(p[key]).toFixed(1)}`)
      .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="mt-3 w-full">
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <line
          key={g}
          x1={0}
          x2={w}
          y1={ys(g)}
          y2={ys(g)}
          stroke="currentColor"
          className="text-border"
          strokeWidth={1}
        />
      ))}
      <line
        x1={xs(threshold)}
        x2={xs(threshold)}
        y1={0}
        y2={h}
        stroke="currentColor"
        className="text-muted-foreground"
        strokeDasharray="4 4"
      />
      <path d={path("precision")} fill="none" stroke="hsl(190 90% 55%)" strokeWidth={2} />
      <path d={path("recall")} fill="none" stroke="hsl(45 95% 60%)" strokeWidth={2} />
      <path d={path("f1")} fill="none" stroke="hsl(140 70% 55%)" strokeWidth={2} />
      <path d={path("falseAlertRate")} fill="none" stroke="hsl(0 75% 60%)" strokeWidth={2} />
      <text x={0} y={h + 14} className="fill-muted-foreground text-[10px]">
        0.05
      </text>
      <text x={w - 20} y={h + 14} className="fill-muted-foreground text-[10px]">
        0.85
      </text>
    </svg>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="panel p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Cell({ v, tone, tag }: { v: number; tone: "good" | "bad"; tag: string }) {
  return (
    <div
      className={`rounded-md border border-border p-2 ${
        tone === "good" ? "bg-[hsl(140_70%_45%/0.12)]" : "bg-[hsl(0_75%_55%/0.12)]"
      }`}
    >
      <span className="font-display text-lg font-semibold">{v}</span>
      <span className="ml-1 text-[10px] uppercase text-muted-foreground">{tag}</span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt>{k}</dt>
      <dd className="font-mono text-foreground/80">{v}</dd>
    </div>
  );
}
