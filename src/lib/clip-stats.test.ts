import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { gradeToScore, perShift, personalBests, type GradedClip } from "./clip-stats";

const clip = (id: string, grade: string, top: number, dist: number, shifts: number, shot: number | null = null) =>
  ({ id, status: "ready", overallGrade: grade, createdAt: id, shifts: Array.from({ length: shifts }, () => ({ start: 0, end: 1 })),
     metrics: { topSpeedKph: top, avgSpeedKph: 20, distanceCoveredM: dist, shifts, puckTouches: 4, movementNote: "", tendencyNote: "", shotSpeedKph: shot } }) as unknown as GradedClip;

describe("clip stats", () => {
  test("B- maps to 80", () => assert.equal(gradeToScore("B-"), 80));
  test("distance averages per shift, not per clip", () =>
    assert.equal(perShift([clip("a", "B", 30, 100, 1), clip("b", "B", 30, 300, 3)])!.distancePerShift, 100));
  test("best top speed picks the fastest clip", () =>
    assert.equal(personalBests([clip("a", "B", 30, 1, 1), clip("b", "C", 34, 1, 1)]).speed!.id, "b"));
  test("no shots means no hardest-shot best", () =>
    assert.equal(personalBests([clip("a", "B", 30, 1, 1)]).shot, null));
});
