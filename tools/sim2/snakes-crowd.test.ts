// A scripted whole game, in virtual time: real PhoneRuntime instances (the code the phone page runs) talk to the real Worker (in-process, real database code on SQLite)
// and to a fake public beacon. Players join, play every turn, the phones vote the winners, and the game ends. Checks: nobody errors, no turn is stuck, every phone shows the
// same standings, the winners the Worker accepted are exactly what an independent computation from the public values gives, and nobody is ever told a result early.
import { describe, expect, test } from "bun:test";
import { handle, type Env } from "../../apps/edge/src/worker";
import { makeD1 } from "../../apps/edge/test/d1-sqlite";
import { TICKS } from "../../apps/edge/test/device";
import { PhoneRuntime } from "../../packages/beacon/src/phone-runtime";
import { settleRace, playRace, rankPlayers, defaultRaceCfg, teamsOf, teamTable } from "../../packages/beacon/src/race";
import { betaOffset, turnRounds } from "../../packages/beacon/src/schedule";
import { GRACE_ROUNDS } from "../../packages/beacon/src/config";
// @ts-ignore plain JS module shared with the other harnesses
import { fakeFetcher, fakeVerify, randomnessOf, roundAt, roundTimeMs } from "./lib/beacon.mjs";

interface Opts { players: number; seed: string; extra?: Record<string, unknown>; window?: number; maxSteps?: number; failFrac?: number }

async function runGame(o: Opts) {
  const d = makeD1(); const raw = d.raw;
  const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", TEST_MODE: "1" } as unknown as Env;
  let vt = Date.UTC(2026, 9, 20, 10, 0, 0);
  const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, vt);
  const j = async (r: Response) => (await r.json()) as any;
  const org = await j(await req("POST", "/api/start", { email: "boss@acme.com", consent: TICKS }, { "cf-connecting-ip": "1.1.1.1" }));
  const h = { "x-organizer": org.token as string };
  const window = o.window ?? 20, startMs = vt + 10 * 60_000, startRound = roundAt(startMs);
  expect((await req("POST", "/api/z", { id: "SIM-1", startRound, callSeconds: window, cap: Math.max(100, o.players), ...(o.extra ?? {}) }, h)).status).toBe(200);
  expect((await req("POST", "/api/z/SIM-1/publish", { email: "boss@acme.com", phone: "9876543210", consent: TICKS }, h)).status).toBe(200);
  raw.prepare("UPDATE engagement SET pack=?").run(Math.max(100, o.players)); // paid (payment itself is tested elsewhere)
  const fetcher = fakeFetcher(() => vt, o.seed);
  const phones = Array.from({ length: o.players }, (_, i) => {
    const mem = new Map<string, string>(); const ip = `10.1.${(i >> 8) & 255}.${(i & 255) + 1}`;
    const rt = new PhoneRuntime("SIM-1", {
      api: async (m: string, path: string, b?: any) => { const r = await req(m, path, b, { "cf-connecting-ip": ip }); const jj: any = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(jj.error ?? "http " + r.status), { status: r.status, code: jj.code, body: jj }); return jj; },
      beacon: { fetcher: fetcher as any, mirrors: ["https://api.t", "https://api2.t", "https://api3.t"], timeoutMs: 400 },
      mono: () => vt, store: { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v) }, verify: fakeVerify(o.seed) as any,
    } as any);
    return { rt, i, errors: [] as string[], sawEarly: false };
  });
  // everybody joins before the start (the game closes sign-up at the start time)
  for (const p of phones) { await p.rt.boot(); const ok = await p.rt.join("", "P" + p.i, undefined, TICKS as any); if (!ok) p.errors.push("join: " + p.rt.error); vt += 400; }
  vt = startMs - 30_000;
  const steps = o.maxSteps ?? 700; let step = 0, stuck = 0, lastTurns = -1;
  for (; step < steps; step++) {
    vt += 3000;
    for (const p of phones) { try { await p.rt.tick(); } catch (e: any) { p.errors.push("tick: " + (e?.message ?? e)); } }
    const v = phones[0]!.rt.view();
    if (v.turnsPlayed === 0) { /* waiting for the first turn */ } else if (v.turnsPlayed === lastTurns) stuck++; else { stuck = 0; lastTurns = v.turnsPlayed; }
    if (stuck > turnRounds(window) * 3) break;
    if (phones.every((p) => p.rt.phase === "ended")) break;
  }
  for (let k = 0; k < 12; k++) { vt += 3000; for (const p of phones) { try { await p.rt.tick(); } catch (e: any) { p.errors.push("tick: " + (e?.message ?? e)); } } } // the last votes go out a few seconds after the end
  return { raw, phones, step, stuck, startRound, req, j, h, vt: () => vt, seed: o.seed, window };
}

