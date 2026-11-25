// Games gap 7 (owner rules of 25 Nov 2026): the rules in one short line each: the milestone tie-break, the exact finish and what happens on a tie.
// "Fairness wording only where true in code": every line below is proved here by playing the engine, then the player page and the home page are checked to hold the same words.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fateOf, newRun, runFrom, squareOf, step, advance, type Run } from "../src/play";
import { defaultRaceCfg, orderPlayers, rankPlayers, settleRace, type RaceState } from "../src/race";
import { RULE_EXACT_FINISH, RULE_MILESTONE_TIE, RULE_PASS_FINISH, RULE_TIE } from "../../shared/src/lines";

const ROOT = join(import.meta.dir, "../../..");
const rd = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const GAME = "rules-game";
const flat = { size: 100, snakes: {} as Record<number, number>, ladders: {} as Record<number, number> };
const sixes = (n: number) => Array.from({ length: n }, () => 6);
/** A finished-or-capped race made of runs played from fixed rolls (null = a missed turn). */
function stateOf(runs: Run[], milestones: number[] = [20]): RaceState {
  const cfg = { ...defaultRaceCfg(GAME, runs.length), milestones };
  return { cfg, b0: "0".repeat(64), runs, boards: runs.map(() => flat as any), turnsPlayed: Math.max(...runs.map((r) => r.pos.length)), ended: true, endReason: "cap", finishedCount: runs.filter((r) => r.finishedTurn !== null).length };
}
const winnerOf = (st: RaceState, pattern: string, ordinal = 1) => { const s = settleRace(st, [{ pattern, ordinal }], (x) => String(x)); expect(s.length).toBe(1); expect(s[0]!.pids.length).toBe(1); return s[0]!; };

describe("the words of the three rules lines", () => {
  test("each is one short plain line, with no my, mine, your or yours", () => {
    for (const l of [RULE_MILESTONE_TIE, RULE_EXACT_FINISH, RULE_PASS_FINISH, RULE_TIE]) { expect(l.length).toBeLessThan(220); expect(l).not.toMatch(/\b(my|mine|your|yours)\b/i); expect(l.split(/[.;]/).length).toBeLessThan(5); expect(l.endsWith(".")).toBe(true); }
  });
});

describe("milestone tie-break: the one who landed further on that turn wins, then the public random numbers decide", () => {
  test(RULE_MILESTONE_TIE, () => {
    // three players reach square 20 on the same turn (turn index 3) and land on 25, 21 and 20
    const a = runFrom(flat, 1, [6, 6, 6, 6]), b = runFrom(flat, 2, [6, 6, 6, 2]), c = runFrom(flat, 3, [6, 6, 6, 1]);
    expect([a, b, c].map((r) => r.pos[3])).toEqual([25, 21, 20]);
    const w = winnerOf(stateOf([c, b, a]), "milestone"); expect(w.pids).toEqual(["1"]); expect(w.tied).toBe(3);
  });
  test("it is the square at arrival that counts, not the square the player stands on later", () => {
    const a = runFrom(flat, 1, [6, 6, 6, 6]);                       // arrives on 25, stays there
    const b = runFrom(flat, 2, [6, 6, 6, 2, 6, 6, 6, 6]);            // arrives on 21, then runs on to 45
    expect(squareOf(b)).toBeGreaterThan(squareOf(a));
    expect(winnerOf(stateOf([a, b]), "milestone").pids).toEqual(["1"]);
  });
  test("an earlier turn always beats a longer jump on a later turn", () => {
    const early = runFrom(flat, 1, [6, 6, 6, 1]);                    // reaches 20 on turn index 3, landing exactly on 20
    const late = runFrom(flat, 2, [6, 6, 5, 1, 6, 6]);               // 7, 13, 18, 19, 25: reaches 20 on turn index 4 with a longer jump
    expect([early.pos[3], late.pos[3], late.pos[4]]).toEqual([20, 19, 25]);
    const w = winnerOf(stateOf([late, early]), "milestone"); expect(w.pids).toEqual(["1"]); expect(w.idx).toBe(3); expect(w.tied).toBeUndefined();
  });
  test("if they landed on the same square, the public random numbers decide (the lowest fate number wins) and nobody shares the gift", () => {
    const a = runFrom(flat, 1, [6, 6, 6, 6]), b = runFrom(flat, 2, [6, 6, 6, 6]);
    const expected = fateOf(GAME, 1, "milestone1") < fateOf(GAME, 2, "milestone1") ? "1" : "2";
    const w = winnerOf(stateOf([a, b]), "milestone"); expect(w.pids).toEqual([expected]); expect(w.tied).toBe(2);
  });
});

