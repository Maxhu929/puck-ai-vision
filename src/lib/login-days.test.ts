import { describe, test } from "node:test";
import { strict as assert } from "node:assert";
import { maskName, rankLoginDays } from "./login-days";

describe("login-day leaderboard", () => {
  test("hides most of the email", () => assert.equal(maskName("maxhu@example.com"), "max•••"));
  test("counts one per day and ranks most days first", () => {
    const r = rankLoginDays([{ user_id: "a", display_name: "a" }, { user_id: "b", display_name: "b" }, { user_id: "b", display_name: "b" }]);
    assert.deepEqual(r.map((x) => [x.id, x.days]), [["b", 2], ["a", 1]]);
  });
});
