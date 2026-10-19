import { z } from "zod";
import { shiftSchema } from "./player-identification";
import { MAX_BRIDGE_SECONDS, LONE_BOX_SECONDS, type HighlightBox } from "./highlight";

export const reviewSegmentSchema = shiftSchema.and(z.object({ status: z.enum(["verified", "uncertain", "offscreen", "wrong_player"]) }));
export const reviewSegmentsSchema = z.array(reviewSegmentSchema).max(200);
export type ReviewSegment = z.infer<typeof reviewSegmentSchema>;
export type VideoRange = { start: number; end: number };

function merge(ranges: VideoRange[]): VideoRange[] {
  const result: VideoRange[] = [];
  for (const range of [...ranges].sort((a, b) => a.start - b.start)) {
    if (range.end <= range.start) continue;
    const last = result.at(-1);
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else result.push({ ...range });
  }
  return result;
}

/** Explicit exclusion always wins over a verified range. Never reconnect through a gap. */
export function reviewedWindows(segments: ReviewSegment[], shifts: VideoRange[]): VideoRange[] {
  let windows = merge(segments.filter(s => s.status === "verified").flatMap(s => shifts.map(shift => ({ start: Math.max(s.start, shift.start), end: Math.min(s.end, shift.end) }))));
  for (const gap of segments.filter(s => s.status !== "verified")) {
    windows = windows.flatMap(w => w.end <= gap.start || w.start >= gap.end ? [w] : [
      { start: w.start, end: Math.min(w.end, gap.start) },
      { start: Math.max(w.start, gap.end), end: w.end },
    ].filter(w => w.end > w.start));
  }
  return windows;
}

/** Only reviewed footage with a supported marker reaches coaching; keep original timestamps. */
export function approvedWindows(segments: ReviewSegment[], shifts: VideoRange[], marks: HighlightBox[]): VideoRange[] {
  return reviewedWindows(segments, shifts).flatMap(window => {
    // A box outside the reviewed section cannot reconnect identity across an excluded gap.
    const anchors = marks.filter(m => m.time >= window.start && m.time < window.end).sort((a, b) => a.time - b.time);
    const support = anchors.flatMap((m, i) => {
      const next = anchors[i + 1];
      return [
        { start: Math.max(window.start, m.time - LONE_BOX_SECONDS), end: Math.min(window.end, m.time + LONE_BOX_SECONDS) },
        ...(next && next.time - m.time <= MAX_BRIDGE_SECONDS ? [{ start: m.time, end: next.time }] : []),
      ];
    });
    return merge(support);
  });
}

export function containsTime(windows: VideoRange[], time: number): boolean {
  return windows.some(w => time >= w.start && time < w.end);
}

export function canProcessReview(approved: boolean, highlighted: boolean, windows: VideoRange[]): boolean {
  return approved && highlighted && windows.some(w => w.end > w.start);
}

export const coachingNoteSchema = z.object({
  time: z.string(), tag: z.string().min(1).max(160), type: z.enum(["positive", "improvement"]),
  text: z.string().min(1).max(1500), evidence: z.string().trim().min(1).max(1500),
  interpretation: z.string().trim().min(1).max(1500), suggestion: z.string().trim().min(1).max(1500),
  confidence: z.literal("high"), visibility: z.literal("visible"),
});