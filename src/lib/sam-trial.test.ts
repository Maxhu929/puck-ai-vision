import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
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

const close = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} not within ${eps} of ${b}`);

describe("box pixel conversion", () => {
  test("converts a 0–1 box to video pixels for fal", () => {
    assert.deepEqual(boxToPixels({ x: 0.5, y: 0.25, w: 0.1, h: 0.2 }, 1280, 720), {
      x_min: 640,
      y_min: 180,
      x_max: 768,
      y_max: 324,
      frame_index: 0,
    });
  });

  test("round-trips through pixelsToBox", () => {
    const box = { x: 0.643, y: 0.66, w: 0.045, h: 0.134 };
    const p = boxToPixels(box, 1280, 720);
    const back = pixelsToBox(p.x_min, p.y_min, p.x_max, p.y_max, 1280, 720);
    close(back.x, box.x);
    close(back.y, box.y);
    close(back.w, box.w);
    close(back.h, box.h);
  });

  test("clamps out-of-frame pixel boxes to 0–1", () => {
    const b = pixelsToBox(-50, -10, 1300, 800, 1280, 720);
    assert.equal(b.x, 0);
    assert.equal(b.y, 0);
    assert.ok(b.x + b.w <= 1);
    assert.ok(b.y + b.h <= 1);
  });
});

describe("frameToTime", () => {
  test("maps mask frames onto the original video clock", () => {
    assert.equal(frameToTime(0, 30, 10), 10);
    assert.equal(frameToTime(30, 30, 10), 11);
    close(frameToTime(751, 30, 10), 10 + 751 / 30, 1e-6);
  });
});

describe("checkpointTimes", () => {
  test("steps every 2 seconds from clip start", () => {
    assert.deepEqual(checkpointTimes(10, 17), [10, 12, 14, 16]);
  });

  test("handles non-integer starts", () => {
    const times = checkpointTimes(3.5, 8);
    assert.equal(times[0], 3.5);
    assert.equal(times.length, 3);
    assert.equal(times[1] - times[0], CHECKPOINT_INTERVAL_SECONDS);
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

  test("counts coverage, switches and lost time per tracker", () => {
    // checkpoints at 0,2,4,6,8,10
    const l = labels(
      ["on_me", "on_me", "on_me", "on_me", "on_me", "on_me"],
      ["on_me", "on_me", "wrong_player", "on_me", "lost", "lost"],
    );
    const m = computeMetrics(l, 0, 12);
    assert.equal(m.sam.coverage, 1);
    assert.equal(m.sam.identitySwitches, 0);
    assert.equal(m.sam.lostCount, 0);
    close(m.lk.coverage, 3 / 6, 1e-6);
    assert.equal(m.lk.identitySwitches, 1);
    assert.equal(m.lk.lostCount, 2);
    assert.equal(m.lk.lostSeconds, 4);
  });

  test("ignores unlabeled checkpoints", () => {
    const l = emptyLabels();
    l.checkpoints["0"] = { sam: "on_me", lk: "lost" };
    const m = computeMetrics(l, 0, 12);
    assert.equal(m.sam.labeled, 1);
    assert.equal(m.sam.coverage, 1);
    assert.equal(m.lk.coverage, 0);
  });

  test("restricts crossing metrics to ±2s around tagged crossings", () => {
    const l = labels(
      ["on_me", "on_me", "on_me", "wrong_player", "on_me", "on_me"],
      ["on_me", "wrong_player", "wrong_player", "wrong_player", "lost", "lost"],
      [6],
    );
    const m = computeMetrics(l, 0, 12);
    // crossing at 6 → checkpoints 4, 6, 8 are in the window
    assert.equal(m.sam.crossing?.labeled, 3);
    close(m.sam.crossing?.coverage ?? 0, 2 / 3, 1e-6);
    assert.equal(m.sam.crossing?.identitySwitches, 1);
    assert.equal(m.lk.crossing?.identitySwitches, 0); // already wrong before the window
  });

  test("reports null crossing metrics when no crossings are tagged", () => {
    const m = computeMetrics(labels(["on_me"], ["on_me"]), 0, 12);
    assert.equal(m.sam.crossing, null);
  });

  test("carries manual correction counts", () => {
    const l = labels(["on_me"], ["on_me"]);
    l.corrections = { sam: 0, lk: 3 };
    const m = computeMetrics(l, 0, 12);
    assert.equal(m.lk.corrections, 3);
    assert.equal(m.sam.corrections, 0);
  });
});

describe("passesBar", () => {
  test("requires 85% coverage, a 20-point lead, and at most 1 crossing switch", () => {
    const l = emptyLabels();
    checkpointTimes(0, 20).forEach((t) => {
      l.checkpoints[String(t)] = { sam: "on_me", lk: "lost" };
    });
    const m = computeMetrics(l, 0, 20);
    assert.equal(m.sam.coverage, 1);
    assert.equal(m.lk.coverage, 0);
    assert.equal(passesBar(m), true);
  });

  test("fails when the arrow is close behind", () => {
    const l = emptyLabels();
    checkpointTimes(0, 20).forEach((t) => {
      l.checkpoints[String(t)] = { sam: "on_me", lk: "on_me" };
    });
    assert.equal(passesBar(computeMetrics(l, 0, 20)), false);
  });
});
