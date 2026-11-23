// Security audit H1 (23 Nov 2026): the server used to settle a prize when enough seats sent the same answer, whatever the answer was. A group of seats could name any winner,
// for a turn that had not happened, even before the game began. Now the server checks every report against the public game (verifywin.ts) before it counts.
// Every test here fails on the older source (the made-up reports were counted) and passes now; the honest flow is proved with the TRUE result of a game worked out the way a phone does.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SEEN_DEVICES, withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import { makeD1 } from "./d1-sqlite";
import { settleByPhones, voteAgain } from "./settle";
import { asked, beaconDown, installBeacon, luckyTruth, settleTrue, trueGame } from "./truth";

const T = Date.UTC(2026, 9, 1, 10, 0, 0), H = 3_600_000;
const roundOf = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;
const START_MS = T + 2 * H, START = roundOf(START_MS);
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let org: Record<string, string>;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => { const d = String(i).padStart(32, "0"); SEEN_DEVICES.add(d); return d; };
const seatNo = (pid: string) => Number(pid.split("x")[0]);
const REWARDS = [{ pattern: "milestone", ordinal: 1, text: "Mug" }, { pattern: "finish", ordinal: 1, text: "1st" }, { pattern: "finish", ordinal: 2, text: "2nd" }, { pattern: "finish", ordinal: 3, text: "3rd" }, { pattern: "climb", ordinal: 1, text: "Climb" }, { pattern: "comeback", ordinal: 1, text: "Comeback" }];
async function game(id: string, players: number, over: Record<string, unknown> = {}): Promise<string[]> {
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 200, turnCap: 60, rewards: REWARDS, ...over }, org)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, org)).status).toBe(200);
  const pids: string[] = [];
  for (let i = 1; i <= players; i++) pids.push((await j(await call("POST", `/api/z/${id}/join`, { name: "Player" + i, device: dev(i) }, {}, T + 1000))).pid);
  return pids;
}
/** One report, once (no retry): the status says whether the server counted it, refused it, or asked the phone to send it again later. */
const once = async (id: string, pid: string, results: any[], now: number) => { let r!: Response; for (const device of SEEN_DEVICES) { r = await call("POST", `/api/z/${id}/vote`, { pid, device, results }, {}, now); if (r.status !== 403) break; } return r; };
const res = (pattern: string, idx: number, pids: string[], ordinal = 1) => ({ pattern, ordinal, round: 1, idx, pids });
const rows = (sql: string) => (raw.prepare(sql).get() as any).c as number;
const nothingSettled = () => { expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0); expect(rows("SELECT COUNT(*) c FROM winner")).toBe(0); expect(rows("SELECT COUNT(*) c FROM prize")).toBe(0); };

beforeEach(async () => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "10000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", TEST_MODE: "1" } as any;
  org = { "x-organizer": (await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }))).token };
  installBeacon(); beaconDown(false); asked.length = 0;
});
afterEach(() => beaconDown(false));

