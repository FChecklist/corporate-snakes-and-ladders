// Security audit M1 of 1.5.4 (23 Nov 2026, angle 2): a few seats could still pick the winner of "biggest climb", "biggest comeback" and the team prize. The server accepted a climb report when
// the named seat had climbed ANY ladder (almost every seat does) and a team report when the seats were ANY whole team. The audit's own probe: 8 players, the true biggest climb was one seat,
// three seats reported another seat that had climbed, and the report settled.
// Now the server plays the whole game from the public numbers and settles these prizes with the same function the phones use (replay.ts). Every test here that says "refused" fails on the 1.5.4
// source (the made-up result was counted there) and passes now; the honest result of the same game is still accepted.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SEEN_DEVICES, withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import { makeD1 } from "./d1-sqlite";
import { settleByPhones, voteAgain } from "./settle";
import { beaconDown, installBeacon, trueGame } from "./truth";

const T = Date.UTC(2026, 9, 1, 10, 0, 0), H = 3_600_000;
const roundOf = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;
const START_MS = T + 2 * H, START = roundOf(START_MS);
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let org: Record<string, string>;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => { const d = String(i).padStart(32, "0"); SEEN_DEVICES.add(d); return d; };
const REWARDS = [{ pattern: "milestone", ordinal: 1, text: "Mug" }, { pattern: "finish", ordinal: 1, text: "1st" }, { pattern: "finish", ordinal: 2, text: "2nd" }, { pattern: "finish", ordinal: 3, text: "3rd" }, { pattern: "climb", ordinal: 1, text: "Climb" }, { pattern: "comeback", ordinal: 1, text: "Comeback" }];
async function game(id: string, players: number, over: Record<string, unknown> = {}): Promise<string[]> {
  expect((await call("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 200, turnCap: 100, rewards: REWARDS, ...over }, org)).status).toBe(200);
  expect((await call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, org)).status).toBe(200);
  const pids: string[] = [];
  for (let i = 1; i <= players; i++) pids.push((await j(await call("POST", `/api/z/${id}/join`, { name: "Player" + i, device: dev(i) }, {}, T + 1000))).pid);
  return pids;
}
/** One report from one phone, sent again while the server answers "not yet" (it plays the seats a part at a time): the answer that ends the waiting. */
const report = async (id: string, pid: string, results: any[], now: number) => { let r!: Response; for (const device of SEEN_DEVICES) { r = await voteAgain(call, id, { pid, device, results }, now, 30); if (r.status !== 403) break; } return r; };
/** One report, once: the status says whether the server counted it, refused it, or asked the phone to send it again. */
const once = async (id: string, pid: string, results: any[], now: number) => { let r!: Response; for (const device of SEEN_DEVICES) { r = await call("POST", `/api/z/${id}/vote`, { pid, device, results }, {}, now); if (r.status !== 403) break; } return r; };
const res = (pattern: string, idx: number, pids: string[], ordinal = 1) => ({ pattern, ordinal, round: 1, idx, pids });
const rows = (sql: string) => (raw.prepare(sql).get() as any).c as number;
const settledOf = (pattern: string) => (raw.prepare("SELECT ordinal, pids FROM settled WHERE pattern=? ORDER BY ordinal").all(pattern) as { ordinal: number; pids: string }[]).map((r) => ({ ordinal: r.ordinal, pids: JSON.parse(r.pids) as string[] }));

beforeEach(async () => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "10000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", TEST_MODE: "1" } as any;
  org = { "x-organizer": (await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }))).token };
  installBeacon(); beaconDown(false);
});
afterEach(() => beaconDown(false));

