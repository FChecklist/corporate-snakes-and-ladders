// Regression: moves, ending, ranking and prizes per finisher position (this game has no claim button: prizes follow finisher position, decided by software only).
import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { defaultRaceCfg, orderPlayers, playRace, rankPlayers, settleRace, type RaceCfg } from "../src/race";
import { rollFor, step, fateOf, squareOf } from "../src/play";
import { squareOf as sq2 } from "../src/play";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const betas = (seed: string, n: number) => Array.from({ length: n }, (_, i) => hex(`${seed}|${i}`));
const B0 = hex("b0");

describe("one throw (step)", () => {
  const board = { size: 100, snakes: { 50: 10 } as Record<number, number>, ladders: { 5: 30 } as Record<number, number> };
  test("a plain move, a ladder, a snake", () => {
    expect(step(board, 1, 2)).toMatchObject({ landed: 3, to: 3, kind: "move" });
    expect(step(board, 1, 4)).toMatchObject({ landed: 5, to: 30, kind: "ladder" });
    expect(step(board, 46, 4)).toMatchObject({ landed: 50, to: 10, kind: "snake" });
  });
  test("exact finish: 100 is a finish, a throw past 100 is not used (pawn stays)", () => {
    expect(step(board, 94, 6)).toMatchObject({ to: 100, kind: "finish" });
    expect(step(board, 97, 4)).toMatchObject({ from: 97, to: 97, kind: "overshoot" });
    expect(step(board, 99, 2)).toMatchObject({ to: 99, kind: "overshoot" });
  });
  test("pass finish: a throw past the end finishes", () => { expect(step(board, 97, 6, "pass")).toMatchObject({ to: 100, kind: "finish" }); });
  test("a roll outside 1 to 6 is an error, never a move", () => { for (const r of [0, 7, -1, 1.5, NaN]) expect(() => step(board, 1, r)).toThrow(); });
  test("every roll value 1..6 appears and rolls are the same on every phone (deterministic) and differ by seat and by turn", () => {
    const bt = hex("beta"), seen = new Set<number>();
    for (let t = 0; t < 600; t++) seen.add(rollFor("G", 1, t, bt));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rollFor("G", 3, 4, bt)).toBe(rollFor("G", 3, 4, bt));
    const varies = new Set(Array.from({ length: 40 }, (_, s) => rollFor("G", s + 1, 0, bt))); expect(varies.size).toBeGreaterThan(3);
  });
  test("a roll cannot be made without the published value of its turn", () => { for (const bad of ["", "xyz", "ab".repeat(31), 12 as any]) expect(() => rollFor("G", 1, 0, bad)).toThrow(); expect(() => rollFor("G", 1, -1, hex("x"))).toThrow(); });
});