describe("H1: a few seats cannot make a winner up", () => {
  test("the audit's own probe: two of three seats report a made-up milestone win on turn 3, an hour BEFORE the game starts: nothing is settled, nobody is a winner", async () => {
    const pids = await game("VC-P", 3);
    const t = trueGame(raw, "VC-P"); expect(t.settled.some((s) => s.pattern === "milestone" && s.idx === 3)).toBe(false); // it really is made up
    for (const p of pids.slice(0, 2)) { const r = await once("VC-P", p, [res("milestone", 3, [pids[0]!])], START_MS - H); expect(r.status).toBe(409); expect((await j(r)).code).toBe("not-yet"); }
    expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0); nothingSettled();
    for (const p of pids) await once("VC-P", p, [res("milestone", 3, [pids[0]!])], START_MS - H); // every seat, not just two
    nothingSettled();
  });
  test("the same made-up win after the game began but before that turn has happened is also not counted", async () => {
    const pids = await game("VC-P", 3); const t = trueGame(raw, "VC-P");
    for (const now of [START_MS + 30_000, t.turnMs(3) - 4_000]) for (const p of pids) { const r = await once("VC-P", p, [res("milestone", 3, [pids[0]!])], now); expect(r.status).toBe(409); }
    expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0); nothingSettled();
  });
  test("a made-up win for a turn that HAS happened is refused too, however many seats say it: the named seat must really have got there on that turn", async () => {
    const pids = await game("VC-P", 8); const t = trueGame(raw, "VC-P");
    for (const p of pids) { const r = await j(await once("VC-P", p, [res("milestone", 3, [pids[0]!])], t.endMs)); expect(r.ok).toBe(true); expect(r.refused).toEqual(["1:milestone:1"]); expect(r.counted).toBe(0); } // all 8 seats agree: still nothing
    expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0); nothingSettled();
  });
  test("a seat that does not exist cannot win", async () => {
    const pids = await game("VC-P", 8); const t = trueGame(raw, "VC-P"), w = t.settled.find((s) => s.pattern === "milestone")!;
    const ghost = "99x" + "ab".repeat(6);
    for (const p of pids) { const r = await j(await once("VC-P", p, [res("milestone", w.idx, [ghost])], t.endMs)); expect(r.refused).toEqual(["1:milestone:1"]); }
    nothingSettled();
  });
  test("a real seat on the right prize but the wrong turn, and a real seat that did not get there, are refused; the true result is counted", async () => {
    const pids = await game("VC-P", 8); const t = trueGame(raw, "VC-P"), w = t.settled.find((s) => s.pattern === "milestone")!;
    const other = pids.find((p) => p !== w.pids[0])!;
    for (const bad of [res("milestone", w.idx + 1, w.pids), res("milestone", w.idx - 1, w.pids), res("milestone", w.idx, [other]), res("finish", w.idx, w.pids), res("milestone", w.idx, [...w.pids, other])]) for (const p of pids) await once("VC-P", p, [bad], t.endMs);
    nothingSettled();
    await settleByPhones(call, "VC-P", [{ pattern: "milestone", idx: w.idx, pids: w.pids }], pids, t.endMs);
    expect(raw.prepare("SELECT idx FROM settled WHERE pattern='milestone'").all()).toEqual([{ idx: w.idx }]);
  });
  test("a report is answered 'not yet' (and kept by the phone) until its turn has happened; it counts from the moment that turn's public number is out", async () => {
    const pids = await game("VC-P", 8); const t = trueGame(raw, "VC-P"), w = t.settled.find((s) => s.pattern === "milestone")!;
    const early = await once("VC-P", pids[0]!, [res("milestone", w.idx, w.pids)], t.turnMs(w.idx) - 3_000);
    expect(early.status).toBe(409); expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0);
    const r = await voteAgain(call, "VC-P", { pid: pids[0], device: dev(1), results: [res("milestone", w.idx, w.pids)] }, t.turnMs(w.idx));
    expect(r.status).toBe(200); expect((await j(r)).counted).toBe(1);
  });
  test("the places agree with each other: one seat cannot take two home places, and 2nd cannot come before 1st", async () => {
    const pids = await game("VC-P", 8, { turnCap: 100 }); const t = trueGame(raw, "VC-P");
    const f = (n: number) => t.settled.find((s) => s.pattern === "finish" && s.ordinal === n)!;
    expect(f(1)).toBeTruthy(); expect(f(2)).toBeTruthy();
    await settleByPhones(call, "VC-P", [{ pattern: "finish", ordinal: 1, idx: f(1).idx, pids: f(1).pids }], pids, t.endMs);
    for (const p of pids) await once("VC-P", p, [res("finish", f(1).idx, f(1).pids, 2)], t.endMs); // the 1st-place seat reported again as 2nd
    expect(rows("SELECT COUNT(*) c FROM settled WHERE ordinal=2")).toBe(0);
    await settleByPhones(call, "VC-P", [{ pattern: "finish", ordinal: 2, idx: f(2).idx, pids: f(2).pids }], pids, t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled WHERE pattern='finish'")).toBe(2);
  });
});

