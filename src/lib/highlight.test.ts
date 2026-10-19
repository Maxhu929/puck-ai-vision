import { test } from "node:test";
import assert from "node:assert/strict";
import { highlightAt } from "./highlight";

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
