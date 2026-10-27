// The phone-side game: everything a phone (or the organizer's console) needs to play and to check a game from the public beacon alone.
// Pure and deterministic: no server, no phone clock. The rules themselves live in board.ts, play.ts, race.ts, table.ts and view.ts;
// this file joins them to the public settings (config.ts), the schedule (schedule.ts) and the beacon values held on a phone.
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { defaultBoardCfg, type BoardCfg } from "./board";
import { DEFAULT_END_PRIZES, DEFAULT_MILESTONE, DEFAULT_TURN_CAP, defaultRaceCfg, settleRace, playRace, type RaceCfg, type RaceInput, type RaceState, type RewardLike, type Settled } from "./race";
import { defaultTableCfg, playTable, settleTable, type TableCfg, type TableInput, type TableState } from "./table";
import { betaOffset, firstTurnRound, openRoundOf, ROUND_SEC, DEFAULT_WINDOW } from "./schedule";
import { GRACE_ROUNDS, defaultCfg, roundEid, type BreakCfg, type EngagementCfg } from "./config";
import type { ControlState } from "./control";
import { seatOfPid } from "./seat";
import { fetchRound, verifyRound, type BeaconOpts, type Round, defaultMirrors } from "./index";

export { fateOf, rollFor } from "./play";
export { generateBoard } from "./board";
export type { Settled } from "./race";

/** The game's own settings out of the public engagement settings. */
export function raceCfgOf(eid: string, cfg: EngagementCfg, players: number, round = 1): RaceCfg {
  const board: BoardCfg = cfg.board ? { size: cfg.board.size, snakes: cfg.board.snakes, ladders: cfg.board.ladders, finish: cfg.board.finish } : defaultBoardCfg();
  return {
    ...defaultRaceCfg(roundEid(eid, round), players), board, milestones: cfg.milestones ?? [DEFAULT_MILESTONE], turnCap: cfg.turnCap ?? DEFAULT_TURN_CAP,
    endPrizes: cfg.endPrizes ?? DEFAULT_END_PRIZES, play: cfg.play ?? "fate", exclusive: cfg.exclusive === true, ...(cfg.mode === "team" && cfg.teams ? { teams: cfg.teams } : {}),
  };
}
export function tableCfgOf(eid: string, cfg: EngagementCfg, players: number, round = 1): TableCfg {
  const board: BoardCfg = cfg.board ? { size: cfg.board.size, snakes: cfg.board.snakes, ladders: cfg.board.ladders, finish: cfg.board.finish } : defaultBoardCfg();
  const winners = Math.max(1, Math.min(cfg.endPrizes ?? 3, 3, players - 1));
  return { ...defaultTableCfg(roundEid(eid, round), players), board, winners, milestone: (cfg.milestones ?? [DEFAULT_MILESTONE])[0] };
}

/** The whole game so far, for any game type. */
export type GameState = { kind: "race"; st: RaceState } | { kind: "table"; st: TableState };
export function playGame(eid: string, cfg: EngagementCfg, players: number, input: RaceInput & TableInput, round = 1): GameState {
  if (cfg.mode === "table") return { kind: "table", st: playTable(tableCfgOf(eid, cfg, players, round), input) };
  return { kind: "race", st: playRace(raceCfgOf(eid, cfg, players, round), input) };
}
/** Who won each reward line so far. `pids` is the seat list in seat order (index 0 = seat 1). */
export function settleGame(g: GameState, cfg: EngagementCfg, pids: readonly string[], round = 1): Settled[] {
  const pidOf = (seat: number) => pids[seat - 1] ?? String(seat);
  const lines: RewardLike[] = cfg.rewards;
  return g.kind === "table" ? settleTable(g.st, lines, pidOf, round) : settleRace(g.st, lines, pidOf, round);
}

/* ---------------- the schedule, with brand breaks and the organizer's pauses ---------------- */

