import { describe, expect, test } from "bun:test";
import { BRAND_COLORS, GRACE_ROUNDS, MAX_ROUNDS, OPENING_WINDOW_SECONDS, PRIZE_HOUSES, autoAfter, brandMomentsFor, breakShift, defaultCfg, defaultRewards, keysInPlay, linesFor, quorumFor, roundEid, validateCfg, votersFor, type EngagementCfg } from "../src/config";

const ok = (input: Record<string, unknown>, base?: EngagementCfg) => { const r = validateCfg(input as any, base); if (!r.ok) throw new Error(r.error); return r.cfg; };
const bad = (input: Record<string, unknown>, base?: EngagementCfg) => { const r = validateCfg(input as any, base); expect(r.ok).toBe(false); return (r as { error: string }).error; };

describe("the default game", () => {
  test("one milestone prize and the first five home; one pawn per player; one round; no marking", () => {
    const c = defaultCfg();
    expect(defaultRewards().map((l) => `${l.pattern}#${l.ordinal}`)).toEqual(["milestone#1", "finish#1", "finish#2", "finish#3", "finish#4", "finish#5"]);
    expect(c.tickets).toBe(1); expect(c.rounds).toBe(1); expect(MAX_ROUNDS).toBe(1);
    expect(keysInPlay(c.rewards)).toEqual(["milestone", "finish"]);
    expect(linesFor(c.rewards, "finish").map((l) => l.ordinal)).toEqual([1, 2, 3, 4, 5]);
  });
  test("the prize table: six prizes with their maximum winners", () => {
    expect(PRIZE_HOUSES.map((h) => [h.id, h.max])).toEqual([["milestone", 3], ["finish", 5], ["team", 3], ["climb", 1], ["comeback", 1], ["nevermissed", 1]]);
    for (const h of PRIZE_HOUSES) { expect(h.label.length).toBeGreaterThan(2); expect(h.how).not.toMatch(/bingo|card|number called/i); }
  });
  test("the first turn opens 2 minutes after the start time (sign-up closes at the start time)", () => { expect(GRACE_ROUNDS * 3).toBe(120); expect(OPENING_WINDOW_SECONDS).toBe(120); });
});

describe("validateCfg", () => {
  test("rewards: a 2nd needs the 1st, each prize has its own maximum, no repeats, unknown prizes refused", () => {
    expect(ok({ rewards: [{ pattern: "climb", ordinal: 1, text: "TV" }] }).rewards).toEqual([{ pattern: "climb", scope: "ticket", ordinal: 1, text: "TV" }]);
    bad({ rewards: [{ pattern: "finish", ordinal: 2 }] });
    bad({ rewards: [{ pattern: "climb", ordinal: 2 }, { pattern: "climb", ordinal: 1 }] });
    bad({ rewards: [{ pattern: "finish", ordinal: 6 }] });
    bad({ rewards: [{ pattern: "finish", ordinal: 1 }, { pattern: "finish", ordinal: 1 }] });
    bad({ rewards: [{ pattern: "line", ordinal: 1 }] });
    bad({ rewards: [] });
    expect(ok({ rewards: [{ pattern: "finish", ordinal: 1, text: "<b>Hamper</b>" }] }).rewards[0]!.text).toBe("bHamper/b");
  });
  test("one pawn and one round", () => { bad({ tickets: 2 }); bad({ rounds: 2 }); expect(ok({ tickets: 1, rounds: 1 }).rounds).toBe(1); });
  test("game type, play mode, teams", () => {
    expect(ok({ mode: "team", teams: 3 })).toMatchObject({ mode: "team", teams: 3 });
    bad({ mode: "team" }); bad({ teams: 3 }); bad({ mode: "team", teams: 1 }); bad({ mode: "team", teams: 11 }); bad({ mode: "league" });
    expect(ok({ mode: "table" }).mode).toBe("table"); expect(ok({ mode: "race" }).mode).toBeUndefined();
    expect(ok({ play: "presence" }).play).toBe("presence"); bad({ play: "random" });
    bad({ rewards: [{ pattern: "nevermissed", ordinal: 1 }] }); expect(ok({ play: "presence", rewards: [{ pattern: "nevermissed", ordinal: 1 }] }).play).toBe("presence");
  });
  test("board: sizes 100, 144, 225; 6 to 12 snakes and ladders; exact or pass; the classic board is stored as nothing", () => {
    expect(ok({ board: { size: 225, snakes: 12, ladders: 6, finish: "pass" } }).board).toEqual({ size: 225, snakes: 12, ladders: 6, finish: "pass" });
    expect(ok({ board: { size: 100, snakes: 9, ladders: 9, finish: "exact" } }).board).toBeUndefined();
    for (const b of [{ size: 99 }, { snakes: 5 }, { snakes: 13 }, { ladders: 1.5 }, { finish: "bounce" }, "big"]) bad({ board: b });
  });
  test("milestones: 1 to 3 different squares before the last, kept in order", () => {
    expect(ok({ milestones: [90, 25, 50] }).milestones).toEqual([25, 50, 90]);
    expect(ok({ milestones: [75] }).milestones).toBeUndefined();
    for (const m of [[], [1], [100], [30, 30], [10, 20, 30, 40], "75"]) bad({ milestones: m });
    expect(ok({ board: { size: 144, snakes: 9, ladders: 9, finish: "exact" }, milestones: [143] }).milestones).toEqual([143]);
    bad({ milestones: [144], board: { size: 144, snakes: 9, ladders: 9, finish: "exact" } });
  });
  test("turn limit 10 to 150, end prizes 1 to 5, one prize per person, theme", () => {
    expect(ok({ turnCap: 90, endPrizes: 3, exclusive: true, theme: "career" })).toMatchObject({ turnCap: 90, endPrizes: 3, exclusive: true, theme: "career" });
    for (const o of [{ turnCap: 9 }, { turnCap: 151 }, { turnCap: 12.5 }, { endPrizes: 0 }, { endPrizes: 6 }, { exclusive: "yes" }, { theme: "space" }]) bad(o);
    expect(ok({ turnCap: 60, endPrizes: 5, exclusive: false, theme: "jungle" }).turnCap).toBeUndefined();
  });
  test("a change keeps what it does not mention", () => {
    const base = ok({ mode: "team", teams: 4, turnCap: 80 });
    const next = ok({ turnCap: 90 }, base);
    expect(next).toMatchObject({ mode: "team", teams: 4, turnCap: 90 });
  });
});

