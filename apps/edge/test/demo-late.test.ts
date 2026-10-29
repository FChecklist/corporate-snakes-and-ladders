// a published game cannot become a demo (found by the security and correctness reviews, 2026-10-29)
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { HOUR, T, call, create, j, one, organizer, paidGame, publish, q, reset, restore, roundMs, startIn, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);
const startMs = roundMs(startIn(2 * HOUR));

describe("a published game cannot become a demo", () => {
  test("switching the demo mark ON after publishing is refused, for an unpaid game and for a paid one; on a draft it is allowed", async () => {
    const o = await organizer(); const draft = uid("ORD"), live = uid("ORD");
    await create(o.key, draft, { cap: 8 }); await create(o.key, live, { cap: 8 }); await publish(o.key, live);
    const late = await call("PATCH", `/api/z/${live}/settings`, { demo: true }, o.h); expect(late.status).toBe(409); expect((await j(late)).code).toBe("demo-late");
    expect((await call("PATCH", `/api/z/${draft}/settings`, { demo: true }, o.h)).status).toBe(200);
    const paid = await paidGame({ cap: 100 }); const p2 = await call("PATCH", `/api/z/${paid.id}/settings`, { demo: true }, paid.h); expect(p2.status).toBe(409);
    const info = await j(await call("GET", `/api/z/${live}/info`, undefined, {}, startMs + 5 * 60_000)); expect(info.demo).toBeUndefined(); // still an ordinary game, held for payment like any other
  });
  test("the console offers the free demo only while a game is a draft (or already a demo)", () => {
    const src = require("node:fs").readFileSync(new URL("../../web/public/zc.js", import.meta.url), "utf8") as string;
    expect(src).toMatch(/const caps = \(S\.draft \|\| isDemoNow\(\) \? demoChip\(f\) : ""\)/);
  });
});
