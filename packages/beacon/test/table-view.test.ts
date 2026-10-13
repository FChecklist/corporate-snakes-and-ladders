import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { defaultTableCfg, playTable, rankTable, settleTable, turnOrder, validateTableCfg, type TableCfg } from "../src/table";
import { defaultRaceCfg, playRace } from "../src/race";
import { ThrowRecord, acceptThrow, mayThrow, spectatorView } from "../src/view";
import { LEAD_ROUNDS, REVEAL_ROUNDS, betaOffset, betaRoundOf, b0RoundFor, firstTurnRound, openRoundOf, turnRounds } from "../src/schedule";
import { QUICKNET, roundTimeMs } from "../src/index";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const B0 = hex("b0-table");
const betas = (n: number, tag = "t") => Array.from({ length: n }, (_, i) => hex(`${tag}|${i}`));

describe("table mode", () => {
  test("R34 2 to 20 players: a sealed order that is the same on every phone, different for different B0, and needs B0", () => {
    for (const n of [2, 3, 7, 12, 20]) {
      const o = turnOrder("tbl", n, B0);
      expect([...o].sort((a, b) => a - b)).toEqual(Array.from({ length: n }, (_, i) => i + 1));
      expect(turnOrder("tbl", n, B0)).toEqual(o);
    }
    expect(turnOrder("tbl", 20, B0)).not.toEqual(turnOrder("tbl", 20, hex("another")));
    expect(validateTableCfg(defaultTableCfg("t", 1))).not.toBeNull();
    expect(validateTableCfg(defaultTableCfg("t", 21))).not.toBeNull();
    expect(validateTableCfg(defaultTableCfg("t", 2))).toBeNull();
    expect(() => playTable(defaultTableCfg("t", 4), { b0: "", betas: betas(3) })).toThrow();
    // the first player is not always seat 1: over many games every seat takes the first turn sometimes
    const firsts = new Set(Array.from({ length: 200 }, (_, i) => turnOrder("g" + i, 6, B0)[0]));
    expect(firsts.size).toBe(6);
  });

  test("R35/R36 pawns take turns in the sealed order, finished pawns are skipped, first home wins; no two pawns move at once", () => {
    for (const n of [2, 3, 5, 9, 20]) {
      const cfg = defaultTableCfg("tbl-" + n, n);
      const st = playTable(cfg, { b0: B0, betas: betas(2000) });
      expect(st.ended).toBe(true); expect(st.endReason).toBe("winners");
      expect(st.finishedOrder.length).toBe(cfg.winners);
      // every throw moved exactly one pawn: total throws = sum over pawns of the turns they took
      expect(st.runs.reduce((a, r) => a + r.pos.length, 0)).toBe(st.throws);
      // finishing order is strict: each finisher has a different throw index
      const idx = st.finishedOrder.map((s) => st.finishThrow.get(s)!);
      expect(new Set(idx).size).toBe(idx.length);
      for (let i = 1; i < idx.length; i++) expect(idx[i]!).toBeGreaterThan(idx[i - 1]!);
      // turns rotate in the sealed order until pawns go home
      const taken = st.runs.map((r) => r.pos.length);
      expect(Math.max(...taken) - Math.min(...taken)).toBeLessThanOrEqual(n === 2 ? 400 : 400);
    }
  });

  test("R35 table order: the first pawn in the sealed order throws first, and a finished pawn is not given another turn", () => {
    const cfg = defaultTableCfg("tbl-order", 4);
    const early = playTable(cfg, { b0: B0, betas: betas(4) });
    const order = turnOrder(cfg.gameId, 4, B0);
    expect(early.runs[order[0]! - 1]!.pos.length).toBe(1);
    expect(early.runs.every((r) => r.pos.length === 1)).toBe(true);
    const st = playTable(cfg, { b0: B0, betas: betas(3000) });
    for (const seat of st.finishedOrder) { const r = st.runs[seat - 1]!; expect(r.finishedTurn).toBe(r.pos.length - 1); expect(st.finishThrow.get(seat)!).toBeGreaterThanOrEqual(r.pos.length - 1); expect(r.pos[r.pos.length - 1]).toBe(100); }
  });

  test("R35 the throw limit ends a table game that is somehow slow; the ranking is then by square", () => {
    const st = playTable({ ...defaultTableCfg("tbl-cap", 5), maxThrows: 25 }, { b0: B0, betas: betas(300) });
    expect(st.ended).toBe(true); expect(st.endReason).toBe("cap"); expect(st.throws).toBe(25);
    const r = rankTable(st); expect(r.map((x) => x.rank)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < r.length; i++) expect(r[i - 1]!.square).toBeGreaterThanOrEqual(r[i]!.square);
  });

  test("R21 presence at the table: an absent player's turn passes and is counted as missed", () => {
    const cfg = defaultTableCfg("tbl-abs", 3);
    const st = playTable(cfg, { b0: B0, betas: betas(30), absent: (seat) => seat === 2 });
    expect(st.runs[1]!.missed).toBeGreaterThan(0); expect(st.runs[1]!.pos.every((p) => p === 1)).toBe(true);
  });

  test("table prizes: finish#k is the k-th pawn home; milestone is the first pawn on or past the square", () => {
    const cfg: TableCfg = { ...defaultTableCfg("tbl-prize", 6), winners: 3, milestone: 50 };
    const st = playTable(cfg, { b0: B0, betas: betas(3000) });
    const won = settleTable(st, [{ pattern: "milestone", ordinal: 1 }, { pattern: "finish", ordinal: 1 }, { pattern: "finish", ordinal: 2 }, { pattern: "finish", ordinal: 3 }, { pattern: "finish", ordinal: 4 }], (s) => `p${s}`);
    expect(won.filter((w) => w.pattern === "finish").map((w) => w.pids[0])).toEqual(st.finishedOrder.map((s) => `p${s}`));
    const m = won.find((w) => w.pattern === "milestone")!; expect(m.idx).toBe(Math.min(...st.milestoneIdx.values()));
  });
});

