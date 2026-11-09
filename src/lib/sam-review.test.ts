import { test } from "node:test";
import assert from "node:assert/strict";
import { coachingWindows, samHighlightAt, samReviewSchema } from "./sam-review";

const box = { x: 0.2, y: 0.2, w: 0.1, h: 0.2 };
const review = { trialId: "bb6caf12-c791-4e90-acfd-21f2232139d9", fps: 30, clipStart: 10, clipEnd: 11,
  frames: Array.from({ length: 30 }, (_, frame) => ({ ...box, frame, time: 10 + frame / 30, area: 0.02, lost: frame === 15 })) };
test("SAM 2 uses original timestamps and hides lost frames without reconnecting", () => {
  assert.equal(samHighlightAt(review, 10)?.x, 0.2);
  assert.equal(samHighlightAt(review, 10.5), null);
  assert.equal(samHighlightAt(review, 9), null);
  assert.equal(samHighlightAt(review, 11), null);
});
test("SAM 2 never expands manual eligibility or includes excluded footage", () => {
  const windows = coachingWindows([{ start: 0, end: 20, status: "verified" }, { start: 10.2, end: 10.4, status: "wrong_player" }], [{ start: 0, end: 20 }], [{ ...box, time: 10 }, { ...box, time: 10.6 }], review);
  assert.ok(windows.length > 0);
  assert.ok(windows.every(w => w.start >= 10 && w.end <= 11));
  assert.equal(windows.some(w => w.start <= 10.3 && w.end > 10.3), false);
  assert.equal(windows.some(w => w.start <= 10.5 && w.end > 10.5), false);
  assert.deepEqual(coachingWindows([{ start: 0, end: 20, status: "verified" }], [{ start: 0, end: 20 }], [], review), []);
});
test("review snapshots reject malformed boxes, unsorted frames and timestamp shifts", () => {
  assert.equal(samReviewSchema.safeParse(review).success, true);
  assert.equal(samReviewSchema.safeParse({ ...review, frames: [{ ...review.frames[0], x: 0.99 }] }).success, false);
  assert.equal(samReviewSchema.safeParse({ ...review, frames: [...review.frames].reverse() }).success, false);
  assert.equal(samReviewSchema.safeParse({ ...review, frames: [{ ...review.frames[0], time: 10.7 }] }).success, false);
});