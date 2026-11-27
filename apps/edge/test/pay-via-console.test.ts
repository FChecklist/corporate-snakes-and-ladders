// 1.5.6 (27 Nov 2026, owner order): Snakes and Ladders takes no payment itself. The console asks `payable` (read-only), Moneypenny charges, the console sends the signed `paid` notice, this game unlocks.
// With PAY_VIA_CONSOLE=1 the game's own pay, pay-link, credit and proforma routes answer 410, and nothing is ever opened with Razorpay or the central service.
// FALSIFIED BY: payable-leaks-a-strangers-game, payable-writes, pay-route-left-open, credit-route-left-open, paylink-route-left-open, placeorder-opens-an-order-with-the-flag-on
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { T, W, callRaw, create, j, one, organizer, publish, q, reset, restore, uid } from "./param-harness";
import { makeKeyPair, signAssertion, type Payload } from "../src/console-bridge/assertion";

const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
let kp: Awaited<ReturnType<typeof makeKeyPair>>, other: Awaited<ReturnType<typeof makeKeyPair>>, n = 0, outbound: string[] = [];
const fetchBefore = () => globalThis.fetch;
beforeEach(async () => {
  reset(); kp = await makeKeyPair(); other = await makeKeyPair(); outbound = [];
  W.env.PUBLIC_ORIGIN = "https://snakes.test"; (W.env as any).CONSOLE_PUBKEYS = "k1:" + kp.publicB64u; (W.env as any).CONSOLE_ORIGIN = "https://console.test"; (W.env as any).PAY_VIA_CONSOLE = "1";
  const inner = fetchBefore(); globalThis.fetch = (async (u: any, i?: any) => { outbound.push(String(u instanceof Request ? u.url : u)); return inner(u, i); }) as any;
});
afterEach(restore);

const notice = async (email: string, eid: string, o: { key?: CryptoKey; act?: Payload["act"] } = {}) => {
  const payload: Payload = { v: 1, kid: "k1", aud: "https://snakes.test", sub: await sha("email|" + email.toLowerCase()), act: o.act ?? "payable", eid, jti: "pvc" + (++n) + "x".repeat(20), iat: Math.floor(T / 1000), exp: Math.floor(T / 1000) + 60 } as any;
  return signAssertion(payload, o.key ?? kp.privateKey);
};
const payable = async (email: string, eid: string, o: Parameters<typeof notice>[2] = {}) => callRaw("POST", "/api/console/payable", { assertion: await notice(email, eid, o), eid }, {}, T);
async function game(cap = 20, over: Record<string, unknown> = {}) {
  const o = await organizer(`pvc${++n}@acme.com`), id = uid("PV");
  expect((await create(o.key, id, { cap, ...over })).status).toBe(200);
  expect((await publish(o.key, id)).status).toBe(200);
  return { ...o, id };
}

