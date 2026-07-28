import { createFileRoute, Link } from "@tanstack/react-router";
import { Upload, MessageSquare, GitCompare, BarChart3, Trophy } from "lucide-react";
import heroImage from "@/assets/hockey-hero.jpg";
import { AppNav } from "@/components/AppNav";
import { recentSubmissions } from "@/lib/hockey-data";

const title = "Hockey Video Analyzer — AI Game Film Breakdown";
const description =
  "Upload hockey game footage and get AI feedback, per-shift grades, side-by-side player comparison, shot heat maps, and advanced statistics.";

export const Route = createFileRoute("/")({
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
  component: Index,
});

const stats = [
  { value: "2,847", label: "Plays Analyzed", className: "text-ice" },
  { value: "156", label: "Teams Using", className: "text-turf" },
  { value: "94%", label: "Accuracy Rate", className: "text-violet-accent" },
];

const tiles = [
  { to: "/upload", icon: Upload, title: "Upload", desc: "Add game footage", className: "text-ice" },
  { to: "/feedback", icon: MessageSquare, title: "Feedback", desc: "Review & annotate", className: "text-turf" },
  { to: "/compare", icon: GitCompare, title: "Compare", desc: "Side-by-side analysis", className: "text-violet-accent" },
  { to: "/statistics", icon: BarChart3, title: "Statistics", desc: "Performance metrics", className: "text-gold" },
] as const;

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <AppNav />

      <section className="relative isolate overflow-hidden">
        <img
          src={heroImage}
          alt="Hockey player on the ice in dim arena lighting"
          width={1920}
          height={1088}
          className="absolute inset-0 -z-10 size-full object-cover opacity-45"
        />
        <div
          className="absolute inset-0 -z-10"
          style={{ background: "var(--gradient-hero)" }}
          aria-hidden="true"
        />

        <div className="mx-auto max-w-6xl px-5 pt-24 pb-16 text-center sm:pt-32">
          <h1 className="text-5xl font-bold sm:text-7xl">Hockey Video Analyzer</h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Play smarter, not harder — analyze every shift
          </p>

          <div className="mt-12 flex flex-wrap justify-center gap-4">
            {stats.map((s) => (
              <div key={s.label} className="surface-card w-40 rounded-xl px-6 py-5">
                <div className={`font-display text-2xl font-bold ${s.className}`}>{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="surface-card group rounded-2xl px-6 py-10 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-glow)]"
              >
                <t.icon className={`mx-auto size-9 ${t.className}`} strokeWidth={1.75} />
                <h2 className="mt-6 text-lg font-semibold">{t.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-bold">Recent submissions</h2>
          <Link to="/leaderboard" className="inline-flex items-center gap-2 text-sm text-ice hover:underline">
            <Trophy className="size-4" /> Grade leaderboard
          </Link>
        </div>
        <ul className="mt-5 divide-y divide-border overflow-hidden rounded-2xl surface-card">
          {recentSubmissions.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-6 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{s.title}</p>
                <p className="text-sm text-muted-foreground">
                  {s.date} · {s.duration} · {s.status}
                </p>
              </div>
              <span className="font-display text-xl font-bold text-turf">{s.grade}</span>
              <Link to="/feedback" search={{ id: undefined }} className="text-sm text-ice hover:underline">
                View feedback
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
