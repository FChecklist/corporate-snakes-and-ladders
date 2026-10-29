// Found by tools/qa-model.mjs (2026-10-29): a team race does not break when fewer people join than there are teams.
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

describe("a team race does not break when fewer people join than there are teams", () => {
  test("10 teams chosen, 6 people join: the game is played with 6 teams of one", () => {
    const v = validateCfg({ mode: "team", teams: 10 }); if (!v.ok) throw new Error(v.error);
    expect(() => playGame("teams-few", v.cfg, 6, { b0: hex("b0-t"), betas: betas(20, "t") })).not.toThrow();
    expect(raceCfgOf("teams-few", v.cfg, 6).teams).toBe(6);
    expect(raceCfgOf("teams-many", v.cfg, 40).teams).toBe(10); // enough people: the organizer's number stays
  });
});
