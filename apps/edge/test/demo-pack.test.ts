// a demo has room for 10 people whatever size it was made with (found by the correctness review, 2026-10-29)
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { HOUR, T, call, create, j, one, organizer, paidGame, publish, q, reset, restore, roundMs, startIn, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);
const startMs = roundMs(startIn(2 * HOUR));

describe("a demo has room for 10 people whatever size it was made with", () => {
  test("a demo made for 3 people can be raised to 10 after publishing, and not to 11", async () => {
    const o = await organizer(); const id = uid("DEMO"); await create(o.key, id, { cap: 3, demo: true }); await publish(o.key, id);
    expect(one("SELECT pack FROM engagement WHERE id=?", id).pack).toBe(10);
    expect((await call("PATCH", `/api/z/${id}/settings`, { cap: 10 }, o.h)).status).toBe(200);
    const eleven = await call("PATCH", `/api/z/${id}/settings`, { cap: 11 }, o.h); expect(eleven.status).toBe(400); expect((await j(eleven)).code).toBe("demo-cap");
  });
});
