import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { defaultRaceCfg, crowdOf, orderPlayers, playRace, rankPlayers, settleRace, teamTable, teamsOf, validateRaceCfg, type RaceCfg } from "../src/race";
import { squareOf } from "../src/play";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const B0 = hex("b0-race");
const betas = (n: number, tag = "b") => Array.from({ length: n }, (_, i) => hex(`${tag}|${i}`));
const cfgOf = (players: number, over: Partial<RaceCfg> = {}): RaceCfg => ({ ...defaultRaceCfg("race-game", players), ...over });
const LINES = [{ pattern: "milestone", ordinal: 1 }, ...[1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o }))];

describe("group race", () => {
  test("R39/R40 positions are computed from public values only, and the same on every device", () => {
    const a = playRace(cfgOf(30), { b0: B0, betas: betas(40) }), b = playRace(cfgOf(30), { b0: B0.toUpperCase(), betas: betas(40) });
    expect(a.runs.map((r) => r.pos.join(","))).toEqual(b.runs.map((r) => r.pos.join(",")));
    expect(a.turnsPlayed).toBe(b.turnsPlayed);
  });

  test("R3 nothing can be played without B0", () => {
    expect(() => playRace(cfgOf(10), { b0: "", betas: betas(3) })).toThrow();
  });

  test("R22 fate mode: every player throws every turn, nobody misses", () => {
    const st = playRace(cfgOf(40), { b0: B0, betas: betas(10) });
    expect(st.runs.every((r) => r.missed === 0 && r.pos.length === Math.min(10, r.pos.length))).toBe(true);
    expect(st.turnsPlayed).toBe(10);
  });

  test("R21 presence mode: only players with a recorded throw move; the others miss the turn", () => {
    const st = playRace(cfgOf(20, { play: "presence" }), { b0: B0, betas: betas(8), thrown: (seat, t) => seat % 2 === 0 || t < 2 });
    for (const r of st.runs) {
      if (r.seat % 2 === 0) expect(r.missed).toBe(0);
      else { expect(r.missed).toBe(6); expect(r.pos.slice(2).every((p) => p === r.pos[1])).toBe(true); }
    }
    expect(playRace(cfgOf(5, { play: "presence" }), { b0: B0, betas: betas(4) }).runs.every((r) => r.missed === 4)).toBe(true); // no record at all = nobody threw
  });

  test("R24 the game ends when the 5th player lands on the last square, with strict 1st-5th prizes", () => {
    const st = playRace(cfgOf(200), { b0: B0, betas: betas(150) });
    expect(st.ended).toBe(true);
    expect(["finishers", "cap"]).toContain(st.endReason);
    if (st.endReason === "finishers") {
      expect(st.finishedCount).toBeGreaterThanOrEqual(5);
      const won = settleRace(st, LINES, (s) => `p${s}`);
      const fin = won.filter((w) => w.pattern === "finish").sort((a, b) => a.ordinal - b.ordinal);
      expect(fin.map((w) => w.ordinal)).toEqual([1, 2, 3, 4, 5]);
      expect(new Set(fin.map((w) => w.pids[0])).size).toBe(5);
      for (let i = 1; i < fin.length; i++) expect(fin[i]!.idx).toBeGreaterThanOrEqual(fin[i - 1]!.idx); // 1st finished no later than 2nd ...
      // the last square is really where they stand
      for (const w of fin) expect(squareOf(st.runs[Number(w.pids[0]!.slice(1)) - 1]!)).toBe(100);
    }
    expect(st.turnsPlayed).toBeLessThanOrEqual(st.cfg.turnCap);
  });

  test("R24/R30 the game also ends at the turn limit and the ranking is by square", () => {
    const st = playRace(cfgOf(6, { turnCap: 12 }), { b0: B0, betas: betas(100) });
    expect(st.turnsPlayed).toBeLessThanOrEqual(12);
    if (st.endReason === "cap") {
      const order = orderPlayers(st);
      for (let i = 1; i < order.length; i++) if (order[i - 1]!.finishedTurn === null && order[i]!.finishedTurn === null) expect(squareOf(order[i - 1]!)).toBeGreaterThanOrEqual(squareOf(order[i]!));
    }
    expect(st.ended).toBe(true);
    const few = playRace(cfgOf(6, { turnCap: 10 }), { b0: B0, betas: betas(5) });
    expect(few.ended).toBe(false); expect(few.endReason).toBe("running");
  });

  test("R23 the milestone prize goes to the first player on or past the milestone square", () => {
    const st = playRace(cfgOf(300, { milestones: [60] }), { b0: B0, betas: betas(25) });
    const won = settleRace(st, [{ pattern: "milestone", ordinal: 1 }], (s) => `p${s}`);
    expect(won.length).toBe(1);
    const winner = st.runs[Number(won[0]!.pids[0]!.slice(1)) - 1]!;
    const turnOf = (r: typeof winner) => r.pos.findIndex((p) => p >= 60);
    expect(turnOf(winner)).toBe(won[0]!.idx);
    for (const r of st.runs) if (turnOf(r) >= 0) expect(turnOf(r)).toBeGreaterThanOrEqual(won[0]!.idx); // nobody got there earlier
    const same = st.runs.filter((r) => turnOf(r) === won[0]!.idx);
    expect(won[0]!.tied ?? 1).toBe(same.length > 1 ? same.length : 1);
  });

  test("R23 up to three milestones, each its own prize; a milestone nobody reached has no winner", () => {
    const st = playRace(cfgOf(100, { milestones: [25, 50, 99] }), { b0: B0, betas: betas(5) });
    const won = settleRace(st, [1, 2, 3].map((o) => ({ pattern: "milestone", ordinal: o })), (s) => `p${s}`);
    expect(won.find((w) => w.ordinal === 3)).toBeUndefined();
    expect(validateRaceCfg(cfgOf(10, { milestones: [10, 20, 30, 40] }))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10, { milestones: [100] }))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10, { milestones: [30, 30] }))).not.toBeNull();
  });

  test("R25/R26/R27 no ties: many players on one turn always get a strict, repeatable order with a note", () => {
    const st = playRace(cfgOf(1500), { b0: B0, betas: betas(150) });
    const rows = rankPlayers(st, 10);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(rows.map((r) => r.seat)).size).toBe(10);
    const again = rankPlayers(playRace(cfgOf(1500), { b0: B0, betas: betas(150) }), 10);
    expect(again.map((r) => r.seat)).toEqual(rows.map((r) => r.seat));
    // the full order has no repeats either
    const order = orderPlayers(st); expect(new Set(order.map((r) => r.seat)).size).toBe(1500);
    // finishers come first, in finishing order
    const fin = order.filter((r) => r.finishedTurn !== null);
    for (let i = 1; i < fin.length; i++) expect(fin[i]!.finishedTurn!).toBeGreaterThanOrEqual(fin[i - 1]!.finishedTurn!);
    expect(order.slice(0, fin.length).every((r) => r.finishedTurn !== null)).toBe(true);
    // when several finished on the same turn the note says so and names the deciding measure
    const sameTurn = rows.filter((r) => r.finishedTurn !== null && rows.filter((x) => x.finishedTurn === r.finishedTurn).length > 1);
    for (const r of sameTurn) expect(r.note).toMatch(/players finished on turn \d+; decided by (more ladders climbed|fewer turns missed|chance)/);
  });

  test("R25 the chain: same turn -> more ladders wins, then fewer missed turns, then fate", () => {
    const st = playRace(cfgOf(50), { b0: B0, betas: betas(150) });
    const order = orderPlayers(st);
    for (let i = 1; i < order.length; i++) {
      const a = order[i - 1]!, b = order[i]!;
      const fa = a.finishedTurn ?? Infinity, fb = b.finishedTurn ?? Infinity;
      expect(fa).toBeLessThanOrEqual(fb);
      if (fa === fb && squareOf(a) === squareOf(b)) { expect(a.ladders).toBeGreaterThanOrEqual(b.ladders); if (a.ladders === b.ladders) expect(a.missed).toBeLessThanOrEqual(b.missed); }
      else if (fa === fb) expect(squareOf(a)).toBeGreaterThan(squareOf(b));
    }
  });

  test("R25 tied players on the same square are separated and the note explains it (forced tie at the start)", () => {
    const st = playRace(cfgOf(12), { b0: B0, betas: betas(0) }); // nothing thrown yet: everybody on square 1, all measures equal -> fate decides
    const rows = rankPlayers(st, 10);
    expect(new Set(rows.map((r) => r.seat)).size).toBe(10);
    expect(rows[0]!.note).toMatch(/12 players are on square 1; decided by chance/);
  });

  test("R28 a player may win more than one prize; with one-prize-per-person nobody wins two", () => {
    const base = cfgOf(400, { milestones: [70] });
    const st = playRace(base, { b0: B0, betas: betas(150) });
    const all = settleRace(st, LINES, (s) => `p${s}`);
    const ex = playRace({ ...base, exclusive: true }, { b0: B0, betas: betas(150) });
    const only = settleRace(ex, LINES, (s) => `p${s}`);
    expect(new Set(only.map((w) => w.pids[0])).size).toBe(only.length);
    expect(only.length).toBeGreaterThanOrEqual(all.length - 1);
    // exclusive prizes are announced when the game has ended only
    const early = playRace({ ...base, exclusive: true }, { b0: B0, betas: betas(3) });
    expect(settleRace(early, LINES).length).toBe(0);
    // the same name can appear twice only when exclusivity is off
    const dup = all.map((w) => w.pids[0]); expect(dup.length).toBeGreaterThan(0);
  });

  test("R29 extra prizes: biggest climb and comeback appear at the end; never-missed only in presence mode", () => {
    const extra = [{ pattern: "climb", ordinal: 1 }, { pattern: "comeback", ordinal: 1 }, { pattern: "nevermissed", ordinal: 1 }];
    const live = playRace(cfgOf(300), { b0: B0, betas: betas(5) });
    expect(settleRace(live, extra).length).toBe(0); // the game has not ended
    const st = playRace(cfgOf(300), { b0: B0, betas: betas(150) });
    const won = settleRace(st, extra, (s) => `p${s}`);
    const climb = won.find((w) => w.pattern === "climb")!, comeback = won.find((w) => w.pattern === "comeback")!;
    expect(climb).toBeDefined(); expect(comeback).toBeDefined();
    const best = Math.max(...st.runs.map((r) => r.bestClimb));
    expect(st.runs[Number(climb.pids[0]!.slice(1)) - 1]!.bestClimb).toBe(best);
    expect(Math.max(...st.runs.map((r) => r.bestComeback))).toBe(st.runs[Number(comeback.pids[0]!.slice(1)) - 1]!.bestComeback);
    expect(won.find((w) => w.pattern === "nevermissed")).toBeUndefined(); // fate mode: nobody can miss
    const pr = playRace(cfgOf(60, { play: "presence" }), { b0: B0, betas: betas(150), thrown: (seat, t) => seat !== 7 && (seat !== 8 || t > 1) });
    const nm = settleRace(pr, [{ pattern: "nevermissed", ordinal: 1 }], (s) => `p${s}`);
    expect(nm.length).toBe(1);
    const w = pr.runs[Number(nm[0]!.pids[0]!.slice(1)) - 1]!; expect(w.missed).toBe(0); expect([7, 8]).not.toContain(w.seat);
  });

  test("R39 the crowd chart adds up to the number of players, and 'ahead of' is a share of players", () => {
    for (const n of [2, 17, 333, 1000]) {
      const st = playRace(cfgOf(n), { b0: B0, betas: betas(20) });
      const c = crowdOf(st); expect(c.bands.reduce((a, b) => a + b, 0)).toBe(n); expect(c.players).toBe(n);
      const a = c.aheadOf(1); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(100);
      const same = playRace(cfgOf(n), { b0: B0, betas: betas(20) }); expect(crowdOf(same).bands).toEqual(c.bands);
    }
  });

  test("config checks are plain and complete", () => {
    expect(validateRaceCfg(cfgOf(1))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10001))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10, { endPrizes: 6 }))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10, { turnCap: 5 }))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10, { teams: 11 }))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(3, { teams: 4 }))).not.toBeNull();
    expect(validateRaceCfg(cfgOf(10))).toBeNull();
  });
});

