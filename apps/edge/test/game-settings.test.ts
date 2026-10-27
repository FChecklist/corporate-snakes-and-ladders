// The server side of a Snakes and Ladders game: what a join returns, the game settings (type, play mode, board, milestones, prizes), sign-up closing at the start,
// and winners decided only when enough different phones report the same result.
import { beforeEach, describe, expect, test } from "bun:test";
import { SEEN_DEVICES, withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import { settleByPhones } from "./settle";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const roundOf = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;
const START = roundOf(T + 2 * 86_400_000);
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let h: Record<string, string>;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const pubBody = { email: "boss@acme.com", phone: "98765 43210" };
async function game(id = "SL-1", over: Record<string, unknown> = {}, publish = true) {
  const r = await call("POST", "/api/z", { id, startRound: START, callSeconds: 20, cap: 200, ...over }, h);
  expect(r.status).toBe(200);
  if (publish) expect((await call("POST", `/api/z/${id}/publish`, pubBody, h)).status).toBe(200);
}
const join = (i: number, id = "SL-1", now = T + 1000) => call("POST", `/api/z/${id}/join`, { name: "Player" + i, device: (() => { const d = String(i).padStart(32, "0"); SEEN_DEVICES.add(d); return d; })() }, {}, now);
beforeEach(async () => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", TEST_MODE: "1" } as any;
  const o = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }));
  h = { "x-organizer": o.token };
});

describe("joining", () => {
  test("a join returns what a phone needs to play: its seat id, the schedule, the prizes and the default game settings; no card, no ticket", async () => {
    await game();
    const r = await j(await join(1));
    expect(r.pid).toMatch(/^1x[0-9a-f]{12}$/);
    expect(r.startRound).toBe(START); expect(r.callSeconds).toBe(20);
    expect(r.rewards.map((x: any) => `${x.pattern}#${x.ordinal}`)).toEqual(["milestone#1", "finish#1", "finish#2", "finish#3", "finish#4", "finish#5"]);
    expect(r.rounds).toBe(1); expect(r.tickets).toBe(1);
    expect(JSON.stringify(r)).not.toMatch(/bingo|ticket number|called/i);
  });
  test("every joiner gets the next seat number (the board and every roll are made from it)", async () => {
    await game();
    const seats = []; for (let i = 1; i <= 6; i++) seats.push(((await j(await join(i))).pid as string).split("x")[0]);
    expect(seats).toEqual(["1", "2", "3", "4", "5", "6"]);
  });
  test("R43 sign-up closes at the start time: a new player after the start is told the game is running; a player who joined before can still open it", async () => {
    await game();
    const first = await j(await join(1));
    const late = await join(2, "SL-1", T + 2 * 86_400_000 + 10_000);
    expect(late.status).toBe(410); const b = await j(late); expect(b.code).toBe("closed"); expect(b.error).toContain("closed");
    const again = await j(await join(1, "SL-1", T + 2 * 86_400_000 + 20_000)); expect(again.pid).toBe(first.pid);
  });
  test("the turn window is 15, 20, 25 or 30 seconds", async () => {
    for (const s of [6, 9, 10, 12, 14, 31, 45]) expect((await call("POST", "/api/z", { id: "SL-W", startRound: START, callSeconds: s, cap: 100 }, h)).status).toBe(400);
    for (const s of [15, 25, 30]) expect((await call("POST", "/api/z", { id: "SL-W" + s, startRound: START, callSeconds: s, cap: 100 }, h)).status).toBe(200);
  });
});

