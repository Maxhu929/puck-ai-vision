export type ShotStyle = "quick" | "hybrid" | "power";
export type PlayStance = "upright" | "medium" | "crouched";
export type GearPosition = "forward" | "defense";
export type Handedness = "left" | "right";

export const shotStyles: { key: ShotStyle; label: string; hint: string }[] = [
  { key: "quick", label: "Quick release", hint: "Snap shots, in-tight scoring" },
  { key: "hybrid", label: "Hybrid", hint: "Mix of snap and slap shots" },
  { key: "power", label: "Power shooter", hint: "Heavy slap shots from distance" },
];

export const stances: { key: PlayStance; label: string; hint: string }[] = [
  { key: "upright", label: "Upright", hint: "Tall skating posture" },
  { key: "medium", label: "Medium", hint: "Standard knee bend" },
  { key: "crouched", label: "Deep crouch", hint: "Low, wide skating base" },
];

export type GearInput = {
  heightCm: number;
  hipHeightCm: number;
  weightKg: number;
  position: GearPosition;
  style: ShotStyle;
  stance: PlayStance;
  handedness: Handedness;
};

export type GearSuggestion = {
  kickPoint: { value: string; why: string };
  stickLength: { value: string; why: string };
  flex: { value: string; why: string };
  pattern: { value: string; why: string };
  lie: { value: string; why: string };
};

const cmToIn = (cm: number) => cm / 2.54;

function formatIn(inches: number) {
  const rounded = Math.round(inches * 2) / 2;
  return `${rounded}" (${Math.round(rounded * 2.54)} cm)`;
}

export function suggestGear(input: GearInput): GearSuggestion {
  const { heightCm, hipHeightCm, weightKg, position, style, stance, handedness } = input;

  // Stick length: cut so the butt end sits between navel and chin when off skates.
  // Hip height is the anchor — a shaft roughly 1.55–1.65x hip height puts the
  // knob at chest level on skates.
  const multiplier = stance === "crouched" ? 1.5 : stance === "medium" ? 1.58 : 1.66;
  const lengthIn = cmToIn(hipHeightCm * multiplier);
  const lengthLow = lengthIn - 1;
  const lengthHigh = lengthIn + 1;

  // Flex: ~half body weight in lbs, adjusted for cut length and style.
  const lbs = weightKg * 2.205;
  let flex = lbs / 2;
  if (style === "quick") flex -= 5;
  if (style === "power") flex += 5;
  if (position === "defense") flex += 5;
  if (stance === "crouched") flex -= 3;
  const flexRounded = Math.round(flex / 5) * 5;

  const kickPoint =
    style === "quick"
      ? {
          value: "Low kick",
          why: "Loads and releases fast in tight — best for snap shots off the rush and in the slot.",
        }
      : style === "power"
        ? {
            value: "High / elite kick",
            why: "Stores more energy through a long load, giving heavier slap shots and one-timers from distance.",
          }
        : {
            value: "Mid kick",
            why: "Balanced load point that handles both quick snap shots and full wind-ups.",
          };

  const pattern =
    position === "defense"
      ? {
          value: 'Mid-toe curve, open face, ~5.5" depth (P92 / P28 style)',
          why: "Helps elevate point shots quickly and keeps saucer passes flat through traffic.",
        }
      : style === "quick"
        ? {
            value: "Toe curve, open face (P28 style)",
            why: "Toe-heavy curve favors quick toe-drags, off-the-toe snap shots and in-tight release.",
          }
        : style === "power"
          ? {
              value: "Mid curve, slightly closed face (P90 / P88 style)",
              why: "Flatter mid blade gives a stable face for hard slap shots and accurate wristers.",
            }
          : {
              value: "Mid curve, open face (P92 style)",
              why: "The most versatile pattern — good elevation, puck cradle and backhand control.",
            };

  const lieValue = stance === "crouched" ? "Lie 6" : stance === "medium" ? "Lie 5.5" : "Lie 5";
  const lie = {
    value: lieValue,
    why:
      stance === "crouched"
        ? "A deep crouch and low hands keep the toe up on lower lies — a 6 puts the whole blade flat on the ice."
        : stance === "medium"
          ? "Standard knee bend with hands out front sits flat on a 5.5 — check for even tape wear across the blade."
          : "An upright stance with hands wide keeps the heel down, so a lower lie keeps the blade flush.",
  };

  return {
    kickPoint,
    stickLength: {
      value: `${formatIn(lengthLow)} – ${formatIn(lengthHigh)} shaft`,
      why: `Based on a ${Math.round(hipHeightCm)} cm playing hip height and a ${stances.find((s) => s.key === stance)?.label.toLowerCase()} stance — the knob should reach between the collarbone and chin on skates.`,
    },
    flex: {
      value: `${flexRounded} flex (${handedness === "left" ? "left" : "right"} hand)`,
      why: `About half of ${Math.round(lbs)} lb body weight, adjusted for your ${position} role and shot style. Every 1" cut off the top adds roughly 5 flex.`,
    },
    pattern,
    lie,
  };
}

export function estimateHipHeight(heightCm: number, stance: PlayStance) {
  const seated = heightCm * 0.53; // hip joint at ~53% of standing height
  const bend = stance === "crouched" ? 0.86 : stance === "medium" ? 0.92 : 0.97;
  return Math.round(seated * bend);
}