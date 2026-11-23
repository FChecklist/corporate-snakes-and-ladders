// OWNER RULES 1.1 (20 Nov 2026) on the Worker: invite by employee ID only, A-1101 = A 1101 = A/1101, an unlisted ID waits for the host's yes or no,
// no name and no mobile number is kept, every throw happens by itself, and a game is paid ONLY by the console's signed notice, once per order id.
// Every test here fails on the code before the change (the older rules stay in force for a Worker without OWNER_RULES, which the last tests check).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TICKS } from "./device";
import { handle } from "./cohost-accepted";
import type { Env } from "../src/worker";
import { networkOf, retentionSweep } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { CONSOLE_NOTICE_WINDOW_MS, CONSOLE_SECRET_MIN } from "../src/pay";
import { erasePersonal, PURGE_AFTER_MS } from "../src/lifecycle";
import { loadRows, verifyChain } from "../src/audit";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 10, 22, 10, 0, 0);
const GEN = 1692803367;
const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const START = roundAt(T) + 1200; // one hour after T
const SECRET = "test-console-secret-not-a-real-one";
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let ipN = 0;
const realFetch = globalThis.fetch;
const call = (method: string, path: string, body?: unknown, key?: string, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...(key ? { "x-organizer": key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => (String(i).padStart(2, "0") + "c".repeat(32)).slice(0, 32);
const rowsOf = (sql: string, ...v: unknown[]) => raw.prepare(sql).all(...(v as any[])) as any[];
const hmac = async (secret: string, msg: string) => { const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg))), (b) => b.toString(16).padStart(2, "0")).join(""); };
/** The console's notice, signed the way the console signs it. */
async function notice(body: unknown, o: { ts?: number; secret?: string; sig?: string; now?: number } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body), ts = o.ts ?? T;
  const sig = o.sig ?? (await hmac(o.secret ?? SECRET, `${ts}.${text}`));
  return handle(new Request("http://x/api/console/paid", { method: "POST", headers: { "content-type": "application/json", "x-console-timestamp": String(ts), "x-console-signature": sig }, body: text }), env as Env, o.now ?? T);
}

async function setup(opts: { id?: string; envPatch?: Record<string, unknown> } = {}) {
  if (opts.envPatch) Object.assign(env, opts.envPatch);
  const st = await j(await handle(new Request("http://x/api/start", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `7.7.8.${++ipN}` }, body: JSON.stringify({ consent: TICKS, email: `o${ipN}@acme.com` }) }), env as Env, T));
  const master = st.token as string;
  const id = opts.id ?? "IDR-1";
  { const r = await call("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 100 }, master); const b = await r.clone().text(); expect([r.status, b.slice(0, 200)]).toEqual([200, expect.anything()]); }
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210", consent: TICKS }, master)).status).toBe(200);
  return { master, id };
}
const addIds = (key: string, people: unknown[], id = "IDR-1") => call("POST", `/api/z/${id}/people`, { people, consent: TICKS }, key);
const joinId = (id: string, empId: string, i: number, extra: Record<string, unknown> = {}) => call("POST", `/api/z/${id}/join`, { empId, device: dev(i), consent: TICKS, ...extra });

beforeEach(() => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://snakes.test", PHONE_SALT: "salt", OWNER_RULES: "1.1", CONSOLE_PAID_SECRET: SECRET } as PayEnv;
  (globalThis as any).fetch = async () => new Response("{}", { status: 404 });
});
afterEach(() => { globalThis.fetch = realFetch; });

describe("a game made under owner rules 1.1", () => {
  test("is by employee ID only, for the people on the list, with every throw by itself", async () => {
    const t = await setup();
    const s = await j(await call("GET", `/api/z/${t.id}/summary`, undefined, t.master));
    expect([s.ownerRules, s.verify, s.employeesOnly, s.whoCanJoin, s.invites.on]).toEqual([true, "id", true, "list", false]);
    const pub = await j(await call("GET", `/api/z/${t.id}/info`));
    expect([pub.ownerRules, pub.verify, pub.employeesOnly]).toEqual([true, "id", true]);
  });
  test("refuses a mobile-number game, an Email ID game, 'anyone with the link' and 'players throw', with a plain reason", async () => {
    const t = await setup();
    for (const [body, word] of [[{ verify: "mobile" }, "employee ID only"], [{ verify: "both" }, "employee ID only"], [{ idKind: "email" }, "employee ID only"], [{ employeesOnly: false }, "your yes or no"], [{ play: "presence" }, "by itself"]] as const) {
      const r = await call("PATCH", `/api/z/${t.id}/settings`, body, t.master); expect([JSON.stringify(body), r.status]).toEqual([JSON.stringify(body), 400]);
      expect((await j(r)).error).toContain(word);
    }
    // the choices that stay: prizes, board, turn length; and the rules stay on after a save that does not mention them
    expect((await call("PATCH", `/api/z/${t.id}/settings`, { rewards: [{ pattern: "finish", ordinal: 1, text: "" }] }, t.master)).status).toBe(200);
    const s = await j(await call("GET", `/api/z/${t.id}/summary`, undefined, t.master)); expect([s.ownerRules, s.verify, s.employeesOnly]).toEqual([true, "id", true]);
    // creating a game that asks for a mobile number is refused too
    const r2 = await call("POST", "/api/z", { id: "IDR-2", startRound: START, callSeconds: 10, cap: 100, verify: "mobile" }, t.master); expect(r2.status).toBe(400);
  });
  test("the older rules stay for a Worker without OWNER_RULES (so games already made are not changed)", async () => {
    delete (env as any).OWNER_RULES;
    const t = await setup();
    const s = await j(await call("GET", `/api/z/${t.id}/summary`, undefined, t.master)); expect([s.ownerRules, s.verify, s.employeesOnly]).toEqual([false, "mobile", false]);
    expect((await call("PATCH", `/api/z/${t.id}/settings`, { play: "presence", rewards: [{ pattern: "finish", ordinal: 1, text: "" }] }, t.master)).status).toBe(200);
  });
});

