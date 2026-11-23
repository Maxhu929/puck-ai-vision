import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/AppNav";
import { buildNutritionPlan, goals, type GoalKey, type Sex } from "@/lib/nutrition";

const title = "Hockey Game-Day Nutrition & Daily Calories";
const description = "What to eat and drink before and after a hockey game, plus daily calories based on your goal, height and weight.";

export const Route = createFileRoute("/nutrition")({
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
  component: NutritionPage,
});

const before = [
  { when: "3–4 hours before", eat: "Full meal: pasta, rice or potatoes, chicken or fish, some veggies.", drink: "500 ml (2 cups) water." },
  { when: "1–2 hours before", eat: "Light snack: banana, bagel with peanut butter, granola bar.", drink: "250–500 ml water." },
  { when: "15–30 min before", eat: "Optional: a few crackers or half a banana.", drink: "Small sips of water or sports drink." },
];
const during = "Between periods: sip water or a sports drink, about 250 ml each intermission. Orange slices are fine.";
const after = [
  { when: "Within 30–60 min", eat: "Chocolate milk, a protein shake, or yogurt with fruit (protein + carbs).", drink: "About 500–750 ml water for every 0.5 kg (1 lb) you lost sweating." },
  { when: "Within 2 hours", eat: "Real meal: lean protein, rice or pasta, vegetables.", drink: "Keep drinking water until your pee is pale yellow." },
];
const avoid = "Skip before games: greasy fast food, big fizzy drinks, energy drinks, and anything new you haven't tried before.";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-sm"><span className="text-muted-foreground">{label}</span><div className="mt-1">{children}</div></label>;
}
const input = "w-full rounded-md border border-border bg-background p-2";

function NutritionPage() {
  const [ft, setFt] = useState(5);
  const [inch, setInch] = useState(9);
  const [lbs, setLbs] = useState(150);
  const [age, setAge] = useState(16);
  const [sex, setSex] = useState<Sex>("male");
  const [goal, setGoal] = useState<GoalKey>("maintain");
  const heightCm = (ft * 12 + inch) * 2.54;
  const weightKg = lbs * 0.4536;
  const ok = heightCm > 100 && weightKg > 25 && age > 5;
  const train = ok ? buildNutritionPlan({ weightKg, heightCm, age, sex, activity: "practice", goal }) : null;
  const rest = ok ? buildNutritionPlan({ weightKg, heightCm, age, sex, activity: "off", goal }) : null;
  const game = ok ? buildNutritionPlan({ weightKg, heightCm, age, sex, activity: "gameday", goal }) : null;

  return (
    <PageShell title="Nutrition" subtitle="What to eat around games, and how much to eat each day.">
      <section className="surface-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold">Daily calories</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Goal">
            <select className={input} value={goal} onChange={(e) => setGoal(e.target.value as GoalKey)}>
              {goals.map((g) => <option key={g.key} value={g.key}>{g.label} — {g.hint}</option>)}
            </select>
          </Field>
          <Field label="Height">
            <div className="flex gap-2">
              <input type="number" className={input} value={ft} onChange={(e) => setFt(Number(e.target.value))} aria-label="Feet" /><span className="self-center">ft</span>
              <input type="number" className={input} value={inch} onChange={(e) => setInch(Number(e.target.value))} aria-label="Inches" /><span className="self-center">in</span>
            </div>
          </Field>
          <Field label="Weight (lbs)"><input type="number" className={input} value={lbs} onChange={(e) => setLbs(Number(e.target.value))} /></Field>
          <Field label="Age"><input type="number" className={input} value={age} onChange={(e) => setAge(Number(e.target.value))} /></Field>
          <Field label="Sex">
            <select className={input} value={sex} onChange={(e) => setSex(e.target.value as Sex)}><option value="male">Male</option><option value="female">Female</option></select>
          </Field>
        </div>
        {train && rest && game ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[["Rest day", rest], ["Practice day", train], ["Game day", game]].map(([l, p]) => {
              const plan = p as typeof train;
              return (
                <div key={l as string} className="rounded-xl border border-border p-4">
                  <p className="text-sm text-muted-foreground">{l as string}</p>
                  <p className="mt-1 font-display text-3xl font-bold">{plan.calories.toLocaleString()} <span className="text-base font-normal">cal</span></p>
                  <p className="mt-1 text-xs text-muted-foreground">Protein {plan.protein} g · Carbs {plan.carbs} g · Fat {plan.fat} g</p>
                </div>
              );
            })}
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">Enter your height, weight and age.</p>}
        {train && <p className="mt-3 text-sm">Water: about <b>{train.waterLiters} L</b> a day, more on game days.</p>}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold">Before the game</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {before.map((b) => <li key={b.when}><p className="font-medium">{b.when}</p><p>🍽 {b.eat}</p><p className="text-muted-foreground">💧 {b.drink}</p></li>)}
          </ul>
          <p className="mt-4 text-sm"><span className="font-medium">During:</span> {during}</p>
          <p className="mt-2 text-sm text-muted-foreground">{avoid}</p>
        </div>
        <div className="surface-card rounded-2xl p-6">
          <h2 className="text-lg font-semibold">After the game</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {after.map((b) => <li key={b.when}><p className="font-medium">{b.when}</p><p>🍽 {b.eat}</p><p className="text-muted-foreground">💧 {b.drink}</p></li>)}
          </ul>
        </div>
      </section>
      <p className="mt-6 text-xs text-muted-foreground">General guidance for athletes, not medical advice. Talk to a doctor or dietitian about special needs.</p>
    </PageShell>
  );
}
