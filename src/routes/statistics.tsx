import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  Line,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageShell } from "@/components/AppNav";
import { keyStats, shiftTrend, shotHeatMap } from "@/lib/hockey-data";
import { listPlayerGames } from "@/lib/players.functions";

const gamesQuery = queryOptions({
  queryKey: ["player-games"],
  queryFn: () => listPlayerGames(),
});

const title = "Advanced Hockey Statistics & Shot Heat Map";
const description =
  "Key performance metrics, grade trends over the season, and a shot heat map generated from your analyzed game film.";

export const Route = createFileRoute("/statistics")({
  loader: ({ context }) => context.queryClient.ensureQueryData(gamesQuery),
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
  component: StatisticsPage,
});

function StatisticsPage() {
  const { data } = useSuspenseQuery(gamesQuery);
  const trend = data.games.length > 0 ? data.games : shiftTrend;
  return (
    <PageShell title="Advanced statistics" subtitle="Everything the AI measured across your last six games.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {keyStats.map((s) => (
          <div key={s.label} className="surface-card rounded-xl px-5 py-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 font-display text-2xl font-bold">{s.value}</p>
            <p className={`mt-1 text-xs ${s.delta.startsWith("-") ? "text-destructive" : "text-turf"}`}>
              {s.delta} vs. last game
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <div className="surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Grade trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="game" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <YAxis domain={[60, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Line type="monotone" dataKey="grade" stroke="var(--ice)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Shot heat map</h2>
          <p className="mt-1 text-sm text-muted-foreground">Attempt density in the offensive zone.</p>
          <div className="mt-5 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-10 gap-px bg-border">
              {shotHeatMap.flatMap((row, r) =>
                row.map((v, c) => (
                  <div
                    key={`${r}-${c}`}
                    title={`${v} attempts`}
                    className="aspect-square"
                    style={{
                      background: `color-mix(in oklch, var(--gold) ${v}%, var(--card))`,
                    }}
                  />
                )),
              )}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span>Low</span>
            <div
              className="h-2 flex-1 rounded-full"
              style={{ background: "linear-gradient(90deg, var(--card), var(--gold))" }}
            />
            <span>High</span>
          </div>
        </div>
      </div>
    </PageShell>
  );
}