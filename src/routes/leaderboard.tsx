import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { loginLeaderboard } from "@/lib/login-days.functions";

const boardQuery = queryOptions({ queryKey: ["login-leaderboard"], queryFn: () => loginLeaderboard() });
const title = "Login Streak Leaderboard | Hockey Video Analyzer";
const description = "See who has shown up the most: players ranked by how many days they've logged on.";

export const Route = createFileRoute("/leaderboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
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
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { data } = useSuspenseQuery(boardQuery);
  return (
    <PageShell title="Leaderboard" subtitle="Ranked by how many days each player has logged on.">
      {data.rows.length === 0 ? (
        <p className="text-muted-foreground">No one yet. Sign in to start your count.</p>
      ) : (
        <ol className="surface-card divide-y divide-border rounded-2xl">
          {data.rows.map((r) => (
            <li key={r.key} className="flex items-center gap-4 px-5 py-3">
              <span className="w-8 font-display text-lg font-bold text-muted-foreground">{r.rank}</span>
              {r.rank === 1 && <Crown className="size-4 text-gold" />}
              <span className="flex-1 font-medium">{r.name}</span>
              <span className="font-display text-lg font-bold">{r.days}</span>
              <span className="text-sm text-muted-foreground">day{r.days === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-4 text-xs text-muted-foreground">One day counts each calendar day (UTC) you open the app signed in.</p>
    </PageShell>
  );
}
