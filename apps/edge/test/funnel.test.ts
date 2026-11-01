// The first-party sales funnel (src/funnel.ts): each of the 13 events fired by the real route code, the flag, Do Not Track / GPC, test-mode accounts, the owner report and CSV,
// and a proof that no event carries a name, a mobile number or an e-mail.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { lifecycleTick } from "../src/lifecycle";
import { setMode } from "../src/mode";
import { FUNNEL_EVENTS } from "../../../vendor/game-core/packages/core/src/funnel";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0), GEN = 1692803367;
const START = Math.floor(((T + 2 * 86_400_000) / 1000 - GEN) / 3) + 1; // two days ahead
const startMs = (GEN + (START - 1) * 3) * 1000;
let env: PayEnv & { FUNNEL_EVENTS?: string }; let raw: ReturnType<typeof makeD1>["raw"];
const realFetch = globalThis.fetch;
let rz: { orders: any[]; payments: Record<string, any> };
const hmac = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : withDevice(method, path, body) }), env as Env, now);

const boot = (flag: string | undefined) => {
  const d = makeD1(); raw = d.raw; rz = { orders: [], payments: {} };
  (globalThis as any).fetch = async (url: string, init?: any) => {
    const u = String(url);
    if (u.startsWith("https://rzp.test/v1/orders")) { const b = JSON.parse(init.body); const o = { id: "order_" + (rz.orders.length + 1), amount: b.amount, currency: b.currency, receipt: b.receipt, status: "created" }; rz.orders.push(o); return new Response(JSON.stringify(o), { status: 200 }); }
    const pm = u.match(/\/payments\/([^/]+)(\/capture)?$/);
    if (pm) { const p = rz.payments[pm[1]!]; if (!p) return new Response("{}", { status: 404 }); if (pm[2]) p.status = "captured"; return new Response(JSON.stringify(p), { status: 200 }); }
    return new Response("{}", { status: 404 });
  };
  env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "sek", RAZORPAY_WEBHOOK_SECRET: "whsec", RAZORPAY_BASE_URL: "https://rzp.test/v1", PUBLIC_ORIGIN: "https://bingo.test", ...(flag ? { FUNNEL_EVENTS: flag } : {}) };
};
afterEach(() => { (globalThis as any).fetch = realFetch; });
const events = (): { ev: string; ukey: string; game: string | null; size: number | null; mode: string | null; reason: string | null }[] => {
  try { return raw.query("SELECT ev, ukey, game, size, mode, reason FROM funnel_event ORDER BY at_ms, ev").all() as any; } catch { return []; }
};
const names = () => [...new Set(events().map((e) => e.ev))].sort();
const send = (body: unknown, headers: Record<string, string> = {}) => call("POST", "/api/funnel/e", JSON.stringify(body), headers);
const VISIT = "abcdefghij12";
const evt = (event: string, extra: Record<string, unknown> = {}) => ({ event, at: T, visit: VISIT, game: "snakes", ...extra });