/** The beacon round turn `k` opens at. A game has one round (replays are new games, made with "play again"), so `round` must be 1. */
export function callRoundR(st: ControlState | null, start: number, strideRounds: number, breaks: readonly BreakCfg[], round: number, k: number): number | null {
  if (round !== 1) return null;
  let a = start + k * strideRounds + breaks.reduce((s, b) => s + (b.after <= k ? b.seconds / ROUND_SEC : 0), 0);
  if (st) { for (const i of st.intervals) if (a >= i.start) a += i.end - i.start; if (st.stopRound !== null && a >= st.stopRound) return null; }
  return a;
}
export const callRoundFull = (st: ControlState | null, start: number, stride: number, breaks: readonly BreakCfg[], k: number): number | null => callRoundR(st, start, stride, breaks, 1, k);
export { openRoundOf, betaOffset, firstTurnRound, GRACE_ROUNDS, DEFAULT_WINDOW };
/** Kept for the older callers: the plain, unshifted schedule. */
export const unshiftedRound = (start: number, stride: number, breaks: readonly BreakCfg[], round: number, k: number): number => start + k * stride + breaks.reduce((s, b) => s + (b.after <= k ? b.seconds / ROUND_SEC : 0), 0) + (round - 1) * 0;
export const scheduleFull = (st: ControlState | null, start: number, stride: number, breaks: readonly BreakCfg[], count = DEFAULT_TURN_CAP): (number | null)[] => Array.from({ length: count }, (_, k) => callRoundFull(st, start, stride, breaks, k));
/** There is only one round, so there is no intermission. */
export const activeIntermission = (..._a: unknown[]): null => null;

/** The beacon round whose randomness decides a lucky draw: the round in which the break ends. */
export function luckyRound(st: ControlState | null, start: number, stride: number, breaks: readonly BreakCfg[], b: BreakCfg): number | null {
  const prev = callRoundFull(st, start, stride, breaks, b.after - 1);
  return prev === null ? null : prev + betaOffsetOfStride(stride) + b.seconds / ROUND_SEC;
}
// The break starts when the turn before it has finished its reveal: one turn after the previous turn's opening.
const betaOffsetOfStride = (stride: number): number => stride;

/** The brand break showing at `nowRound`, if any: it starts right after the turn it follows and lasts its stated length. */
export function activeBreak(st: ControlState | null, start: number, stride: number, breaks: readonly BreakCfg[], nowRound: number): { brk: BreakCfg; endsAtRound: number } | null {
  for (const b of breaks) {
    const prev = callRoundFull(st, start, stride, breaks, b.after - 1);
    if (prev === null) continue;
    const from = prev + stride, to = from + b.seconds / ROUND_SEC;
    if (nowRound >= from && nowRound < to) return { brk: b, endsAtRound: to };
  }
  return null;
}

/**
 * Lucky draw: picks `n` participants from the list using the public randomness of the round that ends the break. Nobody can know the round's
 * randomness beforehand, and anyone holding the participant list can recompute the winners. Every participant is equally likely; nobody wins twice.
 */
export function luckyWinners(engagementId: string, breakAfter: number, randomnessHex: string, pids: readonly string[], n: number): string[] {
  const rank = (pid: string) => bytesToHex(sha256(utf8ToBytes(`SL1-LUCKY|${engagementId}|${breakAfter}|${randomnessHex}|${pid}`)));
  return [...new Set(pids)].map((pid) => [rank(pid), pid] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).slice(0, Math.max(0, n)).map((x) => x[1]);
}

/**
 * Who may win a lucky draw. A seat that is flagged as Organizer, Host or Co-host (`ex`) never wins. A person REMOVED during the game stays in the public seat list (every phone must work out the
 * same draw from the same list), so the list also says WHEN each removal was recorded by the server (`removedMs`): a person removed at least LUCKY_REMOVAL_MARGIN_MS before the moment of the draw
 * (`drawMs`, the time of the beacon round that decides it) is left out, on every phone and in the console, by the same arithmetic. A removal recorded later than that is not counted for this draw
 * (it counts for the next one): the margin is longer than the 20 seconds a copy of the public list may be cached for, so no phone can see a removal that another phone does not, and the draw stays identical everywhere.
 */
export const LUCKY_REMOVAL_MARGIN_MS = 30_000;
export function luckyEligible(seats: readonly { pid: string; ex?: boolean; removedMs?: number | null }[], drawMs: number): string[] {
  return seats.filter((s) => !s.ex && !(typeof s.removedMs === "number" && s.removedMs + LUCKY_REMOVAL_MARGIN_MS <= drawMs)).map((s) => s.pid);
}

