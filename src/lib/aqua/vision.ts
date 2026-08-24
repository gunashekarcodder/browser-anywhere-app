/**
 * AquaSentinel water-surface analyser (browser vision stage).
 *
 * Pure computer-vision, no ML weights: HSV colour classification combined with a
 * local-gradient (texture smoothness) test inside a road region-of-interest.
 * Standing water on a road is characterised by:
 *   - low local gradient (a specular, smooth sheet),
 *   - either low saturation grey/silver reflection, a bluish sky reflection,
 *     or a desaturated brown/ochre muddy tone.
 *
 * Output is a deterministic, explainable feature set. ML verification of the
 * same frame is a separate stage (see src/lib/ai-vision.functions.ts).
 */

export type FrameFeatures = {
  /** Fraction (0-1) of the road ROI classified as standing water. */
  waterCoverage: number;
  /** Fraction (0-1) of the ROI that looks like drivable road surface. */
  roadCoverage: number;
  /** Fraction of water pixels that also look like road (water-on-road overlap). */
  roadBlockedRatio: number;
  /** Mean normalised local gradient of the water candidate area (low = smooth sheet). */
  textureScore: number;
  /** Mean brightness of the ROI, used to flag night / low-light frames. */
  luma: number;
  /** Mean brightness of the water-candidate pixels. */
  waterLuma: number;
  /** Mean brightness of road pixels NOT classified as water (dry surface). */
  dryRoadLuma: number;
  /** Std-dev of brightness inside the water candidate area (reflection structure). */
  waterLumaStd: number;
  /** Mean colour saturation of the water candidate area. */
  waterSaturation: number;
  /** Analysed ROI dimensions. */
  roiWidth: number;
  roiHeight: number;
};

export type AnalyseOptions = {
  /** Where the road ROI starts, as a fraction of frame height. Default 0.42. */
  roiTop?: number;
  /** Pixel sampling stride. Default 2. */
  stride?: number;
  /** Gradient threshold (0-1) below which a pixel counts as smooth. Default 0.085. */
  smoothThreshold?: number;
};

