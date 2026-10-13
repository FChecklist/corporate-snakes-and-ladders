import { describe, expect, test } from "bun:test";
import { normalize, price, PACKS, proposeBreakPositions, rewardName, maskNumber, numberWords, spokenRoll } from "../src";

describe("phone numbers (handout section 12, default country IN)", () => {
  const ok = (raw: string, e164: string, cc = "IN") => {
    const r = normalize(raw, cc);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.e164).toBe(e164);
  };
  test("mandated formats", () => {
    ok("98200 44556", "+919820044556");
    ok("+91 99876 11223", "+919987611223");
    ok("09123456780", "+919123456780");
    ok("0091 9988776655", "+919988776655");
    ok("919812312312", "+919812312312");
    ok("+65 9123 4567", "+6591234567");
    ok("+971 50 765 4321", "+971507654321");
  });
  test("rejections", () => {
    expect(normalize("12345", "IN")).toEqual({ ok: false, reason: "Too short" });
    expect(normalize("98765abc10", "IN")).toEqual({ ok: false, reason: "Contains letters" });
    expect(normalize("", "IN")).toEqual({ ok: false, reason: "No number found" });
    expect(normalize("1".repeat(16), "IN")).toEqual({ ok: false, reason: "Too long" });
  });
  test("changed flag", () => {
    const a = normalize("+919820044556", "IN");
    const b = normalize("98200 44556", "IN");
    expect(a.ok && a.changed).toBe(false);
    expect(b.ok && b.changed).toBe(true);
  });
  test("masking hides the middle digits", () => {
    const m = maskNumber("+919820044556");
    expect(m).toContain("•");
    expect(m.endsWith("556")).toBe(true);
  });
});

describe("spoken dice", () => {
  test("a roll is said in plain words, with what happened", () => {
    expect(spokenRoll(4)).toBe("You rolled four.");
    expect(spokenRoll(6, "ladder", 38)).toBe("You rolled six. A ladder! Up to square 38.");
    expect(spokenRoll(2, "snake", 21)).toBe("You rolled two. A snake. Down to square 21.");
    expect(spokenRoll(5, "finish")).toBe("You rolled five. You are home!");
    expect(spokenRoll(6, "overshoot")).toContain("You stay");
  });
  test("number words", () => {
    expect(numberWords(7)).toBe("seven"); expect(numberWords(52)).toBe("fifty-two"); expect(numberWords(100)).toBe("one hundred"); expect(numberWords(225)).toBe("two hundred twenty-five");
    expect(() => numberWords(0)).toThrow();
  });
});

describe("pricing and breaks", () => {
  test("no GST is charged: the rupee price is the whole amount; no tax abroad either", () => {
    expect(price(1000, "INR")).toEqual({ total: 7099, base: 7099, tax: 0 });
    expect(price(1000, "USD")).toEqual({ total: 101, base: 101, tax: 0 });
  });
  test("owner rule 2026-10-09: every price is the old GST-inclusive price (list price + 18%) rounded to the nearest number ending in 99", () => {
    const oldList = [1999, 2999, 3999, 4999, 5999, 9999, 14999, 24999];
    const nearest99 = (x: number) => { const lo = Math.floor((x + 1) / 100) * 100 - 1, hi = lo + 100; return x - lo <= hi - x ? lo : hi; };
    PACKS.forEach(([n, inr], i) => {
      expect(inr % 100).toBe(99);
      expect(inr).toBe(nearest99(Math.round(oldList[i]! * 1.18 * 100) / 100));
      expect(price(n, "INR").total).toBe(inr);
    });
    expect(PACKS.map((p) => p[1])).toEqual([2399, 3499, 4699, 5899, 7099, 11799, 17699, 29499]);
  });
  test("break positions are near-equal and capped at 3", () => {
    expect(proposeBreakPositions(3)).toEqual([15, 30, 45]);
    expect(() => proposeBreakPositions(4)).toThrow();
  });
  test("reward names", () => {
    expect(rewardName("finish", "ticket", 2, 5)).toBe("2nd Reach the end");
    expect(rewardName("climb", "ticket", 1, 1)).toBe("Biggest climb");
    expect(rewardName("milestone", "ticket", 1, 1)).toBe("Milestone");
  });
});
