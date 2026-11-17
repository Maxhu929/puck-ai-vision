import { test } from "node:test";
import assert from "node:assert/strict";
import { highlightAt, lostStretches, histogramSimilarity, colorHistogram } from "./highlight";

const a = { time: 10, x: 0.1, y: 0.1, w: 0.1, h: 0.2 };
const b = { time: 20, x: 0.3, y: 0.1, w: 0.1, h: 0.2 };

test("marker glides between boxes up to 12 seconds apart", () => {
  assert.ok(Math.abs(highlightAt([a, b], [], 15)!.x - 0.2) < 1e-9);
});

test("marker is hidden across gaps longer than 12 seconds", () => {
  assert.equal(highlightAt([a, { ...b, time: 30 }], [], 20), null);
});

test("marker is hidden outside logged shifts", () => {
  assert.equal(highlightAt([a, b], [{ start: 0, end: 12 }], 15), null);
});

test("lone box shows only within 1.5 seconds", () => {
  assert.ok(highlightAt([a], [], 11));
  assert.equal(highlightAt([a], [], 12), null);
});

test("flags a box mismatch that lasts long enough", () => {
  const s = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((time, i) => ({ time, similarity: i >= 1 ? 0.2 : 0.9 }));
  assert.deepEqual(lostStretches(s), [0.1]);
});
test("ignores a brief blip", () => {
  const s = [0, 0.1, 0.2, 0.3].map((time, i) => ({ time, similarity: i === 1 ? 0.2 : 0.9 }));
  assert.deepEqual(lostStretches(s), []);
});
test("empty ice looks different from a dark jersey", () => {
  const ice = colorHistogram(new Uint8ClampedArray(Array(40).fill([250, 250, 250, 255]).flat()));
  const jersey = colorHistogram(new Uint8ClampedArray(Array(40).fill([20, 20, 120, 255]).flat()));
  assert.ok(histogramSimilarity(ice, jersey) < 0.6);
  assert.ok(Math.abs(histogramSimilarity(ice, ice) - 1) < 1e-6);
});