function rgbToHsv(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Analyse a decoded frame. `data` must be RGBA (as returned by
 * CanvasRenderingContext2D.getImageData). Also fills `mask` (one byte per
 * sampled cell, row-major over the ROI) when provided, for overlay rendering.
 */
export function analyseFrame(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: AnalyseOptions = {},
): { features: FrameFeatures; mask: Uint8Array; maskCols: number; maskRows: number } {
  const roiTop = options.roiTop ?? 0.42;
  const stride = Math.max(1, options.stride ?? 2);
  const smoothThreshold = options.smoothThreshold ?? 0.085;

  const yStart = Math.floor(height * roiTop);
  const cols = Math.max(1, Math.floor(width / stride));
  const rows = Math.max(1, Math.floor((height - yStart) / stride));
  const mask = new Uint8Array(cols * rows);

  let sampled = 0;
  let waterPixels = 0;
  let roadPixels = 0;
  let waterOnRoad = 0;
  let gradSum = 0;
  let waterGradSum = 0;
  let lumaSum = 0;
  let waterLumaSum = 0;
  let waterLumaSqSum = 0;
  let waterSatSum = 0;
  let dryRoadLumaSum = 0;
  let dryRoadPixels = 0;

  const at = (x: number, y: number) => (y * width + x) * 4;
  const lumaAt = (x: number, y: number) => {
    const i = at(x, y);
    return (0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!) / 255;
  };

  // Pass 1: ROI brightness statistics. Standing water is judged relative to the
  // surrounding surface, which is what separates a reflective sheet of water
  // from uniformly smooth dry asphalt (the dominant false-alert source).
  let preSum = 0;
  let preCount = 0;
  for (let row = 0; row < rows; row++) {
    const y = yStart + row * stride;
    if (y + stride >= height) break;
    for (let col = 0; col < cols; col++) {
      const x = col * stride;
      if (x + stride >= width) break;
      preSum += lumaAt(x, y);
      preCount++;
    }
  }
  const roiLuma = preCount === 0 ? 0 : preSum / preCount;

  for (let row = 0; row < rows; row++) {
    const y = yStart + row * stride;
    if (y + stride >= height) break;
    for (let col = 0; col < cols; col++) {
      const x = col * stride;
      if (x + stride >= width) break;

      const i = at(x, y);
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const { h, s, v } = rgbToHsv(r, g, b);
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Local gradient (Roberts-style cross difference), normalised 0-1.
      const gx = Math.abs(l - lumaAt(Math.min(x + stride, width - 1), y));
      const gy = Math.abs(l - lumaAt(x, Math.min(y + stride, height - 1)));
      const grad = Math.min(1, Math.hypot(gx, gy));

      sampled++;
      gradSum += grad;
      lumaSum += l;

      const smooth = grad < smoothThreshold;
      // A grey sheen only counts as water when it stands out from the local
      // surface: a bright specular reflection, or a distinctly darker pool.
      const brighterSheen = s < 0.22 && v < 0.97 && l > roiLuma + 0.055;
      const darkerPool = s < 0.26 && l < roiLuma - 0.1 && v > 0.05;
      const skyReflection = h >= 168 && h <= 255 && s >= 0.1 && s <= 0.62;
      const muddyWater = h >= 15 && h <= 62 && s >= 0.12 && s < 0.45 && v < 0.66;
      const isWater = smooth && (brighterSheen || darkerPool || skyReflection || muddyWater);

      // Road surface: asphalt/concrete is low-saturation and mid/dark value.
      const isRoad = s < 0.28 && v > 0.06 && v < 0.85;

      if (isRoad) roadPixels++;
      if (isWater) {
        waterPixels++;
        waterGradSum += grad;
        waterLumaSum += l;
        waterLumaSqSum += l * l;
        waterSatSum += s;
        if (isRoad) waterOnRoad++;
        mask[row * cols + col] = 1;
      } else if (isRoad) {
        dryRoadPixels++;
        dryRoadLumaSum += l;
      }
    }
  }

  const safeSampled = Math.max(1, sampled);
  const features: FrameFeatures = {
    waterCoverage: waterPixels / safeSampled,
    roadCoverage: roadPixels / safeSampled,
    roadBlockedRatio: waterPixels === 0 ? 0 : waterOnRoad / waterPixels,
    textureScore: waterPixels === 0 ? gradSum / safeSampled : waterGradSum / waterPixels,
    luma: lumaSum / safeSampled,
    waterLuma: waterPixels === 0 ? 0 : waterLumaSum / waterPixels,
    dryRoadLuma: dryRoadPixels === 0 ? 0 : dryRoadLumaSum / dryRoadPixels,
    waterLumaStd:
      waterPixels === 0
        ? 0
        : Math.sqrt(Math.max(0, waterLumaSqSum / waterPixels - (waterLumaSum / waterPixels) ** 2)),
    waterSaturation: waterPixels === 0 ? 0 : waterSatSum / waterPixels,
    roiWidth: width,
    roiHeight: height - yStart,
  };

  return { features, mask, maskCols: cols, maskRows: rows };
}

/**
 * Composite flood confidence (0-1) for a single frame.
 *
 * Coverage alone confuses rain-wet asphalt and night reflections with standing
 * water, so the decision score also rewards water that actually sits on the
 * road (roadBlockedRatio) and a specular, smooth surface (low textureScore),
 * and damps very dark frames where colour information is unreliable.
 * Every term is documented and auditable; the operating threshold is chosen
 * from the measured sweep on the Evaluation page.
 */
export function floodConfidence(f: FrameFeatures): number {
  const coverage = Math.min(1, f.waterCoverage / 0.45);
  const onRoad = Math.min(1, f.roadBlockedRatio / 0.6);
  const smooth = Math.max(0, Math.min(1, (0.14 - f.textureScore) / 0.14));
  // Reflection structure: standing water carries sky/light reflections and
  // submerged edges, so brightness varies inside the wet area. Uniform dry
  // asphalt is smooth AND flat, which is the main false-alert source.
  const reflectivity = Math.min(1, f.waterLumaStd / 0.13);
  // Contrast against the remaining dry surface, when any dry road is visible.
  const contrast =
    f.dryRoadLuma === 0 ? 0.5 : Math.min(1, Math.abs(f.waterLuma - f.dryRoadLuma) / 0.12);
  const nightDamp = f.luma < 0.18 ? 0.8 : 1;
  const evidence = 0.45 * coverage + 0.2 * onRoad + 0.1 * smooth + 0.25 * reflectivity;
  const score = evidence * (0.45 + 0.55 * Math.max(reflectivity, contrast)) * nightDamp;
  return Math.max(0, Math.min(1, score));
}

/** Paint the water mask over a canvas for operator-visible annotation. */
export function drawMaskOverlay(
  ctx: CanvasRenderingContext2D,
  mask: Uint8Array,
  maskCols: number,
  maskRows: number,
  width: number,
  height: number,
  roiTop = 0.42,
) {
  const yStart = Math.floor(height * roiTop);
  const cellW = width / maskCols;
  const cellH = (height - yStart) / maskRows;

  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = "#22d3ee";
  for (let row = 0; row < maskRows; row++) {
    let runStart = -1;
    for (let col = 0; col <= maskCols; col++) {
      const on = col < maskCols && mask[row * maskCols + col] === 1;
      if (on && runStart === -1) runStart = col;
      if (!on && runStart !== -1) {
        ctx.fillRect(
          runStart * cellW,
          yStart + row * cellH,
          (col - runStart) * cellW,
          Math.ceil(cellH),
        );
        runStart = -1;
      }
    }
  }
  ctx.restore();

  // ROI boundary line
  ctx.save();
  ctx.strokeStyle = "rgba(34,211,238,0.65)";
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = Math.max(1, width / 480);
  ctx.beginPath();
  ctx.moveTo(0, yStart);
  ctx.lineTo(width, yStart);
  ctx.stroke();
  ctx.restore();
}

/**
 * Temporal persistence gate. A waterlogging incident is only confirmed when the
 * water coverage stays above threshold for a continuous window — this is what
 * separates a real waterlogged road from a passing dark vehicle or a wet patch.
 */
export class PersistenceGate {
  private samples: { t: number; coverage: number }[] = [];

  constructor(
    private coverageThreshold = 0.16,
    private windowSeconds = 6,
    private minRatio = 0.7,
  ) {}

  push(coverage: number, now = Date.now()) {
    this.samples.push({ t: now, coverage });
    const cutoff = now - this.windowSeconds * 1000 * 2;
    while (this.samples.length && this.samples[0]!.t < cutoff) this.samples.shift();
  }

  /** Continuous seconds of above-threshold coverage at the tail of the buffer. */
  persistenceSeconds(now = Date.now()): number {
    let last = now;
    let seconds = 0;
    for (let i = this.samples.length - 1; i >= 0; i--) {
      const s = this.samples[i]!;
      if (s.coverage < this.coverageThreshold) break;
      seconds += (last - s.t) / 1000;
      last = s.t;
    }
    return seconds;
  }

  confirmed(now = Date.now()): boolean {
    const windowStart = now - this.windowSeconds * 1000;
    const inWindow = this.samples.filter((s) => s.t >= windowStart);
    if (inWindow.length < 3) return false;
    const above = inWindow.filter((s) => s.coverage >= this.coverageThreshold).length;
    return above / inWindow.length >= this.minRatio;
  }

  reset() {
    this.samples = [];
  }
}
