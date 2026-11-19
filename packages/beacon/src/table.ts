// Snakes and Ladders: TABLE MODE. One shared board and 2 to 20 pawns that take turns in a sealed random order.
// (Added for small groups; the SPEC's own mode is the group race. The same dice, board and finish rules apply.)
import { generateBoard, defaultBoardCfg, type Board, type BoardCfg } from "./board";
import { advance, fateOf, newRun, rollFor, squareOf, type Run } from "./play";
import type { RewardLike, Settled } from "./race";

/** The most people one shared board can hold. The server refuses a table game for more people (worker.ts), because phones cannot play it. */
export const TABLE_MAX_PLAYERS = 20;
export interface TableCfg { gameId: string; players: number; board: BoardCfg; winners: number; maxThrows: number; milestone?: number }
export const defaultTableCfg = (gameId: string, players: number): TableCfg => ({ gameId, players, board: defaultBoardCfg(), winners: Math.min(3, players - 1), maxThrows: 600 });
export interface TableInput { b0: string; betas: readonly string[]; absent?: (seat: number, throwIndex: number) => boolean }
export interface TableState { cfg: TableCfg; board: Board; order: number[]; runs: Run[]; throws: number; finishedOrder: number[]; finishThrow: Map<number, number>; milestoneIdx: Map<number, number>; whoseTurn: number | null; ended: boolean; endReason: "winners" | "cap" | "running" }

export function validateTableCfg(c: TableCfg): string | null {
  if (!Number.isInteger(c.players) || c.players < 2 || c.players > TABLE_MAX_PLAYERS) return "A table game has 2 to 20 players.";
  if (!Number.isInteger(c.winners) || c.winners < 1 || c.winners > Math.min(3, c.players - 1)) return "1 to 3 players win, and at least one player is left over.";
  if (!Number.isInteger(c.maxThrows) || c.maxThrows < c.players * 5) return "The throw limit is too small.";
  return null;
}

/** The sealed turn order: every seat gets a fate number from the game id and B0 (unknown before registration closed); the lowest plays first. The same on every phone. */
export function turnOrder(gameId: string, players: number, b0: string): number[] {
  return Array.from({ length: players }, (_, i) => i + 1).sort((a, b) => { const x = fateOf(gameId, a, `order|${b0}`), y = fateOf(gameId, b, `order|${b0}`); return x < y ? -1 : x > y ? 1 : a - b; });
}

/** Plays the table forward for as long as the published values allow. Throw k uses b_k and goes to the next pawn that has not finished. */
export function playTable(cfg: TableCfg, input: TableInput): TableState {
  const err = validateTableCfg(cfg); if (err) throw new Error(err);
  const board = generateBoard(cfg.gameId, "table", input.b0, cfg.board), order = turnOrder(cfg.gameId, cfg.players, input.b0);
  const runs = Array.from({ length: cfg.players }, (_, i) => newRun(i + 1));
  const st: TableState = { cfg, board, order, runs, throws: 0, finishedOrder: [], finishThrow: new Map(), milestoneIdx: new Map(), whoseTurn: order[0]!, ended: false, endReason: "running" };
  let ptr = 0;
  const skipDone = () => { let g = 0; while (runs[order[ptr % order.length]! - 1]!.finishedTurn !== null && g++ < order.length) ptr++; };
  for (let k = 0; k < input.betas.length && !st.ended; k++) {
    skipDone();
    const seat = order[ptr % order.length]!, run = runs[seat - 1]!;
    const roll = input.absent?.(seat, k) ? null : rollFor(cfg.gameId, seat, k, input.betas[k]!);
    advance(board, run, roll, cfg.board.finish);
    if (run.finishedTurn !== null && !st.finishThrow.has(seat)) { st.finishedOrder.push(seat); st.finishThrow.set(seat, k); }
    if (cfg.milestone !== undefined && !st.milestoneIdx.has(seat) && squareOf(run) >= cfg.milestone) st.milestoneIdx.set(seat, k);
    st.throws = k + 1; ptr++;
    if (st.finishedOrder.length >= cfg.winners) { st.ended = true; st.endReason = "winners"; }
    else if (st.throws >= cfg.maxThrows) { st.ended = true; st.endReason = "cap"; }
  }
  skipDone();
  st.whoseTurn = st.ended ? null : order[ptr % order.length]!;
  return st;
}

/** The ranking of a table game: finishers in the order they finished (never tied: pawns move one at a time), then the rest by square, ladders, fewer missed turns, fate. */
export function rankTable(st: TableState): { rank: number; seat: number; finishedAtThrow: number | null; square: number }[] {
  const fin = st.finishedOrder.map((s) => st.runs[s - 1]!);
  const rest = st.runs.filter((r) => !st.finishThrow.has(r.seat))
    .sort((a, b) => squareOf(b) - squareOf(a) || b.ladders - a.ladders || a.missed - b.missed || (fateOf(st.cfg.gameId, a.seat, "tablerank") < fateOf(st.cfg.gameId, b.seat, "tablerank") ? -1 : 1));
  return [...fin, ...rest].map((r, i) => ({ rank: i + 1, seat: r.seat, finishedAtThrow: st.finishThrow.get(r.seat) ?? null, square: squareOf(r) }));
}

/** Who won each reward line at the table: finish#k is the k-th pawn home, milestone#1 the first pawn on or past the milestone square. */
export function settleTable(st: TableState, lines: readonly RewardLike[], pidOf: (seat: number) => string = (s) => String(s), round = 1): Settled[] {
  const out: Settled[] = [];
  for (const l of lines) {
    if (l.pattern === "finish") { const seat = st.finishedOrder[l.ordinal - 1]; if (seat !== undefined) out.push({ pattern: "finish", ordinal: l.ordinal, idx: st.finishThrow.get(seat)!, pids: [pidOf(seat)], round }); }
    else if (l.pattern === "milestone" && l.ordinal === 1) {
      const first = [...st.milestoneIdx.entries()].sort((a, b) => a[1] - b[1])[0];
      if (first) out.push({ pattern: "milestone", ordinal: 1, idx: first[1], pids: [pidOf(first[0])], round });
    }
  }
  return out;
}
