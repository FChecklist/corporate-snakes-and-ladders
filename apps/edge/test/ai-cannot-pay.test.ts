// An AI assistant cannot pay (owner rule, 25 Nov 2026): an AI key (cba_, kind "ai") is refused on EVERY payment route with HTTP 403 and one plain message, before anything else
// is looked at; a co-organizer's key used through an AI work link is refused the same way; the organizer and the co-organizer in the console are not touched by this check.
// Every route is tried with and without OWNER_RULES (under the rules the older pay routes answer 410 to everybody else, but an AI key is refused first).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TICKS } from "./device";
import { handle } from "./cohost-accepted";
import type { Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { AI_CANNOT_DO, AI_CANNOT_PAY, PAY_PATH, isAiCaller } from "../src/ai-pay";
import { makeD1 } from "./d1-sqlite";

/** The owner's words, exactly. */
const MESSAGE = "An AI assistant cannot pay. Only the organizer or a co-organizer can pay, with Pay now in the console. Please tell the organizer that the game is ready to pay.";
const DO_MESSAGE = "An AI assistant cannot do this. The organizer does it in the console. Please tell the organizer what needs doing and where.";
const T = Date.UTC(2026, 10, 22, 10, 0, 0), H = 3_600_000;
const START = Math.floor(((T + 3 * H) / 1000 - 1692803367) / 3) + 1; // the game starts 3 hours after T
const TOKEN = "a".repeat(48); // a pay-link token (the AI is refused before the token is looked up)
const realFetch = globalThis.fetch;
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let rzpCalls: number; let ipN = 0;
const count = (table: string) => (raw.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as any).c as number;
const j = async (r: Response) => (await r.json()) as any;
const call = (method: string, path: string, body?: unknown, key?: string, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...(key ? { "x-organizer": key } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env as Env, T);
/** The call a person's page makes: the same, with the tick on the consent box. */
const callTick = (method: string, path: string, body: Record<string, unknown>, key?: string) => call(method, path, { consent: TICKS, ...body }, key);
const q = (o: unknown) => encodeURIComponent(JSON.stringify(o));

/** Every payment route an AI could try, as the direct API call and as the address behind an AI work link. */
const ROUTES: { name: string; method: string; path: string; body?: unknown }[] = [
  { name: "checkout", method: "POST", path: "/api/checkout", body: { eid: "AIP-1", org: "Acme", name: "Boss", email: "payer@acme.com", country: "IN", currency: "INR" } },
  { name: "checkout with no game", method: "POST", path: "/api/checkout", body: { pack: 100, name: "Boss", email: "payer@acme.com" } },
  { name: "payment test", method: "POST", path: "/api/payments/test", body: { pack: 100, name: "Boss", email: "payer@acme.com" } },
  { name: "payment paytest", method: "POST", path: "/api/payments/paytest", body: { name: "Boss", email: "payer@acme.com", country: "IN" } },
  { name: "end of a payment", method: "POST", path: "/api/payments/verify", body: { paymentId: "pay_0123456789abcdef" } },
  { name: "checkout of a pay link", method: "POST", path: `/api/paylink/${TOKEN}/checkout`, body: { name: "Fiona", email: "fiona@acme.com" } },
  { name: "make a pay link", method: "POST", path: "/api/z/AIP-1/paylink", body: {} },
  { name: "make a pay link for a game that does not exist", method: "POST", path: "/api/z/NOPE-1/paylink", body: {} },
  { name: "pay with credit", method: "POST", path: "/api/z/AIP-1/pay-with-credit", body: {} },
  { name: "read the credit", method: "GET", path: "/api/org/credit" },
];
const viaLink = (key: string, r: { method: string; path: string; body?: unknown }) => {
  const rest = r.path.replace(/^\/api\//, "");
  return r.method === "GET" ? { method: "GET", path: `/ai/${key}/${rest}` } : { method: "GET", path: `/ai/${key}/${rest}?_method=POST&_body=${q(r.body ?? {})}` }; // a browse-only AI sends a POST as a GET with _method and _body
};

for (const rules of [false, true]) describe(rules ? "with OWNER_RULES 1.1" : "without OWNER_RULES", () => {
  beforeEach(() => {
    const d = makeD1(); raw = d.raw; rzpCalls = 0;
    (globalThis as any).fetch = async (url: string, init?: any) => {
      const u = String(url);
      if (!u.startsWith("https://rzp.test")) return realFetch(url, init);
      rzpCalls++;
      if (u.startsWith("https://rzp.test/v1/orders")) { const b = JSON.parse(init.body); return new Response(JSON.stringify({ id: "order_" + rzpCalls, amount: b.amount, currency: b.currency, receipt: b.receipt, status: "created" })); }
      return new Response("{}", { status: 404 });
    };
    env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "1000000", RAZORPAY_KEY_ID: "rzp_test_x", RAZORPAY_KEY_SECRET: "sek", RAZORPAY_WEBHOOK_SECRET: "whsec", RAZORPAY_BASE_URL: "https://rzp.test/v1", PUBLIC_ORIGIN: "https://bingo.test", OWNER_EMAIL: "owner@platform.test", ...(rules ? { OWNER_RULES: "1.1", CONSOLE_PAID_SECRET: "s".repeat(40), PHONE_SALT: "salt" } : {}) } as PayEnv;
  });
  afterEach(() => { globalThis.fetch = realFetch; });

  /** The organizer with a draft game, an AI key, a co-organizer (key cbh_), a Co-host of the game and the key of a co-organizer's AI work link. */
  async function team() {
    const st = await j(await handle(new Request("http://x/api/start", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `6.6.6.${++ipN}` }, body: JSON.stringify({ consent: TICKS, email: `boss${ipN}@acme.com` }) }), env as Env, T));
    const master = st.token as string, ai = st.aiKey as string;
    expect(ai).toMatch(/^cba_[0-9a-f]{48}$/); expect(master).toMatch(/^cbk_/);
    const made = await call("POST", "/api/z", { id: "AIP-1", startRound: START, callSeconds: 10, cap: 100 }, master); expect(made.status).toBe(200);
    const host = (await j(await call("POST", "/api/org/host", { label: "Priya", email: "priya@acme.com", mobile: "9876500009" }, master))).hostKey as string; expect(host).toMatch(/^cbh_/);
    const cohost = (await j(await call("POST", "/api/org/cohost", { label: "Ravi", phone: "9876500001", e: "AIP-1" }, master))).cohostKey as string; expect(cohost).toMatch(/^cbc_/);
    return { master, ai, host, cohost };
  }
  /** Nothing was made: no payment, no pay link, no credit used, no order opened with the payment service. */
  const nothingMade = () => { expect([count("payment"), count("paylink"), count("credit_use"), rzpCalls]).toEqual([0, 0, 0, 0]); };

  test("an AI key is refused on every payment route with HTTP 403 and the one plain message, and nothing is created", async () => {
    const t = await team();
    for (const r of ROUTES) {
      const res = await call(r.method, r.path, r.body, t.ai); const body = await j(res);
      expect([r.name, res.status, body.error, body.code]).toEqual([r.name, 403, MESSAGE, "ai-cannot-pay"]);
    }
    nothingMade();
  });

  test("the same through the AI link (the address an AI is given), also as a browse-only GET with _method and _body", async () => {
    const t = await team();
    for (const r of ROUTES) {
      const v = viaLink(t.ai, r); const res = await call(v.method, v.path); const body = await j(res);
      expect([r.name, res.status, body.error]).toEqual([r.name, 403, MESSAGE]);
      expect(JSON.stringify(body)).not.toContain(t.ai); // an answer never carries the key
    }
    expect((await j(await call("POST", `/ai/${t.ai}/z/AIP-1/paylink`, {}))).error).toBe(MESSAGE); // a real POST through the link
    nothingMade();
  });

  test("the check comes first: no tick on a consent box, no body at all and the owner rules change nothing about the answer", async () => {
    const t = await team();
    for (const path of ["/api/checkout", "/api/payments/test", "/api/payments/paytest", `/api/paylink/${TOKEN}/checkout`]) {
      const res = await call("POST", path, undefined, t.ai); // no body, no tick
      expect([path, res.status, (await j(res)).error]).toEqual([path, 403, MESSAGE]);
    }
    const bearer = await call("POST", "/api/checkout", { eid: "AIP-1" }, undefined, { authorization: `Bearer ${t.ai}` }); // the key in the Authorization header is the same key
    expect([bearer.status, (await j(bearer)).error]).toEqual([403, MESSAGE]);
    nothingMade();
  });

  test("a co-organizer's key used through an AI link is refused the same way; used in the console it is not refused by this check", async () => {
    const t = await team();
    for (const r of ROUTES) {
      const v = viaLink(t.host, r); const res = await call(v.method, v.path); const body = await j(res);
      expect([r.name, res.status, body.error]).toEqual([r.name, 403, MESSAGE]);
    }
    // the same key with the header an AI work link adds (x-cb-link), sent straight to the API
    for (const r of ROUTES) { const res = await call(r.method, r.path, r.body, t.host, { "x-cb-link": "1" }); expect([r.name, res.status, (await j(res)).error]).toEqual([r.name, 403, MESSAGE]); }
    nothingMade();
    // in the console (no work link) a co-organizer may make a pay link and read the credit
    const consolePay = await call("POST", "/api/z/AIP-1/paylink", {}, t.host);
    if (rules) expect([consolePay.status, (await j(consolePay)).code]).toEqual([410, "pay-in-console"]); else { expect(consolePay.status).toBe(200); expect((await j(consolePay)).url).toMatch(/paylink\.html\?t=/); }
    expect((await call("GET", "/api/org/credit", undefined, t.host)).status).toBe(200);
  });

  test("the organizer and the co-organizer are not refused by this check, and a Co-host of the game keeps what the code gives them today", async () => {
    const t = await team();
    for (const [who, key] of [["organizer", t.master], ["co-organizer", t.host], ["Co-host", t.cohost]] as const) {
      for (const r of ROUTES.filter((x) => x.path !== "/api/z/NOPE-1/paylink")) {
        const res = await callTick(r.method === "GET" ? "GET" : r.method, r.path, (r.body ?? {}) as Record<string, unknown>, key).catch((e) => { throw new Error(`${who} ${r.name}: ${e}`); });
        const body = await j(res.clone().status === 204 ? new Response("{}") : res);
        expect([who, r.name, body.error === MESSAGE, body.code === "ai-cannot-pay"]).toEqual([who, r.name, false, false]);
      }
    }
    // what each one gets, plainly
    const org = await j(await callTick("POST", "/api/checkout", { eid: "AIP-1", org: "Acme", name: "Boss", email: "payer@acme.com", country: "IN", currency: "INR" }, t.master));
    if (rules) expect(org.code).toBe("pay-in-console"); else expect(org.mode).toBe("razorpay");
    expect((await call("GET", "/api/org/credit", undefined, t.master)).status).toBe(200);
    expect((await call("GET", "/api/org/credit", undefined, t.cohost)).status).toBe(403); // a Co-host is not shown the credit: as before, and not with the AI message
    const cohostLink = await call("POST", "/api/z/AIP-1/paylink", {}, t.cohost);
    expect(cohostLink.status).toBe(rules ? 410 : 200); // a Co-host may make the pay link of their own game: as before
  });

  test("the AI key still does its allowed work: read, change settings before the start, read back", async () => {
    const t = await team();
    expect((await call("GET", "/api/z/AIP-1/summary", undefined, t.ai)).status).toBe(200);
    const set = await call("PATCH", "/api/z/AIP-1/settings", { name: "Welcome game", rewards: [{ pattern: "milestone", ordinal: 1, text: "Hamper" }, { pattern: "finish", ordinal: 1, text: "Tablet" }] }, t.ai);
    expect([set.status, set.status === 200 ? "" : (await set.clone().text()).slice(0, 200)]).toEqual([200, ""]);
    const back = await j(await call("GET", `/ai/${t.ai}/z/AIP-1/summary`));
    expect(back.rewards.map((x: any) => x.text)).toEqual(["Hamper", "Tablet"]);
    expect((await call("GET", "/api/history", undefined, t.ai)).status).toBe(200);
    expect((await call("GET", `/ai/${t.ai}/z/AIP-1/participants`)).status).toBe(200);
  });

  test("any other step that is the organizer's gets a plain, kind refusal with no my, mine, your or yours", async () => {
    const t = await team();
    for (const [m, p] of [["POST", "/api/z/AIP-1/erase"], ["POST", "/api/org/ai"], ["GET", "/api/org/keys"]] as const) {
      const r = await call(m, p, m === "POST" ? {} : undefined, t.ai); const body = await j(r);
      expect([m, p, r.status]).toEqual([m, p, 403]);
      if (body.error === DO_MESSAGE || /cannot do this/.test(body.error ?? "")) expect(body.error).toBe(DO_MESSAGE);
      expect(body.error ?? "").not.toMatch(/\b(my|mine|your|yours)\b/i);
    }
    const erase = await j(await call("POST", "/api/z/AIP-1/erase", {}, t.ai)); expect(erase.error).toBe(DO_MESSAGE);
  });
});

