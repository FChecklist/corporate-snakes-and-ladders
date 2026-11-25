import { expect, test } from "bun:test";
import { snakesRules, finalRanking } from "../../../vendor/game-core/packages/snakes/src";

test("T-81 an extra throw in the same turn does not place an earlier finisher twice", () => {
  const board = { size: 10, snakes: {}, ladders: {} } as any, pawn = (at: number, finishedTurn?: number) => ({ at, ladders: 0, missed: 0, fate: 0, finishedTurn });
  const s = { boards: { a: board, b: board, c: board }, pawns: { a: pawn(10, 3), b: pawn(9), c: pawn(1) }, turn: 3, turnLimit: 600, pass: false, presence: false, finishers: ["a"], survivors: 0, roundTurns: 10, out: [], milestones: [], milestoneWon: {}, over: false, timeLimitMs: 1e9, gameMs: 0, settledMs: 0 } as any;
  const r = snakesRules.step(s, { type: "turn", only: "b", rolls: { b: 1 } } as any, 0, { phase: "running" } as any);
  expect(r.state.finishers).toEqual(["a", "b"]);
  expect(finalRanking(r.state)).toEqual(["a", "b", "c"]);
});
