import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Crown, MapPin } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { players, type Player } from "@/lib/hockey-data";

const title = "Grade Leaderboard | Hockey Video Analyzer";
const description =
  "See which players rank highest by AI grade, and open a profile to view their team, position, and full stat line.";

export const Route = createFileRoute("/leaderboard")({
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
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const ranked = [...players].sort((a, b) => b.grade - a.grade);
  const podium = [ranked[1], ranked[0], ranked[2]];
  const heights = ["h-24", "h-36", "h-16"];
  const [selected, setSelected] = useState<Player | null>(null);

  return (
    <PageShell title="Grade leaderboard" subtitle="Ranked by AI grade across all analyzed footage.">
      <div className="grid grid-cols-3 items-end gap-4 sm:max-w-xl">
        {podium.map((p, i) => (
          <button key={p.id} onClick={() => setSelected(p)} className="text-center">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="font-display text-lg font-bold text-gold">{p.grade}</p>
            <div
              className={`mt-2 ${heights[i]} rounded-t-xl border border-border`}
              style={{
                background: i === 1 ? "var(--gradient-ice)" : "var(--secondary)",
              }}
            >
              {i === 1 ? <Crown className="mx-auto mt-2 size-6 text-ice-foreground" /> : null}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <ul className="divide-y divide-border overflow-hidden rounded-2xl surface-card">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <button
                onClick={() => setSelected(p)}
                className="flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-secondary/60"
              >
                <span className="w-6 font-display text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {p.position} · {p.team}
                  </p>
                </div>
                <span className="font-display text-lg font-bold text-turf">{p.grade}</span>
              </button>
            </li>
          ))}
        </ul>

        <aside className="surface-card h-fit rounded-2xl p-6">
          {selected ? (
            <>
              <h2 className="text-xl font-bold">{selected.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.position} · {selected.team}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-4" /> {selected.location}
              </p>
              <p className="mt-4 font-display text-4xl font-bold text-gradient-ice">{selected.grade}</p>
              <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                {Object.entries(selected.stats).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Select a player to view their profile.</p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}