// "No one knows the next roll: not the organizer, not the co-organizer, not even the software." (suite rules 1.1). This file is the proof that the sentence is true.
// A roll is a function of (game id, seat, turn, b_t) where b_t is the public beacon value published only AFTER that turn's window closes.
// So: (1) the software cannot make a roll without b_t; (2) everything the organizer, the host or the software holds before the window closes leaves all six faces open;
// (3) no setting can pick or steer a number; (4) the race cannot move past the last published value.
import { describe, expect, test } from "bun:test";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";
import { FAIRNESS_LINE } from "../../shared/src/lines";
import { rollFor } from "../src/play";
import { playRace, defaultRaceCfg } from "../src/race";
import { GAME_FIELDS, validateCfg } from "../src/config";

const hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));

describe("the fairness sentence is the one the owner fixed", () => {
  test("it says the organizer, the host and the software", () => {
    expect(FAIRNESS_LINE).toBe("No one knows the next roll: not the organizer, not the co-organizer, not even the software.");
  });
});

describe("it is true: nobody can know the next roll", () => {
  test("(1) the software cannot make a roll without the published value of that turn", () => {
    for (const bad of ["", "abc", "z".repeat(64), undefined as unknown as string, null as unknown as string]) expect(() => rollFor("G-1", 3, 7, bad)).toThrow();
    expect(rollFor.length).toBe(4); // the only inputs: game id, seat, turn, the published value. No fifth input, so no organizer, host or software choice can enter.
    const src = rollFor.toString(); expect(src).not.toMatch(/Math\.random|Date\.now|cfg|config|organizer|host/i);
  });
  test("(2) with everything known before the window closes fixed (game, seat, turn, every earlier value) all six faces stay possible and equally likely", () => {
    const N = 12000, count = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < N; i++) count[rollFor("G-1", 3, 7, hex("unknown-future-value-" + i))]!++;
    expect(count[0]).toBe(0);
    for (let f = 1; f <= 6; f++) { expect(count[f]!).toBeGreaterThan(N / 6 * 0.9); expect(count[f]!).toBeLessThan(N / 6 * 1.1); }
  });
  test("(2b) a roll tells nothing about the next: the same value gives the same roll, and a different seat or turn with the same value gives an unrelated one", () => {
    const b = hex("one value");
    expect(rollFor("G-1", 3, 7, b)).toBe(rollFor("G-1", 3, 7, b.toUpperCase()));
    let same = 0, n = 3000; for (let i = 0; i < n; i++) { const v = hex("v" + i); if (rollFor("G-1", 1, 4, v) === rollFor("G-1", 2, 4, v)) same++; }
    expect(same / n).toBeGreaterThan(1 / 6 - 0.04); expect(same / n).toBeLessThan(1 / 6 + 0.04); // two seats on the same value agree only by chance
  });
  test("(3) no setting can pick or steer a number: the settings hold no roll, dice or seed, and players cannot be made to throw", () => {
    expect([...GAME_FIELDS].filter((k) => /roll|dice|seed|number|value/i.test(k))).toEqual([]);
    const v = validateCfg({ roll: 6, dice: 6, seed: "x", fixedRoll: 6, throws: [6, 6, 6] } as any, undefined, { rules: true });
    expect(v.ok).toBe(true); if (v.ok) expect(JSON.stringify(v.cfg)).not.toMatch(/roll|dice|seed|fixed|throws/i);
    expect(validateCfg({ play: "presence" }, undefined, { rules: true }).ok).toBe(false); // nobody's press decides anything
  });
  test("(4) the race cannot move past the last published value, so the turn after it is unknown to everyone", () => {
    const cfg = defaultRaceCfg("G-1", 6), b0 = hex("b0");
    const three = Array.from({ length: 3 }, (_, i) => hex("b" + i)), four = [...three, hex("b3")];
    const a = playRace(cfg, { b0, betas: three }), b = playRace(cfg, { b0, betas: four });
    expect(a.turnsPlayed).toBe(3); expect(b.turnsPlayed).toBe(4);
    for (let s = 0; s < 6; s++) expect(b.runs[s]!.pos.slice(0, 4)).toEqual(a.runs[s]!.pos.slice(0, 4).concat(b.runs[s]!.pos[3]!)); // turns 0 to 2 are identical; turn 3 exists only once its value does
  });
});