describe("a new game made from an older one", () => {
  test("'Create a new game like this one' makes a game under the rules, keeps the prizes, and takes no mobile-number list along", async () => {
    delete (env as any).OWNER_RULES; // an older game, made before the rules
    const t = await setup(); expect((await call("PATCH", `/api/z/${t.id}/settings`, { verify: "mobile", play: "presence", rewards: [{ pattern: "finish", ordinal: 1, text: "A hamper" }, { pattern: "nevermissed", ordinal: 1, text: "A pen" }] }, t.master)).status).toBe(200);
    (env as any).OWNER_RULES = "1.1";
    const r = await j(await call("POST", `/api/z/${t.id}/clone`, { startRound: START + 600, withPeople: true }, t.master)); expect(r.ok).toBe(true); expect(r.peopleCopied).toBe(0);
    const s = await j(await call("GET", `/api/z/${r.id}/summary`, undefined, t.master));
    expect([s.ownerRules, s.verify, s.employeesOnly, s.whoCanJoin]).toEqual([true, "id", true, "list"]);
    expect(s.rewards.map((x: any) => x.pattern)).toEqual(["finish"]); expect(s.rewards[0].text).toBe("A hamper"); // the prize that needs players to throw is left out
    const again = await j(await call("POST", `/api/z/${r.id}/clone`, { startRound: START + 900 }, t.master)); // a copy of a game under the rules stays under them
    expect((await j(await call("GET", `/api/z/${again.id}/summary`, undefined, t.master))).ownerRules).toBe(true);
  });
});

describe("invite by ID only", () => {
  test("A-1101, A 1101 and A/1101 are one ID, and no name or mobile number is kept", async () => {
    const t = await setup();
    const r = await j(await addIds(t.master, [{ empId: "A-1101", name: "Asha Rao", phone: "9876543210" }, { empId: "A 1101" }, { empId: "a/1101" }, { empId: "B-7" }]));
    expect([r.added, r.duplicates]).toEqual([2, 2]);
    const list = (await j(await call("GET", `/api/z/${t.id}/people`, undefined, t.master))).people as any[];
    expect(list.map((p) => p.empId).sort()).toEqual(["A1101", "B7"]);
    expect(list.every((p) => p.name === "" && p.maskedPhone === "")).toBe(true);
    // nothing readable about the person in the stored row either: the sealed record holds the ID only
    expect(rowsOf("SELECT pii FROM person WHERE eid=?", t.id).length).toBe(2);
  });
  test("a row with no ID is refused even when it carries a name and a number", async () => {
    const t = await setup();
    const r = await j(await addIds(t.master, [{ name: "Asha", phone: "9876543210" }]));
    expect(r.added).toBe(0); expect(r.invalid.length).toBe(1);
  });
  test("a listed person joins with any spelling of the ID; a name or number sent along is dropped; the same ID cannot take a second board", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }]);
    const a = await joinId(t.id, " a 1101 ", 1, { name: "Asha Rao", phone: "9876543210" }); expect(a.status).toBe(200);
    const stored = rowsOf("SELECT pii FROM participant WHERE eid=?", t.id); expect(stored.length).toBe(1);
    const me = ((await j(await call("GET", `/api/z/${t.id}/people`, undefined, t.master))).people as any[]).find((p) => p.empId === "A1101");
    expect([me?.status, me?.name, me?.maskedPhone]).toEqual(["joined", "", ""]); // the name and the number that were sent along were never kept
    const again = await joinId(t.id, "A/1101", 2); expect(again.status).not.toBe(200);
  });
  test("an ID that is not on the list waits for the host's yes or no; yes lets them in, no keeps them out", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }]);
    const w = await joinId(t.id, "Z-9", 5); expect(w.status).toBe(403); expect((await j(w)).code).toBe("waiting");
    const list = (await j(await call("GET", `/api/z/${t.id}/waiting`, undefined, t.master))).waiting as any[]; expect(list.length).toBe(1); expect(list[0].empId).toBe("Z9");
    expect((await call("POST", `/api/z/${t.id}/waiting/${list[0].id}`, { decision: "admit" }, t.master)).status).toBe(200);
    expect((await joinId(t.id, "z 9", 5)).status).toBe(200);
    const w2 = await joinId(t.id, "Y-8", 6); expect((await j(w2)).code).toBe("waiting");
    const l2 = (await j(await call("GET", `/api/z/${t.id}/waiting`, undefined, t.master))).waiting as any[];
    expect((await call("POST", `/api/z/${t.id}/waiting/${l2[0].id}`, { decision: "decline" }, t.master)).status).toBe(200);
    const after = await joinId(t.id, "Y-8", 6); expect(after.status).toBe(403); expect((await j(after)).code).toBe("declined");
  });
  test("a person with no ID, only a nickname or a mobile number, cannot come in", async () => {
    const t = await setup();
    const r = await call("POST", `/api/z/${t.id}/join`, { name: "Asha", device: dev(9), consent: TICKS }); expect(r.status).toBe(400); expect((await j(r)).code).toBe("need-id");
    const r2 = await call("POST", `/api/z/${t.id}/join`, { phone: "9876543210", device: dev(10), consent: TICKS }); expect(r2.status).toBe(400);
  });
  test("every ID is deleted with the other participant data, within 24 hours of the end", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }, { empId: "B-2" }]); await joinId(t.id, "A1101", 1); await joinId(t.id, "Q-5", 2);
    expect(PURGE_AFTER_MS).toBeLessThanOrEqual(24 * 3_600_000);
    expect(rowsOf("SELECT 1 FROM person WHERE eid=?", t.id).length + rowsOf("SELECT 1 FROM waiting WHERE eid=?", t.id).length + rowsOf("SELECT 1 FROM participant WHERE eid=?", t.id).length).toBeGreaterThan(0);
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    for (const tbl of ["person", "waiting", "participant", "seat"]) expect(rowsOf(`SELECT 1 FROM ${tbl} WHERE eid=?`, t.id).length).toBe(0);
    expect(rowsOf("SELECT 1 FROM kv WHERE k LIKE ?", `idx/${t.id}/%`).length).toBe(0);
  });
});

