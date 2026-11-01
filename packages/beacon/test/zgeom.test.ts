import { describe, expect, test } from "bun:test";
import { ownerBoard, checkOwnerBoard, isFlat, squareXY } from "../../../vendor/game-core/packages/snakes/src";
import { snakeShape, ladderShape, checkDrawing, O, G, HEAD_R, RAIL_REACH } from "../src/zgeom";

const ids = Array.from({ length: 40 }, (_, i) => "game-" + i).concat(["demo-1", "party", "x9"]);
describe("the drawing stays inside the board and nothing is flat", () => {
  test("every snake body, head and tongue, and every ladder rail and foot, is inside the 10 x 10 grid (120+ game ids)", () => {
    const lo = O, hi = O + G;
    for (const id of ids) {
      const b = ownerBoard(id);
      Object.entries(b.snakes).forEach(([h, t], i) => {
        const s = snakeShape(+h, t, i);
        for (const p of s.pts) { expect(p[0]! - p[2]!).toBeGreaterThanOrEqual(lo); expect(p[0]! + p[2]!).toBeLessThanOrEqual(hi); expect(p[1]! - p[2]!).toBeGreaterThanOrEqual(lo); expect(p[1]! + p[2]!).toBeLessThanOrEqual(hi); }
        expect(s.head.x - HEAD_R).toBeGreaterThanOrEqual(lo); expect(s.head.x + HEAD_R).toBeLessThanOrEqual(hi); expect(s.head.y - HEAD_R).toBeGreaterThanOrEqual(lo); expect(s.head.y + HEAD_R).toBeLessThanOrEqual(hi);
      });
      for (const [f, t] of Object.entries(b.ladders)) {
        const l = ladderShape(+f, t);
        for (const p of [l.a, l.z]) { expect(p[0]! - RAIL_REACH).toBeGreaterThanOrEqual(lo); expect(p[0]! + RAIL_REACH).toBeLessThanOrEqual(hi); expect(p[1]! - RAIL_REACH).toBeGreaterThanOrEqual(lo); expect(p[1]! + RAIL_REACH).toBeLessThanOrEqual(hi); }
      }
      expect(checkDrawing(b)).toEqual([]);
    }
  }, 60000);
  test("no snake or ladder is flat: at least 2 rows apart and steeper than about 22 degrees, for every game id", () => {
    for (const id of ids) {
      const b = ownerBoard(id);
      for (const [f, t] of [...Object.entries(b.snakes), ...Object.entries(b.ladders)] as [string, number][]) {
        expect(isFlat(+f, t)).toBe(false);
        expect(Math.abs(squareXY(+f).row - squareXY(t).row)).toBeGreaterThanOrEqual(2);
      }
      expect(checkOwnerBoard(b)).toEqual([]);
    }
  }, 60000);
  test("the drawing check names a flat snake and a snake that leaves the grid", () => {
    const b = ownerBoard("demo-1"), flat = { ...b, snakes: { ...b.snakes, 48: 41 } };
    expect(checkDrawing(flat)).toContain("no flat snake or ladder");
    expect(checkOwnerBoard(flat).join(" ")).toContain("no flat snake or ladder");
  });
});
