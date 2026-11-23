import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { percentOf, toKph } from "./nhl-benchmarks";
import { parseShot } from "./twelvelabs.server";

describe("NHL compare", () => {
  test("converts 22.1 mph to 35.6 km/h", () => assert.equal(toKph(22.1), 35.6));
  test("no shot gives no percent", () => assert.equal(percentOf(null, 84.3), null));
  test("percent of NHL value", () => assert.equal(percentOf(50, 100), 50));
  test("shot fields stay empty when the player didn't shoot", () =>
    assert.deepEqual(parseShot({ shotSpeedKph: null, shotTechniqueScore: 0 }), { shotSpeedKph: null, shotTechniqueScore: null, shotTechniqueNote: null }));
  test("keeps a real shot", () => assert.equal(parseShot({ shotSpeedKph: 90, shotTechniqueScore: 70 }).shotSpeedKph, 90));
});