describe("paid only by the console's signed notice", () => {
  const paidOf = async (t: { master: string; id: string }) => (await j(await call("GET", `/api/z/${t.id}/summary`, undefined, t.master))).paid;
  test("this site takes no money itself: checkout, the Rs 1 test, the payment-test and the pay link all say 'you pay in the console'", async () => {
    const t = await setup();
    for (const [m, p, b] of [["POST", "/api/checkout", { eid: t.id, consent: TICKS }], ["POST", "/api/payments/test", { eid: t.id }], ["POST", "/api/payments/paytest", {}], ["POST", `/api/z/${t.id}/paylink`, {}], ["POST", `/api/z/${t.id}/pay-with-credit`, {}]] as const) {
      const r = await call(m, p, b, t.master); expect([p, r.status]).toEqual([p, 410]); expect((await j(r)).code).toBe("pay-in-console");
    }
    expect(await paidOf(t)).toBe(false);
    const st = await j(await call("GET", "/api/payments/status")); expect(st.ownerRules).toBe(true);
  });
  test("with no secret set, or without the rules, the address does not exist", async () => {
    const t = await setup();
    delete (env as any).CONSOLE_PAID_SECRET; expect((await notice({ orderId: "ORD-000001", gameId: t.id })).status).toBe(404);
    (env as any).CONSOLE_PAID_SECRET = SECRET; delete (env as any).OWNER_RULES; expect((await notice({ orderId: "ORD-000001", gameId: t.id })).status).toBe(404);
    expect(await paidOf(t)).toBe(false);
  });
  test("a wrong signature, a wrong secret, an edited body, a missing or old time and a GET all change nothing", async () => {
    const t = await setup(); const body = { orderId: "ORD-000002", gameId: t.id }, text = JSON.stringify(body);
    expect((await notice(body, { sig: "0".repeat(64) })).status).toBe(401);
    expect((await notice(body, { secret: "another-secret" })).status).toBe(401);
    expect((await notice(body, { sig: "nothex" })).status).toBe(401);
    const good = await hmac(SECRET, `${T}.${text}`);
    expect((await notice({ ...body, gameId: "IDR-OTHER" }, { sig: good })).status).toBe(401); // signed for another body
    expect((await notice(body, { ts: T - CONSOLE_NOTICE_WINDOW_MS - 1 })).status).toBe(401); // too old: no replay of an old notice
    expect((await notice(body, { ts: T + CONSOLE_NOTICE_WINDOW_MS + 1 })).status).toBe(401);
    expect((await handle(new Request("http://x/api/console/paid", { method: "GET" }), env as Env, T)).status).toBe(404);
    expect((await handle(new Request("http://x/api/console/paid", { method: "POST", body: text }), env as Env, T)).status).toBe(401); // no headers at all
    expect(await paidOf(t)).toBe(false); expect(rowsOf("SELECT 1 FROM kv WHERE k LIKE 'cpaid/%'").length).toBe(0);
  });
  test("a signed notice marks the game paid, once per order id: a repeat answers 'already', another game with the same order id is refused", async () => {
    const t = await setup(); const u = await setup({ id: "IDR-2" });
    expect(await paidOf(t)).toBe(false);
    const r1 = await notice({ orderId: "ORD-100001", gameId: t.id }); expect(r1.status).toBe(200); expect(await j(r1)).toMatchObject({ ok: true, paid: true });
    expect(await paidOf(t)).toBe(true);
    const r2 = await j(await notice({ orderId: "ORD-100001", gameId: t.id })); expect(r2).toMatchObject({ ok: true, already: true });
    const r3 = await notice({ orderId: "ORD-100001", gameId: u.id }); expect(r3.status).toBe(409); expect((await j(r3)).code).toBe("order-reused");
    expect(await paidOf(u)).toBe(false);
    expect(rowsOf("SELECT 1 FROM kv WHERE k='cpaid/ORD-100001'").length).toBe(1);
    // a second, different order for a game that is already paid changes nothing
    const pack = rowsOf("SELECT pack FROM engagement WHERE id=?", t.id)[0].pack;
    expect((await j(await notice({ orderId: "ORD-100002", gameId: t.id }))).already).toBe(true);
    expect(rowsOf("SELECT pack FROM engagement WHERE id=?", t.id)[0].pack).toBe(pack);
    expect(rowsOf("SELECT 1 FROM payment").length).toBe(0); // no payment row, no invoice: the console already took the money
  });
  test("the same notice sent twice at once marks the game paid once", async () => {
    const t = await setup();
    const rs = await Promise.all([notice({ orderId: "ORD-200001", gameId: t.id }), notice({ orderId: "ORD-200001", gameId: t.id })]);
    expect(rs.map((r) => r.status)).toEqual([200, 200]); expect(await paidOf(t)).toBe(true); expect(rowsOf("SELECT 1 FROM kv WHERE k='cpaid/ORD-200001'").length).toBe(1);
  });
  test("a game that does not exist, a cancelled game and a bad notice are refused; nothing is recorded", async () => {
    const t = await setup();
    expect((await notice({ orderId: "ORD-300001", gameId: "NOPE-1" })).status).toBe(404);
    expect((await notice({ orderId: "x", gameId: t.id })).status).toBe(400);
    expect((await notice({ orderId: "ORD-300002" })).status).toBe(400);
    expect((await notice("not json")).status).toBe(400);
    expect((await notice(" ".repeat(2000))).status).toBe(413);
    expect((await handle(new Request("http://x/api/console/paid", { method: "POST", headers: { "content-length": "5000", "x-console-timestamp": String(T), "x-console-signature": "0".repeat(64) }, body: "{}" }), env as Env, T)).status).toBe(413); // refused on the declared size, before the body is read
    raw.prepare("UPDATE engagement SET cancelled_ms=? WHERE id=?").run(T, t.id);
    expect((await notice({ orderId: "ORD-300003", gameId: t.id })).status).toBe(409);
    expect(rowsOf("SELECT 1 FROM kv WHERE k LIKE 'cpaid/%'").length).toBe(0);
  });
  test("a game paid after its start time begins 2 minutes after the notice, like any late payment", async () => {
    const t = await setup();
    const late = roundAt(T) + 1300; const lateMs = (GEN + (late - 1) * 3) * 1000 + 60_000;
    const before = rowsOf("SELECT start_round FROM engagement WHERE id=?", t.id)[0].start_round;
    expect((await notice({ orderId: "ORD-400001", gameId: t.id }, { ts: lateMs, now: lateMs })).status).toBe(200);
    const after = rowsOf("SELECT start_round FROM engagement WHERE id=?", t.id)[0].start_round;
    expect(after).toBeGreaterThan(before);
  });
});