describe("exact finish: a throw that is too big is not used", () => {
  test(RULE_EXACT_FINISH, () => {
    const s = step(flat, 97, 6); expect(s.kind).toBe("overshoot"); expect(s.to).toBe(97);            // too big: not used, the player stays
    expect(step(flat, 97, 3)).toMatchObject({ kind: "finish", to: 100 });                              // exactly the last square: finished
    const r = runFrom(flat, 1, [...sixes(16), 6, 3]);                                                 // 97, a too-big throw, then the exact one
    expect(r.pos[16]).toBe(97); expect(r.finishedTurn).toBe(17); expect(squareOf(r)).toBe(100);
    const early = runFrom(flat, 2, [...sixes(16), 6]); expect(early.finishedTurn).toBeNull();
  });
  test(RULE_PASS_FINISH + " (only when the organizer chose it)", () => {
    expect(step(flat, 97, 6, "pass")).toMatchObject({ kind: "finish", to: 100 });
    expect(runFrom(flat, 1, [...sixes(16), 6], "pass").finishedTurn).toBe(16);
  });
  test("the default of a new game is the exact finish", () => { expect(defaultRaceCfg(GAME, 5).board.finish).toBe("exact"); });
});

describe("a tie: earlier finish, then the higher square, then more ladders, then fewer missed turns, then the public random numbers", () => {
  const ladderBoard = { size: 100, snakes: {} as Record<number, number>, ladders: { 7: 13 } as Record<number, number> };
  test(RULE_TIE, () => {
    // 1. the earlier finish wins
    const fast = runFrom(flat, 1, [...sixes(16), 3]), slow = runFrom(flat, 2, [...sixes(16), 6, 3]);
    expect([fast.finishedTurn, slow.finishedTurn]).toEqual([16, 17]);
    expect(orderPlayers(stateOf([slow, fast])).map((r) => r.seat)).toEqual([1, 2]);
    // 2. nobody finished: the higher square wins
    const high = runFrom(flat, 3, sixes(5)), low = runFrom(flat, 4, sixes(4));
    expect(orderPlayers(stateOf([low, high])).map((r) => r.seat)).toEqual([3, 4]);
    // 3. the same finishing turn: more ladders climbed wins
    const plain = runFrom(flat, 5, [...sixes(16), 6, 3]);
    const climber = new (class { run = newRun(6); })().run; for (const r of [6, ...sixes(14), 6, 6, 3]) advance(ladderBoard, climber, r, "exact");
    expect([plain.finishedTurn, climber.finishedTurn]).toEqual([17, 17]); expect(climber.ladders).toBe(1);
    const st3 = stateOf([plain, climber]); expect(orderPlayers(st3).map((r) => r.seat)).toEqual([6, 5]);
    expect(rankPlayers(st3).map((r) => r.note).join("|")).toContain("more ladders climbed");
    // 4. the same finishing turn and ladders: fewer missed turns wins
    const missed = runFrom(flat, 7, [null, ...sixes(16), 6, 6, 6, 6, 3]), clean = runFrom(flat, 8, [...sixes(16), 6, 6, 6, 6, 6, 3]);
    expect([missed.finishedTurn, clean.finishedTurn]).toEqual([21, 21]); expect([missed.missed, clean.missed]).toEqual([1, 0]);
    const st4 = stateOf([missed, clean]); expect(orderPlayers(st4).map((r) => r.seat)).toEqual([8, 7]);
    expect(rankPlayers(st4).map((r) => r.note).join("|")).toContain("fewer turns missed");
    // 5. everything level: the public random numbers decide, the same way on every phone
    const x = runFrom(flat, 9, [...sixes(16), 3]), y = runFrom(flat, 10, [...sixes(16), 3]);
    const first = fateOf(GAME, 9, "rank") < fateOf(GAME, 10, "rank") ? 9 : 10;
    expect(orderPlayers(stateOf([x, y]))[0]!.seat).toBe(first); expect(orderPlayers(stateOf([y, x]))[0]!.seat).toBe(first);
    expect(rankPlayers(stateOf([x, y])).map((r) => r.note).join("|")).toContain("chance");
  });
  test("no gift is ever shared: every prize line has exactly one winner, even when many players are level", () => {
    const runs = [1, 2, 3, 4].map((s) => runFrom(flat, s, [...sixes(16), 3]));
    const st = stateOf(runs); const out = settleRace(st, [1, 2, 3, 4].map((o) => ({ pattern: "finish", ordinal: o })), (s) => String(s));
    expect(out.length).toBe(4); expect(out.every((o) => o.pids.length === 1)).toBe(true); expect(new Set(out.map((o) => o.pids[0])).size).toBe(4);
  });
});

describe("the same words are on the player page and the home page", () => {
  const z = rd("apps/web/public/z.js");
  test("the player page holds the three lines word for word (and the reach-or-pass line)", () => {
    for (const l of [RULE_MILESTONE_TIE, RULE_EXACT_FINISH, RULE_PASS_FINISH, RULE_TIE]) expect(z).toContain(l);
  });
  test("the home page (the public page that explains how the game plays) holds the three lines word for word, and says the turn is about 10 seconds", () => {
    const t = rd("apps/web/public/index.html").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/&amp;/g, "&");
    for (const l of [RULE_MILESTONE_TIE, RULE_EXACT_FINISH, RULE_TIE]) expect(t).toContain(l);
    expect(t).toContain("Every turn takes about 10 seconds."); expect(t).not.toMatch(/press the dice|20 seconds/i);
  });
});
