// nobody pays for a demo, by credit or by pay link (found by the security and correctness reviews, 2026-10-29)
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { HOUR, T, call, create, j, one, organizer, paidGame, publish, q, reset, restore, roundMs, startIn, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);
const startMs = roundMs(startIn(2 * HOUR));

describe("nobody pays for a demo, in any way", () => {
  test("credit cannot be spent on a demo, and a pay link cannot be made for one", async () => {
    const g = await paidGame({ cap: 100 }); // pays Rs 2,399, then cancelling turns it into credit
    expect((await call("POST", `/api/z/${g.id}/cancel`, { confirmations: 3 }, g.h)).status).toBe(200);
    const id = uid("DEMO"); await create(g.key, id, { cap: 10, demo: true });
    const use = await call("POST", `/api/z/${id}/pay-with-credit`, {}, g.h); expect(use.status).toBe(409); expect((await j(use)).code).toBe("demo-free");
    const link = await call("POST", `/api/z/${id}/paylink`, {}, g.h); expect(link.status).toBe(409); expect((await j(link)).code).toBe("demo-free");
    expect(one("SELECT pack FROM engagement WHERE id=?", id).pack).toBe(0);
    expect(q("SELECT COUNT(*) c FROM credit_use WHERE eid=?", id)[0].c).toBe(0);
  });
});