describe("payable: what must be paid, asked before any money is taken", () => {
  test("the owner gets the pack size for the game's size and paid:false; nothing in the game changes", async () => {
    const g = await game(20), before = JSON.stringify(q("SELECT id, pack, start_round, cap FROM engagement WHERE id=?", g.id)), kv = q("SELECT k FROM kv WHERE k LIKE 'paidby/%'").length;
    const r = await payable(g.email, g.id);
    expect(r.status).toBe(200); expect(await j(r)).toMatchObject({ ok: true, owner: true, item: "100", paid: false });
    expect(JSON.stringify(q("SELECT id, pack, start_round, cap FROM engagement WHERE id=?", g.id))).toBe(before);
    expect(q("SELECT k FROM kv WHERE k LIKE 'paidby/%'").length).toBe(kv);
  });
  test("a stranger is not the owner and learns nothing (no item, not paid)", async () => {
    const g = await game(20), s = await organizer(`stranger${++n}@evil.com`);
    expect(await j(await payable(s.email, g.id))).toMatchObject({ ok: true, owner: false, item: null, paid: false });
  });
  test("a game that is not there looks the same as someone else's", async () => {
    const s = await organizer(`nobody${++n}@acme.com`);
    expect(await j(await payable(s.email, "NO-SUCH-GAME"))).toMatchObject({ owner: false, item: null, paid: false });
  });
  test("after the paid notice the game says paid:true with its pack size; a cancelled game has no item", async () => {
    const g = await game(20);
    const paidNotice = await notice(g.email, g.id, { act: "paid" });
    expect((await callRaw("POST", "/api/console/paid", { assertion: paidNotice, eid: g.id, item: "100", orderRef: "GAME-snakesladders-" + g.id }, {}, T)).status).toBe(200);
    expect(await j(await payable(g.email, g.id))).toMatchObject({ owner: true, item: "100", paid: true });
    const c = await game(20);
    W.raw.prepare("UPDATE engagement SET cancelled_ms=1 WHERE id=?").run(c.id);
    expect(await j(await payable(c.email, c.id))).toMatchObject({ owner: true, item: null, paid: false });
  });
  test("a 'paid' assertion sent to /payable, a reused one, and a forged signature are all 401; 'payable' sent to /paid is 401", async () => {
    const g = await game(20);
    expect((await payable(g.email, g.id, { act: "paid" })).status).toBe(401);
    const tok = await notice(g.email, g.id);
    expect((await callRaw("POST", "/api/console/payable", { assertion: tok, eid: g.id }, {}, T)).status).toBe(200);
    expect((await callRaw("POST", "/api/console/payable", { assertion: tok, eid: g.id }, {}, T)).status).toBe(401); // same jti twice
    expect((await payable(g.email, g.id, { key: other.privateKey })).status).toBe(401);
    expect((await callRaw("POST", "/api/console/paid", { assertion: await notice(g.email, g.id), eid: g.id, item: "100", orderRef: "GAME-snakesladders-wrongact" }, {}, T)).status).toBe(401);
    expect(one("SELECT pack FROM engagement WHERE id=?", g.id).pack).toBe(0);
  });
  test("dark without the console's keys (the normal 404); without PUBLIC_ORIGIN it says why (503)", async () => {
    const g = await game(20); const tok = await notice(g.email, g.id);
    (W.env as any).CONSOLE_PUBKEYS = undefined;
    expect((await callRaw("POST", "/api/console/payable", { assertion: tok, eid: g.id }, {}, T)).status).toBe(404);
    (W.env as any).CONSOLE_PUBKEYS = "k1:" + kp.publicB64u; W.env.PUBLIC_ORIGIN = "";
    expect((await callRaw("POST", "/api/console/payable", { assertion: tok, eid: g.id }, {}, T)).status).toBe(503);
  });
});

describe("paid: the game decides from its own tables", () => {
  const paid = async (email: string, eid: string, item: string, orderRef: string) => callRaw("POST", "/api/console/paid", { assertion: await notice(email, eid, { act: "paid" }), eid, item, orderRef }, {}, T);
  const state = (eid: string) => ({ pack: one("SELECT pack FROM engagement WHERE id=?", eid).pack, ent: q("SELECT id FROM entitlement WHERE eid=?", eid).length });
  test("(1) the owner with the right size: 200, the pack is set, one entitlement", async () => {
    const g = await game(20);
    expect(state(g.id)).toEqual({ pack: 0, ent: 0 });
    expect((await paid(g.email, g.id, "100", "GAME-snakesladders-c1")).status).toBe(200);
    expect(state(g.id)).toEqual({ pack: 100, ent: 1 });
  });
  test("(2) a stranger's signed notice is refused: pack stays 0, no entitlement row", async () => {
    const g = await game(20), s = await organizer(`stranger${++n}@evil.com`);
    const r = await paid(s.email, g.id, "100", "GAME-snakesladders-c2");
    expect(r.status).not.toBe(200); expect((await j(r)).error).toBe("game_refused");
    expect(state(g.id)).toEqual({ pack: 0, ent: 0 });
  });
  test("(3) the wrong size is refused: pack stays 0, no entitlement row", async () => {
    const g = await game(20);
    expect((await j(await paid(g.email, g.id, "250", "GAME-snakesladders-c3"))).error).toBe("game_refused");
    expect(state(g.id)).toEqual({ pack: 0, ent: 0 });
  });
  test("(4) a cancelled game is refused: pack stays 0, no entitlement row", async () => {
    const g = await game(20); W.raw.prepare("UPDATE engagement SET cancelled_ms=1 WHERE id=?").run(g.id);
    expect((await j(await paid(g.email, g.id, "100", "GAME-snakesladders-c4"))).error).toBe("game_refused");
    expect(state(g.id)).toEqual({ pack: 0, ent: 0 });
  });
  test("(5) a paid game and a second, different order: refused as already paid, still one entitlement", async () => {
    const g = await game(20);
    expect((await paid(g.email, g.id, "100", "GAME-snakesladders-c5a")).status).toBe(200);
    const r = await paid(g.email, g.id, "100", "GAME-snakesladders-c5b");
    expect((await j(r)).error).toBe("game_refused");
    expect(state(g.id)).toEqual({ pack: 100, ent: 1 });
  });
  test("(6) the same order twice: the second is a repeat, no second entitlement", async () => {
    const g = await game(20);
    expect((await paid(g.email, g.id, "100", "GAME-snakesladders-c6")).status).toBe(200);
    expect(await j(await paid(g.email, g.id, "100", "GAME-snakesladders-c6"))).toMatchObject({ ok: true, repeat: true });
    expect(state(g.id)).toEqual({ pack: 100, ent: 1 });
  });
  test("(7) a failure after the entitlement insert leaves the job half done; the retry finishes it", async () => {
    const g = await game(20);
    W.raw.exec("CREATE TRIGGER pvc_boom BEFORE UPDATE OF pack ON engagement BEGIN SELECT RAISE(ABORT, 'boom'); END");
    const bad = await paid(g.email, g.id, "100", "GAME-snakesladders-c7");
    expect(bad.status).not.toBe(200);
    expect(state(g.id)).toEqual({ pack: 0, ent: 1 }); // the entitlement is there, the pack is not
    W.raw.exec("DROP TRIGGER pvc_boom");
    // the bridge keeps a 30 s lease on an order that is being marked: the retry comes 31 s later (inside the notice's 60 s life)
    const retry = await callRaw("POST", "/api/console/paid", { assertion: await notice(g.email, g.id, { act: "paid" }), eid: g.id, item: "100", orderRef: "GAME-snakesladders-c7" }, {}, T + 31_000);
    expect(retry.status).toBe(200);
    expect(state(g.id)).toEqual({ pack: 100, ent: 1 });
  });
});

