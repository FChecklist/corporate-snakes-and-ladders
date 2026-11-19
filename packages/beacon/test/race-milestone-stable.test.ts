// Found by tools/qa-model.mjs (2026-10-29): a prize announced on a phone is never taken back.
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

describe("a winner is never taken back", () => {
  test("two players reach the milestone on the same turn; one slides down a snake later: the milestone prize stays with the one who was higher on that turn", () => {
    for (let k = 0; k < 16; k++) {
      const cfg = { ...defaultRaceCfg(`mile-${k}`, 2), milestones: [75] };
      // turn 3: seat 1 stands on 76, seat 2 on 75. Later seat 1 slides to 40 and seat 2 climbs to 90.
      const full = [run(1, [10, 30, 60, 76, 70, 50, 40]), run(2, [8, 20, 55, 75, 80, 85, 90])];
      const at = (n: number) => state(cfg, full.map((r) => run(r.seat, r.pos.slice(0, n))), false);
      const early = settleRace(at(4), [{ pattern: "milestone", ordinal: 1 }], (s) => `p${s}`), late = settleRace(at(7), [{ pattern: "milestone", ordinal: 1 }], (s) => `p${s}`);
      expect(early[0]!.pids[0]).toBe("p1");
      expect(late[0]!.pids[0]).toBe("p1"); // the prize announced on turn 4 is still hers on turn 7
    }
  });
});
