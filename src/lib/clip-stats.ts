import type { AnalysisRecord } from "./analysis.functions";

const GRADES: Record<string, number> = { "A+": 97, A: 94, "A-": 90, "B+": 87, B: 84, "B-": 80, "C+": 77, C: 74, "C-": 70, "D+": 67, D: 64, "D-": 60, F: 50 };
export const gradeToScore = (g: string | null) => (g ? GRADES[g.trim().toUpperCase()] ?? null : null);

export type GradedClip = AnalysisRecord & { metrics: NonNullable<AnalysisRecord["metrics"]> };

export function gradedClips(items: AnalysisRecord[]): GradedClip[] {
  return items
    .filter((a): a is GradedClip => a.status === "ready" && !!a.metrics && gradeToScore(a.overallGrade) != null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Per-shift averages so a short clip and a long clip count fairly. */
export function perShift(clips: GradedClip[]) {
  let shifts = 0, dist = 0, touches = 0, avgSum = 0;
  for (const c of clips) {
    const n = Math.max(1, c.shifts.length || c.metrics.shifts || 1);
    shifts += n; dist += c.metrics.distanceCoveredM; touches += c.metrics.puckTouches; avgSum += c.metrics.avgSpeedKph;
  }
  if (!clips.length) return null;
  const r = (v: number) => Math.round(v * 10) / 10;
  return { shifts, distancePerShift: r(dist / shifts), touchesPerShift: r(touches / shifts), avgSpeed: r(avgSum / clips.length) };
}

export function personalBests(clips: GradedClip[]) {
  const best = <K extends (c: GradedClip) => number | null | undefined>(f: K) =>
    clips.reduce<GradedClip | null>((b, c) => ((f(c) ?? 0) > ((b && f(b)) ?? 0) ? c : b), null);
  return {
    speed: best((c) => c.metrics.topSpeedKph),
    shot: best((c) => c.metrics.shotSpeedKph),
    grade: best((c) => gradeToScore(c.overallGrade)),
  };
}
