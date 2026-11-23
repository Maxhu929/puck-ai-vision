import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { gearHintsFromClips } from "./clip-gear";
import { parseGearHints } from "./twelvelabs.server";
import type { AnalysisRecord } from "./analysis.functions";

const clip = (shotStyle: string | null, stance: string | null) =>
  ({ status: "ready", metrics: { shotStyle, stance } }) as unknown as AnalysisRecord;

describe("gear hints from clips", () => {
  test("picks the most common shot style", () =>
    assert.deepEqual(gearHintsFromClips([clip("quick", null), clip("quick", null), clip("power", null)]).style, { value: "quick", clips: 2 }));
  test("no shots means no shot-style hint", () =>
    assert.equal(gearHintsFromClips([clip(null, "medium")]).style, null));
  test("rejects unknown values from the AI", () =>
    assert.deepEqual(parseGearHints({ shotStyle: "slapper", stance: "low" }), { shotStyle: null, stance: null }));
});
