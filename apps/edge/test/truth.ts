// The server now checks every reported win against the public game (verifywin.ts), so a test that needs a winner has to report a TRUE one.
// This file is the test's copy of the public beacon (a stand-in for the beacon's servers: every round has a fixed, known number) and the true result of a game played on it,
// worked out the way a phone works it out (packages/beacon/src/game.ts playGame + settleGame).
import { GRACE_ROUNDS } from "../../../packages/beacon/src/config";
import { betaRoundOf } from "../../../packages/beacon/src/schedule";
import { playGame, settleGame, luckyRound, luckyEligible, luckyWinners, type Settled } from "../../../packages/beacon/src/game";
import { DEFAULT_TURN_CAP } from "../../../packages/beacon/src/race";
import { cfgOfRow, roundMs } from "../src/lifecycle";
import { settleByPhones } from "./settle";
import { installBeacon, randomnessOf } from "./beacon";
export * from "./beacon";

export interface TrueGame { settled: Settled[]; pids: string[]; endMs: number; turnMs: (t: number) => number; players: number; turns: number; ended: boolean }
/** The true game: the seats that joined, the stand-in beacon's numbers, played to the end the way a phone plays it. */
export function trueGame(raw: any, eid: string, upTo = Infinity): TrueGame {
  const e = raw.prepare("SELECT * FROM engagement WHERE id=?").get(eid), cfg = cfgOfRow(e);
  const seats = raw.prepare("SELECT pid FROM seat WHERE eid=? ORDER BY seq").all(eid) as { pid: string }[];
  const first = e.start_round + GRACE_ROUNDS, cap = cfg.mode === "table" ? 600 : cfg.turnCap ?? DEFAULT_TURN_CAP;
  const betaRound = (t: number) => betaRoundOf(null, first, e.call_seconds, cfg.breaks, t)!;
  const betas: string[] = []; for (let t = 0; t < Math.min(cap, upTo); t++) betas.push(randomnessOf(betaRound(t)));
  const g = playGame(eid, cfg, seats.length, { b0: randomnessOf(e.start_round + 1), betas });
  const settled = settleGame(g, cfg, seats.map((s) => s.pid), 1);
  const st = g.st as any;
  return { settled, pids: seats.map((s) => s.pid), endMs: roundMs(betaRound(cap - 1)) + 120_000, turnMs: (t) => roundMs(betaRound(t)), players: seats.length, turns: st.turnsPlayed ?? st.throws ?? 0, ended: !!st.ended };
}
type CallFn = Parameters<typeof settleByPhones>[0];
/** What a game's phones would all report once it is over. */
export const reportable = (t: TrueGame, pattern?: string) => t.settled.filter((s) => !pattern || s.pattern === pattern);

/** Phones report the true result of the game for the given prizes (default: all of them) after the game is over. Returns what was reported. */
export async function settleTrue(call: CallFn, raw: any, eid: string, voters: string[], patterns?: string[]): Promise<Settled[]> {
  installBeacon();
  const t = trueGame(raw, eid), rs = t.settled.filter((s) => !patterns || patterns.includes(s.pattern));
  await settleByPhones(call, eid, rs.map((s) => ({ pattern: s.pattern, ordinal: s.ordinal, round: 1, idx: s.idx, pids: s.pids })), voters, t.endMs);
  return rs;
}

/** A lucky draw's true winners, worked out the way a phone does it (game.ts luckyWinners from the round that ends the break), and a time after the draw. */
export function luckyTruth(raw: any, eid: string, ordinal = 1): { idx: number; pids: string[]; nowMs: number } {
  const e = raw.prepare("SELECT * FROM engagement WHERE id=?").get(eid), cfg = cfgOfRow(e);
  const brk = cfg.breaks.filter((b) => b.kind === "lucky")[ordinal - 1]!;
  const round = luckyRound(null, e.start_round + GRACE_ROUNDS, Math.floor(e.call_seconds / 3) + 1 + 2, cfg.breaks, brk)!;
  const seats = raw.prepare("SELECT pid, role FROM seat WHERE eid=? ORDER BY seq").all(eid) as { pid: string; role: string | null }[];
  const eligible = luckyEligible(seats.map((x) => ({ pid: x.pid, ex: x.role !== null, removedMs: null })), roundMs(round));
  return { idx: brk.after, pids: luckyWinners(eid, brk.after, randomnessOf(round), eligible, brk.winners || 3).sort(), nowMs: roundMs(round) + 60_000 };
}