describe("brand breaks and moments", () => {
  test("up to 3 breaks during the game, spread evenly over a typical 60-turn game", () => {
    const table: Record<number, number[]> = { 1: [30], 2: [20, 40], 3: [15, 30, 45] };
    for (const n of [1, 2, 3]) expect(Array.from({ length: n }, (_, i) => autoAfter(n, i + 1))).toEqual(table[n]!);
    expect(brandMomentsFor(1)).toBe(5);
    const c = ok({ breaks: [{ kind: "speech", title: "Welcome", seconds: 60 }, { kind: "speech", title: "Thanks", seconds: 60 }] });
    expect(c.breaks.map((b) => b.after)).toEqual([20, 40]);
    bad({ breaks: [1, 2, 3, 4].map((i) => ({ kind: "speech", title: "T" + i, seconds: 60 })) });
  });
  test("a break lasts 15 to 600 seconds in steps of 3; a lucky draw picks 1, 3, 5 or 10; breaks shift later turns", () => {
    for (const s of [14, 601, 61]) bad({ breaks: [{ kind: "speech", title: "Hi there", seconds: s }] });
    bad({ breaks: [{ kind: "lucky", title: "Draw", seconds: 60, winners: 2 }] });
    expect(ok({ breaks: [{ kind: "lucky", title: "Draw", seconds: 60, winners: 5 }] }).breaks[0]!.winners).toBe(5);
    expect(breakShift([{ after: 10, seconds: 60, kind: "speech", title: "x" }], 9)).toBe(0);
    expect(breakShift([{ after: 10, seconds: 60, kind: "speech", title: "x" }], 10)).toBe(20);
  });
  test("an opening must fit in the 2 minutes before the first turn", () => {
    expect(ok({ opening: [{ kind: "speech", title: "Welcome", seconds: 60 }] }).opening).toHaveLength(1);
    bad({ opening: [{ kind: "speech", title: "Welcome", seconds: 123 }] });
    bad({ opening: [{ kind: "speech", title: "A one", seconds: 90 }, { kind: "speech", title: "A two", seconds: 90 }] });
  });
  test("the company brand is a name, one of the listed colours and an optional small logo", () => {
    expect(ok({ brand: { name: "Acme", color: BRAND_COLORS[1] } }).brand).toEqual({ name: "Acme", color: BRAND_COLORS[1] });
    bad({ brand: { name: "Acme", color: "#123456" } }); bad({ brand: { color: BRAND_COLORS[0] } });
    expect(ok({ brand: null }, ok({ brand: { name: "Acme", color: BRAND_COLORS[1] } })).brand).toBeUndefined();
  });
});

describe("who decides, ids", () => {
  test("a result needs a quorum of different phones: half of a tiny game, 5% of a big one (3 to 25)", () => {
    expect([1, 2, 3, 6, 7, 100, 1000, 10000].map(quorumFor)).toEqual([1, 1, 2, 3, 3, 5, 25, 25]);
    expect(votersFor(10)).toBe(10); expect(votersFor(1000)).toBe(100);
  });
  test("a game has one round id", () => { expect(roundEid("G", 1)).toBe("G"); expect(roundEid("G", 2)).toBe("G~r2"); });
});
