import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { type Board } from "../src/board";
import { advance, fateOf, newRun, rollFor, runFrom, squareOf, step } from "../src/play";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
// a tiny hand-made board: ladder 10 -> 25, snake 60 -> 40
const board: Pick<Board, "size" | "snakes" | "ladders"> = { size: 100, snakes: { 60: 40, 90: 70 }, ladders: { 10: 25, 30: 55 } };

describe("dice", () => {
  test("R12 a roll is 1 to 6 and all six are equally likely (60,000 rolls, chi-square)", () => {
    const c = [0, 0, 0, 0, 0, 0, 0]; const N = 60000;
    for (let i = 0; i < N; i++) c[rollFor("g", 1 + (i % 500), Math.floor(i / 500), hex("b" + i))]!++;
    expect(c[0]).toBe(0);
    const exp = N / 6; let chi = 0; for (let k = 1; k <= 6; k++) chi += (c[k]! - exp) ** 2 / exp;
    expect(chi).toBeLessThan(20.5); // 5 degrees of freedom, p = 0.001
  });

  test("R13 a roll cannot be made without the published value of its turn", () => {
    expect(() => rollFor("g", 1, 0, "")).toThrow();
    expect(() => rollFor("g", 1, 0, "not-a-beacon-value")).toThrow();
    expect(() => rollFor("g", 1, 0, undefined as unknown as string)).toThrow();
    expect(() => rollFor("g", 1, -1, hex("x"))).toThrow();
    // and it changes with the value: nobody can pre-compute it
    const rolls = new Set(Array.from({ length: 40 }, (_, i) => rollFor("g", 1, 0, hex("v" + i))));
    expect(rolls.size).toBeGreaterThan(3);
  });

  test("R14 every device gets the same roll for the same seat and turn", () => {
    for (let i = 0; i < 50; i++) { const b = hex("same" + i); expect(rollFor("g", 7, i, b)).toBe(rollFor("g", 7, i, b.toUpperCase())); }
  });

  test("R15 different seats and different turns get independent rolls", () => {
    const b = hex("shared-beacon-value");
    const bySeat = new Set<number>(); for (let s = 1; s <= 60; s++) bySeat.add(rollFor("g", s, 3, b));
    expect(bySeat.size).toBe(6);
    const same = Array.from({ length: 3000 }, (_, s) => rollFor("g", s + 1, 5, b)).reduce((n, r, i, a) => n + (i > 0 && r === a[i - 1] ? 1 : 0), 0);
    expect(same / 3000).toBeGreaterThan(0.12); expect(same / 3000).toBeLessThan(0.22); // about 1/6 of neighbours match, as independent dice do
    expect(rollFor("g", 1, 0, b) === rollFor("g", 1, 1, b) && rollFor("g", 1, 1, b) === rollFor("g", 1, 2, b) && rollFor("g", 1, 2, b) === rollFor("g", 1, 3, b)).toBe(false);
  });

  test("R26 fate numbers are fixed by public values and differ between players and labels", () => {
    expect(fateOf("g", 1, "x")).toBe(fateOf("g", 1, "x"));
    expect(fateOf("g", 1, "x")).not.toBe(fateOf("g", 2, "x"));
    expect(fateOf("g", 1, "x")).not.toBe(fateOf("g", 1, "y"));
    expect(fateOf("g", 1, "x")).not.toBe(fateOf("h", 1, "x"));
  });
});

describe("moving", () => {
  test("R16 a pawn starts on square 1 and moves by the roll", () => {
    expect(squareOf(newRun(1))).toBe(1);
    expect(step(board, 1, 4).to).toBe(5);
    expect(step(board, 20, 6).to).toBe(26);
  });

  test("R17 a ladder bottom takes the pawn up, a snake head takes it down, the other ends do nothing", () => {
    expect(step(board, 5, 5)).toMatchObject({ landed: 10, to: 25, kind: "ladder" });
    expect(step(board, 55, 5)).toMatchObject({ landed: 60, to: 40, kind: "snake" });
    expect(step(board, 20, 5).to).toBe(25);   // the top of a ladder: nothing happens
    expect(step(board, 35, 5).to).toBe(40);   // the tail of a snake: nothing happens
    expect(step(board, 27, 3)).toMatchObject({ to: 55, kind: "ladder" });
    expect(step(board, 85, 5)).toMatchObject({ to: 70, kind: "snake" });
  });

  test("R18 exact finish: a roll that would pass the last square is not used; the exact roll finishes", () => {
    expect(step(board, 97, 4)).toMatchObject({ to: 97, kind: "overshoot" });
    expect(step(board, 99, 2)).toMatchObject({ to: 99, kind: "overshoot" });
    expect(step(board, 97, 3)).toMatchObject({ to: 100, kind: "finish" });
    expect(step(board, 99, 1)).toMatchObject({ to: 100, kind: "finish" });
    const r = runFrom(board, 1, [null, null], "exact"); expect(r.finishedTurn).toBeNull();
    const run = newRun(1); run.pos.push(96); advance(board, run, 5, "exact"); expect(squareOf(run)).toBe(96); advance(board, run, 4, "exact"); expect(squareOf(run)).toBe(100); expect(run.finishedTurn).toBe(2);
  });

  test("R19 option reach-or-pass: a roll that reaches or passes the last square finishes", () => {
    expect(step(board, 97, 6, "pass")).toMatchObject({ to: 100, kind: "finish" });
    expect(step(board, 99, 2, "pass")).toMatchObject({ to: 100, kind: "finish" });
  });

  test("R20 a finished pawn stays finished and does not count missed turns", () => {
    const r = newRun(1); r.pos.push(99); advance(board, r, 1); expect(r.finishedTurn).toBe(1);
    advance(board, r, 6); advance(board, r, null); expect(squareOf(r)).toBe(100); expect(r.missed).toBe(0); expect(r.finishedTurn).toBe(1);
  });

  test("R21 a missed turn (no throw in the window) leaves the pawn where it is and is counted", () => {
    const r = runFrom(board, 1, [3, null, null, 2]);
    expect(r.pos).toEqual([4, 4, 4, 6]); expect(r.missed).toBe(2);
  });

  test("R17 a whole run: ladders, snakes, best climb and comeback are tracked", () => {
    // 1 -> 5 -> ladder 10 to 25 -> ladder 30 to 55 -> snake 60 to 40 -> climbs back to 55
    const r = runFrom(board, 1, [4, 5, 5, 5, 5, 5, 5, 5, 5], "exact");
    expect(r.ladders).toBeGreaterThanOrEqual(1); expect(r.bestClimb).toBe(25);
    expect(r.snakes).toBeGreaterThanOrEqual(1);
    expect(r.bestComeback).toBe(20); // fell 20 from 60 to 40, then got back above where it stood before
  });
});
