import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "results", tests: ["packages/beacon/test/t30-regress-results.test.ts"], mutations: [
  { note: "the game goes on one turn past the limit", file: "packages/beacon/src/race.ts", from: "st.turnsPlayed >= cfg.turnCap", to: "st.turnsPlayed > cfg.turnCap" },
  { note: "the game waits for one more finisher", file: "packages/beacon/src/race.ts", from: "else if (st.finishedCount >= cfg.endPrizes)", to: "else if (st.finishedCount > cfg.endPrizes)" },
  { note: "a throw past the last square finishes (exact finish is lost)", file: "packages/beacon/src/play.ts", from: 'if (finish === "pass") return { from, roll, landed: board.size', to: 'if (finish !== "x") return { from, roll, landed: board.size' },
  { note: "the later finisher ranks first", file: "packages/beacon/src/race.ts", from: "if (fa !== fb) return { order: fa < fb ? -1 : 1, key: 0 };", to: "if (fa !== fb) return { order: fa < fb ? 1 : -1, key: 0 };" },
  { note: "every finish prize goes to the first finisher", file: "packages/beacon/src/race.ts", from: "[st.cfg.exclusive ? 0 : l.ordinal - 1];", to: "[0];" },
  { note: "manual dice: everybody throws whether or not they pressed", file: "packages/beacon/src/race.ts", from: 'const throws = cfg.play === "fate" || (input.thrown ? input.thrown(s, t) : false);', to: "const throws = true;" },
  { note: "the dice never show a 6", file: "packages/beacon/src/play.ts", from: "return 1 + Number(v % 6n);", to: "return 1 + Number(v % 5n);" },
  { note: "a one-player game is allowed", file: "packages/beacon/src/race.ts", from: "c.players < 2 ||", to: "c.players < 1 ||" },
  { note: "a pawn that is on a snake head is not moved", file: "packages/beacon/src/board.ts", from: "export const resolve = (b: Pick<Board, \"snakes\" | \"ladders\">, sq: number): number => b.snakes[sq] ?? b.ladders[sq] ?? sq;", to: "export const resolve = (b: Pick<Board, \"snakes\" | \"ladders\">, sq: number): number => b.ladders[sq] ?? sq;" },
  { note: "the milestone prize goes to the LAST player to reach it", file: "packages/beacon/src/race.ts", from: "reached.sort((a, b) => a.t - b.t ||", to: "reached.sort((a, b) => b.t - a.t ||" },
] });
