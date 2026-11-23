import type { AnalysisRecord } from "./analysis.functions";
import type { PlayStance, ShotStyle } from "./gear";

function vote<T extends string>(vals: Array<T | null | undefined>) {
  const counts = new Map<T, number>();
  for (const v of vals) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: T | null = null, n = 0;
  for (const [k, c] of counts) if (c > n) { best = k; n = c; }
  return best ? { value: best, clips: n } : null;
}

/** Most common shot style and stance the AI saw across graded clips. */
export function gearHintsFromClips(items: AnalysisRecord[]) {
  const ready = items.filter((a) => a.status === "ready" && a.metrics);
  return {
    style: vote<ShotStyle>(ready.map((a) => a.metrics?.shotStyle)),
    stance: vote<PlayStance>(ready.map((a) => a.metrics?.stance)),
  };
}
