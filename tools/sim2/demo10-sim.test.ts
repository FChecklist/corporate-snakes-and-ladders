// PROOF OF THE FREE 10-PERSON DEMO (QA 2026-10-29). A customer (no test account, site in LIVE mode) makes a demo game, publishes it with no payment, ten real phone runtimes
// (the code the phone page runs) join through the real endpoints, the 11th is refused, the whole game is played in virtual time against the real Worker and a fake public beacon,
// and the results are compared with an independent computation. Run:  bun test tools/sim2/demo10-sim.test.ts --timeout 600000
import { describe, expect, test } from "bun:test";
import { handle, type Env } from "../../apps/edge/src/worker";
import { lifecycleTick } from "../../apps/edge/src/lifecycle";
import { sentReports } from "../../apps/edge/src/pay";
import { makeD1 } from "../../apps/edge/test/d1-sqlite";
import { TICKS } from "../../apps/edge/test/device";
import { PhoneRuntime } from "../../packages/beacon/src/phone-runtime";
import { settleRace, playRace, rankPlayers, defaultRaceCfg } from "../../packages/beacon/src/race";
import { betaOffset, turnRounds } from "../../packages/beacon/src/schedule";
import { GRACE_ROUNDS, DEMO_CAP } from "../../packages/beacon/src/config";
// @ts-ignore plain JS module shared with the other harnesses
import { fakeFetcher, fakeVerify, randomnessOf, roundAt } from "./lib/beacon.mjs";

const SEED = "demo10", WINDOW = 20;

