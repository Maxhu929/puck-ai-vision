import { z } from "zod";
import { nearestSample, type SamFrame } from "./sam-trial";
import { approvedWindows, type ReviewSegment, type VideoRange } from "./video-review";
import type { HighlightBox } from "./highlight";

export const samReviewSchema = z.object({
  trialId: z.string().uuid(), fps: z.number().finite().min(1).max(120),
  clipStart: z.number().finite().min(0), clipEnd: z.number().finite().positive(),
  frames: z.array(z.object({
    frame: z.number().int().min(0), time: z.number().finite().min(0),
    x: z.number().finite().min(0).max(1), y: z.number().finite().min(0).max(1),
    w: z.number().finite().min(0).max(1), h: z.number().finite().min(0).max(1),
    area: z.number().finite().min(0).max(1), lost: z.boolean(),
  }).refine(f => f.x + f.w <= 1.000001 && f.y + f.h <= 1.000001)).min(1).max(20000),
}).refine(r => r.clipEnd > r.clipStart && r.clipEnd - r.clipStart <= 30
  && r.frames.every((f, i) => f.time >= r.clipStart && f.time < r.clipEnd
    && Math.abs(f.time - (r.clipStart + f.frame / r.fps)) < 0.001
    && (i === 0 || f.time > r.frames[i - 1].time)));
export type SamReview = z.infer<typeof samReviewSchema>;

/** A frame-local marker; never interpolate or reconnect through lost frames. */
export function samHighlightAt(review: SamReview, time: number): HighlightBox | null {
  if (time < review.clipStart || time >= review.clipEnd) return null;
  const f = nearestSample<SamFrame>(review.frames, time, 0.55 / review.fps);
  return f && !f.lost && f.w > 0 && f.h > 0 ? { ...f, time } : null;
}

/** Tracking can only narrow the existing manual approval windows, never expand them. */
export function coachingWindows(segments: ReviewSegment[], shifts: VideoRange[], marks: HighlightBox[], review?: SamReview | null): VideoRange[] {
  const manual = approvedWindows(segments, shifts, marks);
  if (!review) return manual;
  const result: VideoRange[] = [];
  for (const f of review.frames) {
    if (f.lost || f.w <= 0 || f.h <= 0) continue;
    for (const w of manual) {
      const start = Math.max(w.start, review.clipStart, f.time - 0.5 / review.fps);
      const end = Math.min(w.end, review.clipEnd, f.time + 0.5 / review.fps);
      if (end <= start) continue;
      const last = result.at(-1);
      if (last && start <= last.end + 1e-8) last.end = Math.max(last.end, end);
      else result.push({ start, end });
    }
  }
  return result;
}