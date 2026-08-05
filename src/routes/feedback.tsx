import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, PlayCircle, Target } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { Progress } from "@/components/ui/progress";
import { feedbackCategories, timelineFeedback } from "@/lib/hockey-data";
import { useQuery } from "@tanstack/react-query";
import { getAnalysis } from "@/lib/analysis.functions";
import { suggestDrills } from "@/lib/drills";

const title = "AI Feedback & Shift Grades | Hockey Video Analyzer";
const description =
  "Timestamped AI feedback on every hockey play with explanations, category ratings, and an overall shift grade.";

export const Route = createFileRoute("/feedback")({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { id } = Route.useSearch();
  const { data } = useQuery({
    queryKey: ["analysis", id],
    queryFn: () => getAnalysis({ data: { id: id as string } }),
    enabled: Boolean(id),
  });

  const record = data?.record ?? null;
  const notes = record?.notes.length ? record.notes : timelineFeedback;
  const categories = record?.categories.length ? record.categories : feedbackCategories;
  const grade = record?.overallGrade ?? "A-";
  const drills = suggestDrills(categories);
  const subtitle = record
    ? `${record.playerName}${record.jerseyNumber ? ` · #${record.jerseyNumber}` : ""}`
    : "Bantam AA vs. Northside — 2nd Period · 12:40";

  return (
    <PageShell title="AI Feedback" subtitle={subtitle}>
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="surface-card flex aspect-video items-center justify-center rounded-2xl">
            <div className="text-center">
              <PlayCircle className="mx-auto size-14 text-ice" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-muted-foreground">
                {record?.fileName ?? "Game footage playback"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Play-by-play notes</h2>
            {notes.map((f, i) => (
              <article key={`${f.time}-${i}`} className="surface-card flex gap-4 rounded-xl px-5 py-4">
                {f.type === "positive" ? (
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-turf" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-5 shrink-0 text-gold" />
                )}
                <div>
                  <p className="text-sm font-medium">
                    <span className="font-display text-ice">{f.time}</span>
                    <span className="mx-2 text-muted-foreground">·</span>
                    {f.tag}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Suggested drills</h2>
            <p className="text-sm text-muted-foreground">
              Targeted at the lowest-scoring categories from this session.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {drills.map((d) => (
                <article key={d.name} className="surface-card rounded-xl px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Target className="mt-0.5 size-5 shrink-0 text-ice" />
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        <span className="text-ice">{d.focus}</span>
                        <span className="mx-2">·</span>
                        {d.reps}
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">{d.detail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="surface-card rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Overall grade</p>
            <p className="mt-2 font-display text-6xl font-bold text-gradient-ice">{grade}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {record?.summary ?? "86 / 100 · top 12% of your league"}
            </p>
          </div>

          <div className="surface-card space-y-5 rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Category ratings</h2>
            {categories.map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.score}</span>
                </div>
                <Progress value={c.score} className="mt-2" />
                <p className="mt-2 text-sm text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </PageShell>
  );
}