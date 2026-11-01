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
    const b = ownerBoard("demo-1"), more = { ...b, snakes: { ...b.snakes, 47: 41 } };
    expect(checkOwnerBoard(more).join(" ")).toContain("10 snakes, 10 ladders, 5 penalty and 5 reward squares");
  });
});