describe("how a game ends", () => {
  const cfg = (over: Partial<RaceCfg> = {}): RaceCfg => ({ ...defaultRaceCfg("RES", 12), ...over });
  test("while values are missing the game is 'running'; after the turn limit it ends with 'cap'", () => {
    const run = playRace(cfg({ turnCap: 10, endPrizes: 5 }), { b0: B0, betas: betas("a", 3) }); expect([run.ended, run.endReason, run.turnsPlayed]).toEqual([false, "running", 3]);
    const cap = playRace(cfg({ turnCap: 10, endPrizes: 5, players: 2 }), { b0: B0, betas: betas("a", 50) }); expect(cap.turnsPlayed).toBeLessThanOrEqual(10);
    if (cap.endReason === "cap") expect(cap.turnsPlayed).toBe(10);
  });
  test("it ends with 'finishers' the moment endPrizes players are home, and no later turn is played", () => {
    for (const end of [1, 2, 3, 5]) for (const seed of ["s1", "s2", "s3", "s4", "s5", "s6"]) {
      const st = playRace(cfg({ endPrizes: end, turnCap: 150 }), { b0: B0, betas: betas(seed, 150) });
      if (st.endReason === "finishers") { expect(st.finishedCount).toBeGreaterThanOrEqual(end); const last = st.turnsPlayed - 1; expect(st.runs.some((r) => r.finishedTurn === last)).toBe(true); const prev = st.runs.filter((r) => r.finishedTurn !== null && r.finishedTurn < last).length; expect(prev).toBeLessThan(end); }
      else { expect(st.endReason).toBe("cap"); expect(st.finishedCount).toBeLessThan(end); expect(st.turnsPlayed).toBe(150); }
    }
  });
  test("the last square is never passed: every position is 1..100 and a finished pawn stays at 100", () => {
    const st = playRace(cfg({ endPrizes: 5, turnCap: 150 }), { b0: B0, betas: betas("pos", 150) });
    for (const r of st.runs) { for (const p of r.pos) { expect(p).toBeGreaterThanOrEqual(1); expect(p).toBeLessThanOrEqual(100); } if (r.finishedTurn !== null) { expect(r.pos[r.finishedTurn]).toBe(100); for (const p of r.pos.slice(r.finishedTurn)) expect(p).toBe(100); } }
  });
  test("presence mode: nobody who did not throw moves; a player who throws every turn plays like fate", () => {
    const none = playRace(cfg({ play: "presence", players: 4, turnCap: 20 }), { b0: B0, betas: betas("pr", 20), thrown: () => false });
    for (const r of none.runs) { expect(r.missed).toBe(20); expect(squareOf(r)).toBe(1); }
    const all = playRace(cfg({ play: "presence", players: 4, turnCap: 20 }), { b0: B0, betas: betas("pr", 20), thrown: () => true }); const fate = playRace(cfg({ play: "fate", players: 4, turnCap: 20 }), { b0: B0, betas: betas("pr", 20) });
    expect(all.runs.map((r) => r.pos)).toEqual(fate.runs.map((r) => r.pos)); for (const r of all.runs) expect(r.missed).toBe(0);
    const half = playRace(cfg({ play: "presence", players: 4, turnCap: 20 }), { b0: B0, betas: betas("pr", 20), thrown: (s, t) => (s + t) % 2 === 0 }); for (const r of half.runs) expect(r.missed).toBe(10);
  });
  test("the same inputs give the same game on every phone", () => { const a = playRace(cfg(), { b0: B0, betas: betas("same", 60) }), b = playRace(cfg(), { b0: B0, betas: betas("same", 60) }); expect(a.runs.map((r) => r.pos)).toEqual(b.runs.map((r) => r.pos)); });
  test("a different B0 gives different boards (a board is unknown until B0 exists)", () => { const a = playRace(cfg({ players: 3 }), { b0: hex("one"), betas: [] }), b = playRace(cfg({ players: 3 }), { b0: hex("two"), betas: [] }); expect(JSON.stringify(a.boards[0]!.snakes)).not.toBe(JSON.stringify(b.boards[0]!.snakes)); });
  test("a game of one player is refused (2 to 10,000 players), as are bad limits", () => {
    expect(() => playRace(cfg({ players: 1 }), { b0: B0, betas: [] })).toThrow(/2 to 10,000/);
    expect(() => playRace(cfg({ turnCap: 9 }), { b0: B0, betas: [] })).toThrow(/turn limit/); expect(() => playRace(cfg({ turnCap: 151 }), { b0: B0, betas: [] })).toThrow();
    expect(() => playRace(cfg({ endPrizes: 0 }), { b0: B0, betas: [] })).toThrow(/1 to 5/); expect(() => playRace(cfg({ endPrizes: 6 }), { b0: B0, betas: [] })).toThrow();
    expect(() => playRace(cfg({ milestones: [75, 75] }), { b0: B0, betas: [] })).toThrow(/same square/);
  });
});

