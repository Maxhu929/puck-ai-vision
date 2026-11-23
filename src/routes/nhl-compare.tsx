import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { PageShell } from "@/components/AppNav";
import { listAnalyses } from "@/lib/analysis.functions";
import { NHL_SOURCE, nhlPlayers, percentOf, toKph } from "@/lib/nhl-benchmarks";

const analysesQuery = queryOptions({ queryKey: ["analyses"], queryFn: () => listAnalyses() });
const title = "You vs. the NHL | Skating & Shot Speed Compare";
const description = "Compare your clip's skating speed, shot speed and shot technique against real NHL EDGE tracking numbers.";

export const Route = createFileRoute("/nhl-compare")({
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
  component: NhlCompare,
});

function Bar({ label, yours, nhl, unit }: { label: string; yours: number | null | undefined; nhl: number | null; unit: string }) {
  const pct = percentOf(yours, nhl);
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{pct == null ? "—" : `${pct}% of NHL`}</span></div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <div><div className="text-muted-foreground">You</div><div className="text-lg font-semibold">{yours && yours > 0 ? `${yours} ${unit}` : "No data"}</div></div>
        <div><div className="text-muted-foreground">NHL</div><div className="text-lg font-semibold">{nhl ? `${nhl} ${unit}` : "Not listed"}</div></div>
      </div>
      {pct != null && <div className="mt-3 h-2 rounded bg-secondary"><div className="h-2 rounded bg-primary" style={{ width: `${Math.min(100, pct)}%` }} /></div>}
    </div>
  );
}

function NhlCompare() {
  const analyses = useQuery(analysesQuery);
  const clips = (analyses.data?.items ?? []).filter((a) => a.status === "ready" && a.metrics);
  const [clipId, setClipId] = useState<string>("");
  const [pro, setPro] = useState(0);
  const clip = clips.find((c) => c.id === clipId) ?? clips[0];
  const nhl = nhlPlayers[pro]!;
  const m = clip?.metrics;
  const nhlSkate = nhl.skateMph == null ? null : toKph(nhl.skateMph);
  const nhlShot = nhl.shotMph == null ? null : toKph(nhl.shotMph);
  const hasShot = useMemo(() => !!(m?.shotSpeedKph || m?.shotTechniqueScore), [m]);

  return (
    <PageShell title="You vs. the NHL" subtitle="Your graded clip next to real NHL tracking numbers.">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Your clip
          <select className="mt-1 w-full rounded-md border border-border bg-background p-2" value={clip?.id ?? ""} onChange={(e) => setClipId(e.target.value)}>
            {clips.length === 0 && <option value="">No graded clips yet</option>}
            {clips.map((c) => <option key={c.id} value={c.id}>{c.playerName} — {c.fileName ?? new Date(c.createdAt).toLocaleDateString()}</option>)}
          </select>
        </label>
        <label className="text-sm">NHL player
          <select className="mt-1 w-full rounded-md border border-border bg-background p-2" value={pro} onChange={(e) => setPro(Number(e.target.value))}>
            {nhlPlayers.map((p, i) => <option key={p.name} value={i}>{p.name} ({p.team}, {p.position})</option>)}
          </select>
        </label>
      </div>
      {analyses.isLoading ? <p className="mt-6 text-muted-foreground">Loading clips…</p> : !m ? (
        <p className="mt-6 text-muted-foreground">Get a clip graded on the Feedback page first, then come back here.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Bar label="Top skating speed" yours={m.topSpeedKph} nhl={nhlSkate} unit="km/h" />
          {hasShot ? (
            <>
              <Bar label="Shot speed" yours={m.shotSpeedKph} nhl={nhlShot} unit="km/h" />
              <div className="rounded-lg border border-border bg-card p-4 sm:col-span-2">
                <div className="text-sm font-medium">Shot technique {m.shotTechniqueScore ? `· ${m.shotTechniqueScore}/100` : ""}</div>
                <p className="mt-1 text-sm text-muted-foreground">{m.shotTechniqueNote ?? "No technique note."}</p>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No shot in this clip, so shot speed and technique are left out.</div>
          )}
        </div>
      )}
      <p className="mt-6 text-xs text-muted-foreground">Your numbers are AI estimates from video. NHL numbers: {NHL_SOURCE}.</p>
    </PageShell>
  );
}