// ------------------------------------------------------------------------------------------------ version 1.5.1: guessing IDs (audit M1) and the paid notice (audit lows)
describe("guessing employee IDs: wrong IDs are limited for each network, a right ID is never counted (owner decision)", () => {
  const LIMIT = 30;
  const from = (ip: string, path: string, body: Record<string, unknown>, now = T) => handle(new Request("http://x" + path, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": ip }, body: JSON.stringify({ consent: TICKS, ...body }) }), env as Env, now);
  const joinFrom = (t: { id: string }, ip: string, empId: string, i: number, now = T) => from(ip, `/api/z/${t.id}/join`, { empId, device: dev(i) }, now);
  const whoFrom = (t: { id: string }, ip: string, empId: string) => from(ip, `/api/z/${t.id}/who`, { empId });
  const guess = async (t: { id: string }, ip: (i: number) => string, n: number, start = 0) => { const codes: number[] = []; for (let i = 0; i < n; i++) codes.push((await joinFrom(t, ip(i), "Z-" + (start + i), 100 + start + i)).status); return codes; };
  test("networkOf: IPv4 as it is; IPv6 by its first 64 bits however it is written; no address is one shared bucket", () => {
    expect(networkOf("203.0.113.9")).toBe("203.0.113.9");
    expect(networkOf("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(networkOf("2001:0DB8:0001:0002::1"));
    expect(networkOf("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe(networkOf("2001:db8:1:2::"));
    expect(networkOf("2001:db8:1:2::1")).not.toBe(networkOf("2001:db8:1:3::1"));
    expect(networkOf("2001:db8::5")).toBe(networkOf("2001:db8:0:0:1:2:3:4"));
    expect(networkOf("::ffff:203.0.113.9")).toBe("203.0.113.9");
    expect([networkOf(null), networkOf(""), networkOf(undefined)]).toEqual(["local", "local", "local"]);
  });
  test("one address: the 31st wrong ID is refused (429) and is not queued; a right ID from the same address still comes in", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }]);
    const codes = await guess(t, () => "9.9.9.9", LIMIT + 5);
    expect(codes.slice(0, LIMIT).every((c) => c === 403)).toBe(true); expect(codes.slice(LIMIT)).toEqual([429, 429, 429, 429, 429]);
    expect(rowsOf("SELECT 1 FROM waiting WHERE eid=?", t.id).length).toBe(LIMIT);
    const ok = await joinFrom(t, "9.9.9.9", "A-1101", 1); expect(ok.status).toBe(200); // the owner's decision: a right ID is never counted or refused by the guessing limit
  });
  test("many addresses inside one IPv6 /64 are one network: 60 guesses from 60 addresses are limited", async () => {
    const t = await setup();
    const codes = await guess(t, (i) => `2001:db8:77:8:${(i + 1).toString(16)}:${(i * 7 + 3).toString(16)}::${(i + 9).toString(16)}`, 60);
    expect(codes.filter((c) => c === 429).length).toBe(60 - LIMIT);
    expect((await joinFrom(t, "2001:db8:77:9::1", "Z-900", 900)).status).toBe(403); // another /64 and another IPv4 address have their own allowance
    expect((await joinFrom(t, "9.9.9.10", "Z-901", 901)).status).toBe(403);
  });
  test("guesses sent at the same moment: no more than the limit get through", async () => {
    const t = await setup();
    const rs = await Promise.all(Array.from({ length: 50 }, (_, i) => joinFrom(t, "9.9.9.9", "Z-" + i, 100 + i)));
    expect(rs.filter((r) => r.status !== 429).length).toBeLessThanOrEqual(LIMIT); expect(rs.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(50 - LIMIT);
  });
  test("'Is this you?' and the join share one count; a right ID in 'Is this you?' is never counted", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }]);
    for (let i = 0; i < 100; i++) { const r = await whoFrom(t, "9.9.9.9", "A-1101"); expect([r.status, (await j(r)).known]).toEqual([200, true]); }
    for (let i = 0; i < LIMIT / 2; i++) expect((await whoFrom(t, "9.9.9.9", "Q-" + i)).status).toBe(200);
    for (let i = 0; i < LIMIT / 2; i++) expect((await joinFrom(t, "9.9.9.9", "Q-" + (50 + i), 200 + i)).status).toBe(403);
    expect((await whoFrom(t, "9.9.9.9", "Q-99")).status).toBe(429);
    expect((await joinFrom(t, "9.9.9.9", "Q-98", 298)).status).toBe(429);
    expect((await whoFrom(t, "9.9.9.9", "A-1101")).status).toBe(200);
    expect((await whoFrom(t, "9.9.9.10", "Q-99")).status).toBe(200);
  });
  test("the count is per game and per 10 minutes", async () => {
    const t = await setup(); const u = await setup({ id: "IDR-2" });
    await guess(t, () => "9.9.9.9", LIMIT + 1);
    expect((await joinFrom(t, "9.9.9.9", "Z-1", 1)).status).toBe(429);
    expect((await joinFrom(u, "9.9.9.9", "Z-1", 1)).status).toBe(403);
    expect((await joinFrom(t, "9.9.9.9", "Z-1", 1, T + 11 * 60_000)).status).toBe(403);
  });
  test("the wrong-ID counters hold a hash of the network only, and go with the game's participant data and the daily clean-up", async () => {
    const t = await setup();
    await guess(t, () => "9.9.9.9", 3);
    const rows = rowsOf("SELECT k FROM kv WHERE k LIKE 'idmiss/%'"); expect(rows.length).toBe(1); expect(rows[0].k).not.toContain("9.9.9.9");
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    expect(rowsOf("SELECT 1 FROM kv WHERE k LIKE 'idmiss/%'").length).toBe(0);
    raw.prepare("INSERT INTO kv(k,v) VALUES(?,?)").run(`idmiss/OLD-1/2026-11-01T10:0/abcd`, "5");
    await retentionSweep(env as unknown as Env, T);
    expect(rowsOf("SELECT 1 FROM kv WHERE k LIKE 'idmiss/%'").length).toBe(0);
  });
});