describe("the free 10-person demo, played whole", () => {
  test("10 phones join a customer's demo game (Rs 0), the 11th is refused, the game is played to the end, every phone agrees and the winners are the independent ones", async () => {
    const d = makeD1(); const raw = d.raw;
    const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", PUBLIC_ORIGIN: "https://snakes.example" } as unknown as Env; // LIVE mode, no payment gateway, no test switch
    let vt = Date.UTC(2026, 9, 20, 10, 0, 0);
    const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, vt);
    const j = async (r: Response) => (await r.json()) as any;

    // 1. a customer, a demo game, published with no payment
    const org = await j(await req("POST", "/api/start", { email: "customer@acme.com", consent: TICKS }, { "cf-connecting-ip": "1.1.1.1" }));
    const h = { "x-organizer": org.token as string };
    const startMs = vt + 10 * 60_000, startRound = roundAt(startMs);
    const made = await req("POST", "/api/z", { id: "DEMO-SIM", startRound, callSeconds: WINDOW, cap: DEMO_CAP, demo: true }, h);
    expect(made.status).toBe(200); expect((await j(made)).demo).toBe(true);
    const tooBig = await req("POST", "/api/z", { id: "DEMO-BIG", startRound, callSeconds: WINDOW, cap: 11, demo: true }, h);
    expect(tooBig.status).toBe(400); expect((await j(tooBig)).code).toBe("demo-cap");
    const pub = await j(await req("POST", "/api/z/DEMO-SIM/publish", { email: "customer@acme.com", phone: "9876543210", consent: TICKS }, h));
    expect(pub).toMatchObject({ published: true, paid: true, demo: true, free: true });
    expect((raw.prepare("SELECT COUNT(*) c FROM payment").get() as any).c).toBe(0);       // Rs 0: no order, no payment
    expect((raw.prepare("SELECT COUNT(*) c FROM entitlement").get() as any).c).toBe(0);   // no pack was bought or used
    expect((raw.prepare("SELECT pack FROM engagement WHERE id='DEMO-SIM'").get() as any).pack).toBe(10);

    // 2. eleven phones, the same code the phone page runs
    const fetcher = fakeFetcher(() => vt, SEED);
    const mk = (i: number) => {
      const mem = new Map<string, string>(); const ip = `10.2.0.${i + 1}`;
      const rt = new PhoneRuntime("DEMO-SIM", {
        api: async (m: string, path: string, b?: any) => { const r = await req(m, path, b, { "cf-connecting-ip": ip }); const jj: any = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(jj.error ?? "http " + r.status), { status: r.status, body: jj }); return jj; },
        beacon: { fetcher: fetcher as any, mirrors: ["https://api.t", "https://api2.t", "https://api3.t"], timeoutMs: 400 },
        mono: () => vt, store: { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v) }, verify: fakeVerify(SEED) as any,
      } as any);
      return { rt, i, errors: [] as string[] };
    };
    const phones = Array.from({ length: 10 }, (_, i) => mk(i));
    for (const p of phones) { await p.rt.boot(); const ok = await p.rt.join("", "Player " + p.i, undefined, TICKS as any); if (!ok) p.errors.push("join: " + p.rt.error); vt += 400; }
    expect(phones.flatMap((p) => p.errors)).toEqual([]);
    expect(new Set(phones.map((p) => p.rt.pid)).size).toBe(10);
    const eleventh = mk(10); await eleventh.rt.boot(); const joined = await eleventh.rt.join("", "Player 10", undefined, TICKS as any);
    expect(joined).toBe(false); expect(eleventh.rt.error).toBe("This game is full."); // plain sentence on the 11th phone
    expect((raw.prepare("SELECT COUNT(*) c FROM participant WHERE eid='DEMO-SIM'").get() as any).c).toBe(10);
    // not held for payment when the start time comes
    vt = startMs - 30_000;
    expect(phones[0]!.rt.view().cfg.demo).toBe(true);

    // 3. play the whole game in virtual time
    let stuck = 0, lastTurns = -1;
    for (let step = 0; step < 900; step++) {
      vt += 3000;
      for (const p of phones) { try { await p.rt.tick(); } catch (e: any) { p.errors.push("tick: " + (e?.message ?? e)); } }
      const v = phones[0]!.rt.view();
      if (v.turnsPlayed === 0) { /* waiting for the first turn */ } else if (v.turnsPlayed === lastTurns) stuck++; else { stuck = 0; lastTurns = v.turnsPlayed; }
      if (stuck > turnRounds(WINDOW) * 3) break;
      if (phones.every((p) => p.rt.phase === "ended")) break;
    }
    for (let k = 0; k < 12; k++) { vt += 3000; for (const p of phones) { try { await p.rt.tick(); } catch (e: any) { p.errors.push("tick: " + (e?.message ?? e)); } } }
    expect(phones.flatMap((p) => p.errors)).toEqual([]);
    expect(stuck).toBeLessThanOrEqual(turnRounds(WINDOW) * 3);
    expect(phones.every((p) => p.rt.phase === "ended")).toBe(true);

    // 4. every phone shows the same standings, and they are the independent ones
    const b0 = randomnessOf(startRound + 1, SEED), first = startRound + GRACE_ROUNDS, stride = turnRounds(WINDOW);
    const betas = Array.from({ length: 150 }, (_, t) => randomnessOf(first + t * stride + betaOffset(WINDOW), SEED));
    const ref = playRace({ ...defaultRaceCfg("DEMO-SIM", 10) }, { b0, betas });
    expect(ref.ended).toBe(true);
    const views = phones.map((p) => p.rt.view());
    for (const v of views) { expect(v.turnsPlayed).toBe(ref.turnsPlayed); expect(v.top.map((r) => r.seat)).toEqual(rankPlayers(ref, 10).map((r) => r.seat)); expect(v.crowd!.players).toBe(10); }
    const settled = raw.prepare("SELECT pattern, ordinal, idx, pids FROM settled ORDER BY pattern, ordinal").all() as { pattern: string; ordinal: number; idx: number; pids: string }[];
    const pidOfSeat = (s: number) => (raw.prepare("SELECT pid FROM seat WHERE seq=?").get(s) as any).pid as string;
    const want = settleRace(ref, [{ pattern: "milestone", ordinal: 1 }, ...[1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o }))], pidOfSeat);
    expect(want.length).toBeGreaterThanOrEqual(2);
    expect(settled.length).toBe(want.length);
    for (const w of want) { const r = settled.find((x) => x.pattern === w.pattern && x.ordinal === w.ordinal)!; expect(r, `${w.pattern}#${w.ordinal}`).toBeDefined(); expect(r.idx).toBe(w.idx); expect(JSON.parse(r.pids)).toEqual(w.pids); }
    for (const w of want.filter((x) => x.pattern === "finish")) { const p = phones.find((q) => q.rt.pid === w.pids[0])!; expect(p.rt.view().won.some((x) => x.pattern === "finish" && x.ordinal === w.ordinal)).toBe(true); } // each winner's own phone knows it won

    // 5. the report goes to the organizer a few minutes after the end, and still nothing was paid
    sentReports.length = 0;
    for (let k = 0; k < 8 && !sentReports.length; k++) { vt += 5 * 60_000; await lifecycleTick(env as any, vt); }
    expect(sentReports.some((m) => m.to === "customer@acme.com")).toBe(true);
    expect((raw.prepare("SELECT COUNT(*) c FROM payment").get() as any).c).toBe(0);
    console.log(`DEMO10 PROOF: 10 joined, 11th refused ("${eleventh.rt.error}"), ${ref.turnsPlayed} turns, ${settled.length} prizes awarded and equal to the independent result, report mailed, payments: 0`);
  }, 600000);
});