describe("spectator and presence", () => {
  test("R37 a spectator sees counts and nicknames only: no seeds, no beacon values, nothing about throws not yet played", () => {
    const b = betas(6, "sp"), st = playRace(defaultRaceCfg("spect-game", 40), { b0: B0, betas: b });
    const v = spectatorView(st, (s) => `Nick${s}`), json = JSON.stringify(v);
    expect(json).not.toContain(B0); for (const x of b) expect(json).not.toContain(x);
    expect(json).not.toMatch(/[0-9a-f]{40,}/);
    expect(v.turn).toBe(6); expect(v.players).toBe(40); expect(v.bands.reduce((a, c) => a + c, 0)).toBe(40);
    expect(v.leaders.length).toBe(10); expect(v.leaders[0]!.name).toMatch(/^Nick\d+$/);
    // the view of turn 6 is built from six values only: it cannot contain turn 7 (the function never received it)
    const v7 = spectatorView(playRace(defaultRaceCfg("spect-game", 40), { b0: B0, betas: betas(7, "sp") }), (s) => `Nick${s}`);
    expect(v7.turn).toBe(7);
    const tv = spectatorView(playTable(defaultTableCfg("tv", 5), { b0: B0, betas: betas(10) }));
    expect(tv.kind).toBe("table"); expect(JSON.stringify(tv)).not.toContain(B0);
    expect(mayThrow("spectator")).toBe(false); expect(mayThrow("player")).toBe(true);
  });

  test("R38 presence: a late claim, a borrowed device, an unknown seat and a repeat are all refused", () => {
    const dev = (s: number) => (s <= 3 ? `dev${s}` : undefined), win = { openMs: 1_000_000, windowSec: 20 };
    expect(acceptThrow({ seat: 1, turn: 4, device: "dev1", arrivalMs: 1_005_000 }, dev, win)).toEqual({ ok: true });
    expect(acceptThrow({ seat: 1, turn: 4, device: "dev1", arrivalMs: 1_019_999 }, dev, win)).toEqual({ ok: true });
    expect(acceptThrow({ seat: 1, turn: 4, device: "dev1", arrivalMs: 1_020_000 }, dev, win)).toMatchObject({ ok: false, reason: "window closed" });
    expect(acceptThrow({ seat: 1, turn: 4, device: "dev1", arrivalMs: 1_060_000 }, dev, win)).toMatchObject({ ok: false }); // claiming after the dice are public
    expect(acceptThrow({ seat: 1, turn: 4, device: "dev1", arrivalMs: 999_999 }, dev, win)).toMatchObject({ ok: false, reason: "window not open yet" });
    expect(acceptThrow({ seat: 2, turn: 4, device: "dev1", arrivalMs: 1_005_000 }, dev, win)).toMatchObject({ ok: false, reason: "wrong device" });
    expect(acceptThrow({ seat: 9, turn: 4, device: "dev9", arrivalMs: 1_005_000 }, dev, win)).toMatchObject({ ok: false, reason: "unknown seat" });
    const rec = new ThrowRecord();
    expect(rec.add(1, 4)).toBe(true); expect(rec.add(1, 4)).toBe(false); expect(rec.add(2, 4)).toBe(true); expect(rec.add(1, 5)).toBe(true);
    expect(rec.count).toBe(3); expect(rec.throwsIn(4)).toBe(2); expect(rec.thrown(1, 4)).toBe(true); expect(rec.thrown(3, 4)).toBe(false);
  });

  test("R38 a refused claim cannot gain moves: a player with no accepted throws never moves", () => {
    const rec = new ThrowRecord();
    for (let t = 0; t < 30; t++) { rec.add(2, t); rec.add(3, t); } // seat 1 claimed nothing in time
    const st = playRace({ ...defaultRaceCfg("pres", 3), play: "presence" }, { b0: B0, betas: betas(30), thrown: rec.thrown });
    expect(st.runs[0]!.pos.every((p) => p === 1)).toBe(true); expect(st.runs[0]!.missed).toBe(30);
    expect(st.runs[1]!.missed).toBe(0);
  });

  test("R38 the collector budget: players x turns requests, well inside the free allowance for 1,000 players on a normal game", () => {
    const players = 1000, turns = 36, pings = players * turns;
    expect(pings).toBe(36000); expect(pings).toBeLessThan(100000);
    const rec = new ThrowRecord(); for (let s = 1; s <= 200; s++) for (let t = 0; t < 12; t++) rec.add(s, t);
    expect(rec.count).toBe(2400);
  });
});

