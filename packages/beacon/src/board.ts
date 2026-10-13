// Snakes and Ladders: the board. Pure and deterministic. A board is made from (game id, seat, B0) only, where B0 is the first public beacon value
// published after registration closed. Nobody can know a board earlier, and any phone can re-make any board later.
//
// Every board must be equally hard (SPEC section 3): the expected number of turns to finish, worked out EXACTLY with the game's own rules, has to be
// inside a band around the target, and the chance of finishing within 20 turns has to be inside a fixed band. A board outside the band is thrown away
// and the next candidate comes from the same seat's seed stream.
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export const BOARD_SIZES = [100, 144, 225] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];
export const DEFAULT_SIZE: BoardSize = 100;
export type FinishRule = "exact" | "pass";

/** The settings that shape a board. Part of the game's public settings, so every phone uses the same ones. */
export interface BoardCfg { size: BoardSize; snakes: number; ladders: number; finish: FinishRule; targetTurns?: number }
export const defaultBoardCfg = (): BoardCfg => ({ size: DEFAULT_SIZE, snakes: 9, ladders: 9, finish: "exact" });
export const MIN_PER_KIND = 6, MAX_PER_KIND = 12;

export interface Board { size: number; side: number; snakes: Record<number, number>; ladders: Record<number, number>; expectedTurns: number; within20: number; attempts: number }

export const sideOf = (size: number): number => Math.round(Math.sqrt(size));
/** Target expected turns: 40 on the classic board (SPEC), and the measured typical value for the two larger boards (54 and 80, found from simulation, see docs/GATES.md). */
export const targetTurnsFor = (size: number, override?: number): number => override ?? (size === 144 ? 54 : size === 225 ? 80 : 40);
/** The expected turns must be within this fraction of the target (SPEC: 5%). */
export const BAND_TOLERANCE = 0.05;
/** The chance of finishing within 20 turns (30 on the 144 board, 52 on the 225 board: windows chosen so the typical board sits near 13%) must lie in this band. Found from simulation, see docs/GATES.md. */
export const SPREAD_BAND = { lo: 0.07, hi: 0.25 } as const;
export const spreadTurns = (size: number): number => (size === 144 ? 30 : size === 225 ? 52 : 20);

/** Climb and drop limits scale with the side of the board (SPEC: ladder rises 8 to 30, snake drops 8 to 40 on 100 squares). */
export function limits(size: number) {
  const f = sideOf(size) / 10;
  return { minRise: Math.ceil(8 * f), maxRise: Math.floor(30 * f), minDrop: Math.ceil(8 * f), maxDrop: Math.floor(40 * f) };
}

/** Where a throw lands: follows a snake head or a ladder bottom to the other end. */
export const resolve = (b: Pick<Board, "snakes" | "ladders">, sq: number): number => b.snakes[sq] ?? b.ladders[sq] ?? sq;

/** A deterministic random stream: the same seed gives the same numbers on every phone. Rejection sampling keeps it unbiased. */
export function seededStream(seed: string): (n: number) => number {
  let counter = 0, buf: Uint8Array = new Uint8Array(0), pos = 0;
  const refill = () => { buf = sha256(utf8ToBytes(`${seed}|${counter++}`)); pos = 0; };
  return (n: number) => {
    const limit = Math.floor(0x100000000 / n) * n;
    for (;;) {
      if (pos + 4 > buf.length) refill();
      const v = ((buf[pos]! << 24) | (buf[pos + 1]! << 16) | (buf[pos + 2]! << 8) | buf[pos + 3]!) >>> 0;
      pos += 4;
      if (v < limit) return v % n;
    }
  };
}

/** The standing squares a player can end a throw on, in order, and where one throw from `s` ends for each roll. */
function nextOf(b: Pick<Board, "size" | "snakes" | "ladders">, s: number, r: number, finish: FinishRule): number {
  const t = s + r;
  if (t > b.size) return finish === "pass" ? b.size : s; // exact: a throw that would pass the end is not used
  return resolve(b, t);
}