describe("H1: the honest flow still works (the true result of a whole game, worked out as a phone does, is accepted)", () => {
  test("every prize line of a real game settles: milestone, the home places, biggest climb, comeback", async () => {
    const pids = await game("VC-H", 8, { turnCap: 100 });
    const reported = await settleTrue(call, raw, "VC-H", pids);
    const patterns = new Set(reported.map((x) => x.pattern)); for (const k of ["milestone", "finish", "climb", "comeback"]) expect(patterns.has(k)).toBe(true);
    const settled = raw.prepare("SELECT pattern, ordinal, idx, pids FROM settled ORDER BY pattern, ordinal").all() as any[];
    expect(settled.length).toBe(reported.length);
    for (const s of reported) expect(settled.some((x) => x.pattern === s.pattern && x.ordinal === s.ordinal && x.idx === s.idx && JSON.parse(x.pids)[0] === s.pids[0])).toBe(true);
    expect(rows("SELECT COUNT(*) c FROM winner")).toBe(reported.length); expect(rows("SELECT COUNT(*) c FROM prize")).toBeGreaterThan(0);
  });
  test("a game with a brand break (the schedule moves later) is checked on the same schedule the phones use", async () => {
    const pids = await game("VC-B", 6, { turnCap: 80, breaks: [{ after: 5, seconds: 30, kind: "speech", title: "A word" }] });
    expect((await settleTrue(call, raw, "VC-B", pids, ["milestone", "finish"])).length).toBeGreaterThan(0);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBeGreaterThan(0);
  });
  test("the prizes that need the whole game wait for the end of it: 'not yet' while it runs, counted once it is over (by the schedule, or by the phones saying so)", async () => {
    const pids = await game("VC-E", 8, { turnCap: 100 }); const t = trueGame(raw, "VC-E"), c = t.settled.find((s) => s.pattern === "climb")!;
    const mid = t.turnMs(c.idx) + 1_000;
    for (const p of pids.slice(0, 3)) expect((await once("VC-E", p, [res("climb", c.idx, c.pids)], mid)).status).toBe(409);
    expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0);
    if (t.endMs - 120_000 > mid + 60_000) { // the game ended before its schedule did: three phones say it is over
      for (const p of pids.slice(0, 4)) await call("POST", "/api/z/VC-E/over", { pid: p, device: dev(seatNo(p)) }, {}, t.turnMs(c.idx) + 30_000);
    }
    await settleByPhones(call, "VC-E", [{ pattern: "climb", idx: c.idx, pids: c.pids }], pids, t.endMs);
    expect(raw.prepare("SELECT pattern FROM settled").all()).toEqual([{ pattern: "climb" }]);
  });
  test("a lucky draw is worked out again from the round that ends the break: the true draw is counted, another set of winners and an early report are not", async () => {
    const pids = await game("VC-L", 8, { breaks: [{ after: 10, seconds: 30, kind: "lucky", title: "Lucky draw", winners: 3 }] });
    const lt = luckyTruth(raw, "VC-L"); expect(lt.pids.length).toBe(3);
    const wrong = pids.filter((p) => !lt.pids.includes(p)).slice(0, 3);
    for (const p of pids) { await once("VC-L", p, [res("lucky", lt.idx, wrong)], lt.nowMs); await once("VC-L", p, [res("lucky", lt.idx, lt.pids)], lt.nowMs - 120_000); }
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
    await settleByPhones(call, "VC-L", [{ pattern: "lucky", idx: lt.idx, pids: lt.pids }], pids, lt.nowMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(1);
  });
  test("a team race: the whole team named by the game's own fate is counted; a made-up set of seats is not", async () => {
    const pids = await game("VC-T", 8, { mode: "team", teams: 2, turnCap: 40, rewards: [{ pattern: "team", ordinal: 1, text: "Hamper" }, { pattern: "team", ordinal: 2, text: "Pen" }] });
    const t = trueGame(raw, "VC-T"), team = t.settled.find((s) => s.pattern === "team" && s.ordinal === 1)!; expect(team.pids.length).toBe(4);
    for (const p of pids) await once("VC-T", p, [res("team", team.idx, pids.slice(0, 3))], t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
    await settleByPhones(call, "VC-T", [{ pattern: "team", ordinal: 1, idx: team.idx, pids: team.pids }], pids, t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(1);
  });
});

describe("H1: the public numbers", () => {
  test("when the public numbers cannot be fetched the report waits ('not yet'); nothing is counted, and it counts as soon as they can", async () => {
    const pids = await game("VC-N", 8); const t = trueGame(raw, "VC-N"), w = t.settled.find((s) => s.pattern === "milestone")!;
    beaconDown(true);
    const r = await once("VC-N", pids[0]!, [res("milestone", w.idx, w.pids)], t.endMs); expect(r.status).toBe(409); expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0);
    beaconDown(false);
    await settleByPhones(call, "VC-N", [{ pattern: "milestone", idx: w.idx, pids: w.pids }], pids, t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(1);
  });
  test("each public number is fetched once per game and kept, not once per phone; a report already checked is not checked again", async () => {
    const pids = await game("VC-C", 8); const t = trueGame(raw, "VC-C"), w = t.settled.find((s) => s.pattern === "milestone")!;
    await settleByPhones(call, "VC-C", [{ pattern: "milestone", idx: w.idx, pids: w.pids }], pids, t.endMs);
    const n = asked.length; expect(n).toBeGreaterThan(0); expect(n).toBeLessThanOrEqual(w.idx + 2); expect(new Set(asked).size).toBe(n);
    await settleByPhones(call, "VC-C", [{ pattern: "milestone", idx: w.idx, pids: w.pids }], pids, t.endMs);
    expect(asked.length).toBe(n);
    expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'bcn/VC-C/%'")).toBe(n);
  });
  test("a number that is not from the beacon (wrong round, or its randomness is not the hash of its signature) is not used", async () => {
    const pids = await game("VC-F", 8); const t = trueGame(raw, "VC-F"), w = t.settled.find((s) => s.pattern === "milestone")!;
    const good = globalThis.fetch as any;
    globalThis.fetch = (async (u: any, i?: any) => { const m = String(u).match(/\/public\/(\d+)$/); if (!m) return good(u, i); const r = Number(m[1]); return new Response(JSON.stringify({ round: r + 1, randomness: "ab".repeat(32), signature: "cd".repeat(48) }), { status: 200 }); }) as any;
    const r = await once("VC-F", pids[0]!, [res("milestone", w.idx, w.pids)], t.endMs); expect(r.status).toBe(409); expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'bcn/%'")).toBe(0);
    globalThis.fetch = (async (u: any, i?: any) => { const m = String(u).match(/\/public\/(\d+)$/); if (!m) return good(u, i); return new Response(JSON.stringify({ round: Number(m[1]), randomness: "ab".repeat(32), signature: "cd".repeat(48) }), { status: 200 }); }) as any;
    expect((await once("VC-F", pids[1]!, [res("milestone", w.idx, w.pids)], t.endMs)).status).toBe(409); expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'bcn/%'")).toBe(0);
    globalThis.fetch = good;
  });
  test("the kept numbers and the 'already checked' marks go with the game's data (the 24-hour deletion), and no name or number is in them", async () => {
    const pids = await game("VC-D", 8); const t = trueGame(raw, "VC-D"), w = t.settled.find((s) => s.pattern === "milestone")!;
    await settleByPhones(call, "VC-D", [{ pattern: "milestone", idx: w.idx, pids: w.pids }], pids, t.endMs);
    expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'bcn/VC-D/%' OR k LIKE 'vok/VC-D/%'")).toBeGreaterThan(0);
    expect(JSON.stringify(raw.prepare("SELECT k, v FROM kv WHERE k LIKE 'bcn/VC-D/%' OR k LIKE 'vok/VC-D/%'").all())).not.toMatch(/Player|98765|@/);
    expect((await call("POST", "/api/z/VC-D/erase", {}, org, t.endMs + 3_600_000)).status).toBe(200);
    expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'bcn/VC-D/%' OR k LIKE 'vok/VC-D/%'")).toBe(0);
  });
});
