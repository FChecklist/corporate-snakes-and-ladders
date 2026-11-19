// Found by tools/qa-model.mjs (2026-10-29): one prize per person does not lose a prize at the end of the game.
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

describe("one prize per person does not lose a prize", () => {
  test("the game does not end while a 'reach the end' prize is still unawarded because the milestone winner is among the first five home (60 games)", () => {
    let unawardedBefore = 0, checked = 0;
    for (let k = 0; k < 60; k++) {
      const v = validateCfg({ exclusive: true }); if (!v.ok) throw new Error(v.error);
      const eid = `excl-${k}`;
      const g = playGame(eid, v.cfg, 12, { b0: hex("b0-" + eid), betas: betas(150, eid) });
      if (g.kind !== "race" || g.st.endReason !== "finishers") continue;
      checked++;
      const settled = settleGame(g, v.cfg, Array.from({ length: 12 }, (_, i) => `${i + 1}x00000000`));
      for (const o of [1, 2, 3, 4, 5]) if (!settled.some((x) => x.pattern === "finish" && x.ordinal === o)) unawardedBefore++;
    }
    expect(checked).toBeGreaterThan(30);
    expect(unawardedBefore).toBe(0);
  });
  test("without one prize per person the game still ends when the 5th player is home", () => {
    const v = validateCfg({}); if (!v.ok) throw new Error(v.error);
    for (let k = 0; k < 10; k++) { const eid = `plain-${k}`; const g = playGame(eid, v.cfg, 12, { b0: hex("b0-" + eid), betas: betas(150, eid) }); if (g.kind === "race" && g.st.endReason === "finishers") expect(g.st.finishedCount).toBeGreaterThanOrEqual(5); }
  });
});
