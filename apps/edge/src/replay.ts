// The server works out the WHOLE game itself, for the prizes that need every seat (security audit M1 of 1.5.4, 25 Nov 2026).
//
// Before this file a report for "biggest climb", "biggest comeback" or "the winning team" was accepted when the named seat climbed at all (any seat does), or when the named seats were any
// whole team. Three seats could name almost anyone, and the first group to reach the quorum won. Now the server plays every seat of the game from the public beacon numbers, exactly as a
// phone or the organizer's console does (the same functions: packages/beacon/src/play.ts, race.ts), keeps a small record of each seat, and settles these three prizes with the SAME function the
// phones use (`settleRace`). A report counts only when it is exactly that answer: same seat (or same whole team), same turn.
//
// WHY IT RUNS IN SMALL STEPS. Making one seat's board takes about 10 ms (every board is checked to be equally hard), so a game of 2,000 seats is about 20 seconds of work. The account is on the
// paid Workers plan (owner, 2026-10-27: `pages/wrangler.toml`), whose call may use far more than the 10 ms of the free plan, but one call still never plays more than `seatsPerCall` seats.
// The records are kept in the database (`tru/<game>/<turn>/<part>`: seat numbers and squares only, public data, no name or number) and the report answers "not yet" (409, the phone sends it
// again in a few seconds) until every part is there. Each part is made once per game and turn, whoever asks and however often.
import { boardOf, settleRace, teamsOf, DEFAULT_MILESTONE, type RaceState, type Settled } from "../../../packages/beacon/src/race";
import { raceCfgOf } from "../../../packages/beacon/src/game";
import { newRun, rollFor, runFrom, type Run } from "../../../packages/beacon/src/play";
import type { EngagementCfg } from "../../../packages/beacon/src/config";
import { prefixEnd } from "./checkin";
import type { Env } from "./worker";

/** Seats played by one call. */
const SEATS_PER_CALL = 100;
export const seatsPerCall = (env: Env): number => { const n = Number((env as any).REPLAY_SEATS_PER_CALL); return Number.isInteger(n) && n >= 1 && n <= 500 ? n : SEATS_PER_CALL; };

export type Truth = { ok: true; lines: Settled[] } | { ok: false; later: boolean; why: string };
const later = (why: string): Truth => ({ ok: false, later: true, why });
const no = (why: string): Truth => ({ ok: false, later: false, why });

/** What is kept of one seat after turn `E` (E counted from 0): [finished turn or -1, ladders climbed, biggest climb, biggest comeback, square after turn E, then for each milestone (smallest first): turn reached or -1, square on arrival]. */
type Rec = number[];

/** The milestones in the order the game ranks them (smallest square first). */
const milestonesOf = (cfg: EngagementCfg): number[] => [...(cfg.milestones ?? [DEFAULT_MILESTONE])].sort((a, b) => a - b);

/** One seat played from the public numbers up to and including turn E: the same board, the same rolls and the same rules as on every phone. */
function recordOf(eid: string, cfg: EngagementCfg, seat: number, b0: string, betas: readonly string[]): Rec {
  const rc = raceCfgOf(eid, cfg, 2), board = boardOf(rc, seat, b0);
  const run = runFrom(board, seat, betas.map((b, t) => rollFor(rc.gameId, seat, t, b)), rc.board.finish);
  const out: Rec = [run.finishedTurn ?? -1, run.ladders, run.bestClimb, run.bestComeback, run.pos[run.pos.length - 1] ?? 1];
  for (const m of milestonesOf(cfg)) { const t = run.pos.findIndex((p) => p >= m); out.push(t, t < 0 ? 0 : run.pos[t]!); }
  return out;
}

/** A seat's kept record turned back into what the prize rules read (`settleRace` looks at the finishing turn, the ladders, the biggest climb and comeback, the square, and when each milestone was reached). */
function runOf(seat: number, r: Rec, E: number, ms: number[]): Run {
  const run = newRun(seat);
  run.finishedTurn = r[0]! >= 0 ? r[0]! : null; run.ladders = r[1]!; run.bestClimb = r[2]!; run.bestComeback = r[3]!;
  const pos = new Array<number>(E + 1).fill(0); pos[E] = r[4]!;
  ms.forEach((_m, j) => { const t = r[5 + 2 * j]!; if (t >= 0) pos[t] = r[6 + 2 * j]!; });
  run.pos = pos;
  return run;
}

