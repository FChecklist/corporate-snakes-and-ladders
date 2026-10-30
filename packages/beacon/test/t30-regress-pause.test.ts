// Regression: pause / resume / extend / stop (packages/beacon/src/control.ts), with real Ed25519 signatures. Every test asserts a number or a boolean that the rule decides.
import { describe, expect, test } from "bun:test";
import { acceptLog, callRound, generateOrganizerKey, pausedAt, resolveControl, scheduleWithControl, signControl, signControlWithSecret, publicKeyFromSecret, MAX_TIMED_PAUSE_ROUNDS, type ControlConfig, type ControlMsg, type UnsignedControl } from "../src/control";

const SECRET = "11".repeat(32), OTHER = "22".repeat(32);
const cfg = (over: Partial<ControlConfig> = {}): ControlConfig => ({ pubKey: publicKeyFromSecret(SECRET), maxPauseRounds: 600, leadRounds: 4, ...over });
const msg = (over: Partial<UnsignedControl> & Pick<UnsignedControl, "seq" | "action" | "atBeaconRound">, secret = SECRET): ControlMsg => signControlWithSecret(secret, { engagementId: "G1", signedAtRound: over.atBeaconRound - 10, ...over } as UnsignedControl);
const START = 1000, STRIDE = 7; // a 20-second turn is 7 rounds of 3 seconds

describe("pause moves every later turn by exactly the pause length", () => {
  test("no messages: turn k opens at start + k*stride", () => { const s = resolveControl(cfg(), []); expect(scheduleWithControl(s, START, STRIDE, 5)).toEqual([1000, 1007, 1014, 1021, 1028]); });
  test("a timed pause of 30 rounds at round 1012 pushes turns at or after 1012 by 30 and leaves earlier turns", () => {
    const s = resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1012, untilRound: 1042 })]);
    expect(s.intervals).toEqual([{ start: 1012, end: 1042 }]); expect(s.applied).toBe(1); expect(s.ignored).toEqual([]);
    expect(scheduleWithControl(s, START, STRIDE, 5)).toEqual([1000, 1007, 1044, 1051, 1058]); // turn 2 would have been 1014 (>= 1012): 1014 + 30
    expect(pausedAt(s, 1011)).toBe(false); expect(pausedAt(s, 1012)).toBe(true); expect(pausedAt(s, 1041)).toBe(true); expect(pausedAt(s, 1042)).toBe(false);
  });
  test("open-ended pause then resume: the pause lasts exactly from the pause round to the resume round", () => {
    const s = resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100 }), msg({ seq: 2, action: "resume", atBeaconRound: 1160 })]);
    expect(s.intervals).toEqual([{ start: 1100, end: 1160 }]); expect(callRound(s, START, STRIDE, 20)).toBe(1000 + 140 + 60);
  });
  test("an open-ended pause ends by itself after maxPauseRounds (a lost organizer cannot freeze a room)", () => {
    const s = resolveControl(cfg({ maxPauseRounds: 600 }), [msg({ seq: 1, action: "pause", atBeaconRound: 1100 })]); expect(s.intervals).toEqual([{ start: 1100, end: 1700 }]);
  });
  test("two pauses add up", () => {
    const s = resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1050, untilRound: 1060 }), msg({ seq: 2, action: "pause", atBeaconRound: 1200, untilRound: 1250 })]);
    expect(callRound(s, START, STRIDE, 60)).toBe(1000 + 420 + 10 + 50);
  });
  test("extend moves the end of the running pause later; an extend that does not move it later is ignored", () => {
    const s = resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1120 }), msg({ seq: 2, action: "extend", atBeaconRound: 1105, untilRound: 1140 }), msg({ seq: 3, action: "extend", atBeaconRound: 1110, untilRound: 1130 })]);
    expect(s.intervals).toEqual([{ start: 1100, end: 1140 }]); expect(s.ignored.map((x) => x.seq)).toEqual([3]);
  });
  test("stop: no turn opens at or after the stop round (null), earlier ones are unchanged", () => {
    const s = resolveControl(cfg(), [msg({ seq: 1, action: "stop", atBeaconRound: 1030 })]);
    expect(scheduleWithControl(s, START, STRIDE, 6)).toEqual([1000, 1007, 1014, 1021, 1028, null]); expect(s.stopRound).toBe(1030);
  });
});

