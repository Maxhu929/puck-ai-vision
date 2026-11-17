/** Browser-safe helpers for burning a bright player marker into a copy of the clip. */
export type HighlightBox = { time: number; x: number; y: number; w: number; h: number };
type Shift = { start: number; end: number };

/** Longest gap between two boxes we are willing to bridge by straight-line motion. */
export const MAX_BRIDGE_SECONDS = 12;
/** A lone box is shown this long either side when there is no neighbour to bridge to. */
export const LONE_BOX_SECONDS = 1.5;

/**
 * Where the marker goes at time t, or null when it must be hidden. The marker only appears
 * inside logged shifts (when any exist) and never guesses across long gaps between boxes.
 */
export function highlightAt(marks: HighlightBox[], shifts: Shift[], t: number): HighlightBox | null {
  const shift = shifts.find((s) => t >= s.start && t <= s.end);
  if (shifts.length && !shift) return null;
  const inside = [...marks].filter((m) => !shift || (m.time >= shift.start - 0.5 && m.time <= shift.end + 0.5)).sort((a, b) => a.time - b.time);
  const before = [...inside].reverse().find((m) => m.time <= t);
  const after = inside.find((m) => m.time > t);
  if (before && after && after.time - before.time <= MAX_BRIDGE_SECONDS) {
    const k = (t - before.time) / (after.time - before.time);
    const lerp = (a: number, b: number) => a + (b - a) * k;
    return { time: t, x: lerp(before.x, after.x), y: lerp(before.y, after.y), w: lerp(before.w, after.w), h: lerp(before.h, after.h) };
  }
  const near = [before, after].filter((m): m is HighlightBox => !!m && Math.abs(m.time - t) <= LONE_BOX_SECONDS)
    .sort((a, b) => Math.abs(a.time - t) - Math.abs(b.time - t))[0];
  return near ? { ...near, time: t } : null;
}

