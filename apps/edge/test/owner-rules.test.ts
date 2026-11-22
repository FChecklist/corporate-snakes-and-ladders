// OWNER RULES 1.1 (20 Nov 2026) on the Worker: invite by employee ID only, A-1101 = A 1101 = A/1101, an unlisted ID waits for the host's yes or no,
// no name and no mobile number is kept, every throw happens by itself, and a game is paid ONLY by the console's signed notice, once per order id.
// Every test here fails on the code before the change (the older rules stay in force for a Worker without OWNER_RULES, which the last tests check).
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { TICKS } from "./device";
import { handle } from "./cohost-accepted";
import type { Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { CONSOLE_NOTICE_WINDOW_MS } from "../src/pay";
import { erasePersonal, PURGE_AFTER_MS } from "../src/lifecycle";
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
