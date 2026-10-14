// G14: the lucky draw picks only eligible people. Real PhoneRuntime instances (the code the phone page runs) talk to the real Worker and a fake public beacon, in virtual time.
// Eligible = a player who joined and is not flagged as Organizer, Host or Co-host. The phones work the winners out themselves from the public randomness and the public seat list; the Worker stores
// them only because several phones sent the same list. A person removed after the start stays in the public seat list (every phone must work out the same result), so the draw cannot leave
// them out: that is the stated limit (docs/GATES.md G14), not something this test hides.
import { describe, expect, test } from "bun:test";
import { handle, type Env } from "../src/worker";
import { makeD1 } from "./d1-sqlite";
import { TICKS } from "./device";
import { PhoneRuntime } from "../../../packages/beacon/src/phone-runtime";
import { luckyWinners } from "../../../packages/beacon/src/game";
// @ts-ignore plain JS module shared with the other harnesses
import { fakeFetcher, fakeVerify, randomnessOf, roundAt } from "../../../tools/sim2/lib/beacon.mjs";

async function drawGame(players: number, flagged: number[], winners: 1 | 3 | 5 | 10, seed: string) {
  const d = makeD1(); const raw = d.raw;
  const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", TEST_MODE: "1" } as unknown as Env;
  let vt = Date.UTC(2026, 9, 20, 10, 0, 0);
  const req = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, vt);
  const j = async (r: Response) => (await r.json()) as any;
  const org = await j(await req("POST", "/api/start", { email: "boss@acme.com", consent: TICKS }, { "cf-connecting-ip": "1.1.1.1" }));
  const h = { "x-organizer": org.token as string };
  const window = 20, startMs = vt + 10 * 60_000, startRound = roundAt(startMs);
  const brk = { after: 3, seconds: 30, kind: "lucky" as const, title: "Lucky draw", winners };
  expect((await req("POST", "/api/z", { id: "LK-1", startRound, callSeconds: window, cap: 100, breaks: [brk] }, h)).status).toBe(200);
  expect((await req("POST", "/api/z/LK-1/publish", { email: "boss@acme.com", phone: "9876543210", consent: TICKS }, h)).status).toBe(200);
  raw.prepare("UPDATE engagement SET pack=100").run();
  const fetcher = fakeFetcher(() => vt, seed);
  const phones = Array.from({ length: players }, (_, i) => {
    const mem = new Map<string, string>(); const ip = `10.1.0.${i + 1}`;
    const rt = new PhoneRuntime("LK-1", {
      api: async (m: string, path: string, b?: any) => { const r = await req(m, path, b, { "cf-connecting-ip": ip }); const jj: any = await r.json().catch(() => ({})); if (!r.ok) throw Object.assign(new Error(jj.error ?? "http " + r.status), { status: r.status }); return jj; },
      beacon: { fetcher: fetcher as any, mirrors: ["https://api.t", "https://api2.t", "https://api3.t"], timeoutMs: 400 },
      mono: () => vt, store: { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v) }, verify: fakeVerify(seed) as any,
    } as any);
    return { rt, i };
  });
  for (const p of phones) { await p.rt.boot(); expect(await p.rt.join("", "P" + p.i, undefined, TICKS as any)).toBeTruthy(); vt += 400; }
  for (const i of flagged) { const seat = Number(/^(\d+)x/.exec(phones[i]!.rt.pid!)![1]); expect((await req("POST", "/api/z/LK-1/mark", { seat, role: "host" }, h)).status).toBe(200); }
  vt = startMs - 30_000;
  const done = () => phones.every((p) => { const l = p.rt.view().lucky; return l.length > 0 && l[0]!.published; });
  for (let step = 0; step < 900 && !done(); step++) { vt += 3000; for (const p of phones) { try { await p.rt.tick(); } catch { /* the next step tries again */ } } }
  for (let k = 0; k < 12; k++) { vt += 3000; for (const p of phones) { try { await p.rt.tick(); } catch { /* */ } } }
  return { raw, phones, req, j, h, brk, startRound, window, seed, done: done() };
}

