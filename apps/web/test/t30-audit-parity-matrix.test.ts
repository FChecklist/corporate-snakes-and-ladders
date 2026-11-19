// AUDIT of the coder's apps/web/test/parity-matrix.test.ts (docs/TEST_FINDINGS.md F-12): which of its scenario fields can make an assertion fail?
// A field that no assertion reads cannot fail, and under the rule "a check that cannot fail does not count" it does not count. This test READS the coder's file and lists the fields its assertions use.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const src = readFileSync(join(import.meta.dir, "parity-matrix.test.ts"), "utf8");
const gen = src.slice(src.indexOf("function* scenarios()"), src.indexOf("function run("));
const run = src.slice(src.indexOf("function run("), src.indexOf('describe("parity matrix"'));

describe("coder's parity-matrix.test.ts: what the 1,728,000 scenarios really check", () => {
  test("the generator makes the fields rounds, d, role, l, s, dev, th, place", () => { expect(gen).toContain("yield { rounds, d, role, l, s, dev, th, place }"); });
  test("the assertions read only the fields s (screen state) and th (theme); the other six fields are never read", () => {
    const read = new Set([...run.matchAll(/\bc\.(\w+)/g)].map((m) => m[1]!));
    expect([...read].sort()).toEqual(["s", "th"]);
    const made = ["rounds", "d", "role", "l", "s", "dev", "th", "place"], unused = made.filter((f) => !read.has(f));
    expect(unused).toEqual(["rounds", "d", "role", "l", "dev", "place"]);
  });
  test("so the number of distinct checks is states x themes = 5 x 2 = 10, not 1,728,000", () => {
    const states = 5, themes = 2, total = 60 * 3 * 4 * 6 * states * 4 * themes * 10;
    expect(total).toBe(1_728_000); expect(states * themes).toBe(10); expect(total / (states * themes)).toBe(172_800); // every real check is repeated 172,800 times
  });
});
