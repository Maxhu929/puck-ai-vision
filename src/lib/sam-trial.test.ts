import { describe, expect, it } from "vitest";
import {
  boxToPixels,
  pixelsToBox,
  frameToTime,
  checkpointTimes,
  computeMetrics,
  emptyLabels,
  passesBar,
  CHECKPOINT_INTERVAL_SECONDS,
  type TrialLabels,
} from "./sam-trial";

describe("box pixel conversion", () => {
  it("converts a 0–1 box to video pixels for fal", () => {
    expect(boxToPixels({ x: 0.5, y: 0.25, w: 0.1, h: 0.2 }, 1280, 720)).toEqual({
      x_min: 640,
      y_min: 180,
      x_max: 768,
      y_max: 324,
      frame_index: 0,
    });
  });

  it("round-trips through pixelsToBox", () => {
    const box = { x: 0.643, y: 0.66, w: 0.045, h: 0.134 };
    const p = boxToPixels(box, 1280, 720);
    const back = pixelsToBox(p.x_min, p.y_min, p.x_max, p.y_max, 1280, 720);
    expect(back.x).toBeCloseTo(box.x, 2);
    expect(back.y).toBeCloseTo(box.y, 2);
    expect(back.w).toBeCloseTo(box.w, 2);
    expect(back.h).toBeCloseTo(box.h, 2);
  });

  it("clamps out-of-frame pixel boxes to 0–1", () => {
    const b = pixelsToBox(-50, -10, 1300, 800, 1280, 720);
    expect(b.x).toBe(0);
    expect(b.y).toBe(0);
    expect(b.x + b.w).toBeLessThanOrEqual(1);
    expect(b.y + b.h).toBeLessThanOrEqual(1);
  });
});

describe("frameToTime", () => {
  it("maps mask frames onto the original video clock", () => {
    expect(frameToTime(0, 30, 10)).toBe(10);
    expect(frameToTime(30, 30, 10)).toBe(11);
    expect(frameToTime(751, 30, 10)).toBeCloseTo(10 + 751 / 30, 6);
  });
});

describe("checkpointTimes", () => {
  it("steps every 2 seconds from clip start", () => {
    expect(checkpointTimes(10, 17)).toEqual([10, 12, 14, 16]);
  });

  it("handles non-integer starts", () => {
    const times = checkpointTimes(3.5, 8);
    expect(times[0]).toBe(3.5);
    expect(times).toHaveLength(3);
    expect(times[1] - times[0]).toBe(CHECKPOINT_INTERVAL_SECONDS);
  });
});

describe("computeMetrics", () => {
  const labels = (sam: string[], lk: string[], crossings: number[] = []): TrialLabels => {
    const l = emptyLabels();
    checkpointTimes(0, 12).forEach((t, i) => {
      l.checkpoints[String(t)] = {
        sam: sam[i] as TrialLabels["checkpoints"][string]["sam"],
        lk: lk[i] as TrialLabels["checkpoints"][string]["lk"],
      };
    });
    l.crossings = crossings;
    return l;
  };

  it("counts coverage, switches and lost time per tracker", () => {
    // checkpoints at 0,2,4,6,8,10
    const l = labels(
      ["on_me", "on_me", "on_me", "on_me", "on_me", "on_me"],
      ["on_me", "on_me", "wrong_player", "on_me", "lost", "lost"],
    );
    const m = computeMetrics(l, 0, 12);
    expect(m.sam.coverage).toBe(1);
    expect(m.sam.identitySwitches).toBe(0);
    expect(m.sam.lostCount).toBe(0);
    expect(m.lk.coverage).toBeCloseTo(3 / 6, 6);
    expect(m.lk.identitySwitches).toBe(1);
    expect(m.lk.lostCount).toBe(2);
    expect(m.lk.lostSeconds).toBe(4);
  });

  it("ignores unlabeled checkpoints", () => {
    const l = emptyLabels();
    l.checkpoints["0"] = { sam: "on_me", lk: "lost" };
    const m = computeMetrics(l, 0, 12);
    expect(m.sam.labeled).toBe(1);
    expect(m.sam.coverage).toBe(1);
    expect(m.lk.coverage).toBe(0);
  });

  it("restricts crossing metrics to ±2s around tagged crossings", () => {
    const l = labels(
      ["on_me", "on_me", "on_me", "wrong_player", "on_me", "on_me"],
      ["on_me", "wrong_player", "wrong_player", "wrong_player", "lost", "lost"],
      [6],
    );
    const m = computeMetrics(l, 0, 12);
    // crossing at 6 → checkpoints 4, 6, 8 are in the window
    expect(m.sam.crossing?.labeled).toBe(3);
    expect(m.sam.crossing?.coverage).toBeCloseTo(2 / 3, 6);
    expect(m.sam.crossing?.identitySwitches).toBe(1);
    expect(m.lk.crossing?.identitySwitches).toBe(0); // already wrong before the window
  });

  it("reports null crossing metrics when no crossings are tagged", () => {
    const m = computeMetrics(labels(["on_me"], ["on_me"]), 0, 12);
    expect(m.sam.crossing).toBeNull();
  });

  it("carries manual correction counts", () => {
    const l = labels(["on_me"], ["on_me"]);
    l.corrections = { sam: 0, lk: 3 };
    const m = computeMetrics(l, 0, 12);
    expect(m.lk.corrections).toBe(3);
    expect(m.sam.corrections).toBe(0);
  });
});

describe("passesBar", () => {
  it("requires 85% coverage, a 20-point lead, and at most 1 crossing switch", () => {
    const l = emptyLabels();
    checkpointTimes(0, 20).forEach((t) => {
      l.checkpoints[String(t)] = { sam: "on_me", lk: "lost" };
    });
    const m = computeMetrics(l, 0, 20);
    expect(m.sam.coverage).toBe(1);
    expect(m.lk.coverage).toBe(0);
    expect(passesBar(m)).toBe(true);
  });

  it("fails when the arrow is close behind", () => {
    const l = emptyLabels();
    checkpointTimes(0, 20).forEach((t) => {
      l.checkpoints[String(t)] = { sam: "on_me", lk: "on_me" };
    });
    expect(passesBar(computeMetrics(l, 0, 20))).toBe(false);
  });
});
