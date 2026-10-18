import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { consistentMotion } from "./player-tracker";

describe("Arrow motion safeguards", () => {
  test("follows coherent player motion", () => assert.deepEqual(consistentMotion(Array.from({ length: 6 }, () => ({ dx: 3, dy: -2 })))?.dx, 3));
  test("stops when fewer than four features remain", () => assert.equal(consistentMotion([{ dx: 1, dy: 1 }]), null));
  test("stops for inconsistent motion", () => assert.equal(consistentMotion([{ dx: -20, dy: 0 }, { dx: -10, dy: 10 }, { dx: 0, dy: 20 }, { dx: 10, dy: 30 }, { dx: 20, dy: 40 }]), null));
});