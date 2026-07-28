import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { PageShell } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listPlayers } from "@/lib/players.functions";

const playersQuery = queryOptions({
  queryKey: ["players"],
  queryFn: () => listPlayers(),
});

const title = "Compare Players Side by Side | Hockey Video Analyzer";
const description =
  "Put your hockey stats head-to-head against any player with a comparison table and skill radar chart.";

export const Route = createFileRoute("/compare")({
  loader: ({ context }) => context.queryClient.ensureQueryData(playersQuery),
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
  component: ComparePage,
});

function ComparePage() {
  const { data } = useSuspenseQuery(playersQuery);
  const players = data.players;
  const you = players.find((p) => p.slug === "you") ?? players[0];
  const others = players.filter((p) => p.id !== you?.id);
  const [otherId, setOtherId] = useState<string>(others[0]?.id ?? "");
  const [shown, setShown] = useState<string | null>(others[0]?.id ?? null);
  const other = players.find((p) => p.id === (shown ?? otherId)) ?? others[0];

  const radarData = useMemo(
    () =>
      (you?.radar ?? []).map((r, i) => ({
        metric: r.metric,
        you: r.value,
        other: other?.radar[i]?.value ?? 0,
      })),
    [you, other],
  );

  const statKeys = Object.keys(you?.stats ?? {});

  if (!you || !other) {
    return (
      <PageShell title="Compare" subtitle="You vs. anyone in the league.">
        <p className="text-sm text-muted-foreground">Not enough players to compare yet.</p>
      </PageShell>
    );
  }

  return (
    <PageShell title="Compare" subtitle="You vs. anyone in the league.">
      <div className="surface-card flex flex-wrap items-end gap-4 rounded-2xl p-6">
        <div>
          <p className="text-sm text-muted-foreground">You</p>
          <p className="font-display text-xl font-bold">{you.name}</p>
        </div>
        <p className="pb-1 text-muted-foreground">vs.</p>
        <div className="min-w-56">
          <p className="mb-1 text-sm text-muted-foreground">Player 2</p>
          <Select value={otherId} onValueChange={setOtherId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {others.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setShown(otherId)}>Compare</Button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="surface-card overflow-hidden rounded-2xl">
          <div className="grid grid-cols-3 border-b border-border px-6 py-3 text-sm text-muted-foreground">
            <span>Stat</span>
            <span className="text-center text-ice">{you.name}</span>
            <span className="text-center text-violet-accent">{other.name}</span>
          </div>
          {statKeys.map((k) => (
            <div key={k} className="grid grid-cols-3 border-b border-border/60 px-6 py-3 text-sm last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-center font-medium">{you.stats[k]}</span>
              <span className="text-center font-medium">{other.stats[k]}</span>
            </div>
          ))}
          <div className="grid grid-cols-3 bg-secondary/50 px-6 py-4">
            <span className="text-sm text-muted-foreground">AI Grade</span>
            <span className="text-center font-display text-lg font-bold text-ice">{you.grade}</span>
            <span className="text-center font-display text-lg font-bold text-violet-accent">{other.grade}</span>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Skill radar</h2>
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Radar name={you.name} dataKey="you" stroke="var(--ice)" fill="var(--ice)" fillOpacity={0.3} />
                <Radar
                  name={other.name}
                  dataKey="other"
                  stroke="var(--violet-accent)"
                  fill="var(--violet-accent)"
                  fillOpacity={0.25}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {other.name} · {other.position} · {other.team}
          </p>
        </div>
      </div>
    </PageShell>
  );
}