describe("the console's notice: a short secret, one order id for two games, an order that is already paid", () => {
  const paidOf = async (t: { master: string; id: string }) => (await j(await call("GET", `/api/z/${t.id}/summary`, undefined, t.master))).paid;
  test("a secret shorter than the minimum counts as no secret: the address does not exist", async () => {
    const t = await setup(); const short = "s".repeat(CONSOLE_SECRET_MIN - 1); (env as any).CONSOLE_PAID_SECRET = short;
    expect((await notice({ orderId: "ORD-500001", gameId: t.id }, { secret: short })).status).toBe(404); expect(await paidOf(t)).toBe(false);
    const ok = "s".repeat(CONSOLE_SECRET_MIN); (env as any).CONSOLE_PAID_SECRET = ok;
    expect((await notice({ orderId: "ORD-500001", gameId: t.id }, { secret: ok })).status).toBe(200);
  });
  test("two signed notices with ONE order id for two games at the same moment mark one game paid, never both", async () => {
    const t = await setup(); const u = await setup({ id: "IDR-2" });
    const rs = await Promise.all([notice({ orderId: "ORD-600001", gameId: t.id }), notice({ orderId: "ORD-600001", gameId: u.id })]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect([await paidOf(t), await paidOf(u)].filter(Boolean).length).toBe(1);
    expect(rowsOf("SELECT 1 FROM kv WHERE k='cpaid/ORD-600001'").length).toBe(1);
  });
  test("a second order id for a game that is already paid answers 'already' and is not used up", async () => {
    const t = await setup(); expect((await notice({ orderId: "ORD-700001", gameId: t.id })).status).toBe(200);
    expect((await j(await notice({ orderId: "ORD-700002", gameId: t.id }))).already).toBe(true);
    expect(rowsOf("SELECT 1 FROM kv WHERE k='cpaid/ORD-700002'").length).toBe(0);
  });
});

describe("1.5.2: the paid notice finishes after a failure", () => {
  const paidOf = async (t: { master: string; id: string }) => (await j(await call("GET", `/api/z/${t.id}/summary`, undefined, t.master))).paid;
  /** Makes the first statement that starts with `prefix` fail once, the way a passing database error would. */
  const failOnce = (prefix: string) => { const real = env.DB.prepare.bind(env.DB); let hit = 0; (env as any).DB = { ...env.DB, prepare: (sql: string) => { if (!hit && sql.startsWith(prefix)) { hit++; const s: any = real(sql); const wrap = (x: any): any => ({ ...x, bind: (...v: unknown[]) => wrap(x.bind(...v)), run: async () => { throw new Error("D1 error"); }, sync: () => { throw new Error("D1 error"); } }); return wrap(s); } return real(sql); }, batch: env.DB.batch.bind(env.DB) }; return () => hit; };

  test("if the database fails between the claim and the game update, nothing stays behind and the console's retry marks the game paid", async () => {
    const t = await setup(); const hits = failOnce("UPDATE engagement SET pack");
    const first = await notice({ orderId: "ORD-800001", gameId: t.id });
    expect([first.status, (await j(first)).code]).toEqual([503, "try-again"]); expect(hits()).toBe(1);
    expect(await paidOf(t)).toBe(false); expect(rowsOf("SELECT 1 FROM kv WHERE k='cpaid/ORD-800001'").length).toBe(0);
    const retry = await j(await notice({ orderId: "ORD-800001", gameId: t.id }));
    expect([retry.ok, retry.already]).toEqual([true, undefined]); expect(await paidOf(t)).toBe(true);
  });
  test("a claim row left for an UNPAID game never answers 'already': the repeat marks the game paid", async () => {
    const t = await setup(); raw.prepare("INSERT INTO kv(k,v) VALUES(?,?)").run("cpaid/ORD-800002", JSON.stringify({ gameId: t.id, ms: T - 1000 }));
    const r = await j(await notice({ orderId: "ORD-800002", gameId: t.id }));
    expect([r.ok, r.paid, r.already]).toEqual([true, true, undefined]); expect(await paidOf(t)).toBe(true);
    expect((await j(await notice({ orderId: "ORD-800002", gameId: t.id }))).already).toBe(true); // now it really is paid
  });
  test("a claim row of ANOTHER game still refuses with 409 and marks nothing", async () => {
    const t = await setup(); const u = await setup({ id: "IDR-2" });
    raw.prepare("INSERT INTO kv(k,v) VALUES(?,?)").run("cpaid/ORD-800003", JSON.stringify({ gameId: u.id, ms: T - 1000 }));
    const r = await notice({ orderId: "ORD-800003", gameId: t.id }); expect([r.status, (await j(r)).code]).toEqual([409, "order-reused"]);
    expect([await paidOf(t), await paidOf(u)]).toEqual([false, false]);
  });
  test("the test database now behaves like D1: a batch that fails leaves none of its statements behind", async () => {
    raw.prepare("INSERT INTO kv(k,v) VALUES('x/1','a')").run();
    await expect(env.DB.batch([env.DB.prepare("INSERT INTO kv(k,v) VALUES(?,?)").bind("x/2", "b"), env.DB.prepare("INSERT INTO kv(k,v) VALUES(?,?)").bind("x/1", "dup")])).rejects.toBeDefined();
    expect(rowsOf("SELECT 1 FROM kv WHERE k='x/2'").length).toBe(0);
  });

  test("audit 2 L1: a reply lost AFTER the database committed does not free the order id; the notice is finished as a success and the id cannot be used for another game", async () => {
    const t = await setup(); const u = await setup({ id: "IDR-2" });
    const realBatch = env.DB.batch.bind(env.DB); let n = 0;
    (env as any).DB = { ...env.DB, prepare: env.DB.prepare.bind(env.DB), batch: async (st: unknown[]) => { const r = await realBatch(st as any); if (!n++) throw new Error("reply lost after commit"); return r; } };
    const first = await notice({ orderId: "ORD-800010", gameId: t.id });
    expect([first.status, (await j(first)).paid]).toEqual([200, true]); expect(await paidOf(t)).toBe(true);
    expect(rowsOf("SELECT 1 FROM kv WHERE k='cpaid/ORD-800010'").length).toBe(1);
    expect(rowsOf("SELECT 1 FROM kv WHERE k=?", `paidby/${t.id}`).length).toBe(1); // finished like any marked game
    const other = await notice({ orderId: "ORD-800010", gameId: u.id }); expect([other.status, (await j(other)).code]).toEqual([409, "order-reused"]); expect(await paidOf(u)).toBe(false);
  });
  test("audit 2 L2: if the markers fail after the batch, the console's repeat writes them (the game is already paid, and the repeat says so)", async () => {
    const t = await setup(); const hits = failOnce("INSERT OR IGNORE INTO kv");
    const first = await notice({ orderId: "ORD-800011", gameId: t.id }).then((r) => r.status, () => 500); expect(first).toBeGreaterThanOrEqual(500); expect(hits()).toBe(1);
    expect(await paidOf(t)).toBe(true); expect(rowsOf("SELECT 1 FROM kv WHERE k=?", `paidby/${t.id}`).length).toBe(0);
    const again = await j(await notice({ orderId: "ORD-800011", gameId: t.id })); expect([again.ok, again.already]).toEqual([true, true]);
    expect(rowsOf("SELECT 1 FROM kv WHERE k=?", `pub/${t.id}`).length).toBe(1); expect(rowsOf("SELECT 1 FROM kv WHERE k=?", `paidby/${t.id}`).length).toBe(1);
  });

  const WIN_NAME = "Asha Rao", WIN_PHONE = "+917012345678", WIN_IP = "203.0.113.77";
});

describe("1.5.4 (audit M1, M2, L4): a winner's name and mobile number are kept 365 days on purpose; the network address, phone details and every other guest's details are not", () => {
  const WIN_NAME = "Asha Rao", WIN_PHONE = "+917012345678", WIN_IP = "203.0.113.77";
  /** The winner's own phone confirming its name and number, from a known network address and browser. */
  const confirm = (id: string, pid: string, name: string, phone: string, now = T) => handle(new Request(`http://x/api/z/${id}/confirm`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": WIN_IP, "user-agent": "Mozilla/5.0 (Linux; Android 14) Chrome/124.0 Mobile Safari/537.36", "x-request-id": "Asha-typed-this-free-text" }, body: JSON.stringify({ pid, device: dev(1), name, phone }) }), env as Env, now);
  /** A game, a listed person who joined by ID, and a prize row for them; the winner then confirms their details with the rules switch `flagAtConfirm` ("1.1" or off). */
  const winner = async (id = "IDR-1", flagAtConfirm = true) => {
    const t = await setup({ id }); await addIds(t.master, [{ empId: "A-1101" }], id);
    const jn = await j(await joinId(t.id, "A1101", 1)); const pid = jn.pid as string; const seat = Number(pid.split("x")[0]);
    const pii = (rowsOf("SELECT pii FROM participant WHERE eid=? AND pid=?", t.id, pid)[0] as any).pii;
    raw.prepare("INSERT INTO prize(eid,round,pattern,ordinal,seat,pii,orig) VALUES(?,?,?,?,?,?,?)").run(t.id, 1, "early5", 1, seat, pii, pii);
    if (!flagAtConfirm) delete (env as any).OWNER_RULES;
    const conf = await confirm(t.id, pid, WIN_NAME, WIN_PHONE);
    expect(conf.status).toBe(200);
    return { t, pid, seat };
  };
  /** Everything a person could read from: the opened audit log of the game, plus every column of every table (sealed columns can only be read through the log). */
  const leftOf = async (t: { id: string }, needles: string[]) => {
    const log = JSON.stringify(await loadRows(env as any, t.id));
    const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map((x) => x.name as string);
    let tablesText = ""; for (const n of tables) tablesText += JSON.stringify(raw.prepare(`SELECT * FROM "${n}"`).all());
    return { found: needles.filter((x) => log.includes(x) || tablesText.includes(x)), foundInLog: needles.filter((x) => log.includes(x)) };
  };
  const prizeDetails = async (t: { id: string }) => (await loadRows(env as any, t.id)).find((r) => r.event === "prize")?.details;
  const openedPrize = async (t: { id: string }) => { const row = rowsOf("SELECT pii FROM prize WHERE eid=?", t.id)[0]; return row?.pii ? await (await import("../src/pii")).openPii(env as any, row.pii) : null; };

  test("after the 24-hour deletion the winner's name, mobile number and ID are still in the prize record (kept 365 days, owner rule), and the winners record stays", async () => {
    const { t, seat } = await winner();
    const before = rowsOf("SELECT pii, orig, trail, confirmed_ms FROM prize WHERE eid=?", t.id)[0]; expect(before.pii).toBeTruthy();
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    const after = rowsOf("SELECT seat, round, pattern, ordinal, pii, orig, trail, confirmed_ms FROM prize WHERE eid=?", t.id);
    expect(after.length).toBe(1); expect(after[0]).toMatchObject({ seat, round: 1, pattern: "early5", ordinal: 1, pii: before.pii, orig: before.orig, trail: before.trail }); expect(after[0].confirmed_ms).toBe(before.confirmed_ms);
    const kept = (await openedPrize(t))!; expect(kept).toMatchObject({ name: WIN_NAME, empId: "A1101" }); expect(String(kept.phone)).toContain("7012345678");
    expect(rowsOf("SELECT COUNT(*) AS c FROM participant WHERE eid=?", t.id)[0].c).toBe(0); // everyone else's details are gone
    expect(rowsOf("SELECT COUNT(*) AS c FROM seat WHERE eid=?", t.id)[0].c).toBe(0);
  });
  test("audit M1: after the deletion the audit log still holds the winner's name and mobile number (and the seat), and NOT the network address, the browser, the phone id or the participant id; the chain verifies", async () => {
    const { t, pid, seat } = await winner();
    const live = await leftOf(t, [WIN_NAME, "7012345678", WIN_IP, dev(1), pid, "Chrome"]);
    expect(live.foundInLog).toEqual(expect.arrayContaining([WIN_NAME, "7012345678", WIN_IP, dev(1), pid, "Chrome"])); // the probe sees all of it while the game is live
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    const gone = await leftOf(t, [WIN_IP, dev(1), pid, "Chrome", "Android", "Asha-typed-this-free-text"]);
    expect(gone.found).toEqual([]);
    const kept = await leftOf(t, [WIN_NAME, "7012345678"]); expect(kept.foundInLog).toEqual([WIN_NAME, "7012345678"]);
    const d = await prizeDetails(t);
    expect(d).toMatchObject({ personal_data_erased: true, winner: { seat, name: WIN_NAME }, status: 200 }); expect(String(d.winner.phone)).toContain("7012345678");
    expect(JSON.stringify(d)).not.toMatch(/ip|user_agent|browser|device/i);
    expect(rowsOf("SELECT COUNT(*) AS c FROM audit_pii WHERE eid=?", t.id)[0].c).toBe(0); expect(rowsOf("SELECT COUNT(*) AS c FROM eng_key WHERE eid=?", t.id)[0].c).toBe(0);
    const v = await verifyChain(env.DB as any, t.id); expect([v.ok, v.brokenAtSeq]).toEqual([true, null]);
  });
  test("audit M1 (the switch-over): the same result whether the rules switch was on or off when the winner confirmed, and on or off when the deletion ran; nothing depends on it", async () => {
    let n = 0;
    for (const [onWhenConfirmed, onWhenDeleted] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      env.OWNER_RULES = "1.1";
      const { t, pid } = await winner("IDR-S" + ++n, onWhenConfirmed);
      if (onWhenDeleted) env.OWNER_RULES = "1.1"; else delete (env as any).OWNER_RULES;
      await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
      expect([onWhenConfirmed, onWhenDeleted, (await leftOf(t, [WIN_IP, dev(1), pid])).found]).toEqual([onWhenConfirmed, onWhenDeleted, []]);
      expect([onWhenConfirmed, onWhenDeleted, (await leftOf(t, [WIN_NAME, "7012345678"])).foundInLog]).toEqual([onWhenConfirmed, onWhenDeleted, [WIN_NAME, "7012345678"]]);
      expect([onWhenConfirmed, onWhenDeleted, (await openedPrize(t))?.name]).toEqual([onWhenConfirmed, onWhenDeleted, WIN_NAME]);
    }
    env.OWNER_RULES = "1.1";
  });
  test("a legal hold keeps the sealed personal part (nothing is shredded under a hold); once the hold is lifted and the deletion runs again, only the winner's own part is left", async () => {
    const { t, pid } = await winner();
    raw.prepare("INSERT INTO legal_hold(eid,at_ms,note) VALUES(?,?,?)").run(t.id, T, "test hold");
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    expect((await leftOf(t, [WIN_IP, WIN_NAME])).foundInLog).toEqual([WIN_IP, WIN_NAME]);
    raw.prepare("DELETE FROM legal_hold WHERE eid=?").run(t.id);
    await erasePersonal(env as unknown as Env, t.id, T + 7_200_000, "test");
    expect((await leftOf(t, [WIN_IP, dev(1), pid])).found).toEqual([]);
    expect((await leftOf(t, [WIN_NAME])).foundInLog).toEqual([WIN_NAME]);
  });
  test("a late try after the deletion is refused and leaves the typed name and number nowhere", async () => {
    const { t, pid } = await winner();
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    const late = await confirm(t.id, pid, "Late Name", "+917099999999", T + 7_200_000); expect(late.status).toBe(403);
    expect((await leftOf(t, ["Late Name", "7099999999"])).found).toEqual([]);
  });
  test("audit M2: an employee ID typed into a link for a game that does not exist is kept nowhere, makes no key and no log row, and a script cannot fill the database this way", async () => {
    for (let i = 0; i < 20; i++) {
      const r = await handle(new Request(`http://x/api/z/GHOSTGAME${i}/join`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "198.51.100." + (i + 1) }, body: JSON.stringify({ empId: "ZZ-9999", device: dev(2), consent: TICKS }) }), env as Env, T);
      expect(r.status).toBe(404);
    }
    expect(rowsOf("SELECT COUNT(*) AS c FROM eng_key")[0].c).toBe(0);
    expect(rowsOf("SELECT COUNT(*) AS c FROM audit_log WHERE eid LIKE 'GHOSTGAME%'")[0].c).toBe(0);
    expect(rowsOf("SELECT COUNT(*) AS c FROM audit_pii")[0].c).toBe(0);
    const tables = (raw.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).map((x) => x.name as string);
    let all = ""; for (const n of tables) all += JSON.stringify(raw.prepare(`SELECT * FROM "${n}"`).all());
    expect(all).not.toContain("ZZ-9999");
  });
  test("a failed join for a REAL game keeps the typed ID only in the sealed part: it is gone after the 24-hour deletion", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }]);
    const r = await joinId(t.id, "ZZ-9999", 1); expect(r.status).toBeGreaterThanOrEqual(400);
    expect((await leftOf(t, ["ZZ-9999"])).foundInLog).toEqual(["ZZ-9999"]); // the log sees it while the game is live
    await erasePersonal(env as unknown as Env, t.id, T + 3_600_000, "test");
    expect((await leftOf(t, ["ZZ-9999"])).found).toEqual([]);
  });
  test("audit L4: the caller's own request id is never copied into the log; only the network's own id is", async () => {
    const t = await setup(); await addIds(t.master, [{ empId: "A-1101" }]);
    await handle(new Request(`http://x/api/z/${t.id}/join`, { method: "POST", headers: { "content-type": "application/json", "x-request-id": "ZZ-9999 typed by a caller", "cf-ray": "8abc123-BOM" }, body: JSON.stringify({ empId: "A1101", device: dev(1), consent: TICKS }) }), env as Env, T);
    const rows = rowsOf("SELECT corr, country FROM audit_log WHERE eid=? AND actor='participant'", t.id);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) { expect(r.corr).not.toContain("ZZ-9999"); expect(r.country).toBeNull(); }
    expect(rows.some((r) => r.corr === "8abc123-BOM")).toBe(true);
  });
  test("the words match what is kept: the report, the e-mails and the pages say a winner's name and mobile number are kept 365 days, and no network address or phone detail is", async () => {
    const { readFileSync } = await import("node:fs");
    const { layoutReport } = await import("../src/report-layout");
    const kept = /name, mobile number and employee ID/;
    const pdf = new TextDecoder("latin1").decode(layoutReport({ engagementId: "X", organizerEmail: "o@x.com", sentAtMs: T, scheduledMs: T, firstNumberMs: T, endMs: T, endReason: "ran", wasHeld: false, rounds: 1, callSeconds: 10, ticketsPerPerson: 1, cap: 10, inviteOnly: false, numbersCalled: 5, people: [], prizes: [], lucky: [], timeline: [], breaks: [], personalDeleteAtMs: T, fullDeleteAtMs: T + 365 * 86_400_000 } as any));
    expect(pdf).toMatch(/Kept for 365 days[\s\S]*name, mobile number and employee ID/); expect(pdf).not.toMatch(/go with everyone else|are deleted with everyone else's, so please keep/);
    const src = (f: string) => readFileSync(new URL(f, import.meta.url), "utf8");
    for (const f of ["../src/lifecycle.ts", "../src/worker.ts", "../src/trust-page.ts", "../../web/public/index.html", "../../web/public/llms.txt"]) {
      const text = src(f);
      expect([f, /go with everyone else|winnersGone|gone within 24 hours of the game ending, along with/.test(text)]).toEqual([f, false]); // the 1.5.3 wording that said the opposite is gone
    }
    expect(src("../src/lifecycle.ts")).toMatch(kept); expect(src("../src/worker.ts")).toMatch(/name, mobile number and employee ID, if any/); expect(src("../../web/public/index.html")).toMatch(/hand-over details \(the name, mobile number and employee ID, if any/);
    expect(src("../../web/public/llms.txt")).toMatch(/hand-over details/); expect(src("../src/trust-page.ts")).toMatch(/hand-over details/);
  });
});
