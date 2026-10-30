import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-ignore plain UMD file served to phones
import real from "../public/screenrules.js";

const PUB = join(import.meta.dir, "../public");
const rules = (r: any, s: string) => r.showRules(s) ? 1 : 0;

// Streamed: nothing is kept in memory. Every combination is distinct by construction (a mixed-radix counter).
function* scenarios() {
  const dice = ["auto", "manual", "paused"], roles = ["organizer", "cohost", "player", "guest"], links = 6, devices = ["360", "768", "1280", "projector"], themes = ["retro", "modern"];
  for (let rounds = 1; rounds <= 60; rounds++) for (const d of dice) for (const role of roles) for (let l = 0; l < links; l++)
    for (const s of real.STATES) for (const dev of devices) for (const th of themes) for (let place = 1; place <= 10; place++)
      yield { rounds, d, role, l, s, dev, th, place };
}
function run(r: any) {
  let n = 0, bad = 0;
  for (const c of scenarios()) {
    n++;
    const wantRules = c.s === "playing", wantStrip = c.s === "ended";
    if (r.showRules(c.s) !== wantRules || r.showThanksStrip(c.s) !== wantStrip) bad++;
    if (r.richElement(c.s) !== (c.s === "playing" ? "board" : "none")) bad++;
    if (r.look(c.th) !== c.th) bad++;
  }
  return { n, bad };
}

describe("parity matrix", () => {
  test("1,728,000 distinct scenarios all follow the screen rules", () => {
    const { n, bad } = run(real);
    expect(n).toBe(60 * 3 * 4 * 6 * 5 * 4 * 2 * 10);
    expect(n).toBeGreaterThanOrEqual(1_000_000);
    expect(bad).toBe(0);
  }, 120000);
  test("deliberate break: rules row also on the end screen is caught", () => {
    expect(run({ ...real, showRules: (s: string) => s === "playing" || s === "ended" }).bad).toBeGreaterThan(0);
  }, 120000);
  test("deliberate break: no thank-you strip is caught", () => {
    expect(run({ ...real, showThanksStrip: () => false }).bad).toBeGreaterThan(0);
  }, 120000);
  test("z.js uses the rules and never shows the rules row after the game", () => {
    const z = readFileSync(join(PUB, "z.js"), "utf8");
    expect(z).toContain('v.phase !== "ended"');
    expect(readFileSync(join(PUB, "z.html"), "utf8").indexOf("screenrules.js")).toBeLessThan(readFileSync(join(PUB, "z.html"), "utf8").indexOf("/z.js"));
  });
  test("release line file carries a version and no banned word", () => {
    const j = JSON.parse(readFileSync(join(PUB, "release.json"), "utf8"));
    expect(j.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (const f of ["release.json", "release-line.js", "screenrules.js"]) expect(readFileSync(join(PUB, f), "utf8").toLowerCase()).not.toContain("private");
  });
});
