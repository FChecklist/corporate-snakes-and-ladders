// O7: the organizer ends the game with a signed stop. The signature is the authorisation: the Worker accepts the organizer's stop at its control address, and every phone (the real PhoneRuntime,
// reading the public control file) stops at the same turn. A stop signed by anybody else is refused and the phones play on. Real Worker, real phones, a fake public beacon, virtual time.
// The console button itself calls TBControl.publish (packages/beacon/src/control-browser.ts), which signs with the key in the browser's key store and posts to this same address.
import { describe, expect, test } from "bun:test";
import { handle, type Env } from "../src/worker";
import { makeD1 } from "./d1-sqlite";
import { TICKS } from "./device";
import { PhoneRuntime } from "../../../packages/beacon/src/phone-runtime";
import { nextMessage, publicKeyFromSecret, readPublished, signControlWithSecret, type KV } from "../../../packages/beacon/src/control";
// @ts-ignore plain JS module shared with the other harnesses
import { fakeFetcher, fakeVerify, roundAt } from "../../../tools/sim2/lib/beacon.mjs";

const KEY = "11".repeat(32);

async function setup(players: number, seed: string) {
  const d = makeD1(); const raw = d.raw;
  const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", TEST_MODE: "1" } as unknown as Env;
  let vt = Date.UTC(2026, 9, 20, 10, 0, 0);
  const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, vt);
  const j = async (r: Response) => (await r.json()) as any;
  const org = await j(await req("POST", "/api/start", { email: "boss@acme.com", consent: TICKS }, { "cf-connecting-ip": "1.1.1.1" }));
  const h = { "x-organizer": org.token as string };
  const window = 20, startMs = vt + 10 * 60_000, startRound = roundAt(startMs);
  expect((await req("POST", "/api/z", { id: "EN-1", startRound, callSeconds: window, cap: 100 }, h)).status).toBe(200);
  expect((await req("POST", "/api/z/EN-1/publish", { email: "boss@acme.com", phone: "9876543210", consent: TICKS }, h)).status).toBe(200);
  raw.prepare("UPDATE engagement SET pack=100").run();
  expect((await req("PUT", "/api/z/EN-1/control/key", { publicKey: publicKeyFromSecret(KEY) }, h)).status).toBe(200);
  const fetcher = fakeFetcher(() => vt, seed);
  const phones = Array.from({ length: players }, (_, i) => {
    const mem = new Map<string, string>(); const ip = `10.1.0.${i + 1}`;
    const rt = new PhoneRuntime("EN-1", {
      api: async (m: string, path: string, b?: any) => { const r = await req(m, path, b, { "cf-connecting-ip": ip }); const jj: any = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(jj.error ?? "http " + r.status), { status: r.status }); return jj; },
      beacon: { fetcher: fetcher as any, mirrors: ["https://api.t", "https://api2.t", "https://api3.t"], timeoutMs: 400 },
      mono: () => vt, store: { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v) }, verify: fakeVerify(seed) as any,
    } as any);
    return { rt, i };
  });
  for (const p of phones) { await p.rt.boot(); expect(await p.rt.join("", "P" + p.i, undefined, TICKS as any)).toBeTruthy(); vt += 400; }
  vt = startMs - 30_000;
  const step = async (n = 1) => { for (let k = 0; k < n; k++) { vt += 3000; for (const p of phones) { try { await p.rt.tick(); } catch { /* the next step tries again */ } } } };
  const kv: KV = { get: async (k) => (raw.prepare("SELECT v FROM kv WHERE k=?").get(k) as any)?.v ?? null, put: async () => {} };
  const stop = async (secret: string) => { const f = (await readPublished(kv, "EN-1"))!; const msg = signControlWithSecret(secret, nextMessage(f, roundAt(vt), { action: "stop" })); const r = await req("POST", "/api/z/EN-1/control", { message: msg }, { "cf-connecting-ip": "9.9.9.9" }); return { status: r.status, body: await r.json().catch(() => ({})) }; };
  return { raw, phones, step, stop, j, req, vt: () => vt };
}
const turns = (ps: { rt: PhoneRuntime }[]) => ps.map((p) => p.rt.view().turnsPlayed);

describe("O7: the organizer's signed stop ends the game on every phone", () => {
  test("a stop the organizer signed is accepted; every phone ends at the same turn, long before the game would have ended by itself; without a stop the same game plays on", async () => {
    const g = await setup(6, "end6");
    await g.step(120);
    const before = turns(g.phones); expect(Math.min(...before)).toBeGreaterThan(0); expect(g.phones.every((p) => p.rt.phase !== "ended")).toBe(true);
    const r = await g.stop(KEY); expect(r.status).toBe(200);
    await g.step(200);
    expect(g.phones.every((p) => p.rt.phase === "ended")).toBe(true);
    const after = turns(g.phones); expect(new Set(after).size).toBe(1); // the same last turn on every phone
    expect(after[0]).toBeGreaterThanOrEqual(before[0]!); expect(after[0]).toBeLessThan(before[0]! + 8); // it stopped about when the stop took effect, a few turns at most after the press
    const tops = g.phones.map((p) => JSON.stringify(p.rt.view().top.map((x) => x.seat))); expect(new Set(tops).size).toBe(1); // and the same standings
    // the same game with nobody pressing stop is still going over the same stretch of time
    const c = await setup(6, "end6"); await c.step(120 + 200);
    expect(c.phones.some((p) => p.rt.phase === "ended")).toBe(false); expect(Math.min(...turns(c.phones))).toBeGreaterThan(after[0]!);
  }, 300_000);
  test("a stop signed by anybody else is refused and the phones play on", async () => {
    const g = await setup(4, "end4");
    await g.step(100);
    const r = await g.stop("22".repeat(32)); expect(r.status).toBe(403);
    const t0 = Math.max(...turns(g.phones)); await g.step(100);
    expect(g.phones.some((p) => p.rt.phase === "ended")).toBe(false); expect(Math.max(...turns(g.phones))).toBeGreaterThan(t0);
  }, 300_000);
});
