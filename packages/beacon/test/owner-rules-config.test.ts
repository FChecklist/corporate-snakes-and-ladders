// Owner rules 1.1 in the shared settings check (packages/beacon/src/config.ts): the rules are chosen when a game is made, kept with it, and refuse what they replace.
import { describe, expect, test } from "bun:test";
import { defaultCfg, validateCfg } from "../src/config";

const R = { rules: true };
describe("owner rules 1.1 in validateCfg", () => {
  test("a game made under them is by employee ID only, for the list, and throws by itself", () => {
    const v = validateCfg({}, undefined, R); expect(v.ok).toBe(true); if (!v.ok) return;
    expect([v.cfg.rules, v.cfg.verify, v.cfg.employeesOnly, v.cfg.play, v.cfg.idKind]).toEqual(["1.1", "id", true, undefined, undefined]);
    expect(v.cfg.invites?.on).toBe(false); expect(v.cfg.join).toBe("phone");
  });
  test("they refuse a mobile number, an Email ID, 'anyone with the link' and players who must throw", () => {
    for (const input of [{ verify: "mobile" }, { verify: "either" }, { verify: "both" }, { idKind: "email" }, { employeesOnly: false }, { play: "presence" }] as const) {
      const v = validateCfg(input as any, undefined, R); expect([JSON.stringify(input), v.ok]).toEqual([JSON.stringify(input), false]);
    }
    expect(validateCfg({ verify: "id", employeesOnly: true, idKind: "emp", play: "fate" }, undefined, R).ok).toBe(true);
  });
  test("they stay on when a later save does not mention them, and when the stored settings are read back", () => {
    const first = validateCfg({}, undefined, R); if (!first.ok) throw new Error(first.error);
    const next = validateCfg({ name: "Team day" }, first.cfg); expect(next.ok).toBe(true); if (next.ok) expect([next.cfg.rules, next.cfg.verify, next.cfg.employeesOnly]).toEqual(["1.1", "id", true]);
    const bad = validateCfg({ verify: "mobile" }, first.cfg); expect(bad.ok).toBe(false); // the game's own mark is enough: no flag is needed to hold it to the rules
    const back = validateCfg({ verify: first.cfg.verify, employeesOnly: true }, undefined, { stored: true, rules: true }); expect(back.ok).toBe(true);
  });
  test("a prize that needs players to throw cannot be added under them", () => {
    const v = validateCfg({ rewards: [{ pattern: "nevermissed", scope: "ticket", ordinal: 1, text: "x" }] }, undefined, R); expect(v.ok).toBe(false);
  });
  test("without them nothing changes: a mobile-number game and players-throw play are still allowed", () => {
    expect(validateCfg({ verify: "both", play: "presence" }).ok).toBe(true);
    const d = defaultCfg(); expect(d.rules).toBeUndefined();
  });
});
