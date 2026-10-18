import { describe, expect, test } from "bun:test";
import { hasVerifiedIdentity, isVerifiedTime, marksSchema, shiftsSchema, type IdentificationEvidence } from "./player-identification";
const evidence: IdentificationEvidence = { confidence: "high", observedClues: ["Red #17 inside the marked box at 01:00"], uncertainty: "", verifiedIntervals: [{ start: 60, end: 90 }] };
describe("Target player safeguards", () => {
  test("missing identity confirmation never passes", () => expect(hasVerifiedIdentity(undefined, evidence)).toBe(false));
  test("medium confidence never passes", () => expect(hasVerifiedIdentity(true, { ...evidence, confidence: "medium" })).toBe(false));
  test("no observed clues never passes", () => expect(hasVerifiedIdentity(true, { ...evidence, observedClues: [] })).toBe(false));
  test("confirmed no shifts means no player on ice", () => expect(hasVerifiedIdentity(true, evidence, [])).toBe(false));
  test("high confidence with observed evidence passes", () => expect(hasVerifiedIdentity(true, evidence)).toBe(true));
  test("notes outside verified intervals are excluded", () => expect(isVerifiedTime("01:35", evidence)).toBe(false));
  test("notes outside logged shifts are excluded", () => expect(isVerifiedTime("01:10", evidence, [{ start: 75, end: 90 }])).toBe(false));
  test("notes in both windows are retained", () => expect(isVerifiedTime("01:20", evidence, [{ start: 75, end: 90 }])).toBe(true));
  test("shift end is off ice", () => expect(isVerifiedTime("01:30", evidence)).toBe(false));
  test("boxes cannot extend outside the frame", () => expect(marksSchema.safeParse([{ time: 60, x: .9, y: .1, w: .2, h: .2 }]).success).toBe(false));
  test("overlapping shifts are rejected", () => expect(shiftsSchema.safeParse([{ start: 1, end: 10 }, { start: 5, end: 15 }]).success).toBe(false));
});