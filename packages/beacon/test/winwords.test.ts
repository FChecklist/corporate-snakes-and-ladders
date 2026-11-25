// What a winner is told they won (winwords.ts): the organizer's own words first, a plain sentence under them or on its own, for every kind of prize.
import { describe, expect, test } from "bun:test";
import { PRIZE_HOUSES } from "../src/config";
import { ordinalWord, plainWin, winWords } from "../src/winwords";

const FORBIDDEN = /\b(my|mine|your|yours|host|hosts|co-host|guest|guests|participant|participants|nickname|ticket|tickets|engagement)\b/i; // the owner's word rules for anything a person reads

describe("ordinal words", () => {
  test("1st 2nd 3rd 4th 5th and the teens and twenties", () => {
    expect([1, 2, 3, 4, 5, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinalWord)).toEqual(["1st", "2nd", "3rd", "4th", "5th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
  });
});

describe("the plain sentence", () => {
  test("a milestone win names the square and the milestone gift (the default square is 75)", () => {
    expect(plainWin({ pattern: "milestone", ordinal: 1 }, {})).toBe("You reached square 75 first and won the milestone gift.");
    expect(plainWin({ pattern: "milestone", ordinal: 1 }, { milestones: [60], milestoneLines: 1 })).toBe("You reached square 60 first and won the milestone gift.");
  });
  test("with more than one milestone prize each sentence says which one, and the squares are taken in order", () => {
    const ctx = { milestones: [90, 40, 65], milestoneLines: 3 };
    expect(plainWin({ pattern: "milestone", ordinal: 1 }, ctx)).toBe("You reached square 40 first and won the 1st milestone gift.");
    expect(plainWin({ pattern: "milestone", ordinal: 2 }, ctx)).toBe("You reached square 65 first and won the 2nd milestone gift.");
    expect(plainWin({ pattern: "milestone", ordinal: 3 }, ctx)).toBe("You reached square 90 first and won the 3rd milestone gift.");
  });
  test("a finish win says the place: You came 2nd.", () => {
    expect(plainWin({ pattern: "finish", ordinal: 2 })).toMatch(/^You came 2nd\./);
    expect(plainWin({ pattern: "finish", ordinal: 1 })).toBe("You came 1st. You were the 1st player to get home.");
    expect(plainWin({ pattern: "finish", ordinal: 5 })).toMatch(/^You came 5th\./);
  });
  test("every other prize has a sentence of its own; an unknown prize still gets a kind one", () => {
    expect(plainWin({ pattern: "team", ordinal: 3 })).toBe("The team you are in came 3rd in the team race and won the team prize.");
    expect(plainWin({ pattern: "climb", ordinal: 1 })).toMatch(/biggest ladder/);
    expect(plainWin({ pattern: "comeback", ordinal: 1 })).toMatch(/fall down a snake/);
    expect(plainWin({ pattern: "nevermissed", ordinal: 1 })).toMatch(/every turn/);
    expect(plainWin({ pattern: "lucky", ordinal: 1 })).toBe("You were picked in the lucky draw.");
    expect(plainWin({ pattern: "something-new", ordinal: 1 })).toBe("You won a prize.");
  });
  test("a bad place number or a missing milestone square still gives a sentence, never a blank or NaN", () => {
    for (const w of [{ pattern: "finish", ordinal: 0 }, { pattern: "finish", ordinal: NaN }, { pattern: "milestone", ordinal: 9 }, { pattern: "team", ordinal: -2 }]) {
      const s = plainWin(w as any, { milestones: [50], milestoneLines: 2 });
      expect(s.length).toBeGreaterThan(15); expect(s).not.toMatch(/NaN|undefined|null/);
    }
  });
  test("no sentence for any prize in the game's own table, any place or any context uses my / your / mine / yours or a banned word", () => {
    const seen: string[] = [];
    for (const h of PRIZE_HOUSES) for (let ordinal = 1; ordinal <= Math.max(h.max, 3); ordinal++) for (const ctx of [{}, { milestones: [75], milestoneLines: 1 }, { milestones: [30, 60, 90], milestoneLines: 3 }]) seen.push(plainWin({ pattern: h.id, ordinal }, ctx));
    seen.push(plainWin({ pattern: "lucky", ordinal: 1 }), plainWin({ pattern: "other", ordinal: 1 }));
    expect(seen.length).toBeGreaterThan(20);
    for (const s of seen) { expect([s, FORBIDDEN.test(s)]).toEqual([s, false]); expect(/[A-Z]/.test(s[0]!)).toBe(true); expect(/[.!]$/.test(s)).toBe(true); }
  });
});

describe("the two lines a winner reads", () => {
  test("the organizer's own words come first and the plain sentence sits under them", () => {
    expect(winWords({ pattern: "milestone", ordinal: 1, text: "Coffee mug" }, { milestones: [75] })).toEqual({ main: "Coffee mug", sub: "You reached square 75 first and won the milestone gift." });
    expect(winWords({ pattern: "finish", ordinal: 1, text: "  Gift card:   1000 " })).toEqual({ main: "Gift card: 1000", sub: "You came 1st. You were the 1st player to get home." });
  });
  test("with no words from the organizer the plain sentence stands alone: You came 2nd.", () => {
    for (const text of [undefined, "", "   "]) {
      const x = winWords({ pattern: "finish", ordinal: 2, text });
      expect(x.main).toMatch(/^You came 2nd\./); expect(x.sub).toBe("");
    }
  });
  test("a lucky draw shows its title when the organizer named a prize, and only the plain sentence when it is the bare words Lucky draw", () => {
    expect(winWords({ pattern: "lucky", ordinal: 1, text: "Smart watch" })).toEqual({ main: "Smart watch", sub: "You were picked in the lucky draw." });
    expect(winWords({ pattern: "lucky", ordinal: 1, text: "Lucky draw" })).toEqual({ main: "You were picked in the lucky draw.", sub: "" });
  });
  test("a prize the organizer called No prize is shown as written (the organizer's choice), with the plain sentence under it", () => {
    expect(winWords({ pattern: "finish", ordinal: 3, text: "No prize" }).main).toBe("No prize");
  });
});
