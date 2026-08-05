import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Apple, Droplets, Flame } from "lucide-react";
import { PageShell } from "@/components/AppNav";
import { listPlayers } from "@/lib/players.functions";
import {
  activityLevels,
  buildNutritionPlan,
  goals,
  mealSplit,
  type ActivityKey,
  type GoalKey,
  type Sex,
} from "@/lib/nutrition";

const playersQuery = queryOptions({
  queryKey: ["players"],
  queryFn: () => listPlayers(),
});

const title = "Player Nutrition Plan | Calories & Macros";
const description =
  "Get a per-player daily calorie target and protein, carb and fat macro split tuned to training load, game days and body-composition goals.";

export const Route = createFileRoute("/nutrition")({
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
  component: NutritionPage,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground outline-none focus:border-ice";

function NutritionPage() {
  const { data } = useSuspenseQuery(playersQuery);
  const players = data.players;

  const [slug, setSlug] = useState(players[0]?.slug ?? "");
  const [weightKg, setWeightKg] = useState(84);
  const [heightCm, setHeightCm] = useState(183);
  const [age, setAge] = useState(19);
  const [sex, setSex] = useState<Sex>("male");
  const [activity, setActivity] = useState<ActivityKey>("practice");
  const [goal, setGoal] = useState<GoalKey>("maintain");

  const player = players.find((p) => p.slug === slug) ?? null;
  const plan = useMemo(
    () => buildNutritionPlan({ weightKg, heightCm, age, sex, activity, goal }),
    [weightKg, heightCm, age, sex, activity, goal],
  );
  const meals = useMemo(() => mealSplit(plan), [plan]);

  const macroCards = [
    { label: "Protein", grams: plan.protein, kcal: plan.protein * 4, color: "var(--ice)" },
    { label: "Carbs", grams: plan.carbs, kcal: plan.carbs * 4, color: "var(--gold)" },
    { label: "Fat", grams: plan.fat, kcal: plan.fat * 9, color: "var(--turf)" },
  ];

  return (
    <PageShell
      title="Nutrition plan"
      subtitle="Daily calories and macros tuned to each player's body, training load and goal."
    >
      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Player profile</h2>
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
              <Field label="Weight (kg)">
                <input
                  type="number"
                  className={inputClass}
                  value={weightKg}
                  min={30}
                  max={160}
                  onChange={(e) => setWeightKg(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Height (cm)">
                <input
                  type="number"
                  className={inputClass}
                  value={heightCm}
                  min={120}
                  max={220}
                  onChange={(e) => setHeightCm(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Age">
                <input
                  type="number"
                  className={inputClass}
                  value={age}
                  min={10}
                  max={60}
                  onChange={(e) => setAge(Number(e.target.value) || 0)}
                />
              </Field>
              <Field label="Sex">
                <select className={inputClass} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </Field>
            </div>

            <Field label="Training day">
              <select
                className={inputClass}
                value={activity}
                onChange={(e) => setActivity(e.target.value as ActivityKey)}
              >
                {activityLevels.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label} — {a.hint}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Goal">
              <div className="grid grid-cols-3 gap-2">
                {goals.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    onClick={() => setGoal(g.key)}
                    className={`rounded-lg border px-2 py-2 text-xs transition-colors ${
                      goal === g.key
                        ? "border-ice bg-secondary text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </Field>
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card rounded-2xl p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Daily target{player ? ` for ${player.name}` : ""}
                </p>
                <p className="mt-1 flex items-center gap-2 font-display text-4xl font-bold">
                  <Flame className="size-7 text-gold" />
                  {plan.calories.toLocaleString()} kcal
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>BMR {plan.bmr.toLocaleString()} kcal</p>
                <p>Maintenance {plan.tdee.toLocaleString()} kcal</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {macroCards.map((m) => (
                <div key={m.label} className="rounded-xl border border-border px-4 py-3">
                  <p className="text-sm text-muted-foreground">{m.label}</p>
                  <p className="mt-1 font-display text-2xl font-bold">{m.grams} g</p>
                  <div className="mt-2 h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((m.kcal / Math.max(plan.calories, 1)) * 100)}%`,
                        background: m.color,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round((m.kcal / Math.max(plan.calories, 1)) * 100)}% of calories
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="surface-card rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Apple className="size-5 text-turf" /> Meal split
              </h2>
              <ul className="mt-4 space-y-3 text-sm">
                {meals.map((m) => (
                  <li key={m.name} className="flex items-center justify-between gap-3">
                    <span>{m.name}</span>
                    <span className="text-muted-foreground">
                      {m.calories} kcal · {m.protein}P / {m.carbs}C / {m.fat}F
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="surface-card rounded-2xl p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Droplets className="size-5 text-ice" /> Game-day timing
              </h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>
                  <span className="text-foreground">3–4 h before puck drop:</span> {plan.preGameCarbs} g carbs with
                  lean protein and low fat.
                </li>
                <li>
                  <span className="text-foreground">Within 30 min after:</span> {plan.postGameProtein} g protein plus
                  fast carbs to reload glycogen.
                </li>
                <li>
                  <span className="text-foreground">Hydration:</span> ~{plan.waterLiters} L water per day, more with
                  two-a-days, plus electrolytes on game days.
                </li>
              </ul>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Estimates use the Mifflin-St Jeor equation and sports-nutrition ranges for hockey athletes. They are
            guidance, not medical advice — check with a dietitian for individual needs.
          </p>
        </div>
      </div>
    </PageShell>
  );
}