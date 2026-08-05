import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowRight, Ruler, Sparkles } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { listPlayers } from "@/lib/players.functions";
import {
  estimateHipHeight,
  shotStyles,
  stances,
  suggestGear,
  type GearPosition,
  type Handedness,
  type PlayStance,
  type ShotStyle,
} from "@/lib/gear";

const playersQuery = queryOptions({
  queryKey: ["players"],
  queryFn: () => listPlayers(),
});

const title = "Hockey Stick & Gear Fitting Suggestions";
const description =
  "Compare the stick a player uses today with a recommended kick point, shaft length from hip height, blade pattern and lie.";

export const Route = createFileRoute("/gear")({
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
  component: GearPage,
});

const inputClass =
  "w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground outline-none focus:border-ice";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function CompareCard({
  category,
  current,
  onCurrentChange,
  placeholder,
  suggested,
  why,
}: {
  category: string;
  current: string;
  onCurrentChange: (v: string) => void;
  placeholder: string;
  suggested: string;
  why: string;
}) {
  return (
    <div className="surface-card rounded-2xl p-5">
      <h3 className="text-base font-semibold">{category}</h3>
      <div className="mt-4 grid items-stretch gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Currently uses</p>
          <input
            value={current}
            onChange={(e) => onCurrentChange(e.target.value)}
            placeholder={placeholder}
            className="mt-2 w-full bg-transparent font-display text-lg font-semibold text-foreground outline-none placeholder:text-sm placeholder:font-normal placeholder:text-muted-foreground"
          />
        </div>
        <div className="hidden items-center justify-center sm:flex">
          <ArrowRight className="size-5 text-muted-foreground" />
        </div>
        <div className="rounded-xl border border-ice/50 bg-ice/5 p-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ice">
            <Sparkles className="size-3.5" /> Suggested
          </p>
          <p className="mt-2 font-display text-lg font-semibold">{suggested}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{why}</p>
    </div>
  );
}

function GearPage() {
  const { data } = useSuspenseQuery(playersQuery);
  const players = data.players;

  const [slug, setSlug] = useState(players[0]?.slug ?? "");
  const [heightCm, setHeightCm] = useState(183);
  const [weightKg, setWeightKg] = useState(84);
  const [stance, setStance] = useState<PlayStance>("medium");
  const [style, setStyle] = useState<ShotStyle>("hybrid");
  const [position, setPosition] = useState<GearPosition>("forward");
  const [handedness, setHandedness] = useState<Handedness>("left");
  const [autoHip, setAutoHip] = useState(true);
  const [hipHeightCm, setHipHeightCm] = useState(estimateHipHeight(183, "medium"));

  const effectiveHip = autoHip ? estimateHipHeight(heightCm, stance) : hipHeightCm;

  const [currentKick, setCurrentKick] = useState("");
  const [currentLength, setCurrentLength] = useState("");
  const [currentFlex, setCurrentFlex] = useState("");
  const [currentPattern, setCurrentPattern] = useState("");
  const [currentLie, setCurrentLie] = useState("");

  const gear = useMemo(
    () =>
      suggestGear({
        heightCm,
        hipHeightCm: effectiveHip,
        weightKg,
        position,
        style,
        stance,
        handedness,
      }),
    [heightCm, effectiveHip, weightKg, position, style, stance, handedness],
  );

  const player = players.find((p) => p.slug === slug) ?? null;

  return (
    <PageShell
      title="Gear fitting"
      subtitle="Match the stick a player uses today against a fit built from their body, stance and shooting style."
    >
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="surface-card h-fit rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Player measurements</h2>
          <div className="mt-5 space-y-4">
            {players.length > 0 ? (
              <Field label="Player">
                <select className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)}>
                  {players.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name} — {p.position || "Player"}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Height (cm)">
                <input
                  type="number"
                  className={inputClass}
                  value={heightCm}
                  onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  type="number"
                  className={inputClass}
                  value={weightKg}
                  onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                />
              </Field>
            </div>

            <Field label="Playing stance">
              <select
                className={inputClass}
                value={stance}
                onChange={(e) => setStance(e.target.value as PlayStance)}
              >
                {stances.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
            </Field>

            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Ruler className="size-4 text-ice" /> Hip height in stance
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (autoHip) setHipHeightCm(estimateHipHeight(heightCm, stance));
                    setAutoHip(!autoHip);
                  }}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {autoHip ? "Enter measured" : "Use estimate"}
                </button>
              </div>
              {autoHip ? (
                <p className="mt-2 font-display text-2xl font-bold">
                  {effectiveHip} cm
                  <span className="ml-2 text-xs font-normal text-muted-foreground">estimated from height + stance</span>
                </p>
              ) : (
                <input
                  type="number"
                  className={`${inputClass} mt-2`}
                  value={hipHeightCm}
                  onChange={(e) => setHipHeightCm(Number(e.target.value) || 0)}
                />
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Measure floor-to-hip while the player is in their normal skating crouch for the most accurate cut.
              </p>
            </div>

            <Field label="Shooting style">
              <select className={inputClass} value={style} onChange={(e) => setStyle(e.target.value as ShotStyle)}>
                {shotStyles.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label} — {s.hint}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Position">
                <select
                  className={inputClass}
                  value={position}
                  onChange={(e) => setPosition(e.target.value as GearPosition)}
                >
                  <option value="forward">Forward</option>
                  <option value="defense">Defense</option>
                </select>
              </Field>
              <Field label="Handedness">
                <select
                  className={inputClass}
                  value={handedness}
                  onChange={(e) => setHandedness(e.target.value as Handedness)}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Fill the left box with what {player ? player.name : "the player"} uses today — the right box is the fit we
            recommend.
          </p>

          <CompareCard
            category="Kick point"
            current={currentKick}
            onCurrentChange={setCurrentKick}
            placeholder="e.g. Mid kick"
            suggested={gear.kickPoint.value}
            why={gear.kickPoint.why}
          />
          <CompareCard
            category="Stick length"
            current={currentLength}
            onCurrentChange={setCurrentLength}
            placeholder="e.g. 60 in uncut"
            suggested={gear.stickLength.value}
            why={gear.stickLength.why}
          />
          <CompareCard
            category="Flex"
            current={currentFlex}
            onCurrentChange={setCurrentFlex}
            placeholder="e.g. 85 flex"
            suggested={gear.flex.value}
            why={gear.flex.why}
          />
          <CompareCard
            category="Blade pattern"
            current={currentPattern}
            onCurrentChange={setCurrentPattern}
            placeholder="e.g. P92"
            suggested={gear.pattern.value}
            why={gear.pattern.why}
          />
          <CompareCard
            category="Lie"
            current={currentLie}
            onCurrentChange={setCurrentLie}
            placeholder="e.g. Lie 5"
            suggested={gear.lie.value}
            why={gear.lie.why}
          />

          <p className="text-xs text-muted-foreground">
            Fitting guidance only — confirm lie by checking tape wear across the blade after a few skates, and try a
            demo stick before committing.
          </p>
        </div>
      </div>
    </PageShell>
  );
}