describe("the game settings", () => {
  const TEAM = { mode: "team", teams: 4, play: "presence", board: { size: 144, snakes: 8, ladders: 10, finish: "pass" }, milestones: [100, 50], turnCap: 80, endPrizes: 3, exclusive: true, theme: "career",
    rewards: [{ pattern: "milestone", ordinal: 1, text: "Mug" }, { pattern: "milestone", ordinal: 2, text: "Pen" }, { pattern: "team", ordinal: 1, text: "Hamper" }, { pattern: "nevermissed", ordinal: 1, text: "Voucher" }] };
  test("settings given at creation are kept and shown to every phone; milestones are put in order", async () => {
    await game("SL-T", TEAM);
    const info = await j(await call("GET", "/api/z/SL-T/info"));
    expect(info).toMatchObject({ mode: "team", teams: 4, play: "presence", board: { size: 144, snakes: 8, ladders: 10, finish: "pass" }, milestones: [50, 100], turnCap: 80, endPrizes: 3, exclusive: true, theme: "career" });
    expect(info.rewards.map((x: any) => x.pattern)).toEqual(["milestone", "milestone", "team", "nevermissed"]);
    const joined = await j(await join(1, "SL-T")); expect(joined.mode).toBe("team"); expect(joined.board.size).toBe(144);
  });
  test("bad settings are refused with a plain reason and nothing is created", async () => {
    const bad: Record<string, unknown>[] = [
      { board: { size: 120 } }, { board: { snakes: 5 } }, { board: { ladders: 13 } }, { board: { finish: "bounce" } },
      { milestones: [1] }, { milestones: [100] }, { milestones: [10, 10] }, { milestones: [10, 20, 30, 40] },
      { turnCap: 9 }, { turnCap: 151 }, { endPrizes: 0 }, { endPrizes: 6 }, { mode: "league" }, { play: "random" }, { teams: 4 }, { mode: "team" }, { mode: "team", teams: 11 },
      { rounds: 2 }, { tickets: 2 }, { theme: "space" },
      { rewards: [{ pattern: "team", ordinal: 1, text: "" }] },              // a team prize needs a team race
      { rewards: [{ pattern: "nevermissed", ordinal: 1, text: "" }] },       // never missed needs presence play
      { rewards: [{ pattern: "milestone", ordinal: 2, text: "" }] },         // the 2nd milestone prize needs the 1st
      { rewards: [{ pattern: "line", ordinal: 1, text: "" }] },              // not a prize of this game
      { rewards: [{ pattern: "finish", ordinal: 6, text: "" }] },            // only 5 end prizes
    ];
    for (const [i, o] of bad.entries()) { const r = await call("POST", "/api/z", { id: "SL-B" + i, startRound: START, callSeconds: 20, cap: 100, ...o }, h); expect([JSON.stringify(o), r.status]).toEqual([JSON.stringify(o), 400]); expect(((await j(r)).error as string).length).toBeGreaterThan(10); }
    expect(raw.prepare("SELECT COUNT(*) AS c FROM engagement WHERE id LIKE 'SL-B%'").get()).toEqual({ c: 0 });
  });
  test("settings can be changed before the start and never after; a bad change changes nothing", async () => {
    await game();
    expect((await call("PATCH", "/api/z/SL-1/settings", { play: "presence", turnCap: 90 }, h)).status).toBe(200);
    expect(await j(await call("GET", "/api/z/SL-1/info"))).toMatchObject({ play: "presence", turnCap: 90 });
    expect((await call("PATCH", "/api/z/SL-1/settings", { turnCap: 5 }, h)).status).toBe(400);
    expect((await j(await call("GET", "/api/z/SL-1/info"))).turnCap).toBe(90);
    const after = await call("PATCH", "/api/z/SL-1/settings", { turnCap: 70 }, h, T + 2 * 86_400_000 + 60_000);
    expect(after.status).not.toBe(200); expect((await j(await call("GET", "/api/z/SL-1/info"))).turnCap).toBe(90);
  });
  test("game settings can be put back to the defaults (null / the default value)", async () => {
    await game("SL-D", { board: { size: 144, snakes: 8, ladders: 8, finish: "exact" }, turnCap: 80 });
    await call("PATCH", "/api/z/SL-D/settings", { board: null, turnCap: 60 }, h);
    const info = await j(await call("GET", "/api/z/SL-D/info")); expect(info.board).toBeUndefined(); expect(info.turnCap).toBeUndefined();
  });
});

describe("winners are decided by the software", () => {
  const pids: string[] = [];
  beforeEach(async () => { await game(); pids.length = 0; for (let i = 1; i <= 8; i++) pids.push((await j(await join(i))).pid); });
  const res = (idx: number, winners: string[], pattern = "finish", ordinal = 1) => ({ pattern, ordinal, round: 1, idx, pids: winners });
  const vote = async (pid: string, results: any[]) => { let r!: Response; for (const device of SEEN_DEVICES) { r = await call("POST", "/api/z/SL-1/vote", { pid, device, results }); if (r.status !== 403) break; } return r; }; // a vote carries the phone's own device id
  test("one phone's word is not enough; the result stands once enough different phones report exactly the same winner", async () => {
    await vote(pids[0]!, [res(11, [pids[3]!])]);
    expect(raw.prepare("SELECT COUNT(*) c FROM settled").get()).toEqual({ c: 0 });
    await vote(pids[1]!, [res(11, [pids[3]!])]);
    const r = await j(await vote(pids[2]!, [res(11, [pids[3]!])]));
    expect(r.accepted).toBe(1);
    expect(raw.prepare("SELECT pattern, ordinal, idx FROM settled").all()).toEqual([{ pattern: "finish", ordinal: 1, idx: 11 }]);
    expect((raw.prepare("SELECT COUNT(*) c FROM winner WHERE src='phones'").get() as any).c).toBe(1);
  });
  test("phones that disagree settle nothing, and a made-up result cannot outvote an honest one", async () => {
    await vote(pids[0]!, [res(11, [pids[0]!])]); await vote(pids[1]!, [res(12, [pids[1]!])]);
    expect(raw.prepare("SELECT COUNT(*) c FROM settled").get()).toEqual({ c: 0 });
    for (const p of [pids[2]!, pids[3]!, pids[4]!]) await vote(p, [res(13, [pids[5]!])]);
    expect(raw.prepare("SELECT idx FROM settled").get()).toEqual({ idx: 13 });
  });
  test("a stranger cannot report; a prize that is not in the game, or a turn that cannot exist, is dropped", async () => {
    expect((await vote("99x" + "0".repeat(12), [res(11, [pids[0]!])])).status).toBe(403);
    for (const bad of [res(11, [pids[0]!], "line"), res(11, [pids[0]!], "finish", 9), res(-1, [pids[0]!]), res(100000, [pids[0]!]), res(11, ["nonsense"])]) { await vote(pids[0]!, [bad]); await vote(pids[1]!, [bad]); await vote(pids[2]!, [bad]); }
    expect(raw.prepare("SELECT COUNT(*) c FROM settled").get()).toEqual({ c: 0 });
  });
  test("a result already accepted is never replaced by later reports; results name seats, never names or numbers", async () => {
    await settleByPhones(call, "SL-1", [{ pattern: "finish", idx: 11, pids: [pids[3]!] }], pids.slice(0, 4));
    await settleByPhones(call, "SL-1", [{ pattern: "finish", idx: 12, pids: [pids[4]!] }], pids.slice(4, 8));
    expect(raw.prepare("SELECT idx FROM settled").all()).toEqual([{ idx: 11 }]);
    const out = JSON.stringify(await j(await call("GET", "/api/z/SL-1/results")));
    expect(out).toContain(pids[3]!); expect(out).not.toMatch(/Player\d|98765|@/);
  });
});
