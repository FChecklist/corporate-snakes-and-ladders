// Found by tools/qa-model.mjs (2026-10-29): the ranking a player sees and the prize list tell the same story.
import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { defaultRaceCfg, orderPlayers, playRace, rankPlayers, settleRace, type RaceCfg, type RaceState } from "../src/race";
import { newRun, type Run } from "../src/play";
import { playGame, raceCfgOf, settleGame } from "../src/game";
import { validateCfg } from "../src/config";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const betas = (n: number, tag: string) => Array.from({ length: n }, (_, i) => hex(`${tag}|${i}`));
const run = (seat: number, pos: number[], over: Partial<Run> = {}): Run => ({ ...newRun(seat), pos, ...over });
const state = (cfg: RaceCfg, runs: Run[], ended = true): RaceState => ({ cfg, b0: hex("b0"), runs, boards: [], turnsPlayed: Math.max(...runs.map((r) => r.pos.length)), ended, endReason: ended ? "finishers" : "running", finishedCount: runs.filter((r) => r.finishedTurn !== null).length });
const LINES = [{ pattern: "milestone", ordinal: 1 }, ...[1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o }))];

describe("the ranking and the prizes agree", () => {
  test("two players finish on the same turn with the same ladders and misses: the prize for 1st goes to the player the ranking shows first (64 different games)", () => {
    for (let k = 0; k < 64; k++) {
      const cfg = { ...defaultRaceCfg(`tie-${k}`, 2), endPrizes: 1 };
      const st = state(cfg, [run(1, [10, 100], { finishedTurn: 1, ladders: 2 }), run(2, [12, 100], { finishedTurn: 1, ladders: 2 })]);
      const shown = rankPlayers(st, 2)[0]!.seat;
      const won = settleRace(st, LINES, (s) => `p${s}`).find((w) => w.pattern === "finish" && w.ordinal === 1)!;
      expect(won.pids[0]).toBe(`p${shown}`);
      expect(orderPlayers(st)[0]!.seat).toBe(shown);
    }
  });
});
