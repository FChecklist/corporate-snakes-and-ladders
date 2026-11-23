// The cheap Lows of the security audit of 23 Nov 2026 (L1 compare of secrets, L3 join counter, L5 the phone's proof out of the address, L6 the deletion never waits for the report).
// Every test fails on the source before this change.
import { beforeEach, describe, expect, test } from "bun:test";
import { SEEN_DEVICES, withDevice } from "./device";
import { handle, sameSecret, type Env } from "../src/worker";
import { endBoundMs, lifecycleTick, PURGE_AFTER_MS } from "../src/lifecycle";
import { makeD1 } from "./d1-sqlite";
import { readFileSync } from "node:fs";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const roundOf = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let org: Record<string, string>;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => { const d = String(i).padStart(32, "0"); SEEN_DEVICES.add(d); return d; };

beforeEach(async () => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "platform-secret-0123456789", CRON_KEY: "cron-secret-0123456789", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "10000000", DATA_KEY: "k", TEST_MODE: "1" } as any;
  org = { "x-organizer": (await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }))).token };
});
const game = async (id: string, startMs = T + 3_600_000) => {
  const c = await call("POST", "/api/z", { id, startRound: roundOf(startMs), callSeconds: 10, cap: 200 }, org); expect([c.status, JSON.stringify(await j(c.clone()))]).toEqual([200, expect.anything()]);
  const p = await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, org); expect([p.status, JSON.stringify(await j(p.clone()))]).toEqual([200, expect.anything()]);
};

describe("L1: secrets are compared in constant time", () => {
  test("sameSecret: equal text is yes; a different length, a wrong character, an empty text and an empty secret are no", () => {
    expect(sameSecret("abcdef0123456789", "abcdef0123456789")).toBe(true);
    for (const [a, b] of [["abcdef0123456788", "abcdef0123456789"], ["abcdef012345678", "abcdef0123456789"], ["abcdef01234567890", "abcdef0123456789"], ["", "abcdef0123456789"], ["", ""], ["x", ""]] as const) expect([a, b, sameSecret(a, b)]).toEqual([a, b, false]);
  });
  test("the platform key and the scheduler's key still open their doors, and a near miss does not", async () => {
    expect((await call("GET", "/api/history", undefined, { "x-organizer": "platform-secret-0123456789" })).status).toBe(200);
    expect((await call("GET", "/api/history", undefined, { "x-organizer": "platform-secret-0123456788" })).status).toBe(403);
    expect((await call("POST", "/api/lifecycle/tick", {}, { "x-cron-key": "cron-secret-0123456789" })).status).toBe(200);
    expect((await call("POST", "/api/lifecycle/tick", {}, { "x-cron-key": "cron-secret-0123456788" })).status).toBe(403);
  });
  test("no secret is compared with a plain ===", () => {
    const src = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/presented === env\.ORGANIZER_SECRET/); expect(src).not.toMatch(/jobKey\.trim\(\) === jobSecret/);
  });
});

describe("L3: the join counter counts the network, and counts in one step", () => {
  test("a phone that changes its address inside one IPv6 network does not start the count again", async () => {
    env = { ...env, JOIN_PER_IP_MINUTE: "3", JOIN_PER_IP_DAY: "1000" } as any;
    await game("L3-A", T + 3_600_000);
    const codes: number[] = [];
    for (let i = 1; i <= 8; i++) codes.push((await call("POST", "/api/z/L3-A/join", { name: "P" + i, device: dev(i) }, { "cf-connecting-ip": `2001:db8:abcd:12:${i}::${i}` })).status);
    expect(codes.filter((c) => c === 200).length).toBe(3); expect(codes.filter((c) => c === 429).length).toBe(5);
  });
  test("joins sent at the same moment from one address: no more than the limit get through", async () => {
    env = { ...env, JOIN_PER_IP_MINUTE: "5", JOIN_PER_IP_DAY: "1000" } as any;
    await game("L3-B", T + 3_600_000);
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => call("POST", "/api/z/L3-B/join", { name: "P" + i, device: dev(100 + i) }, { "cf-connecting-ip": "198.51.100.9" })));
    expect(rs.filter((r) => r.status === 200).length).toBe(5);
  });
});

describe("L5: a phone's proof is not sent in an address", () => {
  test("the phone asks for its prizes with POST and the proof in the body; a wrong proof is refused; no log row is written for the read", async () => {
    await game("L5-A");
    const jn = await j(await call("POST", "/api/z/L5-A/join", { name: "Asha", device: dev(1) }, {}, T)); expect(jn.pid).toBeTruthy();
    raw.prepare("INSERT INTO prize(eid,round,pattern,ordinal,seat) VALUES('L5-A',1,'finish',1,1)").run();
    const before = (raw.prepare("SELECT COUNT(*) c FROM audit_log").get() as any).c;
    const ok = await call("POST", "/api/z/L5-A/myprizes", { pid: jn.pid, device: dev(1) }); expect(ok.status).toBe(200); expect((await j(ok)).prizes.length).toBe(1);
    expect((raw.prepare("SELECT COUNT(*) c FROM audit_log").get() as any).c).toBe(before); // no row for the read itself
    expect((await call("POST", "/api/z/L5-A/myprizes", { pid: jn.pid, device: dev(2) })).status).toBe(403);
    expect((await call("POST", "/api/z/L5-A/myprizes", {})).status).toBe(400);
  });
  test("the game page no longer puts the device id in the address of that call", () => {
    const z = readFileSync(new URL("../../web/public/z.js", import.meta.url), "utf8");
    expect(z).not.toMatch(/myprizes\?pid=/); expect(z).toMatch(/api\("POST", `\/api\/z\/\$\{EID\}\/myprizes`, \{ pid: v\.pid, device: myDevice\(\) \}\)/);
  });
});

describe("L6: the 24-hour deletion does not wait for the report", () => {
  test("when the report step fails every time, the participants' data is still deleted on time", async () => {
    await game("L6-A"); await call("POST", "/api/z/L6-A/join", { name: "Asha", phone: "9876543210", device: dev(1) }, {}, T);
    await raw.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES('contact/L6-A','this is not json{')").run(); // the report step cannot read its contact and throws
    const end = await endBoundMs(env as any, raw.prepare("SELECT * FROM engagement WHERE id='L6-A'").get());
    for (let i = 0; i < 3; i++) await lifecycleTick(env as any, end + 5 * 60_000 + i * 60_000);
    expect((raw.prepare("SELECT COUNT(*) c FROM participant").get() as any).c).toBe(1); // not yet 24 hours
    await lifecycleTick(env as any, end + PURGE_AFTER_MS + 1000);
    expect((raw.prepare("SELECT COUNT(*) c FROM participant").get() as any).c).toBe(0);
    expect((raw.prepare("SELECT COUNT(*) c FROM seat").get() as any).c).toBe(0);
  });
});
