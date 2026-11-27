// Found by the 100-million smoke test (rules T-80 / T-81, 2026-11-04, seeds 164 / 7216 / 9886 of the snakes generator): the common Snakes engine (vendor/game-core/packages/snakes) gave a
// pawn that had already finished a SECOND place when an extra throw (`only`) came in the same turn, because an extra throw keeps the turn number and "finished this turn" matched the old finisher
// again. The finishers list then held one player twice, the final ranking listed that player twice and left another out, and a second "1st" win was announced.
// FALSIFIED BY: core-snakes-refinish-on-extra-throw (step: fin = pawns finished in this turn, without leaving out those already placed)
import { expect, test } from "bun:test";
import { snakesRules, finalRanking } from "../../../vendor/game-core/packages/snakes/src";

const clock = { phase: "running", frozenAt: null, pausedMs: 0, pauses: [] } as never;
const players = ["p1", "p2", "p3"];
const setup = { board: { size: 100, snakes: {}, ladders: {} }, fate: { p1: 1, p2: 2, p3: 3 }, turnLimit: 600, survivors: 0, milestones: "" };

test("an extra throw in the turn a pawn finished does not place that pawn twice", () => {
  let st: any = snakesRules.init(setup as never, players);
  st = { ...st, pawns: { ...st.pawns, p1: { ...st.pawns.p1, at: 99 }, p2: { ...st.pawns.p2, at: 50, extra: 1 } } };
  const t1 = snakesRules.step(st, { type: "turn", rolls: { p1: 1, p2: 1, p3: 1 } } as never, 0, clock) as any;
  expect(t1.state.finishers).toEqual(["p1"]);
  expect(t1.out.filter((o: any) => o.kind === "win" && o.position === "1st").length).toBe(1);
  const t2 = snakesRules.step(t1.state, { type: "turn", rolls: { p2: 1 }, only: "p2" } as never, 0, clock) as any;
  expect(t2.state.turn).toBe(t1.state.turn); // an extra throw is not a new turn
  expect(t2.state.finishers).toEqual(["p1"]);
  expect(t2.out.filter((o: any) => o.kind === "win" && o.position === "1st")).toEqual([]); // nobody is announced as 1st again
  const rk = finalRanking(t2.state);
  expect(rk.length).toBe(players.length);
  expect(new Set(rk).size).toBe(players.length);
  expect(rk[0]).toBe("p1");
});
