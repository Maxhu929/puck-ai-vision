import type { AnalysisRecord, ClipMetrics } from "./analysis.functions";

export type ClipWorkload = {
  metrics: ClipMetrics;
  /** True when the numbers were inferred from the clip breakdown instead of measured. */
  estimated: boolean;
};

function score(record: AnalysisRecord, name: string, fallback = 70) {
  const c = record.categories.find((x) => x.name.toLowerCase().includes(name));
  return c && Number.isFinite(c.score) ? Math.max(0, Math.min(100, c.score)) : fallback;
}

/**
 * Movement numbers for a clip. Newer analyses store them directly; older ones
 * are back-filled from the skating / puck-control breakdown so a comparison is
 * still possible.
 */
export function clipWorkload(record: AnalysisRecord): ClipWorkload {
  if (record.metrics && record.metrics.topSpeedKph > 0) {
    return { metrics: record.metrics, estimated: false };
  }
  const skating = score(record, "skating");
  const puck = score(record, "puck control");
  const positioning = score(record, "positioning");
  const puckNotes = record.notes.filter((n) => /puck|pass|shot|carry/i.test(n.text)).length;

  return {
    estimated: true,
    metrics: {
      topSpeedKph: Math.round((24 + skating * 0.14) * 10) / 10,
      avgSpeedKph: Math.round((24 + skating * 0.14) * 0.55 * 10) / 10,
      distanceCoveredM: Math.round((900 + skating * 12 + positioning * 4) / 10) * 10,
      shifts: Math.max(1, Math.round(record.notes.length / 2)),
      puckTouches: Math.max(1, puckNotes * 2 + Math.round(puck / 8)),
      movementNote: "Estimated from the skating and positioning breakdown of this clip.",
      tendencyNote: "Estimated puck involvement based on the coaching notes for this clip.",
    },
  };
}

export type MetricDelta = {
  key: string;
  label: string;
  unit: string;
  latest: number;
  previous: number;
  deltaPct: number;
};

export type NutritionInsight = {
  title: string;
  detail: string;
  tone: "warn" | "good" | "flat";
};

function pct(latest: number, previous: number) {
  if (!previous) return 0;
  return Math.round(((latest - previous) / previous) * 1000) / 10;
}

export function compareWorkloads(
  latest: AnalysisRecord,
  previous: AnalysisRecord,
  weightKg: number,
): { metrics: MetricDelta[]; insights: NutritionInsight[]; estimated: boolean } {
  const a = clipWorkload(latest);
  const b = clipWorkload(previous);

  const metrics: MetricDelta[] = [
    { key: "top", label: "Top speed", unit: "km/h", latest: a.metrics.topSpeedKph, previous: b.metrics.topSpeedKph },
    { key: "avg", label: "Average speed", unit: "km/h", latest: a.metrics.avgSpeedKph, previous: b.metrics.avgSpeedKph },
    { key: "dist", label: "Distance covered", unit: "m", latest: a.metrics.distanceCoveredM, previous: b.metrics.distanceCoveredM },
    { key: "shifts", label: "Shifts tracked", unit: "", latest: a.metrics.shifts, previous: b.metrics.shifts },
    { key: "touches", label: "Puck touches", unit: "", latest: a.metrics.puckTouches, previous: b.metrics.puckTouches },
  ].map((m) => ({ ...m, deltaPct: pct(m.latest, m.previous) }));

  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m])) as Record<string, MetricDelta>;
  const insights: NutritionInsight[] = [];
  const g = (n: number) => Math.round(weightKg * n);

  if (byKey["avg"].deltaPct <= -5) {
    insights.push({
      tone: "warn",
      title: "Skating pace dropped between clips",
      detail: `Average speed is down ${Math.abs(byKey["avg"].deltaPct)}%, which usually means the tank ran low. Add ${g(1.5)} g of carbs 3 hours before puck drop and sip ${g(0.6)} ml of a carb-electrolyte drink between periods.`,
    });
  } else if (byKey["avg"].deltaPct >= 5) {
    insights.push({
      tone: "good",
      title: "Skating pace is up",
      detail: `Average speed is up ${byKey["avg"].deltaPct}%. Keep the current pre-game meal timing and repeat it — it is clearly working.`,
    });
  }

  if (byKey["top"].deltaPct <= -4) {
    insights.push({
      tone: "warn",
      title: "Less top-end burst",
      detail: `Top speed fell ${Math.abs(byKey["top"].deltaPct)}%. Explosive speed leans on stored muscle glycogen: aim for ${g(6)} g of carbs across the day before game day and get ${g(0.4)} g of protein in within 30 minutes after skating.`,
    });
  }

  if (byKey["dist"].deltaPct <= -8) {
    insights.push({
      tone: "warn",
      title: "Covering less ice",
      detail: `Distance is down ${Math.abs(byKey["dist"].deltaPct)}%. That is a fuel-and-fluid pattern — add a ${Math.round(weightKg * 4)} kcal-per-kg breakfast on game day and drink ${Math.round(weightKg * 0.045 * 10) / 10} L of water plus sodium through the day.`,
    });
  } else if (byKey["dist"].deltaPct >= 8) {
    insights.push({
      tone: "good",
      title: "Working harder over the clip",
      detail: `Distance is up ${byKey["dist"].deltaPct}%. Higher workload burns more, so add roughly ${Math.round(weightKg * 5)} kcal on heavy days, mostly from carbs.`,
    });
  }

  if (byKey["touches"].deltaPct <= -15) {
    insights.push({
      tone: "warn",
      title: "Touching the puck less",
      detail: `Puck touches fell ${Math.abs(byKey["touches"].deltaPct)}%. When legs fade, players stop jumping into plays. A ${g(0.5)} g carb snack 45 minutes before warmup and a between-period gel keep late-game engagement up.`,
    });
  } else if (byKey["touches"].deltaPct >= 15) {
    insights.push({
      tone: "good",
      title: "More involved with the puck",
      detail: `Puck touches are up ${byKey["touches"].deltaPct}%. More involvement means more stop-start work — protect recovery with ${g(0.4)} g of protein and fast carbs right after the game.`,
    });
  }

  if (!insights.length) {
    insights.push({
      tone: "flat",
      title: "Output held steady",
      detail: "Speed, movement and puck involvement are close to the last clip. Stay on the current calorie and macro targets below and keep hydration consistent.",
    });
  }

  if (a.metrics.movementNote) {
    insights.push({ tone: "flat", title: "Movement read", detail: a.metrics.movementNote });
  }
  if (a.metrics.tendencyNote) {
    insights.push({ tone: "flat", title: "Tendencies", detail: a.metrics.tendencyNote });
  }

  return { metrics, insights, estimated: a.estimated || b.estimated };
}