describe("rules that keep a pause safe", () => {
  test("a pause with less lead than leadRounds is ignored and takes no effect (but still uses its number)", () => {
    const s = resolveControl(cfg({ leadRounds: 4 }), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, signedAtRound: 1098 })]);
    expect(s.intervals).toEqual([]); expect(s.ignored).toEqual([{ seq: 1, why: "pause needs at least 4 rounds of lead" }]); expect(callRound(s, START, STRIDE, 20)).toBe(1140);
  });
  test("exactly the lead is enough (4 of 4), one less is not (3 of 4)", () => {
    expect(resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, signedAtRound: 1096, untilRound: 1110 })]).intervals).toHaveLength(1);
    expect(resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, signedAtRound: 1097, untilRound: 1110 })]).intervals).toHaveLength(0);
  });
  test("a second pause while paused, a resume when not paused, and anything after a stop are ignored with a reason", () => {
    const s = resolveControl(cfg(), [msg({ seq: 1, action: "resume", atBeaconRound: 1000 }), msg({ seq: 2, action: "pause", atBeaconRound: 1100, untilRound: 1200 }), msg({ seq: 3, action: "pause", atBeaconRound: 1150, untilRound: 1250 }), msg({ seq: 4, action: "stop", atBeaconRound: 1300 }), msg({ seq: 5, action: "pause", atBeaconRound: 1400 })]);
    expect(s.ignored.map((x) => [x.seq, x.why])).toEqual([[1, "not paused"], [3, "already paused"], [5, "engagement already stopped"]]); expect(s.applied).toBe(2);
  });
  test("a timed pause longer than 24 hours of rounds, or ending before it starts, is refused", () => {
    expect(resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1100 + MAX_TIMED_PAUSE_ROUNDS + 1 })]).intervals).toHaveLength(0);
    expect(resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1100 + MAX_TIMED_PAUSE_ROUNDS })]).intervals).toHaveLength(1);
    expect(resolveControl(cfg(), [msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1090 })]).intervals).toHaveLength(0);
  });
  test("messages are applied in seq order whatever order they arrive in", () => {
    const a = msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1200 }), b = msg({ seq: 2, action: "resume", atBeaconRound: 1150 });
    expect(resolveControl(cfg(), [b, a])).toEqual(resolveControl(cfg(), [a, b])); expect(resolveControl(cfg(), [b, a]).intervals).toEqual([{ start: 1100, end: 1150 }]);
  });
});

describe("only the organizer's key can pause (signatures)", () => {
  test("a message signed with another key is dropped as forged and does not move the schedule", async () => {
    const good = msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1120 }), forged = msg({ seq: 2, action: "pause", atBeaconRound: 1300, untilRound: 1900 }, OTHER);
    const r = await (await import("../src/control")).acceptLogDetailed(cfg(), "G1", [good, forged]);
    expect(r.forged).toBe(1); expect(r.log.map((m) => m.seq)).toEqual([1]); expect(resolveControl(cfg(), r.log).intervals).toEqual([{ start: 1100, end: 1120 }]);
  });
  test("changing any signed field after signing (the end round) breaks the signature", async () => {
    const good = msg({ seq: 1, action: "pause", atBeaconRound: 1100, untilRound: 1120 }); const tampered = { ...good, untilRound: 1999 };
    expect((await acceptLog(cfg(), "G1", [tampered])).length).toBe(0); expect((await acceptLog(cfg(), "G1", [good])).length).toBe(1);
  });
  test("a message for another game is dropped (cannot be replayed into this one)", async () => {
    const other = signControlWithSecret(SECRET, { engagementId: "G2", seq: 1, action: "pause", atBeaconRound: 1100, signedAtRound: 1000, untilRound: 1120 }); expect((await acceptLog(cfg(), "G1", [other])).length).toBe(0);
  });
  test("a key made in the browser way (WebCrypto) signs and verifies the same way", async () => {
    const k = await generateOrganizerKey(); const m = await signControl(k.privateKey, { engagementId: "G1", seq: 1, action: "stop", atBeaconRound: 1100, signedAtRound: 1000 });
    expect((await acceptLog({ pubKey: k.publicKeyHex, maxPauseRounds: 600, leadRounds: 4 }, "G1", [m])).length).toBe(1); expect((await acceptLog(cfg(), "G1", [m])).length).toBe(0);
  });
  test("junk in the log (not an object, missing fields, wrong action) is dropped, never thrown", async () => {
    expect((await acceptLog(cfg(), "G1", [null, 5, "x", {}, { seq: 1 }, { ...msg({ seq: 1, action: "pause", atBeaconRound: 1100 }), action: "explode" }] as any)).length).toBe(0);
    expect((await acceptLog(cfg(), "G1", "not a list" as any)).length).toBe(0);
  });
});