describe("the words and the list", () => {
  test("the messages are the owner's words, have no my, mine, your or yours, and name who can pay and where", () => {
    expect(AI_CANNOT_PAY).toBe(MESSAGE); expect(AI_CANNOT_DO).toBe(DO_MESSAGE);
    for (const m of [AI_CANNOT_PAY, AI_CANNOT_DO]) { expect(m).not.toMatch(/\b(my|mine|your|yours)\b/i); expect(m).toMatch(/^An AI assistant cannot /); expect(m).toMatch(/tell the organizer/i); }
    expect(AI_CANNOT_PAY).toMatch(/Pay now/); expect(AI_CANNOT_PAY).toMatch(/co-organizer/);
  });
  test("the list of payment addresses holds the seven the owner named (and the end of a payment) and nothing that is not a payment", () => {
    for (const p of ["/api/checkout", "/api/payments/test", "/api/payments/paytest", `/api/paylink/${TOKEN}/checkout`, "/api/z/GAME-1/paylink", "/api/z/GAME-1/pay-with-credit", "/api/org/credit", "/api/payments/verify"]) expect([p, PAY_PATH.test(p)]).toEqual([p, true]);
    for (const p of ["/api/z/GAME-1/settings", "/api/z/GAME-1/summary", "/api/payments/status", `/api/paylink/${TOKEN}`, "/api/org/credit/x", "/api/z/GAME-1/paylinks", "/api/history"]) expect([p, PAY_PATH.test(p)]).toEqual([p, false]);
  });
  test("an AI key and a work-link co-organizer are AI callers; the organizer, a co-organizer in the console and a Co-host are not", () => {
    expect([isAiCaller("ai", false), isAiCaller("ai", undefined), isAiCaller("host", true), isAiCaller("host", false), isAiCaller("master", false), isAiCaller("cohost", false), isAiCaller(null, false), isAiCaller("platform", false)]).toEqual([true, true, true, false, false, false, false, false]);
  });
  test("in the source, the AI check is the first thing payRoute does (before the owner rules, the consent and the body)", () => {
    const src = readFileSync(join(import.meta.dir, "../src/pay.ts"), "utf8"); const at = src.indexOf("export async function payRoute"); expect(at).toBeGreaterThan(0);
    const head = src.slice(at, at + 900);
    expect(head).toContain("aiPayGuard(req, env, now)"); expect(head.indexOf("aiPayGuard")).toBeLessThan(head.indexOf("const rzp"));
    expect(src.indexOf("aiPayGuard(req, env, now)", at)).toBeLessThan(src.indexOf("pay-in-console", at)); expect(src.indexOf("aiPayGuard(req, env, now)", at)).toBeLessThan(src.indexOf("checkConsent(\"K3\"", at));
  });
});