/** Every rule of section 3 that does not need a calculation. Returns a plain reason, or null when the board is legal. */
export function boardProblem(b: Pick<Board, "size" | "snakes" | "ladders">): string | null {
  const L = limits(b.size), side = sideOf(b.size), used = new Set<number>();
  const mark = (x: number) => { if (used.has(x)) return false; used.add(x); return true; };
  for (const [h, t] of Object.entries(b.snakes).map(([k, v]) => [Number(k), v] as const)) {
    if (h <= 1 || h >= b.size) return `snake head ${h} is on the first or last square`;
    if (!(t >= 1 && t < h)) return `snake ${h} does not go down`;
    if (h - t < L.minDrop || h - t > L.maxDrop) return `snake ${h} drops ${h - t}, outside ${L.minDrop} to ${L.maxDrop}`;
    if (!mark(h) || !mark(t)) return `a square is used twice (snake ${h})`;
  }
  for (const [bo, t] of Object.entries(b.ladders).map(([k, v]) => [Number(k), v] as const)) {
    if (bo <= 1 || t >= b.size) return `ladder ${bo} starts on the first square or ends on the last`;
    if (!(t > bo)) return `ladder ${bo} does not go up`;
    if (t - bo < L.minRise || t - bo > L.maxRise) return `ladder ${bo} rises ${t - bo}, outside ${L.minRise} to ${L.maxRise}`;
    if (Math.ceil(bo / side) <= 1 && Math.ceil(t / side) >= side - 1) return `ladder ${bo} goes from the first row to the last two rows`;
    if (!mark(bo) || !mark(t)) return `a square is used twice (ladder ${bo})`;
  }
  return null;
}

/** True when a player can reach the last square from every square they can stand on (nobody is ever trapped). */
export function everySquareReachesEnd(b: Pick<Board, "size" | "snakes" | "ladders">, finish: FinishRule = "exact"): boolean {
  const n = b.size, rev: number[][] = Array.from({ length: n + 1 }, () => []);
  for (let s = 1; s < n; s++) for (let r = 1; r <= 6; r++) { const t = nextOf(b, s, r, finish); if (t !== s) rev[t]!.push(s); }
  const seen = new Uint8Array(n + 1); seen[n] = 1; const q = [n];
  while (q.length) { const x = q.pop()!; for (const p of rev[x]!) if (!seen[p]) { seen[p] = 1; q.push(p); } }
  for (let s = 1; s < n; s++) if (!seen[s] && b.snakes[s] === undefined && b.ladders[s] === undefined) return false;
  return true;
}

/** Expected number of throws to finish from square 1 (every throw counted, none missed), solved exactly. */
export function expectedTurns(b: Pick<Board, "size" | "snakes" | "ladders">, finish: FinishRule = "exact"): number {
  const n = b.size - 1; // unknowns: squares 1..size-1
  const A = new Float64Array(n * (n + 1)); // augmented matrix, row i = square i+1
  const idx = (i: number, j: number) => i * (n + 1) + j;
  for (let s = 1; s <= n; s++) {
    const i = s - 1;
    A[idx(i, i)] = (A[idx(i, i)] ?? 0) + 1; A[idx(i, n)] = 1;
    for (let r = 1; r <= 6; r++) { const t = nextOf(b, s, r, finish); if (t < b.size) A[idx(i, t - 1)] = (A[idx(i, t - 1)] ?? 0) - 1 / 6; }
  }
  for (let c = 0; c < n; c++) { // Gaussian elimination, partial pivoting
    let p = c, best = Math.abs(A[idx(c, c)]!);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[idx(r, c)]!); if (v > best) { best = v; p = r; } }
    if (best < 1e-12) return Infinity;
    if (p !== c) for (let j = c; j <= n; j++) { const t = A[idx(c, j)]!; A[idx(c, j)] = A[idx(p, j)]!; A[idx(p, j)] = t; }
    const d = A[idx(c, c)]!;
    for (let r = c + 1; r < n; r++) {
      const f = A[idx(r, c)]! / d; if (f === 0) continue;
      for (let j = c; j <= n; j++) A[idx(r, j)]! -= f * A[idx(c, j)]!;
    }
  }
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) { let s = A[idx(i, n)]!; for (let j = i + 1; j < n; j++) s -= A[idx(i, j)]! * x[j]!; x[i] = s / A[idx(i, i)]!; }
  return x[0]!;
}

/** The chance of having landed on the last square within `turns` throws. */
export function finishWithin(b: Pick<Board, "size" | "snakes" | "ladders">, turns: number, finish: FinishRule = "exact"): number {
  let dist = new Float64Array(b.size + 1); dist[1] = 1;
  for (let t = 0; t < turns; t++) {
    const nd = new Float64Array(b.size + 1); nd[b.size] = dist[b.size]!;
    for (let s = 1; s < b.size; s++) { const p = dist[s]!; if (!p) continue; for (let r = 1; r <= 6; r++) nd[nextOf(b, s, r, finish)]! += p / 6; }
    dist = nd;
  }
  return dist[b.size]!;
}