/** A mirror that gave nothing for a past round (blocked, offline, hanging) is left out of the next 100 catch-up rounds, about one whole catch-up: a blocked network is waited on once, not once per mirror per round. Counted in rounds asked for, never in time: this code never reads the device clock. */
const BACKFILL_SKIP = 100;
/**
 * Rounds a phone holds for a game. Past rounds (a phone that opens the game late) are accepted provisionally when two different mirrors
 * give byte-identical answers, then checked against the BLS signature in the background so the page never blocks for seconds.
 * Current rounds are always signature-checked straight away. Anything that fails the check is thrown away and re-fetched.
 */
export class RoundStore {
  readonly rounds = new Map<number, Round>();
  readonly verified = new Set<number>();
  discarded = 0;
  readonly backfills = { asked: 0, skipUntil: new Map<string, number>() };
  constructor(readonly opts: BeaconOpts = {}, readonly verify: (x: Round) => boolean = (x) => verifyRound(x, opts.net)) {}

  /** Live round: verified immediately. `mirrors`, when given, is the list to ask in the order to ask it (instead of the default list rotated by `salt`). */
  async fetchLive(r: number, salt = 0, mirrors?: readonly string[]): Promise<boolean> {
    if (this.verified.has(r)) return true;
    const x = await fetchRound(r, { ...this.opts, ...(mirrors ? { mirrors } : {}), verify: (y) => this.verify(y) }, salt);
    if (!x) return false;
    this.rounds.set(r, x); this.verified.add(r);
    return true;
  }

  /** Past round: needs two mirrors to agree (their raw answers are compared), signature check deferred. */
  async fetchBackfill(r: number, salt = 0): Promise<boolean> {
    if (this.rounds.has(r)) return true;
    const mirrors = this.opts.mirrors ?? defaultMirrors();
    const answers: Round[] = [];
    const bf = this.backfills; bf.asked++;
    const lately = (m: string) => (bf.skipUntil.get(m) ?? 0) > bf.asked; // gave nothing a moment ago
    for (let i = 0; i < mirrors.length && answers.length < 2; i++) {
      const m = mirrors[(i + salt) % mirrors.length]!;
      if (lately(m)) continue; // not waited on again for every round of a catch-up (checked at each step, so what the other rounds of this batch found counts)
      // no per-round signature check here (verify: always true); the deferred check below is what makes it safe
      const x = await fetchRound(r, { ...this.opts, mirrors: [m], verify: (y) => !!y && y.round === r && typeof y.signature === "string" && typeof y.randomness === "string" }, 0);
      if (x) { answers.push(x); bf.skipUntil.delete(m); } else bf.skipUntil.set(m, bf.asked + BACKFILL_SKIP);
    }
    if (answers.length < 2) { // not enough mirrors: fall back to the slow, fully-checked path rather than trust a single answer
      const late = mirrors.filter(lately), live = mirrors.filter((m) => !lately(m));
      if (!late.length || !live.length) return this.fetchLive(r, salt);
      return this.fetchLive(r, 0, [...live.map((_, i) => live[(i + salt) % live.length]!), ...late]); // the ones that gave nothing lately are asked last there too
    }
    if (answers[0]!.signature !== answers[1]!.signature || answers[0]!.randomness !== answers[1]!.randomness) return this.fetchLive(r, salt);
    this.rounds.set(r, answers[0]!);
    return true;
  }

  /** Checks up to `max` provisional rounds. Call repeatedly (e.g. one per timer tick). Returns how many remain. */
  verifySome(max = 1): number {
    let n = 0;
    for (const [r, x] of this.rounds) {
      if (this.verified.has(r)) continue;
      if (n >= max) break;
      n++;
      if (this.verify(x)) this.verified.add(r); else { this.rounds.delete(r); this.discarded++; }
    }
    return this.pending();
  }
  pending(): number { let p = 0; for (const r of this.rounds.keys()) if (!this.verified.has(r)) p++; return p; }
  async verifyAll(): Promise<void> { while (this.verifySome(1) > 0) await new Promise((r) => setTimeout(r, 0)); }
}

export const rankName = (r: number): string => ["", "1st", "2nd", "3rd"][r] ?? `${r}th`;
export { seatOfPid, defaultCfg, roundEid, firstTurnRound as firstTurn };
