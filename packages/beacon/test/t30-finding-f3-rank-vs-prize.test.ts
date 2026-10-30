// FINDING F-3 (docs/TEST_FINDINGS.md): when two players are level on finish turn, ladders and missed turns, the results table (rankPlayers/orderPlayers) breaks the tie with the
// fate label "rank" and the finish PRIZE (settleRace) breaks it with the label "finish". The two can disagree: the table puts one player 5th, the 5th-place prize goes to the other.
// This test states the correct behaviour (table and prize agree) and is RED on release/snakes-1.4.0. It is kept as a reproduction, not hidden.
import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { defaultRaceCfg, orderPlayers, playRace, settleRace } from "../src/race";
const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const betas = (seed: string, n: number) => Array.from({ length: n }, (_, i) => hex(`${seed}|${i}`));

describe("F-3: results table and finish prizes agree on who is 1st to 5th", () => {
  test("game PRZ1 (20 players, turn limit 150, 5 end prizes): the 5th finisher in the table is the winner of the 5th-place prize", () => {
    const st = playRace({ ...defaultRaceCfg("PRZ1", 20), turnCap: 150, endPrizes: 5 }, { b0: hex("b1"), betas: betas("r1", 150) });
    const table = orderPlayers(st).filter((r) => r.finishedTurn !== null).slice(0, 5).map((r) => r.seat);
    const prizes = settleRace(st, [1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o })), (s) => String(s)).map((w) => Number(w.pids[0]));
    expect(prizes).toEqual(table);
  });
  test("over 40 generated games the table and the prizes never disagree", () => {
    let bad = 0;
    for (let g = 0; g < 40; g++) {
      const st = playRace({ ...defaultRaceCfg("PRZ" + g, 20), turnCap: 150, endPrizes: 5 }, { b0: hex("b" + g), betas: betas("r" + g, 150) });
      const table = orderPlayers(st).filter((r) => r.finishedTurn !== null).slice(0, 5).map((r) => r.seat);
      const prizes = settleRace(st, [1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o })), (s) => String(s)).map((w) => Number(w.pids[0]));
      if (JSON.stringify(table) !== JSON.stringify(prizes)) bad++;
    }
    expect(bad).toBe(0);
  });
});