/** One random candidate (not yet checked for fairness). */
function candidate(rand: (n: number) => number, cfg: BoardCfg): Pick<Board, "size" | "snakes" | "ladders"> | null {
  const size = cfg.size, side = sideOf(size), L = limits(size), used = new Set<number>(), snakes: Record<number, number> = {}, ladders: Record<number, number> = {};
  const free = (x: number) => !used.has(x);
  for (let i = 0; i < cfg.ladders; i++) {
    let ok = false;
    for (let tries = 0; tries < 60 && !ok; tries++) {
      const bo = 2 + rand(size - 3), rise = L.minRise + rand(L.maxRise - L.minRise + 1), top = bo + rise;
      if (top >= size || !free(bo) || !free(top) || bo === top) continue;
      if (Math.ceil(bo / side) <= 1 && Math.ceil(top / side) >= side - 1) continue;
      used.add(bo); used.add(top); ladders[bo] = top; ok = true;
    }
    if (!ok) return null;
  }
  for (let i = 0; i < cfg.snakes; i++) {
    let ok = false;
    for (let tries = 0; tries < 60 && !ok; tries++) {
      const h = 2 + rand(size - 3), drop = L.minDrop + rand(L.maxDrop - L.minDrop + 1), tail = h - drop;
      if (tail < 1 || !free(h) || !free(tail)) continue;
      used.add(h); used.add(tail); snakes[h] = tail; ok = true;
    }
    if (!ok) return null;
  }
  return { size, snakes, ladders };
}

export const isHex64 = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{64}$/i.test(s);

/**
 * The board of one seat: the first candidate from the seat's own seed stream that obeys every hard rule and sits inside the fairness band.
 * Needs B0, so it cannot be made before the beacon value exists. The same inputs always give the same board.
 */
export function generateBoard(gameId: string, seat: number | string, b0Hex: string, cfg: BoardCfg = defaultBoardCfg()): Board {
  if (!isHex64(b0Hex)) throw new Error("A board can only be made from the published beacon value B0.");
  if (!BOARD_SIZES.includes(cfg.size)) throw new Error("Board size must be 100, 144 or 225.");
  if (cfg.snakes < MIN_PER_KIND || cfg.snakes > MAX_PER_KIND || cfg.ladders < MIN_PER_KIND || cfg.ladders > MAX_PER_KIND) throw new Error(`A board has ${MIN_PER_KIND} to ${MAX_PER_KIND} snakes and as many ladders.`);
  const rand = seededStream(`SL1|board|${gameId}|${seat}|${b0Hex.toLowerCase()}`);
  const target = targetTurnsFor(cfg.size, cfg.targetTurns), lo = target * (1 - BAND_TOLERANCE), hi = target * (1 + BAND_TOLERANCE);
  for (let attempt = 1; attempt <= 5000; attempt++) {
    const c = candidate(rand, cfg);
    if (!c || boardProblem(c) || !everySquareReachesEnd(c, cfg.finish)) continue;
    const e = expectedTurns(c, cfg.finish);
    if (!(e >= lo && e <= hi)) continue;
    const w = finishWithin(c, spreadTurns(cfg.size), cfg.finish);
    if (w < SPREAD_BAND.lo || w > SPREAD_BAND.hi) continue;
    return { ...c, side: sideOf(cfg.size), expectedTurns: e, within20: w, attempts: attempt };
  }
  throw new Error("No fair board found for this seed.");
}

/** A short fingerprint of a board, for comparing boards across seats. */
export const boardKey = (b: Pick<Board, "snakes" | "ladders">): string => bytesToHex(sha256(utf8ToBytes(JSON.stringify([Object.entries(b.snakes).sort((x, y) => +x[0] - +y[0]), Object.entries(b.ladders).sort((x, y) => +x[0] - +y[0])])))).slice(0, 16);

/** Screen position of a square on the classic zig-zag: square 1 bottom left, row 1 runs left to right, row 2 right to left, and so on. col and row start at 0 (row 0 = bottom). */
export function squareXY(sq: number, side: number): { col: number; row: number } {
  const i = sq - 1, row = Math.floor(i / side), c = i % side;
  return { col: row % 2 === 0 ? c : side - 1 - c, row };
}
