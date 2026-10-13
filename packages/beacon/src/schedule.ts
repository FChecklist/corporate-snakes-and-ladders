// Snakes and Ladders: when things happen, counted in public beacon rounds (3 seconds each). No phone clock is ever used.
//   Registration closes at T0. B0 is the first round published after T0, so no seat's board can be known earlier.
//   Turn t opens at a published round. The window stays open for `windowSec` seconds. b_t is the first round published AFTER the window closed.
import { roundAt, QUICKNET } from "./index";
import type { ControlState } from "./control";

export const ROUND_SEC = QUICKNET.periodSec;
export const WINDOWS = [15, 20, 25, 30] as const;
export const DEFAULT_WINDOW = 20;
/** About 5 seconds after the window closes the dice shows and the pawns move: the reveal. */
export const REVEAL_ROUNDS = 2;
/** Turn 0 opens this many rounds (about 2 minutes) after B0, so every phone has the time to make its board and openings can play. B0 itself is one round after the start time, so the first turn is GRACE_ROUNDS (40) after it. */
export const LEAD_ROUNDS = 39;

/** Rounds from the opening of a turn to the round whose value is b_t: the first round published after the window closed. */
export const betaOffset = (windowSec: number): number => Math.floor(windowSec / ROUND_SEC) + 1;
/** Rounds one turn takes (window, then reveal): 9 rounds (27 s) for a 20 second window. */
export const turnRounds = (windowSec: number): number => betaOffset(windowSec) + REVEAL_ROUNDS;
/** B0 comes from the first beacon round published strictly after registration closed. */
export const b0RoundFor = (t0Ms: number): number => roundAt(t0Ms) + 1;
export const firstTurnRound = (b0Round: number): number => b0Round + LEAD_ROUNDS;

export interface BreakLike { after: number; seconds: number }
const shiftOf = (breaks: readonly BreakLike[], t: number): number => breaks.reduce((s, b) => s + (b.after <= t ? b.seconds / ROUND_SEC : 0), 0);

/** The round at which turn t opens: the plain schedule, pushed later by every brand break that starts at or before it, then by every pause the organizer signed. Null = the game was stopped before it. */
export function openRoundOf(st: ControlState | null, first: number, windowSec: number, breaks: readonly BreakLike[], t: number): number | null {
  let a = first + t * turnRounds(windowSec) + shiftOf(breaks, t);
  if (st) { for (const i of st.intervals) if (a >= i.start) a += i.end - i.start; if (st.stopRound !== null && a >= st.stopRound) return null; }
  return a;
}
/** The beacon round whose value decides every roll of turn t. */
export const betaRoundOf = (st: ControlState | null, first: number, windowSec: number, breaks: readonly BreakLike[], t: number): number | null => {
  const o = openRoundOf(st, first, windowSec, breaks, t);
  return o === null ? null : o + betaOffset(windowSec);
};
