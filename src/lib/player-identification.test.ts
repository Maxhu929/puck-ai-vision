import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { boxCheckpoints, hasVerifiedIdentity, isVerifiedTime, marksSchema, nextCrossedCheckpoint, unboxedCheckpointAt, shiftsSchema, type IdentificationEvidence } from "./player-identification";
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
  test("a new box is required every 1 second", () => assert.deepEqual(boxCheckpoints([{ start: 0, end: 5 }], []).map(c => c.time), [0, 1, 2, 3, 4]));
  test("one box cannot cover adjacent one-second checkpoints", () => assert.deepEqual(boxCheckpoints([{ start: 0, end: 3 }], [{ time: 1 }]).map(c => c.covered), [false, true, false]));
  test("a box near its checkpoint covers only that moment", () => assert.deepEqual(boxCheckpoints([{ start: 0, end: 3 }], [{ time: 1.05 }]).map(c => c.covered), [false, true, false]));
  test("fractional shifts keep one-second spacing through the last second", () => assert.deepEqual(boxCheckpoints([{ start: 0.514, end: 3.55 }], []).map(c => c.time), [0.514, 1.514, 2.514, 3.514]));
  test("a very short shift still needs a start box", () => assert.deepEqual(boxCheckpoints([{ start: 5, end: 6 }], []).map(c => c.time), [5]));
});

describe("Playback pausing at unboxed checkpoints", () => {
  const cps = boxCheckpoints([{ start: 0, end: 25 }], [{ time: 0 }]);
  test("pauses after one second when the next box is missing", () => assert.equal(nextCrossedCheckpoint(cps, 0.8, 1.2)?.time, 1));
  test("an already boxed checkpoint never pauses", () => assert.equal(nextCrossedCheckpoint(cps, -0.5, 0.5), undefined));
  test("pressing play while sitting on an unboxed checkpoint still stops for a box", () => assert.equal(unboxedCheckpointAt(cps, 10.2)?.time, 10));
  test("pressing play away from a checkpoint never stops", () => assert.equal(unboxedCheckpointAt(cps, 12.5), undefined));
  test("scrubbing backwards never pauses", () => assert.equal(nextCrossedCheckpoint(cps, 20, 10), undefined));
  test("the earliest missed checkpoint wins when two are crossed at once", () => assert.equal(nextCrossedCheckpoint(cps, 9, 21)?.time, 10));
  test("nothing pauses after the last checkpoint", () => assert.equal(nextCrossedCheckpoint(cps, 24.5, 24.9), undefined));
});