export type Drill = {
  name: string;
  focus: string;
  reps: string;
  detail: string;
};

const DRILL_BANK: Record<string, Drill[]> = {
  skating: [
    { name: "Tight-turn figure 8s", focus: "Skating & Edges", reps: "4 x 45s", detail: "Cones 10 ft apart, knees bent past the toe cap, inside edge loaded the whole turn." },
    { name: "Explosive 3-stride starts", focus: "Skating & Edges", reps: "8 x 20 ft", detail: "From a dead stop, full extension on the first three strides, walk back to recover." },
  ],
  "puck control": [
    { name: "Toe-drag gauntlet", focus: "Puck Control", reps: "5 x 30s", detail: "Six obstacles, eyes up the entire rep — pull the puck across your body, never stickhandle in front." },
    { name: "Heads-up dangle box", focus: "Puck Control", reps: "4 x 40s", detail: "Handle in a 4x4 ft box while calling out a coach's hand signals to force vision off the puck." },
  ],
  "shot selection": [
    { name: "Catch-and-release circuit", focus: "Shot Selection", reps: "30 pucks", detail: "Pass received off the wall, shoot within 0.5s. Alternate far pad and blocker side." },
    { name: "Off-wing one-timers", focus: "Shot Selection", reps: "3 x 15 pucks", detail: "Weight on the back leg at reception, blade cupped, hit the same quadrant three in a row before moving on." },
  ],
  positioning: [
    { name: "Low-zone box-out reads", focus: "Positioning", reps: "6 x 30s", detail: "Start above the dot, collapse toward the slot as the puck rotates below the goal line. Stick in the weak-side lane." },
    { name: "Net-front stick placement", focus: "Positioning", reps: "5 min", detail: "Body between the man and the puck, stick on the ice pointing at the passer, head on a swivel every two seconds." },
  ],
  "hockey iq": [
    { name: "Delay-entry decision reps", focus: "Hockey IQ", reps: "10 entries", detail: "Attack wide, delay at the top of the circle and pick the late trailer or the seam depending on the D-man's shoulder." },
    { name: "Support-triangle small area", focus: "Hockey IQ", reps: "4 x 90s", detail: "3v3 in the corner; the off-puck players must always form a passing triangle before a shot counts." },
  ],
  compete: [
    { name: "Board battle rotations", focus: "Compete Level", reps: "6 x 20s", detail: "1v1 along the wall, feet moving, second and third effort required to win possession." },
  ],
};

const DEFAULT_DRILLS: Drill[] = [
  ...DRILL_BANK["skating"].slice(0, 1),
  ...DRILL_BANK["puck control"].slice(0, 1),
  ...DRILL_BANK["shot selection"].slice(0, 1),
];

/** Pick drills targeting the lowest-scoring categories from an analysis. */
export function suggestDrills(
  categories: Array<{ name: string; score: number }>,
  limit = 4,
): Drill[] {
  if (!categories.length) return DEFAULT_DRILLS;
  const weakest = [...categories].sort((a, b) => a.score - b.score);
  const picked: Drill[] = [];
  for (const c of weakest) {
    const key = Object.keys(DRILL_BANK).find((k) => c.name.toLowerCase().includes(k));
    if (!key) continue;
    for (const d of DRILL_BANK[key]) {
      if (picked.length < limit && !picked.some((p) => p.name === d.name)) picked.push(d);
    }
    if (picked.length >= limit) break;
  }
  return picked.length ? picked : DEFAULT_DRILLS;
}
