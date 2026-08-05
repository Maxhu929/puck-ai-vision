export type Sex = "male" | "female";
export type ActivityKey = "off" | "light" | "practice" | "double" | "gameday";
export type GoalKey = "cut" | "maintain" | "gain";

export const activityLevels: { key: ActivityKey; label: string; factor: number; hint: string }[] = [
  { key: "off", label: "Off-day", factor: 1.35, hint: "Recovery, light movement" },
  { key: "light", label: "Light training", factor: 1.5, hint: "Skills session or gym" },
  { key: "practice", label: "Full practice", factor: 1.725, hint: "On-ice practice + lifting" },
  { key: "double", label: "Two-a-day", factor: 1.9, hint: "Ice + gym in the same day" },
  { key: "gameday", label: "Game day", factor: 2.0, hint: "Warmup, game, cooldown" },
];

export const goals: { key: GoalKey; label: string; adjust: number; protein: number; hint: string }[] = [
  { key: "cut", label: "Lean out", adjust: -0.15, protein: 2.2, hint: "Drop body fat, hold strength" },
  { key: "maintain", label: "Maintain", adjust: 0, protein: 1.9, hint: "Fuel the current schedule" },
  { key: "gain", label: "Add mass", adjust: 0.12, protein: 2.0, hint: "Build strength and size" },
];

export type NutritionInput = {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
  activity: ActivityKey;
  goal: GoalKey;
};

export type NutritionPlan = {
  bmr: number;
  tdee: number;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  waterLiters: number;
  preGameCarbs: number;
  postGameProtein: number;
};

export function buildNutritionPlan(input: NutritionInput): NutritionPlan {
  const { weightKg, heightCm, age, sex } = input;
  const activity = activityLevels.find((a) => a.key === input.activity) ?? activityLevels[2];
  const goal = goals.find((g) => g.key === input.goal) ?? goals[1];

  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "male" ? 5 : -161);
  const tdee = bmr * activity.factor;
  const calories = tdee * (1 + goal.adjust);

  const protein = goal.protein * weightKg;
  const fat = (calories * 0.25) / 9;
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    calories: Math.round(calories),
    protein: Math.round(protein),
    fat: Math.round(fat),
    carbs: Math.round(carbs),
    waterLiters: Math.round(weightKg * 0.045 * 10) / 10,
    preGameCarbs: Math.round(weightKg * 1.5),
    postGameProtein: Math.round(weightKg * 0.4),
  };
}

export function mealSplit(plan: NutritionPlan) {
  const meals = [
    { name: "Breakfast", share: 0.25 },
    { name: "Lunch", share: 0.3 },
    { name: "Pre-ice snack", share: 0.1 },
    { name: "Dinner", share: 0.25 },
    { name: "Recovery snack", share: 0.1 },
  ];
  return meals.map((m) => ({
    name: m.name,
    calories: Math.round(plan.calories * m.share),
    protein: Math.round(plan.protein * m.share),
    carbs: Math.round(plan.carbs * m.share),
    fat: Math.round(plan.fat * m.share),
  }));
}