import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { UploadCloud, Film, Sparkles } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { recentSubmissions } from "@/lib/hockey-data";

const title = "Upload Game Footage | Hockey Video Analyzer";
const description =
  "Drop in a shift, a period, or a full hockey game and let the AI break down every play with grades and timestamped notes.";

export const Route = createFileRoute("/upload")({
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
  component: UploadPage,
});

function UploadPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  function simulate(name: string) {
    setFileName(name);
    setProgress(8);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          return 100;
        }
        return p + 6;
      });
    }, 160);
  }

  return (
    <PageShell title="Upload" subtitle="Add game footage and the AI will grade every shift.">
      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <label
            htmlFor="video"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) simulate(f.name);
            }}
            className="surface-card flex cursor-pointer flex-col items-center justify-center rounded-2xl border-dashed px-6 py-20 text-center transition-colors hover:border-ice"
          >
            <UploadCloud className="size-10 text-ice" strokeWidth={1.75} />
            <span className="mt-5 text-lg font-semibold">Drop your video here</span>
            <span className="mt-1 text-sm text-muted-foreground">MP4, MOV or HEVC — up to 4 GB per game</span>
            <input
              id="video"
              type="file"
              accept="video/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) simulate(f.name);
              }}
            />
          </label>

          {fileName ? (
            <div className="surface-card rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <Film className="size-5 text-turf" />
                <span className="truncate font-medium">{fileName}</span>
                <span className="ml-auto text-sm text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="mt-4" />
              {progress >= 100 ? (
                <div className="mt-5 flex items-center gap-3">
                  <Sparkles className="size-4 text-gold" />
                  <p className="text-sm text-muted-foreground">Analysis complete — 42 plays detected.</p>
                  <Button asChild size="sm" className="ml-auto">
                    <Link to="/feedback">See AI feedback</Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="surface-card grid gap-5 rounded-2xl p-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="game">Game or session</Label>
              <Input id="game" placeholder="Bantam AA vs. Northside" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jersey">Your jersey number</Label>
              <Input id="jersey" placeholder="17" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="focus">What should the AI focus on?</Label>
              <Input id="focus" placeholder="Zone entries, defensive positioning, shot selection…" />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <h2 className="text-lg font-semibold">Recent submissions</h2>
          <ul className="space-y-3">
            {recentSubmissions.map((s) => (
              <li key={s.id} className="surface-card rounded-xl px-5 py-4">
                <p className="truncate font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.date} · {s.duration}
                </p>
                <p className="mt-2 font-display text-lg font-bold text-turf">{s.grade}</p>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </PageShell>
  );
}