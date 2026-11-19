// Found by the correctness review (2026-10-29): the prize lines of a game made through the API can come in any order. With one prize per person on, the order they were sent in decided
// who got what ('finish #4' first gave the best finisher the 4th prize; 'biggest climb' before 'reach the end' took a finisher away from it). The engine now follows the order of the
// houses (config.ts HOUSE_ORDER: milestone, finish, team, climb, comeback, never missed) and the winner number, whatever order the lines come in.
import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { validateCfg, type RewardLine } from "../src/config";
import { playGame, settleGame } from "../src/game";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
const line = (pattern: string, ordinal: number): RewardLine => ({ pattern: pattern as any, scope: "ticket", ordinal, text: "" });
const STANDARD = [line("milestone", 1), ...[1, 2, 3, 4, 5].map((o) => line("finish", o)), line("climb", 1), line("comeback", 1)];
const shuffled = (seed: number): RewardLine[] => { const a = [...STANDARD]; let x = seed * 2654435761 >>> 0; for (let i = a.length - 1; i > 0; i--) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; const j = x % (i + 1); [a[i], a[j]] = [a[j]!, a[i]!]; } return a; };
const winners = (rewards: RewardLine[], eid: string, exclusive: boolean) => {
  const v = validateCfg({ rewards, exclusive: exclusive || undefined }); if (!v.ok) throw new Error(v.error);
  const betas = Array.from({ length: 150 }, (_, i) => hex(`${eid}|${i}`));
  const g = playGame(eid, v.cfg, 12, { b0: hex("b0-" + eid), betas });
  return Object.fromEntries(settleGame(g, v.cfg, Array.from({ length: 12 }, (_, i) => `${i + 1}x00000000`)).map((w) => [`${w.pattern}#${w.ordinal}`, w.pids.join()]));
};

describe("the order the prize lines come in does not change who wins what", () => {
  for (const exclusive of [false, true]) test(`one prize per person ${exclusive ? "on" : "off"}: 40 games, each with the lines in a different order`, () => {
    for (let k = 0; k < 40; k++) {
      const eid = `order-${exclusive}-${k}`;
      expect(winners(shuffled(k + 1), eid, exclusive), eid).toEqual(winners(STANDARD, eid, exclusive));
    }
  });
});