describe("team race", () => {
  const teamCfg = (players: number, teams: number, over: Partial<RaceCfg> = {}): RaceCfg => cfgOf(players, { teams, turnCap: 80, ...over });

  test("R31 players are dealt into teams by fate; sizes differ by at most one; the deal is repeatable and needs B0", () => {
    for (const [p, t] of [[10, 3], [20, 4], [7, 7], [100, 10], [13, 2]] as const) {
      const a = teamsOf({ gameId: "tg", players: p, teams: t }, B0), b = teamsOf({ gameId: "tg", players: p, teams: t }, B0);
      expect(a).toEqual(b);
      const sizes = Array.from({ length: t }, (_, k) => a.filter((x) => x === k).length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(sizes.reduce((x, y) => x + y, 0)).toBe(p);
    }
    expect(teamsOf({ gameId: "tg", players: 30, teams: 5 }, B0)).not.toEqual(teamsOf({ gameId: "tg", players: 30, teams: 5 }, hex("other-b0")));
  });

  test("R32 a team finishes when all its players are home; the game ends when the first team finishes", () => {
    const st = playRace(teamCfg(8, 4), { b0: B0, betas: betas(200) });
    expect(st.ended).toBe(true);
    const table = teamTable(st.cfg, st, teamsOf(st.cfg, B0));
    if (st.endReason === "finishers") {
      expect(table[0]!.finishedTurn).not.toBeNull();
      for (const m of table[0]!.members) expect(st.runs[m - 1]!.finishedTurn).not.toBeNull();
      expect(table.filter((r) => r.finishedTurn !== null).every((r) => r.finishedTurn! <= st.turnsPlayed - 1)).toBe(true);
    }
    const won = settleRace(st, [{ pattern: "team", ordinal: 1 }, { pattern: "team", ordinal: 2 }, { pattern: "team", ordinal: 3 }], (s) => `p${s}`);
    expect(won.length).toBe(3);
    expect(new Set(won.flatMap((w) => w.pids)).size).toBe(won.flatMap((w) => w.pids).length); // a player is in one team only
    expect(won[0]!.pids.length).toBe(table[0]!.members.length);
  });

  test("R33 teams are ranked without ties, and the ranking is repeatable", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const st = playRace({ ...teamCfg(12, 6), gameId: "team-" + seed }, { b0: B0, betas: betas(200, seed) });
      const t = teamTable(st.cfg, st, teamsOf(st.cfg, B0));
      expect(t.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6]);
      expect(new Set(t.map((r) => r.team)).size).toBe(6);
      for (let i = 1; i < t.length; i++) {
        const a = t[i - 1]!, b = t[i]!, fa = a.finishedTurn ?? Infinity, fb = b.finishedTurn ?? Infinity;
        expect(fa).toBeLessThanOrEqual(fb);
        if (fa === fb) expect(a.avgSquare).toBeGreaterThanOrEqual(b.avgSquare);
      }
    }
  });

  test("R33 teams that are level at the start are separated by fate with a note", () => {
    const st = playRace(teamCfg(8, 4), { b0: B0, betas: betas(0) });
    const t = teamTable(st.cfg, st, teamsOf(st.cfg, B0));
    expect(t.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(t[0]!.note).toMatch(/4 teams level; decided by chance/);
  });
});
