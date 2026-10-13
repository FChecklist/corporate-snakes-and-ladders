// A game nobody has paid for can be set at most 30 days ahead. A PAID game can be moved to any date within 365 days from the date of payment.
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";

const DAY = 86_400_000;
const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const roundOf = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"];
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: "https://snakes.test", DATA_KEY: "k", TEST_MODE: "1" } as any; });
async function game() {
  const o = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }));
  expect((await call("POST", "/api/z", { id: "WIN-1", startRound: roundOf(T + 5 * DAY), callSeconds: 20, cap: 100 }, { "x-organizer": o.token }, T)).status).toBe(200);
  return { "x-organizer": o.token as string };
}
const move = (h: Record<string, string>, startMs: number, now: number) => call("PATCH", "/api/z/WIN-1/settings", { startRound: roundOf(startMs) }, h, now);
function markPaid(paidMs: number) {
  raw.prepare("UPDATE engagement SET pack=100 WHERE id='WIN-1'").run();
  raw.prepare("INSERT INTO payment(id,org,email,pack,currency,amount,tax,status,created_ms,paid_ms,meta,eid) VALUES('pay_w','o','boss@acme.com',100,'INR',2399,0,'paid',?,?,'{}','WIN-1')").run(paidMs, paidMs);
}

describe("how far ahead a game time can be set", () => {
  test("a game nobody has paid for: capped at 30 days (day 29 allowed, day 31 refused)", async () => {
    const h = await game();
    expect((await move(h, T + 29 * DAY, T)).status).toBe(200);
    const r = await move(h, T + 31 * DAY, T + 1000); expect(r.status).toBe(400); expect((await j(r)).code).toBe("too-far");
    // creating a new game is capped the same way
    expect((await call("POST", "/api/z", { id: "WIN-2", startRound: roundOf(T + 31 * DAY), callSeconds: 20, cap: 100 }, h, T)).status).toBe(400);
  });
  test("a PAID game: any date up to 365 days from the payment (day 364 allowed, day 366 refused), even though that is far past 30 days from now", async () => {
    const h = await game(); markPaid(T);
    const now = T + 2 * DAY;                                                     // two days after paying (the game is still ahead): 364 days from the payment is 362 days from now
    expect((await move(h, T + 364 * DAY, now)).status).toBe(200);
    const late = await move(h, T + 366 * DAY, now + 1000);
    expect(late.status).toBe(400); const b = await j(late); expect(b.code).toBe("too-far"); expect(b.error).toContain("365 days of the payment");
    expect(raw.prepare("SELECT start_round FROM engagement WHERE id='WIN-1'").get()).toEqual({ start_round: roundOf(T + 364 * DAY) });
  });
  test("the window counts from the date of payment, not from today: paid 4 days ago, day 364 from the payment is allowed and day 366 is not", async () => {
    const h = await game(); markPaid(T);
    const now = T + 4 * DAY;
    expect((await move(h, T + 364 * DAY, now)).status).toBe(200);
    expect((await move(h, T + 366 * DAY, now + 1000)).status).toBe(400);
  });
  test("the refund page and the Terms carry the same rule, and no sentence about a 30-day move window remains", () => {
    const rd = (f: string) => readFileSync(new URL("../../web/public/" + f, import.meta.url), "utf8");
    const sd = (f: string) => readFileSync(new URL("../../../site/" + f, import.meta.url), "utf8");
    for (const page of [rd("refund-policy.html"), sd("refund-policy.html")]) {
      expect(page).toContain("There is no refund after payment, and the game can be rescheduled to any date within 365 days of payment");
      expect(page).toContain("any date within 365 days from the date of payment");
      expect(page).not.toMatch(/30 days after you cancel|within 30 days of the cancel|or 30 days pass/i);
    }
    for (const f of ["terms.html", "legal.html", "trust.html", "llms.txt"]) expect(rd(f), f).not.toMatch(/30 days after you cancel|For 30 days after|or 30 days pass|move it to a new date for 30 days/i);
  });
});
