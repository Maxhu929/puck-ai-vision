import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { hasVerifiedIdentity, isVerifiedTime, marksSchema, shiftsSchema, type IdentificationEvidence } from "./player-identification";
const evidence: IdentificationEvidence = { confidence: "high", observedClues: ["Red #17 inside the marked box at 01:00"], uncertainty: "", verifiedIntervals: [{ start: 60, end: 90 }] };
describe("Target player safeguards", () => {
  test("missing identity confirmation never passes", () => assert.equal(hasVerifiedIdentity(undefined, evidence), false));
  test("medium confidence never passes", () => assert.equal(hasVerifiedIdentity(true, { ...evidence, confidence: "medium" }), false));
  test("no observed clues never passes", () => assert.equal(hasVerifiedIdentity(true, { ...evidence, observedClues: [] }), false));
  test("confirmed no shifts means no player on ice", () => assert.equal(hasVerifiedIdentity(true, evidence, []), false));
  test("high confidence with observed evidence passes", () => assert.equal(hasVerifiedIdentity(true, evidence), true));
  test("notes outside verified intervals are excluded", () => assert.equal(isVerifiedTime("01:35", evidence), false));
  test("notes outside logged shifts are excluded", () => assert.equal(isVerifiedTime("01:10", evidence, [{ start: 75, end: 90 }]), false));
  test("notes in both windows are retained", () => assert.equal(isVerifiedTime("01:20", evidence, [{ start: 75, end: 90 }]), true));
  test("shift end is off ice", () => assert.equal(isVerifiedTime("01:30", evidence), false));
  test("boxes cannot extend outside the frame", () => assert.equal(marksSchema.safeParse([{ time: 60, x: .9, y: .1, w: .2, h: .2 }]).success, false));
  test("overlapping shifts are rejected", () => assert.equal(shiftsSchema.safeParse([{ start: 1, end: 10 }, { start: 5, end: 15 }]).success, false));
});