describe("M1: biggest climb and biggest comeback are settled from the whole game", () => {
  test("the audit's probe: three seats name a seat that DID climb but did not climb the most; nothing is settled, and the true result still is", async () => {
    const pids = await game("EP-C", 8); const t = trueGame(raw, "EP-C"), c = t.settled.find((s) => s.pattern === "climb")!;
    const liar = t.runs.find((r: any) => r.bestClimb > 0 && t.pids[r.seat - 1] !== c.pids[0])!; // a seat that climbed at least once: the old check accepted it
    expect(c).toBeTruthy(); expect(liar).toBeTruthy(); expect(liar.bestClimb).toBeLessThan(t.runs[Number(c.pids[0]!.split("x")[0]) - 1].bestClimb);
    for (const p of pids.slice(0, 3)) { const r = await j(await report("EP-C", p, [res("climb", c.idx, [t.pids[liar.seat - 1]!])], t.endMs)); expect(r.refused).toEqual(["1:climb:1"]); expect(r.counted).toBe(0); }
    for (const p of pids) await report("EP-C", p, [res("climb", c.idx, [t.pids[liar.seat - 1]!])], t.endMs); // every seat, not only three
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0); expect(rows("SELECT COUNT(*) c FROM winner")).toBe(0); expect(rows("SELECT COUNT(*) c FROM rvote")).toBe(0);
    await settleByPhones(call, "EP-C", [{ pattern: "climb", idx: c.idx, pids: c.pids }], pids, t.endMs); // the honest phones then report the true winner: it settles
    expect(settledOf("climb")).toEqual([{ ordinal: 1, pids: c.pids }]);
  });
  test("the same for the biggest comeback", async () => {
    const pids = await game("EP-B", 8); const t = trueGame(raw, "EP-B"), c = t.settled.find((s) => s.pattern === "comeback")!;
    const liar = t.runs.find((r: any) => r.bestComeback > 0 && t.pids[r.seat - 1] !== c.pids[0])!;
    expect(c).toBeTruthy(); expect(liar).toBeTruthy();
    for (const p of pids) await report("EP-B", p, [res("comeback", c.idx, [t.pids[liar.seat - 1]!])], t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
    await settleByPhones(call, "EP-B", [{ pattern: "comeback", idx: c.idx, pids: c.pids }], pids, t.endMs);
    expect(settledOf("comeback")).toEqual([{ ordinal: 1, pids: c.pids }]);
  });
  test("a seat that never climbed, a seat that does not exist, and a report that names the right seat for the wrong turn are refused too", async () => {
    const pids = await game("EP-X", 8); const t = trueGame(raw, "EP-X"), c = t.settled.find((s) => s.pattern === "climb")!;
    const flat = t.runs.find((r: any) => r.bestClimb === 0);
    for (const bad of [...(flat ? [res("climb", c.idx, [t.pids[flat.seat - 1]!])] : []), res("climb", c.idx, ["99x" + "ab".repeat(6)]), res("climb", c.idx - 1, c.pids), res("climb", c.idx, [...c.pids, t.pids.find((p) => p !== c.pids[0])!])]) for (const p of pids) await report("EP-X", p, [bad], t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
  });
  test("with one prize per person the climb winner is the best climber who has not already won another prize, exactly as on the phones", async () => {
    const pids = await game("EP-O", 8, { exclusive: true, endPrizes: 3 }); const t = trueGame(raw, "EP-O");
    const climb = t.settled.find((s) => s.pattern === "climb")!, others = new Set(t.settled.filter((s) => s.pattern !== "climb" && s.pattern !== "comeback").flatMap((s) => s.pids));
    expect(climb).toBeTruthy(); expect(others.has(climb.pids[0]!)).toBe(false); // the phones skip a seat that already won something
    const best = t.runs.reduce((a: any, r: any) => (r.bestClimb > a.bestClimb ? r : a), t.runs[0]); // the plain best climber (maybe already a winner, then he is not the answer)
    if (others.has(t.pids[best.seat - 1]!)) for (const p of pids) await report("EP-O", p, [res("climb", climb.idx, [t.pids[best.seat - 1]!])], t.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
    await settleByPhones(call, "EP-O", [{ pattern: "climb", idx: climb.idx, pids: climb.pids }], pids, t.endMs);
    expect(settledOf("climb")).toEqual([{ ordinal: 1, pids: climb.pids }]);
  });
});

describe("M1: the winning team is settled from the whole game", () => {
  test("a whole real team that is NOT the winning team is refused; the winning team is counted", async () => {
    const pids = await game("EP-T", 8, { mode: "team", teams: 2, turnCap: 40, rewards: [{ pattern: "team", ordinal: 1, text: "Hamper" }, { pattern: "team", ordinal: 2, text: "Pen" }] });
    const t = trueGame(raw, "EP-T"), first = t.settled.find((s) => s.pattern === "team" && s.ordinal === 1)!, second = t.settled.find((s) => s.pattern === "team" && s.ordinal === 2)!;
    expect(first.pids.length).toBe(4); expect(second.pids.length).toBe(4); expect(first.pids.some((p) => second.pids.includes(p))).toBe(false);
    for (const p of pids) await report("EP-T", p, [res("team", first.idx, second.pids, 1)], t.endMs); // the other team, whole and real, named as the winner
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0); expect(rows("SELECT COUNT(*) c FROM winner")).toBe(0);
    await settleByPhones(call, "EP-T", [{ pattern: "team", ordinal: 1, idx: first.idx, pids: first.pids }, { pattern: "team", ordinal: 2, idx: second.idx, pids: second.pids }], pids, t.endMs);
    expect(settledOf("team")).toEqual([{ ordinal: 1, pids: first.pids }, { ordinal: 2, pids: second.pids }]);
  });
});

describe("M1: the server plays the seats a part at a time", () => {
  test("a big game is played in parts: each call makes one part and answers 'not yet'; the parts are kept once and never made again", async () => {
    (env as any).REPLAY_SEATS_PER_CALL = "3";
    const pids = await game("EP-P", 8); const t = trueGame(raw, "EP-P"), c = t.settled.find((s) => s.pattern === "climb")!;
    const answers: number[] = [];
    for (let i = 0; i < 3; i++) { const r = await once("EP-P", pids[0]!, [res("climb", c.idx, c.pids)], t.endMs); answers.push(r.status); }
    // the public numbers are fetched in the first calls, then one part (3 seats) per call: 8 seats = 3 parts
    expect(answers.every((s) => s === 409 || s === 200)).toBe(true);
    const r = await report("EP-P", pids[0]!, [res("climb", c.idx, c.pids)], t.endMs); expect(r.status).toBe(200);
    expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'tru/EP-P/%'")).toBe(3);
    const before = raw.prepare("SELECT k, v FROM kv WHERE k LIKE 'tru/EP-P/%' ORDER BY k").all();
    await report("EP-P", pids[1]!, [res("climb", c.idx, c.pids)], t.endMs); await report("EP-P", pids[2]!, [res("climb", c.idx, c.pids)], t.endMs); // the third phone: the quorum
    const cb = t.settled.find((s) => s.pattern === "comeback")!; await report("EP-P", pids[3]!, [res("comeback", cb.idx, cb.pids)], t.endMs); // another prize of the same game: the same parts are used
    expect(raw.prepare("SELECT k, v FROM kv WHERE k LIKE 'tru/EP-P/%' ORDER BY k").all()).toEqual(before); // the same parts: not made again for the next prize or the next phone
    expect(settledOf("climb")).toEqual([{ ordinal: 1, pids: c.pids }]);
  });
  test("what is kept holds seat numbers and squares only, and goes with the rest of the game's data at the 24-hour deletion", async () => {
    const pids = await game("EP-K", 8); const t = trueGame(raw, "EP-K"), c = t.settled.find((s) => s.pattern === "climb")!;
    await settleByPhones(call, "EP-K", [{ pattern: "climb", idx: c.idx, pids: c.pids }], pids, t.endMs);
    expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'tru/EP-K/%'")).toBeGreaterThan(0);
    expect(JSON.stringify(raw.prepare("SELECT k, v FROM kv WHERE k LIKE 'tru/EP-K/%'").all())).not.toMatch(/Player|98765|@|\dx[0-9a-f]{12}/);
    expect((await call("POST", "/api/z/EP-K/erase", {}, org, t.endMs + 3_600_000)).status).toBe(200);
    expect(rows("SELECT COUNT(*) c FROM kv WHERE k LIKE 'tru/EP-K/%'")).toBe(0);
  });
  test("an earlier game's result is not mixed up with another game's: two games keep their own parts", async () => {
    const a = await game("EP-A1", 6), b = await game("EP-A2", 6);
    const ta = trueGame(raw, "EP-A1"), tb = trueGame(raw, "EP-A2");
    await settleByPhones(call, "EP-A1", [{ pattern: "climb", idx: ta.settled.find((s) => s.pattern === "climb")!.idx, pids: ta.settled.find((s) => s.pattern === "climb")!.pids }], a, ta.endMs);
    await settleByPhones(call, "EP-A2", [{ pattern: "climb", idx: tb.settled.find((s) => s.pattern === "climb")!.idx, pids: tb.settled.find((s) => s.pattern === "climb")!.pids }], b, tb.endMs);
    expect(rows("SELECT COUNT(*) c FROM settled WHERE eid='EP-A1' AND pattern='climb'")).toBe(1); expect(rows("SELECT COUNT(*) c FROM settled WHERE eid='EP-A2' AND pattern='climb'")).toBe(1);
  });
});

describe("M1: games the server cannot replay are not settled by phones for these prizes", () => {
  test("an older game where players threw by tapping (presence play): the prizes that need every seat are refused, the others keep their checks", async () => {
    const pids = await game("EP-R", 6, { play: "presence" }); const t = trueGame(raw, "EP-R");
    for (const p of pids) { const r = await j(await report("EP-R", p, [res("climb", 99, [t.pids[0]!])], t.endMs)); expect(r.refused ?? []).toEqual(["1:climb:1"]); } // the last turn the game allows (turn limit 100)
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
  });
});

describe("L2: the places agree with each other at the moment of settling, not only when a report is first checked", () => {
  test("one seat cannot take two home places: a report for 2nd place that passed before 1st place settled is refused when it reaches the quorum", async () => {
    const pids = await game("EP-L", 8); const t = trueGame(raw, "EP-L");
    const f1 = t.settled.find((s) => s.pattern === "finish" && s.ordinal === 1)!; expect(f1).toBeTruthy();
    const A = res("finish", f1.idx, f1.pids, 1), B = res("finish", f1.idx, f1.pids, 2); // the same seat, once as 1st and once as 2nd: each is true for that seat on that turn
    await once("EP-L", pids[0]!, [A], t.endMs); await once("EP-L", pids[0]!, [B], t.endMs); // both pass the first check (nothing is settled yet) and are remembered as checked
    expect(rows("SELECT COUNT(*) c FROM settled")).toBe(0);
    for (const p of pids.slice(1, 3)) await once("EP-L", p, [A], t.endMs); // 1st place reaches the quorum and settles
    expect(rows("SELECT COUNT(*) c FROM settled WHERE pattern='finish' AND ordinal=1")).toBe(1);
    for (const p of pids.slice(1, 5)) await once("EP-L", p, [B], t.endMs); // 2nd place reaches the quorum too: the same seat must not settle twice
    expect(rows("SELECT COUNT(*) c FROM settled WHERE pattern='finish'")).toBe(1); expect(rows("SELECT COUNT(*) c FROM winner WHERE pattern='finish' AND ordinal=2")).toBe(0);
  });
});
