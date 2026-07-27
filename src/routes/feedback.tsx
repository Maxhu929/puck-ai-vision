import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { Progress } from "@/components/ui/progress";
import { feedbackCategories, timelineFeedback } from "@/lib/hockey-data";

const title = "AI Feedback & Shift Grades | Hockey Video Analyzer";
const description =
  "Timestamped AI feedback on every hockey play with explanations, category ratings, and an overall shift grade.";

export const Route = createFileRoute("/feedback")({
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
  return (
    <PageShell title="AI Feedback" subtitle="Bantam AA vs. Northside — 2nd Period · 12:40">
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <div className="surface-card flex aspect-video items-center justify-center rounded-2xl">
            <div className="text-center">
              <PlayCircle className="mx-auto size-14 text-ice" strokeWidth={1.5} />
              <p className="mt-3 text-sm text-muted-foreground">Game footage playback</p>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Play-by-play notes</h2>
            {timelineFeedback.map((f) => (
              <article key={f.time} className="surface-card flex gap-4 rounded-xl px-5 py-4">
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
        </div>

        <aside className="space-y-6">
          <div className="surface-card rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">Overall grade</p>
            <p className="mt-2 font-display text-6xl font-bold text-gradient-ice">A-</p>
            <p className="mt-2 text-sm text-muted-foreground">86 / 100 · top 12% of your league</p>
          </div>

          <div className="surface-card space-y-5 rounded-2xl p-6">
            <h2 className="text-lg font-semibold">Category ratings</h2>
            {feedbackCategories.map((c) => (
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