// Snakes and Ladders: what a spectator sees, and the presence-mode throw record. Both are small and pure.
import { squareOf } from "./play";
import { crowdOf, rankPlayers, type RaceState } from "./race";
import { rankTable, type TableState } from "./table";

export type Role = "player" | "spectator";
/** A spectator watches. They never throw and they hold no seat. */
export const mayThrow = (role: Role): boolean => role === "player";

export interface SpectatorView {
  kind: "race" | "team" | "table";
  turn: number; ended: boolean; players: number; finished: number;
  bands: number[];                                           // how many players stand in each band of the board
  leaders: { rank: number; name: string; square: number; finished: boolean }[];
}
/**
 * The public picture of a game: counts per band and the top-10 list by nickname. It holds no board, no seed, no beacon value and nothing about turns
 * that have not been played, so it can be shown on a big screen or to a viewer who is not playing.
 */
export function spectatorView(st: RaceState | TableState, nick: (seat: number) => string = (s) => `Player ${s}`): SpectatorView {
  if ("order" in st) {
    const rows = rankTable(st).slice(0, 10), size = st.board.size, bands = new Array<number>(10).fill(0);
    for (const r of st.runs) bands[Math.min(9, Math.floor((squareOf(r) - 1) / (size / 10)))]!++;
    return { kind: "table", turn: st.throws, ended: st.ended, players: st.runs.length, finished: st.finishedOrder.length, bands, leaders: rows.map((r) => ({ rank: r.rank, name: nick(r.seat), square: r.square, finished: r.finishedAtThrow !== null })) };
  }
  const c = crowdOf(st), rows = rankPlayers(st, 10);
  return { kind: st.cfg.teams ? "team" : "race", turn: st.turnsPlayed, ended: st.ended, players: c.players, finished: c.finished, bands: c.bands, leaders: rows.map((r) => ({ rank: r.rank, name: nick(r.seat), square: r.square, finished: r.finishedTurn !== null })) };
}

/* ---------------- presence mode: the collector's record of throws ---------------- */

export interface ThrowClaim { seat: number; turn: number; device: string; arrivalMs: number }
export interface TurnWindow { openMs: number; windowSec: number }
/**
 * A throw counts only if it arrived at the collector, with the registered device of that seat, inside the window of that very turn.
 * The arrival time is the collector's own clock. A phone cannot claim a throw afterwards, once the dice for the turn have become public.
 */
export function acceptThrow(c: ThrowClaim, registered: (seat: number) => string | undefined, win: TurnWindow): { ok: true } | { ok: false; reason: "unknown seat" | "wrong device" | "window not open yet" | "window closed" } {
  const dev = registered(c.seat);
  if (dev === undefined) return { ok: false, reason: "unknown seat" };
  if (dev !== c.device) return { ok: false, reason: "wrong device" };
  if (c.arrivalMs < win.openMs) return { ok: false, reason: "window not open yet" };
  if (c.arrivalMs >= win.openMs + win.windowSec * 1000) return { ok: false, reason: "window closed" };
  return { ok: true };
}

/** The record of accepted throws: one per (seat, turn). The same record feeds every phone's `thrown` function. */
export class ThrowRecord {
  private seen = new Set<string>();
  private perTurn = new Map<number, number>();
  count = 0;
  add(seat: number, turn: number): boolean {
    const k = `${seat}:${turn}`; if (this.seen.has(k)) return false;
    this.seen.add(k); this.count++; this.perTurn.set(turn, (this.perTurn.get(turn) ?? 0) + 1); return true;
  }
  thrown = (seat: number, turn: number): boolean => this.seen.has(`${seat}:${turn}`);
  /** How many players threw in a turn (this is what the ping answer carries back). */
  throwsIn(turn: number): number { return this.perTurn.get(turn) ?? 0; }
}