const start = async (email: string, ip: string) => ((await (await call("POST", "/api/start", { email }, { "cf-connecting-ip": ip })).json()) as any).token as string;
const create = (key: string, id: string, cap = 300) => call("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap }, { "x-organizer": key });
const checkout = (key: string, eid: string) => call("POST", "/api/checkout", { eid, org: "Acme Ltd", email: "boss.secret@acme.com", country: "IN", taxId: "", currency: "INR" }, { "x-organizer": key });
const verify = (paymentId: string, orderId: string, payId: string, status: string) => {
  rz.payments[payId] = { id: payId, order_id: orderId, status, amount: rz.orders.find((o) => o.id === orderId)!.amount };
  return call("POST", "/api/payments/verify", { paymentId, razorpay_order_id: orderId, razorpay_payment_id: payId, razorpay_signature: hmac("sek", `${orderId}|${payId}`) });
};

describe("page steps, sent by the page to our own route", () => {
  beforeEach(() => boot("on"));
  test("each page step is stored once per visit, with only the safe fields", async () => {
    for (const e of ["viewed", "size_chosen", "signup_started", "payment_page_reached", "payment_page_opened", "payment_link_copied"]) {
      expect((await send(evt(e, e === "size_chosen" ? { size: 200 } : {}))).status).toBe(204);
      await send(evt(e)); // the same step again in the same visit is not counted again
    }
    expect(names()).toEqual(["payment_link_copied", "payment_page_opened", "payment_page_reached", "signup_started", "size_chosen", "viewed"]);
    expect(events().length).toBe(6);
    expect(events().find((e) => e.ev === "size_chosen")).toMatchObject({ game: "snakes", size: 200 });
  });
  test("the browser cannot send a game step, so the numbers cannot be pushed up from outside", async () => {
    for (const e of ["game_created", "game_published", "payment_started", "payment_succeeded", "payment_failed", "game_started", "game_completed"]) await send(evt(e));
    expect(events()).toEqual([]);
  });
  test("extra fields are dropped and unsafe values are refused: no e-mail, name or mobile reaches the table", async () => {
    await send(evt("viewed", { email: "boss.secret@acme.com", name: "Asha Verma", mobile: "9876543210", game: "boss.secret@acme.com" }));
    await send(evt("size_chosen", { size: 100, game: "9876543210" }));
    await send({ event: "viewed", at: T, visit: "boss.secret@acme.com" }); // not a visit id
    const cols = (raw.query("PRAGMA table_info(funnel_event)").all() as any[]).map((c) => c.name);
    expect(cols).toEqual(["ev", "ukey", "day", "at_ms", "game", "size", "mode", "reason"]);
    const all = JSON.stringify(raw.query("SELECT * FROM funnel_event").all());
    for (const bad of ["boss", "acme", "Asha", "Verma", "9876543210", "@"]) expect(all).not.toContain(bad);
    expect(events().length).toBe(2);
  });
  test("Global Privacy Control and Do Not Track are respected: nothing is stored", async () => {
    await send(evt("viewed"), { "sec-gpc": "1" });
    await send(evt("size_chosen", { size: 100 }), { dnt: "1" });
    expect(events()).toEqual([]);
    await send(evt("viewed")); expect(names()).toEqual(["viewed"]); // without them it is counted
  });
  test("a body that is too big, not JSON, or a wrong method stores nothing", async () => {
    await send({ ...evt("viewed"), junk: "x".repeat(500) });
    expect((await call("POST", "/api/funnel/e", "not json")).status).toBe(204);
    expect((await call("GET", "/api/funnel/e")).status).toBe(405);
    expect(events()).toEqual([]);
  });
});

describe("the flag", () => {
  test("OFF (not set, or any value but on): nothing is stored by the route or by the server steps", async () => {
    for (const flag of [undefined, "off", "true", "1"]) {
      boot(flag);
      await send(evt("viewed"));
      const key = await start("boss.secret@acme.com", "1.1.1.1"); await create(key, "OFF-1");
      expect(events()).toEqual([]);
    }
  });
});

describe("game steps, written by the server from the real routes", () => {
  beforeEach(() => boot("on"));
  test("game_created and game_published", async () => {
    const key = await start("boss.secret@acme.com", "1.1.1.1");
    await create(key, "FN-1");
    expect(names()).toEqual(["game_created"]);
    await call("POST", "/api/z/FN-1/publish", { email: "boss.secret@acme.com", phone: "98765 43210" }, { "x-organizer": key });
    expect(names()).toEqual(["game_created", "game_published"]);
    await create(key, "FN-1"); // creating the same game again counts nothing more
    expect(events().filter((e) => e.ev === "game_created").length).toBe(1);
  });
  test("payment_started, payment_failed (page report and Razorpay's own message), payment_succeeded", async () => {
    const key = await start("boss.secret@acme.com", "1.1.1.1");
    await create(key, "FN-2");
    const c = await (await checkout(key, "FN-2")).json() as any;
    expect(names()).toEqual(["game_created", "payment_started"]);
    expect(events().find((e) => e.ev === "payment_started")).toMatchObject({ game: "snakes", size: 500 });
    await verify(c.paymentId, c.razorpay.orderId, "pay_f1", "failed");
    expect(names()).toContain("payment_failed");
    const body = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_f2", order_id: c.razorpay.orderId, amount: rz.orders[0].amount } } } });
    await call("POST", "/api/payments/webhook", body, { "x-razorpay-signature": hmac("whsec", body) });
    expect(events().filter((e) => e.ev === "payment_failed").length).toBe(1); // one failed order is one failure
    expect(names()).not.toContain("payment_succeeded");
    const ok = await verify(c.paymentId, c.razorpay.orderId, "pay_ok", "captured");
    expect(ok.status).toBe(200);
    expect(names()).toEqual(["game_created", "payment_failed", "payment_started", "payment_succeeded"]);
  });
  test("game_started and game_completed, from the lifecycle pass, once each", async () => {
    const key = await start("boss.secret@acme.com", "1.1.1.1");
    await create(key, "FN-3");
    const c = await (await checkout(key, "FN-3")).json() as any;
    await verify(c.paymentId, c.razorpay.orderId, "pay_ok", "captured");
    expect((await call("POST", "/api/z/FN-3/join", { phone: "9876543210" })).status).toBe(200);
    await lifecycleTick(env as any, startMs - 3_600_000);
    expect(names()).not.toContain("game_started"); // not yet
    await lifecycleTick(env as any, startMs + 60_000);
    expect(names()).toContain("game_started");
    await lifecycleTick(env as any, startMs + 5 * 3_600_000);
    await lifecycleTick(env as any, startMs + 5 * 3_600_000 + 60_000);
    expect(names()).toContain("game_completed");
    for (const n of ["game_started", "game_completed"]) expect(events().filter((e) => e.ev === n).length).toBe(1);
  });
  test("every one of the 13 events can be produced", async () => {
    const key = await start("boss.secret@acme.com", "1.1.1.1");
    for (const e of ["viewed", "size_chosen", "signup_started", "payment_page_reached", "payment_page_opened", "payment_link_copied"]) await send(evt(e));
    await create(key, "FN-4"); await call("POST", "/api/z/FN-4/publish", { email: "boss.secret@acme.com", phone: "98765 43210" }, { "x-organizer": key });
    const c = await (await checkout(key, "FN-4")).json() as any;
    await verify(c.paymentId, c.razorpay.orderId, "pay_f", "failed");
    await verify(c.paymentId, c.razorpay.orderId, "pay_ok", "captured");
    await call("POST", "/api/z/FN-4/join", { phone: "9876543210" });
    await lifecycleTick(env as any, startMs + 60_000); await lifecycleTick(env as any, startMs + 5 * 3_600_000); await lifecycleTick(env as any, startMs + 5 * 3_600_000 + 60_000);
    expect(names()).toEqual([...FUNNEL_EVENTS].sort());
  });
  test("an account made while the site is in TEST mode is never counted", async () => {
    await setMode(env as any, "TEST", "test", T);
    const key = await start("tester@acme.com", "3.3.1.1");
    await create(key, "FN-T");
    expect(events()).toEqual([]);
  });
  test("no event of any kind carries a name, a mobile number or an e-mail", async () => {
    const key = await start("boss.secret@acme.com", "1.1.1.1");
    await send(evt("viewed")); await send(evt("size_chosen", { size: 500, email: "boss.secret@acme.com" }));
    await create(key, "FN-5"); await call("POST", "/api/z/FN-5/publish", { email: "boss.secret@acme.com", phone: "98765 43210", name: "Asha Verma" }, { "x-organizer": key });
    const c = await (await checkout(key, "FN-5")).json() as any;
    await verify(c.paymentId, c.razorpay.orderId, "pay_ok", "captured");
    await call("POST", "/api/z/FN-5/join", { phone: "9876543210", name: "Asha Verma" });
    await lifecycleTick(env as any, startMs + 60_000); await lifecycleTick(env as any, startMs + 5 * 3_600_000); await lifecycleTick(env as any, startMs + 5 * 3_600_000 + 60_000);
    expect(events().length).toBeGreaterThanOrEqual(8);
    const all = JSON.stringify(raw.query("SELECT * FROM funnel_event").all());
    for (const bad of ["boss", "secret", "acme", "Acme", "Asha", "Verma", "9876543210", "98765", "@"]) expect(all).not.toContain(bad);
    for (const row of events()) { expect(Object.keys(row).sort()).toEqual(["ev", "game", "mode", "reason", "size", "ukey"]); expect(row.game === null || row.game === "snakes").toBe(true); }
  });
});

describe("owner report and CSV", () => {
  const get = (q = "", key: string | null = "plat") => call("GET", "/api/owner/funnel?from=2026-09-01&to=2026-12-31" + q, undefined, key ? { "x-organizer": key } : {});
  beforeEach(async () => {
    boot("on");
    for (const e of ["viewed", "size_chosen", "signup_started"]) await send(evt(e));
    await send({ ...evt("viewed"), visit: "zzzzzzzzzz22" });
  });
  test("only the owner key can read it; anybody else gets the same 404 as an unknown address", async () => {
    expect((await get("", null)).status).toBe(404);
    expect((await get("", "wrong")).status).toBe(404);
    const org = await start("boss.secret@acme.com", "1.1.1.1"); expect((await get("", org)).status).toBe(404);
    expect((await get("")).status).toBe(200);
  });
  test("total, by week and by day, with the share of the previous step and of the first", async () => {
    const r = await (await get("")).json() as any;
    expect(r.enabled).toBe(true);
    const row = (e: string) => r.total.find((x: any) => x.event === e);
    expect(row("viewed")).toMatchObject({ count: 2, ofPrevious: null, ofFirst: null });
    expect(row("size_chosen")).toMatchObject({ count: 1, ofPrevious: 50, ofFirst: 50 });
    expect(row("signup_started")).toMatchObject({ count: 1, ofPrevious: 100, ofFirst: 50 });
    expect(r.days.length).toBe(1); expect(r.days[0].period).toBe("2026-10-01"); expect(r.weeks[0].period).toBe("2026-09-28"); // the Monday of that week
    expect(r.total.map((x: any) => x.event)).toEqual([...FUNNEL_EVENTS]);
  });
  test("CSV download", async () => {
    const res = await get("&format=csv");
    expect(res.headers.get("content-type")).toContain("text/csv"); expect(res.headers.get("content-disposition")).toContain("sales-funnel.csv");
    const t = await res.text(); const lines = t.trim().split("\n");
    expect(lines[0]).toBe("period,period_start,step,count,percent_of_previous,percent_of_first");
    expect(t).toContain("total,2026-09-01..2026-12-31,viewed,2,,"); expect(t).toContain("day,2026-10-01,size_chosen,1,50,50");
    expect(t).not.toContain("@");
  });
  test("with the flag off the report still reads what was kept and says counting is off", async () => {
    env.FUNNEL_EVENTS = "off";
    const r = await (await get("")).json() as any;
    expect(r.enabled).toBe(false); expect(r.note).toMatch(/switched off/); expect(r.total.find((x: any) => x.event === "viewed").count).toBe(2);
  });
});
