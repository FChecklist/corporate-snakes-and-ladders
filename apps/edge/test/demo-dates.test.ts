// a demo is dated like a game nobody has paid for (found by the correctness and security reviews, 2026-10-29)
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { HOUR, T, call, create, j, one, organizer, paidGame, publish, q, reset, restore, roundMs, startIn, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);
const startMs = roundMs(startIn(2 * HOUR));

describe("a demo is dated like a game nobody has paid for", () => {
  test("a published demo cannot be moved further than 30 days ahead, and a cancelled demo has nothing to move back", async () => {
    const o = await organizer(); const id = uid("DEMO"); await create(o.key, id, { cap: 10, demo: true }); await publish(o.key, id);
    const far = await call("PATCH", `/api/z/${id}/settings`, { startRound: startIn(200 * 86_400_000) }, o.h); expect(far.status).toBe(400); expect((await j(far)).code).toBe("too-far");
    expect((await call("PATCH", `/api/z/${id}/settings`, { startRound: startIn(20 * 86_400_000) }, o.h)).status).toBe(200);
    await call("POST", `/api/z/${id}/cancel`, { confirmations: 3 }, o.h);
    const back = await call("POST", `/api/z/${id}/reopen`, { startRound: startIn(40 * 86_400_000) }, o.h); expect(back.status).toBe(409);
    expect((await j(back)).error).toMatch(/free demo/i);
  });
});