describe("G14: the lucky draw picks only eligible people", () => {
  test("a player flagged as Organizer, Host or Co-host before the start never wins; everybody else who joined can; every phone agrees, and the store holds exactly those winners", async () => {
    const g = await drawGame(8, [0, 3], 10, "lk8"); // 10 winners asked for among 6 eligible players: all 6 win, the 2 flagged people cannot
    expect(g.done).toBe(true);
    const flaggedPids = [0, 3].map((i) => g.phones[i]!.rt.pid!);
    for (const p of g.phones) { const l = p.rt.view().lucky[0]!; expect([p.i, l.published, l.won]).toEqual([p.i, true, ![0, 3].includes(p.i)]); }
    expect(g.phones.filter((p) => p.rt.view().lucky[0]!.won).length).toBe(6);
    const stored = (await g.j(await g.req("GET", "/api/z/LK-1/results"))).results.find((x: any) => x.pattern === "lucky");
    expect(stored.winners.length).toBe(6); for (const f of flaggedPids) expect(stored.winners).not.toContain(f);
    const seats = g.raw.prepare("SELECT pid, role FROM seat ORDER BY seq").all() as { pid: string; role: string | null }[];
    expect(seats.filter((s) => s.role).map((s) => s.pid).sort()).toEqual([...flaggedPids].sort()); // the server's own seat table says the same two are flagged
    for (const w of stored.winners) expect(seats.some((s) => s.pid === w && !s.role)).toBe(true); // every winner is a joined seat that is not flagged
  }, 300_000);
  test("with 3 winners among 8: exactly 3 distinct eligible players win, and they are exactly the phones that were told they won", async () => {
    const g = await drawGame(8, [1], 3, "lk3");
    expect(g.done).toBe(true);
    const seats = g.raw.prepare("SELECT pid, role FROM seat ORDER BY seq").all() as { pid: string; role: string | null }[];
    const stored = (await g.j(await g.req("GET", "/api/z/LK-1/results"))).results.find((x: any) => x.pattern === "lucky");
    expect(stored.winners.length).toBe(3); expect(new Set(stored.winners).size).toBe(3);
    const eligible = seats.filter((s) => !s.role).map((s) => s.pid);
    for (const w of stored.winners) expect(eligible).toContain(w);
    expect(g.phones.filter((p) => p.rt.view().lucky[0]!.won).map((p) => p.rt.pid!).sort()).toEqual([...stored.winners].sort());
    expect(g.phones[1]!.rt.view().lucky[0]!.won).toBe(false);
  }, 300_000);
});

describe("luckyWinners (the pure draw the phones and the console both use)", () => {
  const pids = Array.from({ length: 12 }, (_, i) => `${i + 1}x00000${i}`);
  test("distinct, at most n, only from the list it is given, the same for any order of the list, different randomness gives a different draw", () => {
    const a = luckyWinners("E-1", 3, randomnessOf(100, "s"), pids, 5);
    expect(a.length).toBe(5); expect(new Set(a).size).toBe(5); for (const w of a) expect(pids).toContain(w);
    expect(luckyWinners("E-1", 3, randomnessOf(100, "s"), [...pids].reverse(), 5)).toEqual(a);
    expect(luckyWinners("E-1", 3, randomnessOf(101, "s"), pids, 5)).not.toEqual(a);
    expect(luckyWinners("E-1", 3, randomnessOf(100, "s"), pids.slice(0, 3), 10).sort()).toEqual(pids.slice(0, 3).sort()); // fewer people than winners: everybody, nobody twice
    expect(luckyWinners("E-1", 3, randomnessOf(100, "s"), [...pids, ...pids], 12).length).toBe(12); // a name listed twice is one person
    expect(luckyWinners("E-1", 3, randomnessOf(100, "s"), [], 3)).toEqual([]);
  });
  test("a person left out of the list can never be in the result, whatever the randomness", () => {
    const left = pids.slice(2);
    for (let r = 1; r <= 200; r++) for (const w of luckyWinners("E-1", 3, randomnessOf(r, "s"), left, 3)) expect([pids[0], pids[1]]).not.toContain(w);
  });
});