/** Draws the marker (glowing outline, ring at the skates, arrow above) in pixel space. */
export function drawMarker(ctx: CanvasRenderingContext2D, box: HighlightBox, width: number, height: number) {
  const x = box.x * width, y = box.y * height, w = box.w * width, h = box.h * height;
  const line = Math.max(3, Math.round(height / 180));
  ctx.save();
  ctx.strokeStyle = "#ff00ff";
  ctx.fillStyle = "#ff00ff";
  ctx.shadowColor = "#ffff00";
  ctx.shadowBlur = line * 3;
  ctx.lineWidth = line;
  ctx.strokeRect(x, y, w, h);
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, Math.max(w * 0.7, line * 4), Math.max(h * 0.12, line * 2), 0, 0, Math.PI * 2);
  ctx.stroke();
  const ax = x + w / 2, ay = y - line * 2, size = Math.max(10, h * 0.35);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - size / 2, ay - size);
  ctx.lineTo(ax + size / 2, ay - size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Coarse 4x4x4 RGB histogram of the centre of a box region, normalized to sum 1. */
export function colorHistogram(data: Uint8ClampedArray): Float32Array {
  const bins = new Float32Array(64);
  let n = 0;
  for (let i = 0; i < data.length; i += 4) { bins[(data[i] >> 6) * 16 + (data[i + 1] >> 6) * 4 + (data[i + 2] >> 6)]++; n++; }
  if (n) for (let i = 0; i < 64; i++) bins[i] /= n;
  return bins;
}

/** Bhattacharyya coefficient: 1 = same colours, 0 = nothing in common. */
export function histogramSimilarity(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.sqrt(a[i] * b[i]);
  return s;
}

/** Below this similarity to the user's own box, the marker probably isn't on the player anymore. */
export const LOST_SIMILARITY = 0.6;
/** How long the mismatch must last before we ask for a rebox (ignores brief blur). */
export const LOST_MIN_SECONDS = 0.4;

/** Start times of every stretch where similarity stays under the threshold long enough. */
export function lostStretches(samples: Array<{ time: number; similarity: number }>, threshold = LOST_SIMILARITY, minSeconds = LOST_MIN_SECONDS): number[] {
  const out: number[] = [];
  let start: number | null = null, last = 0;
  const close = () => { if (start !== null && last - start >= minSeconds) out.push(start); start = null; };
  for (const s of samples) {
    if (s.similarity < threshold) { if (start === null) start = s.time; last = s.time; }
    else close();
  }
  close();
  return out;
}

/** Re-encode the clip with the marker drawn into every frame where highlightAt allows it. */
export async function renderHighlightedClip(url: string, marks: HighlightBox[], shifts: Shift[], onProgress?: (f: number) => void, approved?: Shift[], trackedBox?: (time: number) => HighlightBox | null): Promise<{ file: File; lostAt: number[] }> {
  const samples: Array<{ time: number; similarity: number }> = [];
  let reference: Float32Array | null = null;
  let referenceTime = -Infinity;
  const sortedMarks = [...marks].sort((a, b) => a.time - b.time);
  const mb = await import("mediabunny");
  const input = new mb.Input({ source: new mb.UrlSource(url), formats: mb.ALL_FORMATS });
  const track = await input.getPrimaryVideoTrack();
  if (!track) throw new Error("This clip has no video track.");
  const scale = Math.min(1, 720 / track.displayHeight);
  const width = Math.max(2, Math.round((track.displayWidth * scale) / 2) * 2);
  const height = Math.max(2, Math.round((track.displayHeight * scale) / 2) * 2);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d") as unknown as CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Your browser can't draw video frames.");
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() });
  const conversion = await mb.Conversion.init({
    input, output,
    video: {
      forceTranscode: true, bitrate: 2_500_000, processedWidth: width, processedHeight: height,
      process: (sample) => {
        const window = approved?.find(w => sample.timestamp >= w.start && sample.timestamp < w.end);
        const box = approved
          ? window ? trackedBox ? trackedBox(sample.timestamp) : highlightAt(marks.filter(m => m.time >= window.start && m.time < window.end), [window], sample.timestamp) : null
          : highlightAt(marks, shifts, sample.timestamp);
        // Omit all unapproved imagery, retaining the original clock for report links.
        if (approved && !box) ctx.clearRect(0, 0, width, height);
        else sample.draw(ctx, 0, 0, width, height);
        if (box) {
          // Compare the colours inside the marker with the colours inside the user's own most recent box.
          const bx = Math.max(0, Math.floor((box.x + box.w * 0.2) * width)), by = Math.max(0, Math.floor((box.y + box.h * 0.2) * height));
          const bw = Math.max(1, Math.min(width - bx, Math.floor(box.w * 0.6 * width))), bh = Math.max(1, Math.min(height - by, Math.floor(box.h * 0.6 * height)));
          const hist = colorHistogram(ctx.getImageData(bx, by, bw, bh).data);
          const anchor = [...sortedMarks].reverse().find(m => m.time <= sample.timestamp + 0.05);
          if (anchor && anchor.time > referenceTime && Math.abs(anchor.time - sample.timestamp) < 0.2) { reference = hist; referenceTime = anchor.time; }
          if (!reference) { reference = hist; referenceTime = sample.timestamp; }
          samples.push({ time: sample.timestamp, similarity: histogramSimilarity(hist, reference) });
          drawMarker(ctx, box, width, height);
        }
        return canvas;
      },
    },
    audio: { discard: true },
    showWarnings: false,
  });
  if (!conversion.isValid) throw new Error("This browser can't re-encode this clip. Try Chrome or Edge.");
  conversion.onProgress = (p) => onProgress?.(p);
  await conversion.execute();
  const buffer = output.target.buffer;
  if (!buffer) throw new Error("The highlighted copy came out empty.");
  return { file: new File([buffer], "highlighted.mp4", { type: "video/mp4" }), lostAt: lostStretches(samples) };
}
