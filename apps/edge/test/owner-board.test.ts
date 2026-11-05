import { describe, expect, test } from "bun:test";
import { ownerBoard, checkOwnerBoard, squareKind } from "../src/engine";

describe("owner board: 10 snakes, 10 ladders, 5 penalty, 5 reward", () => {
  test("every game id gives exactly those counts, passes the rule check, and is the same each time", () => {
    for (const id of ["demo-1", "G-2", "party", "x9", "2026-11-02"]) {
      const b = ownerBoard(id), sp = Object.values(b.specials ?? {});
      expect(Object.keys(b.snakes).length).toBe(10);
      expect(Object.keys(b.ladders).length).toBe(10);
      expect(sp.filter((s) => s.kind === "punishment").length).toBe(5);
      expect(sp.filter((s) => s.kind === "reward").length).toBe(5);
      expect(checkOwnerBoard(b)).toEqual([]);
      expect(ownerBoard(id)).toEqual(b);
    }
  });
  test("no snake or ladder starts on a penalty or reward square, and nothing sits on 1 or 100", () => {
    const b = ownerBoard("demo-1");
    for (const q of Object.keys(b.specials ?? {})) { expect(b.snakes[+q]).toBeUndefined(); expect(b.ladders[+q]).toBeUndefined(); expect(["penalty", "reward"]).toContain(squareKind(b, +q)); }
    expect(Object.keys(b.snakes).concat(Object.keys(b.ladders)).some((q) => q === "1" || q === "100")).toBe(false);
  });
  test("the rule check names the counts when they are wrong", () => {
    const b = ownerBoard("demo-1"), taken = new Set([...Object.keys(b.snakes), ...Object.keys(b.ladders), ...Object.keys(b.specials ?? {})].map(Number)), free = [...Array(98).keys()].map((i) => i + 2).find((q) => q > 50 && !taken.has(q))!, more = { ...b, snakes: { ...b.snakes, [free]: 30 } };
    expect(checkOwnerBoard(more).join(" ")).toContain("10 snakes, 10 ladders, 5 penalty and 5 reward squares");
  });
});

import { crossings, MAX_SPAN_ROWS, squareXY } from "../src/engine";
describe("owner board: short, separate, spread out", () => {
  test("every snake and ladder spans 2 to 5 rows, nothing crosses, no square is shared, all 2-row bands are used (40 game ids)", () => {
    for (let i = 0; i < 40; i++) {
      const b = ownerBoard("short-" + i), all = [...Object.entries(b.snakes), ...Object.entries(b.ladders)] as [string, number][];
      expect(all.length).toBe(20);
      const ends = new Set<number>(); for (const [f, t] of all) { ends.add(+f); ends.add(t); const d = Math.abs(squareXY(+f).row - squareXY(t).row); expect(d).toBeGreaterThanOrEqual(2); expect(d).toBeLessThanOrEqual(MAX_SPAN_ROWS); }
      expect(ends.size).toBe(40);
      expect(crossings(b)).toBe(0);
      const bands = [0, 0, 0, 0, 0]; for (const [f, t] of all) bands[Math.min(4, Math.floor((squareXY(+f).row + squareXY(t).row) / 2 / 2))]!++;
      expect(bands.every((n) => n >= 2)).toBe(true);
      expect(checkOwnerBoard(b)).toEqual([]);
    }
  }, 60000);
  test("the rule check reports a long snake and a crossing", () => {
    const b = ownerBoard("demo-1"), long = { ...b, snakes: { ...b.snakes, 97: 5 } };
    expect(checkOwnerBoard(long).join(" ")).toMatch(/short|cross/);
  });
});
