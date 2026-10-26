/**
 * Browser-safe helpers for the SAM 2 tracking trial.
 *
 * The trial compares the existing Lucas–Kanade arrow against a hosted SAM 2
 * run on one short clip. Nothing here feeds grading or approval — trial data
 * lives only on the sam_trials record.
 */

/** A player box in normalized (0–1) video-frame coordinates. */
export type TrialBox = { x: number; y: number; w: number; h: number };

/** One per-frame position from the SAM 2 mask video. */
export type SamFrame = {
  frame: number;
  time: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Mask area as a fraction of the whole frame. */
  area: number;
  lost: boolean;
};

/** One per-frame position recorded from the Lucas–Kanade arrow. */
export type LkSample = { time: number; x: number; y: number; w: number; h: number; lost: boolean };

export type CheckpointLabel = "on_me" | "wrong_player" | "lost";

export type TrialLabels = {
  /** Keyed by checkpoint time (seconds, stringified). */
  checkpoints: Record<string, { sam?: CheckpointLabel; lk?: CheckpointLabel }>;
  /** Times (seconds, original-video clock) where players cross paths. */
  crossings: number[];
  /** How many boxes the user had to redraw per tracker. */
  corrections: { sam: number; lk: number };
};

export const MAX_CLIP_SECONDS = 30;
export const CHECKPOINT_INTERVAL_SECONDS = 2;
export const CROSSING_WINDOW_SECONDS = 2;
/** Masks smaller than this fraction of the frame count as "lost". */
export const MIN_MASK_AREA = 0.0004;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** fal's box_prompts want pixels in the video frame; the app stores 0–1 boxes. */
export function boxToPixels(box: TrialBox, width: number, height: number) {
  return {
    x_min: Math.round(box.x * width),
    y_min: Math.round(box.y * height),
    x_max: Math.round((box.x + box.w) * width),
    y_max: Math.round((box.y + box.h) * height),
    frame_index: 0,
  };
}

/** Inverse of boxToPixels, clamped to the frame. */
export function pixelsToBox(xMin: number, yMin: number, xMax: number, yMax: number, width: number, height: number): TrialBox {
  const x = clamp01(xMin / width);
  const y = clamp01(yMin / height);
  return {
    x,
    y,
    w: clamp01(xMax / width) - x,
    h: clamp01(yMax / height) - y,
  };
}

/** Mask frame index → timestamp on the original video's clock. */
export function frameToTime(frame: number, fps: number, clipStart: number): number {
  return clipStart + frame / fps;
}

/** Labeling pauses every CHECKPOINT_INTERVAL_SECONDS across the clip. */
export function checkpointTimes(clipStart: number, clipEnd: number): number[] {
  const times: number[] = [];
  for (let t = clipStart; t <= clipEnd - 0.001; t += CHECKPOINT_INTERVAL_SECONDS) {
    times.push(Math.round(t * 100) / 100);
  }
  return times;
}

export type TrackerMetrics = {
  labeled: number;
  /** Share of labeled checkpoints marked "on_me". */
  coverage: number;
  /** Times the tracker went from "on_me" to "wrong_player". */
  identitySwitches: number;
  lostCount: number;
  lostSeconds: number;
  corrections: number;
  /** Same counts, only for checkpoints within ±CROSSING_WINDOW_SECONDS of a tagged crossing. */
  crossing: { labeled: number; coverage: number; identitySwitches: number } | null;
};

export type TrialMetrics = { sam: TrackerMetrics; lk: TrackerMetrics };

function trackerMetrics(
  labels: TrialLabels,
  key: "sam" | "lk",
  clipStart: number,
  clipEnd: number,
): TrackerMetrics {
  const times = checkpointTimes(clipStart, clipEnd);
  const entries = times
    .map((t) => ({ time: t, label: labels.checkpoints[String(t)]?.[key] }))
    .filter((e): e is { time: number; label: CheckpointLabel } => Boolean(e.label));

  const summarize = (rows: Array<{ time: number; label: CheckpointLabel }>) => {
    const onMe = rows.filter((r) => r.label === "on_me").length;
    let switches = 0;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i - 1].label === "on_me" && rows[i].label === "wrong_player") switches++;
    }
    return { labeled: rows.length, coverage: rows.length ? onMe / rows.length : 0, identitySwitches: switches };
  };

  const all = summarize(entries);
  const lostCount = entries.filter((e) => e.label === "lost").length;

  const crossingRows = labels.crossings.length
    ? entries.filter((e) => labels.crossings.some((c) => Math.abs(e.time - c) <= CROSSING_WINDOW_SECONDS))
    : [];
  const crossing = labels.crossings.length ? summarize(crossingRows) : null;

  return {
    labeled: all.labeled,
    coverage: all.coverage,
    identitySwitches: all.identitySwitches,
    lostCount,
    lostSeconds: lostCount * CHECKPOINT_INTERVAL_SECONDS,
    corrections: labels.corrections[key],
    crossing: crossing ? { labeled: crossing.labeled, coverage: crossing.coverage, identitySwitches: crossing.identitySwitches } : null,
  };
}

export function computeMetrics(labels: TrialLabels, clipStart: number, clipEnd: number): TrialMetrics {
  return {
    sam: trackerMetrics(labels, "sam", clipStart, clipEnd),
    lk: trackerMetrics(labels, "lk", clipStart, clipEnd),
  };
}

export function emptyLabels(): TrialLabels {
  return { checkpoints: {}, crossings: [], corrections: { sam: 0, lk: 0 } };
}

/** Suggested pass bar from the approved plan. */
export function passesBar(m: TrialMetrics): boolean {
  return m.sam.coverage >= 0.85 && m.sam.coverage - m.lk.coverage >= 0.2 && (m.sam.crossing?.identitySwitches ?? 0) <= 1;
}
