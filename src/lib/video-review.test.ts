import { test } from "node:test";
import assert from "node:assert/strict";
import { reviewedWindows, approvedWindows, containsTime, coachingNoteSchema } from "./video-review";

test("only explicitly verified on-ice footage is eligible", () => {
  assert.deepEqual(reviewedWindows([], [{ start: 0, end: 40 }]), []);
  assert.deepEqual(reviewedWindows([{ start: 0, end: 30, status: "verified" }], [{ start: 10, end: 20 }]), [{ start: 10, end: 20 }]);
});
test("uncertain, offscreen and wrong identities override verified footage", () => {
  for (const status of ["uncertain", "offscreen", "wrong_player"] as const) {
    assert.deepEqual(reviewedWindows([{ start: 0, end: 30, status: "verified" }, { start: 10, end: 20, status }], [{ start: 0, end: 30 }]), [{ start: 0, end: 10 }, { start: 20, end: 30 }]);
  }
});
test("boxes cannot reconnect through an excluded gap", () => {
  const box = { x: 0.2, y: 0.2, w: 0.1, h: 0.2 };
  const windows = approvedWindows([{ start: 0, end: 20, status: "verified" }, { start: 5, end: 7, status: "uncertain" }], [{ start: 0, end: 20 }], [{ ...box, time: 3 }, { ...box, time: 10 }]);
  assert.equal(containsTime(windows, 6), false);
  assert.equal(containsTime(windows, 8), false);
  assert.equal(containsTime(windows, 10), true);
});
test("no anchors means no approved footage", () => {
  assert.deepEqual(approvedWindows([{ start: 0, end: 20, status: "verified" }], [{ start: 0, end: 20 }], []), []);
});
test("coaching without observable evidence or with uncertain identity is rejected", () => {
  const note = { time: "00:10", tag: "Positioning", type: "improvement", text: "Protect the middle", evidence: "Target leaves the slot", interpretation: "Passing lane opens", suggestion: "Stay inside", confidence: "high", visibility: "visible" };
  assert.equal(coachingNoteSchema.safeParse(note).success, true);
  assert.equal(coachingNoteSchema.safeParse({ ...note, evidence: "" }).success, false);
  assert.equal(coachingNoteSchema.safeParse({ ...note, confidence: "low" }).success, false);
});