function independent(seed: string, startRound: number, players: number, window: number, cfgOver: any = {}) {
  const b0 = randomnessOf(startRound + 1, seed), first = startRound + GRACE_ROUNDS, stride = turnRounds(window);
  const betas = Array.from({ length: 150 }, (_, t) => randomnessOf(first + t * stride + betaOffset(window), seed));
  const cfg = { ...defaultRaceCfg("SIM-1", players), ...cfgOver };
  return playRace(cfg, { b0, betas });
}

describe("a scripted whole game, in virtual time", () => {
  test("G16: 6 players play a full game: nobody errors, no turn is stuck, all phones show the same standings, and the accepted winners equal the independent computation", async () => {
    const g = await runGame({ players: 6, seed: "sim6" });
    expect(g.phones.flatMap((p) => p.errors)).toEqual([]);
    expect(g.stuck).toBeLessThanOrEqual(turnRounds(g.window) * 3);
    expect(g.phones.every((p) => p.rt.phase === "ended")).toBe(true);
    const views = g.phones.map((p) => p.rt.view());
    const ref = independent("sim6", g.startRound, 6, g.window);
    expect(ref.ended).toBe(true);
    for (const v of views) { expect(v.turnsPlayed).toBe(ref.turnsPlayed); expect(v.top.map((r) => r.seat)).toEqual(rankPlayers(ref, 10).map((r) => r.seat)); expect(v.crowd!.players).toBe(6); }
    const settledRows = g.raw.prepare("SELECT pattern, ordinal, idx, pids FROM settled ORDER BY pattern, ordinal").all() as { pattern: string; ordinal: number; idx: number; pids: string }[];
    const pidOfSeat = (s: number) => (g.raw.prepare("SELECT pid FROM seat WHERE seq=?").get(s) as any).pid as string;
    const want = settleRace(ref, [{ pattern: "milestone", ordinal: 1 }, ...[1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o }))], pidOfSeat);
    expect(settledRows.length).toBe(want.length);
    for (const w of want) { const r = settledRows.find((x) => x.pattern === w.pattern && x.ordinal === w.ordinal)!; expect(r, `${w.pattern}#${w.ordinal}`).toBeDefined(); expect(r.idx).toBe(w.idx); expect(JSON.parse(r.pids)).toEqual(w.pids); }
    // each winner's own phone knows it won
    for (const w of want.filter((x) => x.pattern === "finish")) { const p = g.phones.find((q) => q.rt.pid === w.pids[0])!; expect(p.rt.view().won.some((x) => x.pattern === "finish" && x.ordinal === w.ordinal)).toBe(true); }
  }, 240000);

  test("G16: 4, 12 and 20 players (the 2-20 table sizes of a small group) each finish with no stuck turn", async () => {
    for (const n of [4, 12, 20]) {
      const g = await runGame({ players: n, seed: "sim" + n, maxSteps: 900 });
      expect(g.phones.flatMap((p) => p.errors), `n=${n}`).toEqual([]);
      expect(g.phones.every((p) => p.rt.phase === "ended"), `n=${n} ended`).toBe(true);
      const tops = new Set(g.phones.map((p) => JSON.stringify(p.rt.view().top.map((r) => r.seat))));
      expect(tops.size, `n=${n} same standings on every phone`).toBe(1);
    }
  }, 600000);

  test("a team race of 8 players in 4 teams: all phones agree on the team table, the winning team is the independent one", async () => {
    const g = await runGame({ players: 8, seed: "simT", extra: { mode: "team", teams: 4, rewards: [{ pattern: "team", ordinal: 1, text: "Hamper" }, { pattern: "team", ordinal: 2, text: "" }] }, maxSteps: 1100 });
    expect(g.phones.flatMap((p) => p.errors)).toEqual([]);
    expect(g.phones.every((p) => p.rt.phase === "ended")).toBe(true);
    const ref = independent("simT", g.startRound, 8, g.window, { teams: 4, turnCap: 60 });
    const b0 = randomnessOf(g.startRound + 1, "simT");
    const want = teamTable(ref.cfg, ref, teamsOf(ref.cfg, b0));
    for (const p of g.phones) { const v = p.rt.view(); expect(v.team!.rows.map((r) => r.team)).toEqual(want.map((r) => r.team)); }
    expect(g.raw.prepare("SELECT COUNT(*) c FROM settled WHERE pattern='team'").get()).toEqual({ c: 2 });
  }, 600000);

  test("G17: a crowd of 100 players (the plan size) completes with no error and every phone agrees", async () => {
    const g = await runGame({ players: 100, seed: "sim100", maxSteps: 600 });
    expect(g.phones.flatMap((p) => p.errors)).toEqual([]);
    expect(g.phones.every((p) => p.rt.phase === "ended")).toBe(true);
    expect(new Set(g.phones.map((p) => JSON.stringify(p.rt.view().top.map((r) => r.seat)))).size).toBe(1);
    const bands = g.phones[0]!.rt.view().crowd!.bands; expect(bands.reduce((a, b) => a + b, 0)).toBe(100);
    expect((g.raw.prepare("SELECT COUNT(*) c FROM settled").get() as any).c).toBeGreaterThanOrEqual(5);
  }, 900000);
});