describe("with PAY_VIA_CONSOLE=1 the game takes no payment itself", () => {
  test("every old pay, pay-link, credit and proforma route answers 410 with the console's address; Razorpay's own notice is not shut", async () => {
    const o = await organizer(`gate${++n}@acme.com`);
    for (const [m, p] of [["POST", "/api/checkout"], ["POST", "/api/proforma"], ["POST", "/api/payments/test"], ["POST", "/api/payments/paytest"], ["POST", "/api/payments/verify"], ["GET", "/api/org/credit"], ["POST", "/api/z/GAME-0001/pay-with-credit"], ["POST", "/api/z/GAME-0001/paylink"], ["GET", "/api/paylink/" + "a".repeat(48)], ["POST", "/api/paylink/" + "a".repeat(48) + "/checkout"]] as const) {
      const r = await callRaw(m, p, m === "POST" ? {} : undefined, o.h, T);
      expect([m, p, r.status]).toEqual([m, p, 410]);
      expect((await j(r)).code).toBe("pay-in-console");
    }
    expect((await callRaw("POST", "/api/payments/webhook", {}, {}, T)).status).not.toBe(410);
  });
  test("nothing is opened with Razorpay or the central order service, whatever keys are set", async () => {
    (W.env as any).PAY_SERVICE_KEY = "svc"; const g = await game(20);
    for (const p of ["/api/checkout", "/api/payments/test"]) expect((await callRaw("POST", p, { eid: g.id, pack: 100 }, g.h, T)).status).toBe(410);
    expect(outbound.filter((u) => /razorpay|rzp\.test|api\/pay\/order/i.test(u))).toEqual([]);
    expect(one("SELECT pack FROM engagement WHERE id=?", g.id).pack).toBe(0);
  });
  test("the credit-expiry and ledger C jobs are skipped; with the flag off the ledger C job runs", async () => {
    const { runTick } = await import("../src/worker");
    const on: any = await runTick(W.env as any, T);
    expect(on.ledgerC).toBeNull(); expect(on.creditLapsed).toBeUndefined();
    (W.env as any).PAY_VIA_CONSOLE = undefined;
    expect(((await runTick(W.env as any, T)) as any).ledgerC).not.toBeNull();
  });
});

describe("rollback: with the flag off the old path is not shut", () => {
  test("the old routes do not answer 410", async () => {
    (W.env as any).PAY_VIA_CONSOLE = undefined; const o = await organizer(`off${++n}@acme.com`);
    for (const p of ["/api/checkout", "/api/proforma"]) expect((await callRaw("POST", p, {}, o.h, T)).status).not.toBe(410);
    expect((await callRaw("GET", "/api/org/credit", undefined, o.h, T)).status).not.toBe(410);
  });
});
