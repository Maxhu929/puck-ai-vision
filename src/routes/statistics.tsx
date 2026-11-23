import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { PageShell } from "@/components/AppNav";
import { listAnalyses } from "@/lib/analysis.functions";
import { gradedClips, gradeToScore, perShift, personalBests, type GradedClip } from "@/lib/clip-stats";

const analysesQuery = queryOptions({ queryKey: ["analyses"], queryFn: () => listAnalyses() });
const title = "Per-Shift Hockey Stats & Personal Bests";
const description = "Per-shift speed, distance and puck touches, your grade trend clip by clip, and personal bests from your graded hockey clips.";

export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StatisticsPage,
});

const SKILLS = ["Skating", "Puck Control", "Shot Selection", "Positioning", "Hockey IQ"];
const COLORS = ["var(--color-primary)", "var(--color-chart-2, var(--color-accent))", "var(--color-chart-3, var(--color-muted-foreground))", "var(--color-chart-4, var(--color-destructive))", "var(--color-chart-5, var(--color-foreground))"];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="surface-card rounded-xl px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Best({ label, clip, value }: { label: string; clip: GradedClip | null; value: string }) {
  return (
    <div className="surface-card rounded-xl px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{clip ? value : "—"}</p>
      {clip && <Link to="/feedback" search={{ id: clip.id }} className="mt-2 inline-block text-xs text-primary underline">Open clip</Link>}
    </div>
  );
}

function StatisticsPage() {
  const q = useQuery(analysesQuery);
  const clips = gradedClips(q.data?.items ?? []);
  const ps = perShift(clips);
  const bests = personalBests(clips);
  const trend = clips.map((c, i) => {
    const row: Record<string, number | string> = { clip: `#${i + 1}`, Grade: gradeToScore(c.overallGrade) ?? 0 };
    for (const s of SKILLS) { const cat = c.categories.find((x) => x.name === s); if (cat) row[s] = cat.score; }
    return row;
  });
  const shots = clips.filter((c) => c.metrics.shotSpeedKph);

  return (
    <PageShell title="Statistics" subtitle="Built from your graded clips, averaged per shift.">
      {q.isLoading ? <p className="text-muted-foreground">Loading clips…</p> : !clips.length ? (
        <p className="text-muted-foreground">No graded clips yet. Get one graded on the Feedback page and your stats will show up here.</p>
      ) : (
        <>
          <h2 className="text-lg font-semibold">Per shift</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Shifts counted" value={String(ps!.shifts)} sub={`${clips.length} graded clip${clips.length > 1 ? "s" : ""}`} />
            <Stat label="Distance per shift" value={`${ps!.distancePerShift} m`} />
            <Stat label="Puck touches per shift" value={String(ps!.touchesPerShift)} />
            <Stat label="Average speed" value={`${ps!.avgSpeed} km/h`} />
          </div>

          <h2 className="mt-8 text-lg font-semibold">Personal bests</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Best label="Fastest skate" clip={bests.speed} value={`${bests.speed?.metrics.topSpeedKph ?? 0} km/h`} />
            <Best label="Hardest shot" clip={bests.shot} value={`${bests.shot?.metrics.shotSpeedKph ?? 0} km/h`} />
            <Best label="Best clip grade" clip={bests.grade} value={bests.grade?.overallGrade ?? ""} />
          </div>

          <div className="surface-card mt-8 rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Clip-by-clip trend</h2>
            {clips.length < 2 && <p className="mt-1 text-sm text-muted-foreground">Grade one more clip to see a trend line.</p>}
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="clip" stroke="var(--color-muted-foreground)" />
                  <YAxis domain={[0, 100]} stroke="var(--color-muted-foreground)" />
                  <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)" }} />
                  <Legend />
                  <Line type="monotone" dataKey="Grade" stroke="var(--color-primary)" strokeWidth={3} dot />
                  {SKILLS.map((s, i) => <Line key={s} type="monotone" dataKey={s} stroke={COLORS[i]} strokeWidth={1.5} dot={false} strokeOpacity={0.7} />)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {shots.length > 0 && (
            <div className="surface-card mt-8 rounded-2xl p-6">
              <h2 className="text-lg font-semibold">Shot log</h2>
              <ul className="mt-3 divide-y divide-border text-sm">
                {shots.map((c) => (
                  <li key={c.id} className="flex justify-between py-2">
                    <span>{c.fileName ?? new Date(c.createdAt).toLocaleDateString()}</span>
                    <span>{c.metrics.shotSpeedKph} km/h{c.metrics.shotTechniqueScore ? ` · technique ${c.metrics.shotTechniqueScore}/100` : ""}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-6 text-xs text-muted-foreground">All numbers are AI estimates from video.</p>
        </>
      )}
    </PageShell>
  );
}
