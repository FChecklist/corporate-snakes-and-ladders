import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { BAND_TOLERANCE, BOARD_SIZES, SPREAD_BAND, boardKey, boardProblem, defaultBoardCfg, everySquareReachesEnd, expectedTurns, finishWithin, generateBoard, limits, sideOf, spreadTurns, squareXY, targetTurnsFor, type BoardCfg } from "../src/board";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const B0 = hex("b0-test");
const cfg = (over: Partial<BoardCfg> = {}): BoardCfg => ({ ...defaultBoardCfg(), ...over });

describe("board rules", () => {
  test("R1 the classic board has 100 squares in a zig-zag, square 1 at the bottom left", () => {
    expect(BOARD_SIZES).toEqual([100, 144, 225]);
    expect(squareXY(1, 10)).toEqual({ col: 0, row: 0 });
    expect(squareXY(10, 10)).toEqual({ col: 9, row: 0 });
    expect(squareXY(11, 10)).toEqual({ col: 9, row: 1 }); // the second row runs right to left
    expect(squareXY(20, 10)).toEqual({ col: 0, row: 1 });
    expect(squareXY(100, 10)).toEqual({ col: 0, row: 9 });
    const seen = new Set(Array.from({ length: 100 }, (_, i) => { const p = squareXY(i + 1, 10); return p.row * 10 + p.col; }));
    expect(seen.size).toBe(100);
    expect(generateBoard("g", 1, B0).size).toBe(100);
    expect(generateBoard("g", 1, B0, cfg({ size: 144 })).size).toBe(144);
    expect(generateBoard("g", 1, B0, cfg({ size: 225 })).size).toBe(225);
  });

  test("R2/R3 a board needs B0: it cannot be made without the published value", () => {
    expect(() => generateBoard("g", 1, "")).toThrow();
    expect(() => generateBoard("g", 1, "abc")).toThrow();
    expect(() => generateBoard("g", 1, "z".repeat(64))).toThrow();
    expect(() => generateBoard("g", 1, undefined as unknown as string)).toThrow();
    expect(generateBoard("g", 1, B0).size).toBe(100);
  });

  test("R2 the board depends on game id, seat and B0 (changing any one changes it)", () => {
    const k = boardKey(generateBoard("g", 1, B0));
    expect(boardKey(generateBoard("h", 1, B0))).not.toBe(k);
    expect(boardKey(generateBoard("g", 2, B0))).not.toBe(k);
    expect(boardKey(generateBoard("g", 1, hex("other")))).not.toBe(k);
  });

  test("R4 the same inputs make the same board", () => {
    const a = generateBoard("game-77", 41, B0), b = generateBoard("game-77", 41, B0.toUpperCase());
    expect(JSON.stringify([a.snakes, a.ladders])).toBe(JSON.stringify([b.snakes, b.ladders]));
  });

  test("R5 in a game of 2,000 players no two boards are the same", () => {
    const keys = new Set<string>();
    for (let s = 1; s <= 2000; s++) keys.add(boardKey(generateBoard("big-game", s, B0)));
    expect(keys.size).toBe(2000);
  }, 90000);

  test("R6 a board has 9 snakes and 9 ladders; the organizer may pick 6 to 12", () => {
    const b = generateBoard("g", 3, B0);
    expect(Object.keys(b.snakes).length).toBe(9); expect(Object.keys(b.ladders).length).toBe(9);
    const c = generateBoard("g", 3, B0, cfg({ snakes: 6, ladders: 12 }));
    expect(Object.keys(c.snakes).length).toBe(6); expect(Object.keys(c.ladders).length).toBe(12);
    expect(() => generateBoard("g", 3, B0, cfg({ snakes: 5 }))).toThrow();
    expect(() => generateBoard("g", 3, B0, cfg({ ladders: 13 }))).toThrow();
  });

  test("R7-R10 over 3,000 boards of every size and shape: all hard rules hold and nobody is trapped", () => {
    let n = 0;
    for (const size of BOARD_SIZES) {
      const count = size === 100 ? 2400 : size === 144 ? 400 : 200;
      for (let s = 1; s <= count; s++) {
        const c = cfg({ size, snakes: 6 + (s % 7), ladders: 6 + ((s * 3) % 7) });
        const b = generateBoard(`prop-${size}`, s, B0, c);
        expect(boardProblem(b)).toBeNull();
        expect(everySquareReachesEnd(b)).toBe(true);
        const L = limits(size), side = sideOf(size), all: number[] = [];
        for (const [h, t] of Object.entries(b.snakes)) { all.push(+h, t); expect(+h - t).toBeGreaterThanOrEqual(L.minDrop); expect(+h - t).toBeLessThanOrEqual(L.maxDrop); expect(+h).toBeGreaterThan(1); expect(+h).toBeLessThan(size); }
        for (const [bo, t] of Object.entries(b.ladders)) {
          all.push(+bo, t); expect(t - +bo).toBeGreaterThanOrEqual(L.minRise); expect(t - +bo).toBeLessThanOrEqual(L.maxRise);
          expect(+bo).toBeGreaterThan(1); expect(t).toBeLessThan(size); // R7
          expect(Math.ceil(+bo / side) <= 1 && Math.ceil(t / side) >= side - 1).toBe(false); // R9
        }
        expect(new Set(all).size).toBe(all.length); // R7: no square used twice
        n++;
      }
    }
    expect(n).toBe(3000);
  }, 120000);

  test("R7/R8/R9/R10 the checker really refuses bad boards", () => {
    const ok = { size: 100, snakes: { 50: 30 } as Record<number, number>, ladders: { 5: 25 } as Record<number, number> };
    expect(boardProblem(ok)).toBeNull();
    expect(boardProblem({ ...ok, ladders: { 1: 20 } })).not.toBeNull();          // starts on square 1
    expect(boardProblem({ ...ok, ladders: { 5: 100 } })).not.toBeNull();         // ends on the last square
    expect(boardProblem({ ...ok, snakes: { 50: 45 } })).not.toBeNull();          // drop of 5 is too small
    expect(boardProblem({ ...ok, ladders: { 5: 50 } })).not.toBeNull();          // rise of 45 is too big
    expect(boardProblem({ ...ok, snakes: { 25: 10 } })).not.toBeNull();          // 25 is the top of the ladder: used twice
    expect(boardProblem({ ...ok, ladders: { 5: 25 }, snakes: { 25: 5 } })).not.toBeNull(); // squares reused
    expect(boardProblem({ size: 100, snakes: {}, ladders: { 3: 85 } })).not.toBeNull();    // first row to last two rows (also too steep)
    expect(boardProblem({ size: 100, snakes: {}, ladders: { 8: 28 } })).toBeNull();
    // a wall of six snake heads in a row traps everyone behind it
    const wall = { size: 100, snakes: { 50: 30, 51: 31, 52: 32, 53: 33, 54: 34, 55: 35 } as Record<number, number>, ladders: {} as Record<number, number> };
    expect(everySquareReachesEnd(wall)).toBe(false);
  });

  test("R11 every board is inside the fairness band: expected turns within 5% of the target, spread inside its band", () => {
    for (const size of BOARD_SIZES) {
      const target = targetTurnsFor(size), count = size === 100 ? 300 : 80;
      for (let s = 1; s <= count; s++) {
        const b = generateBoard(`band-${size}`, s, B0, cfg({ size }));
        expect(Math.abs(b.expectedTurns - target) / target).toBeLessThanOrEqual(BAND_TOLERANCE);
        expect(b.within20).toBeGreaterThanOrEqual(SPREAD_BAND.lo); expect(b.within20).toBeLessThanOrEqual(SPREAD_BAND.hi);
        // the figures stored on the board are the real ones, not claims
        if (s <= 5) { expect(expectedTurns(b)).toBeCloseTo(b.expectedTurns, 9); expect(finishWithin(b, spreadTurns(size))).toBeCloseTo(b.within20, 12); }
      }
    }
  }, 120000);

  test("R11 the expected-turns calculation is right (checked against a known board and a simulation)", () => {
    // a board with no snakes or ladders: the exact calculation must agree with a plain simulation of the rules
    const empty = { size: 100, snakes: {}, ladders: {} };
    const e = expectedTurns(empty);
    let total = 0; const N = 40000; let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let g = 0; g < N; g++) { let pos = 1, t = 0; while (pos !== 100) { const r = 1 + Math.floor(rnd() * 6); if (pos + r <= 100) pos += r; t++; } total += t; }
    expect(Math.abs(total / N - e)).toBeLessThan(0.5);
    expect(finishWithin(empty, 1000)).toBeGreaterThan(0.999999);
    expect(finishWithin(empty, 5)).toBe(0);
  });

  test("R11 a candidate outside the band is thrown away: forcing a narrow target changes which boards come out", () => {
    const strict = generateBoard("g", 9, B0, cfg({ targetTurns: 33 }));
    expect(Math.abs(strict.expectedTurns - 33) / 33).toBeLessThanOrEqual(BAND_TOLERANCE);
    expect(strict.attempts).toBeGreaterThan(1);
  });
});
