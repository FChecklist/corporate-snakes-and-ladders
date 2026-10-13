// Snakes and Ladders: dice and movement. Pure and deterministic.
//
// SEALED DICE. A roll is a function of (game id, seat, turn, b_t). b_t is the first public beacon value published AFTER the window of turn t closed,
// so the roll does not exist while the window is open. The function below cannot be called without a real b_t (it throws), which is how "nobody can
// know the roll before throwing" is true by construction. Every device computes the same roll, and anyone can re-check it later.
import { sha256 } from "@noble/hashes/sha256";
import { utf8ToBytes } from "@noble/hashes/utils";
import { isHex64, resolve, type Board, type FinishRule } from "./board";

/** The roll (1 to 6) of one seat on one turn. Needs the published beacon value of that turn. */
export function rollFor(gameId: string, seat: number | string, turn: number, bt: string): number {
  if (!isHex64(bt)) throw new Error("A roll can only be made from the published beacon value of its turn.");
  if (!Number.isInteger(turn) || turn < 0) throw new Error("Bad turn number.");
  const h = sha256(utf8ToBytes(`SL1|roll|${gameId}|${seat}|${turn}|${bt.toLowerCase()}`));
  let v = 0n; for (const b of h) v = (v << 8n) | BigInt(b);
  return 1 + Number(v % 6n); // 256-bit value mod 6: the bias is smaller than 2^-250
}

/** Fate: a number per (game, seat, label). The same on every phone, from public data only. Lowest wins. Used to break every tie that nothing else breaks. */
export const fateOf = (gameId: string, seat: number | string, label: string): string => {
  const h = sha256(utf8ToBytes(`SL1-TIE|${gameId}|${seat}|tie|${label}`));
  let s = ""; for (const b of h) s += b.toString(16).padStart(2, "0");
  return s;
};

export type StepKind = "move" | "ladder" | "snake" | "overshoot" | "finish";
export interface Step { from: number; roll: number; landed: number; to: number; kind: StepKind }

/** One throw: new square = old + roll; a snake head or ladder bottom moves the pawn to the other end. Exact finish: a throw that would pass the last square is not used. */
export function step(board: Pick<Board, "size" | "snakes" | "ladders">, from: number, roll: number, finish: FinishRule = "exact"): Step {
  if (!Number.isInteger(roll) || roll < 1 || roll > 6) throw new Error("A roll is 1 to 6.");
  const t = from + roll;
  if (t > board.size) {
    if (finish === "pass") return { from, roll, landed: board.size, to: board.size, kind: "finish" };
    return { from, roll, landed: from, to: from, kind: "overshoot" };
  }
  const to = resolve(board, t);
  const kind: StepKind = t === board.size ? "finish" : board.ladders[t] !== undefined ? "ladder" : board.snakes[t] !== undefined ? "snake" : "move";
  return { from, roll, landed: t, to, kind };
}

/** Everything a game keeps about one player, built turn by turn. */
export interface Run {
  seat: number;
  pos: number[];           // square after each turn played so far (pos[t] after turn t)
  finishedTurn: number | null;
  ladders: number;         // ladders climbed
  snakes: number;          // snakes met
  missed: number;          // turns not thrown (presence mode)
  bestClimb: number;       // the biggest single ladder taken
  bestComeback: number;    // the biggest snake drop after which the pawn got back to the square it stood on before that throw
  history: Step[];         // one entry per turn thrown
  _pending: { before: number; drop: number }[];
}

export const newRun = (seat: number): Run => ({ seat, pos: [], finishedTurn: null, ladders: 0, snakes: 0, missed: 0, bestClimb: 0, bestComeback: 0, history: [], _pending: [] });
export const squareOf = (r: Run): number => (r.pos.length ? r.pos[r.pos.length - 1]! : 1);

/** Applies the next turn to a run. `roll` null = the player did not throw inside the window (presence mode): the pawn stays. A finished pawn stays finished. */
export function advance(board: Pick<Board, "size" | "snakes" | "ladders">, run: Run, roll: number | null, finish: FinishRule = "exact"): Run {
  const t = run.pos.length, cur = squareOf(run);
  if (run.finishedTurn !== null) { run.pos.push(cur); return run; }
  if (roll === null) { run.missed++; run.pos.push(cur); return run; }
  const s = step(board, cur, roll, finish);
  run.history.push(s); run.pos.push(s.to);
  if (s.kind === "ladder") { run.ladders++; run.bestClimb = Math.max(run.bestClimb, s.to - s.landed); }
  if (s.kind === "snake") { run.snakes++; run._pending.push({ before: cur, drop: s.landed - s.to }); }
  if (s.to === board.size) run.finishedTurn = t;
  for (let i = run._pending.length - 1; i >= 0; i--) { const p = run._pending[i]!; if (s.to >= p.before) { run.bestComeback = Math.max(run.bestComeback, p.drop); run._pending.splice(i, 1); } }
  return run;
}

/** The whole run of a player from a list of rolls (null = missed). */
export function runFrom(board: Pick<Board, "size" | "snakes" | "ladders">, seat: number, rolls: readonly (number | null)[], finish: FinishRule = "exact"): Run {
  const r = newRun(seat);
  for (const x of rolls) advance(board, r, x, finish);
  return r;
}
