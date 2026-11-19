// A table game (2 to 20 players share one board) cannot be set up for more people than the table can play. Before: a table game of 100 people was accepted, and when the
// 21st person joined every phone answered 'A table game has 2 to 20 players.' and nobody could play (found by tools/qa-model.mjs).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { call, create, j, organizer, reset, restore, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);

describe("table game size", () => {
  test("a table game of 21 or more people is refused when it is made, in a plain sentence; 20 is fine", async () => {
    const o = await organizer();
    const big = await create(o.key, uid("TBL"), { mode: "table", cap: 21 }); expect(big.status).toBe(400);
    const b = await j(big); expect(b.code).toBe("table-cap"); expect(b.error).toBe("A table game is for 2 to 20 people. Choose a smaller number of people, or play a race.");
    expect((await create(o.key, uid("TBL"), { mode: "table", cap: 20 })).status).toBe(200);
    expect((await create(o.key, uid("RAC"), { cap: 500 })).status).toBe(200); // a race is not limited
  });
  test("it cannot be reached by changing the settings either: a big race switched to a table, or a table made bigger", async () => {
    const o = await organizer(); const race = uid("RAC"), table = uid("TBL");
    await create(o.key, race, { cap: 100 }); await create(o.key, table, { mode: "table", cap: 12 });
    const toTable = await call("PATCH", `/api/z/${race}/settings`, { mode: "table" }, o.h); expect(toTable.status).toBe(400); expect((await j(toTable)).code).toBe("table-cap");
    const bigger = await call("PATCH", `/api/z/${table}/settings`, { cap: 40 }, o.h); expect(bigger.status).toBe(400); expect((await j(bigger)).code).toBe("table-cap");
    expect((await call("PATCH", `/api/z/${race}/settings`, { mode: "table", cap: 16 }, o.h)).status).toBe(200); // both together is fine
  });
});