/**
 * The true result of the whole game after turn `E` (the turn the report says the game ended on), or "not yet" while the server is still playing the seats.
 * `b0` and `betas` are the public numbers of the first turn's board and of turns 0 to E; `spend` charges the database writes.
 */
export async function endTruth(env: Env, eid: string, cfg: EngagementCfg, E: number, b0: string, betas: readonly string[], spend: (n: number) => Promise<boolean>): Promise<Truth> {
  const n = (await env.DB.prepare("SELECT COUNT(*) AS c FROM seat WHERE eid=?").bind(eid).first<{ c: number }>())?.c ?? 0;
  if (n < 2) return no("The game has too few players.");
  const K = seatsPerCall(env), parts = Math.ceil(n / K), base = `tru/${eid}/${E}/`;
  const have = new Map<number, Rec[]>();
  for (const r of (await env.DB.prepare("SELECT k, v FROM kv WHERE k >= ? AND k < ?").bind(base, prefixEnd(base)).all<{ k: string; v: string }>()).results ?? []) { try { have.set(Number(r.k.slice(base.length)), JSON.parse(r.v) as Rec[]); } catch { /* made again below */ } }
  const want = (i: number) => Math.min(K, n - i * K); // the last part is shorter; a part made when fewer seats had joined is made again
  for (let i = 0; i < parts; i++) {
    if ((have.get(i)?.length ?? -1) === want(i)) continue;
    if (!(await spend(1))) return later("The server is busy. The report will be sent again.");
    const recs: Rec[] = [];
    for (let s = i * K + 1; s <= i * K + want(i); s++) recs.push(recordOf(eid, cfg, s, b0, betas));
    await env.DB.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)").bind(base + i, JSON.stringify(recs)).run();
    return later(`The server is playing every seat of the game (part ${i + 1} of ${parts}).`); // one part per call; the phone sends the report again in a few seconds
  }
  // every seat is played: put the game together and settle it the way every phone does
  const recs: Rec[] = []; for (let i = 0; i < parts; i++) recs.push(...have.get(i)!);
  const pids = ((await env.DB.prepare("SELECT pid FROM seat WHERE eid=? ORDER BY seq").bind(eid).all<{ pid: string }>()).results ?? []).map((r) => r.pid);
  if (pids.length !== recs.length) return later("The list of seats changed while the game was being checked.");
  const rc = raceCfgOf(eid, cfg, n), ms = milestonesOf(cfg), runs = recs.map((r, i) => runOf(i + 1, r, E, ms));
  const finishedBy = (t: number) => runs.filter((r) => r.finishedTurn !== null && r.finishedTurn <= t).length;
  let over: (t: number) => boolean;
  if (rc.teams) { const deal = teamsOf(rc, b0); over = (t) => { for (let k = 0; k < rc.teams!; k++) { const mem = runs.filter((r) => deal[r.seat - 1] === k); if (mem.length && mem.every((r) => r.finishedTurn !== null && r.finishedTurn <= t)) return true; } return false; }; }
  else over = (t) => finishedBy(t) >= rc.endPrizes;
  // the game really ended on turn E: not earlier (then there is no turn E), and either the end was reached on E or E is the last turn the game allows
  if ((E > 0 && over(E - 1)) || !(over(E) || E >= rc.turnCap - 1)) return no("The game did not end on that turn.");
  const st: RaceState = { cfg: rc, b0, runs, boards: [], turnsPlayed: E + 1, ended: true, endReason: over(E) ? "finishers" : "cap", finishedCount: finishedBy(E) };
  return { ok: true, lines: settleRace(st, cfg.rewards, (seat) => pids[seat - 1] ?? String(seat), 1) };
}

/** Does a report say exactly what the true result says for its prize line: the same turn and the same seats? */
export function sameAsTruth(lines: readonly Settled[], x: { pattern: string; ordinal: number; idx: number; pids: readonly string[] }): boolean {
  const t = lines.find((l) => l.pattern === x.pattern && l.ordinal === x.ordinal);
  return !!t && t.idx === x.idx && JSON.stringify([...t.pids].sort()) === JSON.stringify([...x.pids].sort());
}