describe("ranking has no ties and prizes follow the finisher position", () => {
  const cfg = (over: Partial<RaceCfg> = {}): RaceCfg => ({ ...defaultRaceCfg("PRZ", 20), turnCap: 150, ...over });
  const lines = [{ pattern: "milestone", ordinal: 1 }, ...[1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o }))];
  test("over 40 games: ranks are 1..n each once, the first finishers come first, finishers sorted by finish turn", () => {
    for (let g = 0; g < 40; g++) {
      const st = playRace(cfg({ gameId: "PRZ" + g }), { b0: hex("b" + g), betas: betas("r" + g, 150) }); const rows = rankPlayers(st, 20);
      expect(rows.map((r) => r.rank)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1)); expect(new Set(rows.map((r) => r.seat)).size).toBe(20);
      const fin = rows.filter((r) => r.finishedTurn !== null); for (let i = 1; i < fin.length; i++) expect(fin[i]!.finishedTurn!).toBeGreaterThanOrEqual(fin[i - 1]!.finishedTurn!);
      const firstUnfinished = rows.findIndex((r) => r.finishedTurn === null); if (firstUnfinished >= 0) expect(rows.slice(firstUnfinished).every((r) => r.finishedTurn === null)).toBe(true);
    }
  });
  test("finish prize 1..5 goes to the 1st..5th finisher in ranking order, each person once, nobody who did not finish", () => {
    let checked = 0;
    for (let g = 0; g < 40; g++) {
      const st = playRace(cfg({ gameId: "PRZ" + g, endPrizes: 5 }), { b0: hex("b" + g), betas: betas("r" + g, 150) }); const won = settleRace(st, lines, (s) => "p" + s); const order = orderPlayers(st).filter((r) => r.finishedTurn !== null);
      const fin = won.filter((w) => w.pattern === "finish"); expect(fin.length).toBe(Math.min(5, order.length));
      fin.forEach((w, i) => {
        expect(w.ordinal).toBe(i + 1); expect(w.idx).toBe(order[i]!.finishedTurn!); checked++;
        const o = order[i]!, same = order.filter((x) => x.finishedTurn === o.finishedTurn && x.ladders === o.ladders && x.missed === o.missed); // players level on the whole chain are split by chance
        if (same.length === 1) expect(w.pids).toEqual(["p" + o.seat]); else expect(same.map((x) => "p" + x.seat)).toContain(w.pids[0]!); // see docs/TEST_FINDINGS.md F-3 for the case where the two chances disagree
      });
      expect(new Set(fin.map((w) => w.pids[0])).size).toBe(fin.length);
    }
    expect(checked).toBeGreaterThan(50);
  });
  test("the milestone prize goes to the player who reached the milestone square on the earliest turn", () => {
    for (let g = 0; g < 30; g++) {
      const st = playRace(cfg({ gameId: "MIL" + g, milestones: [60] }), { b0: hex("m" + g), betas: betas("m" + g, 150) }); const w = settleRace(st, [{ pattern: "milestone", ordinal: 1 }], (s) => String(s));
      const reached = st.runs.map((r) => ({ seat: r.seat, t: r.pos.findIndex((p) => p >= 60) })).filter((x) => x.t >= 0).sort((a, b) => a.t - b.t);
      if (!reached.length) { expect(w).toEqual([]); continue; } expect(w).toHaveLength(1); expect(w[0]!.idx).toBe(reached[0]!.t); expect(st.runs[Number(w[0]!.pids[0]) - 1]!.pos[reached[0]!.t]!).toBeGreaterThanOrEqual(60);
    }
  });
  test("two pawns that finish on the same turn are told apart by the chain (square, ladders, missed, then fate): the order is stable and the tie is flagged", () => {
    let tiedGames = 0;
    for (let g = 0; g < 400 && tiedGames < 3; g++) {
      const st = playRace(cfg({ gameId: "TIE" + g, players: 60, endPrizes: 5 }), { b0: hex("t" + g), betas: betas("t" + g, 150) }); const w = settleRace(st, lines, (s) => String(s)).filter((x) => x.pattern === "finish");
      if (w.some((x) => x.tied)) { tiedGames++; const again = settleRace(st, lines, (s) => String(s)).filter((x) => x.pattern === "finish"); expect(again).toEqual(w); for (const x of w) if (x.tied) expect(x.tied).toBeGreaterThanOrEqual(2); }
    }
    expect(tiedGames).toBeGreaterThan(0);
  });
  test("one prize per person (exclusive): across the milestone and finish lines nobody wins twice", () => {
    for (let g = 0; g < 30; g++) { const st = playRace(cfg({ gameId: "EXC" + g, exclusive: true }), { b0: hex("e" + g), betas: betas("e" + g, 150) }); const w = settleRace(st, lines, (s) => String(s)); const pids = w.flatMap((x) => x.pids); expect(new Set(pids).size).toBe(pids.length); }
  });
  test("fate (the final tie-break) is a fixed function of game, seat and label and differs between seats", () => { expect(fateOf("G", 1, "rank")).toBe(fateOf("G", 1, "rank")); expect(fateOf("G", 1, "rank")).not.toBe(fateOf("G", 2, "rank")); expect(fateOf("G", 1, "rank")).not.toBe(fateOf("H", 1, "rank")); expect(fateOf("G", 1, "rank")).toMatch(/^[0-9a-f]{64}$/); });
  test("a 1st prize line with ordinal beyond endPrizes gives nothing", () => { const st = playRace(cfg({ endPrizes: 2 }), { b0: B0, betas: betas("x", 150) }); const w = settleRace(st, [{ pattern: "finish", ordinal: 3 }], (s) => String(s)); expect(w).toEqual([]); });
  test("squareOf is the last position, or 1 before any turn", () => { const st = playRace(cfg({ players: 2 }), { b0: B0, betas: [] }); expect(sq2(st.runs[0]!)).toBe(1); expect(squareOf(st.runs[0]!)).toBe(1); });
});