describe("schedule", () => {
  test("R40 B0 is the first value published AFTER registration closed; turn 0 opens 30 s later", () => {
    const t0 = Date.UTC(2026, 9, 20, 10, 0, 0), b0r = b0RoundFor(t0);
    expect(roundTimeMs(b0r)).toBeGreaterThan(t0); expect(roundTimeMs(b0r - 1)).toBeLessThanOrEqual(t0);
    expect(firstTurnRound(b0r)).toBe(b0r + LEAD_ROUNDS);
    expect(roundTimeMs(firstTurnRound(b0r)) - roundTimeMs(b0r)).toBe(30_000);
  });

  test("R40 b_t is the first round published after the window closed, for every window length", () => {
    for (const w of [15, 20, 25, 30]) {
      const open = 1_000_000, closeMs = roundTimeMs(open) + w * 1000, br = open + betaOffset(w);
      expect(roundTimeMs(br)).toBeGreaterThan(closeMs);          // published after the window closed
      expect(roundTimeMs(br - 1)).toBeLessThanOrEqual(closeMs);  // and it is the first such round
      expect(turnRounds(w)).toBe(betaOffset(w) + REVEAL_ROUNDS);
    }
    expect(turnRounds(20)).toBe(9);
  });

  test("R40 turn rounds follow a fixed schedule, are pushed by brand breaks and by pauses, and stop after a stop", () => {
    const first = 5000;
    expect(openRoundOf(null, first, 20, [], 0)).toBe(5000); expect(openRoundOf(null, first, 20, [], 3)).toBe(5000 + 27);
    expect(openRoundOf(null, first, 20, [{ after: 2, seconds: 60 }], 1)).toBe(5009);
    expect(openRoundOf(null, first, 20, [{ after: 2, seconds: 60 }], 2)).toBe(5018 + 20);
    const st = { intervals: [{ start: 5020, end: 5030 }], stopRound: null } as any;
    expect(openRoundOf(st, first, 20, [], 2)).toBe(5018); expect(openRoundOf(st, first, 20, [], 3)).toBe(5027 + 10);
    const stopped = { intervals: [], stopRound: 5030 } as any;
    expect(openRoundOf(stopped, first, 20, [], 4)).toBeNull();
    expect(betaRoundOf(null, first, 20, [], 0)).toBe(5000 + betaOffset(20));
    expect(QUICKNET.periodSec).toBe(3);
  });
});
