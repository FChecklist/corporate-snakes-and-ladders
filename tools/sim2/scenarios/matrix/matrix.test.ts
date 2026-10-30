// The streamed scenario matrix as a test: runs every group against the real product, records exact counts, and proves each counted dimension can fail by running the matrix against a broken copy of the function that dimension feeds.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import * as A from "./axes";
import { merge, newCounts, real, runGame, runIdentity, runLinks, type Counts, type Subject } from "./run";
import { runWire } from "./wire";

setDefaultTimeout(900_000);
const RESULTS = join(import.meta.dir, "../../../../results");
const results: Record<string, Counts> = {};

describe("scenario matrix: real product, streamed", () => {
  test("M1 identity: ID spelling x era x e-mail spelling x verification setting", async () => { results.M1 = await runIdentity(real); expect(results.M1.fail).toBe(0); expect(results.M1.scenarios).toBe((A.ID_SPELLING_COUNT * 2) * A.MAIL_SPELLING_COUNT * A.verifyCases().length); });
  test("M2 game: dice mode x press pattern x turn limit x end prizes x finish rule x players x seed", async () => { results.M2 = await runGame(real); expect(results.M2.fail).toBe(0); expect(results.M2.scenarios).toBe(A.SEEDS.length * A.PLAYERS.length * A.FINISH.length * A.TURN_CAPS.length * A.END_PRIZES.length * A.DICE.length); });
  test("M3 links and look: role x link type x screen state x theme", async () => { results.M3 = await runLinks(real); expect(results.M3.fail).toBe(0); });
  test("M4 wire: mode x era x payment x ID or phone x listed x device x time x approval, real requests", async () => { results.M4 = await runWire(); expect(results.M4.fail).toBe(0); expect(results.M4.scenarios).toBeGreaterThan(500); });
  test("the total is at least 1,000,000 distinct scenarios with zero failures; exact counts are saved to results/matrix-counts.json", () => {
    const total = Object.values(results).reduce(merge, newCounts());
    const independent = A.ID_SPELLING_COUNT * 2 + A.MAIL_SPELLING_COUNT + A.verifyCases().length + results.M2!.scenarios + results.M3!.scenarios + results.M4!.scenarios;
    mkdirSync(RESULTS, { recursive: true });
    writeFileSync(join(RESULTS, "matrix-counts.json"), JSON.stringify({ groups: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { scenarios: v.scenarios, checks: v.checks, pass: v.pass, fail: v.fail }])), total: { scenarios: total.scenarios, checks: total.checks, pass: total.pass, fail: total.fail }, independentInputs: independent, byDimension: total.byDimension, firstFailures: total.firstFailures }, null, 1));
    expect(total.scenarios).toBeGreaterThanOrEqual(1_000_000); expect(total.fail).toBe(0); expect(total.pass).toBe(total.scenarios);
    for (const [dim, v] of Object.entries(total.byDimension)) expect([dim, v.scenarios > 0]).toEqual([dim, true]);
  });
});

/** Each counted dimension must be able to fail: the matrix, run against a broken copy of the function it feeds, goes red and names that dimension. */
const broken = (over: Partial<Subject>): Subject => ({ ...real, ...over });
const MUTANTS: { dimension: string; group: "M1" | "M2" | "M3"; what: string; subject: Subject }[] = [
  { dimension: "employee-id-format", group: "M1", what: "the ID reading keeps dashes and slashes", subject: broken({ normEmp: (raw: unknown, clean = false) => (clean ? (String(raw ?? "").trim() ? String(raw).normalize("NFKC").toUpperCase().replace(/[^A-Z0-9\-/.]/g, "").slice(0, 30) : "") : real.normEmp(raw, false)) }) },
  { dimension: "game-era", group: "M1", what: "an old game reads IDs the new way", subject: broken({ normEmp: (raw: unknown) => real.normEmp(raw, true) }) },
  { dimension: "email-format", group: "M1", what: "the address is compared with its case", subject: broken({ cleanEmail: (s: string) => String(s).normalize("NFKC").trim().replace(/\s+/g, "") }) },
  { dimension: "validation-mode", group: "M1", what: "'either' is read as 'mobile'", subject: broken({ verifyOf: ((e: any) => { const r = real.verifyOf(e); return r.mode === "either" ? { ...r, mode: "mobile" as const } : r; }) as Subject["verifyOf"] }) },
  { dimension: "employee-id-vs-email", group: "M1", what: "the ID reading is applied to an address and keeps the @", subject: broken({ normEmp: (raw: unknown, clean = false) => (String(raw).includes("@") ? String(raw).toUpperCase() : real.normEmp(raw, clean)) }) },
  { dimension: "dice-mode", group: "M2", what: "manual dice are played as automatic", subject: broken({ playRace: (cfg, input) => real.playRace({ ...cfg, play: "fate" }, input) }) },
  { dimension: "turn-limit", group: "M2", what: "the turn limit is 5 turns too long", subject: broken({ playRace: (cfg, input) => real.playRace({ ...cfg, turnCap: cfg.turnCap + 5 }, input) }) },
  { dimension: "end-prizes", group: "M2", what: "the game waits for one more finisher than the organizer chose", subject: broken({ playRace: (cfg, input) => real.playRace({ ...cfg, endPrizes: Math.min(5, cfg.endPrizes + 1) }, input) }) },
  { dimension: "finish-rule", group: "M2", what: "every game plays the 'pass' finish", subject: broken({ playRace: (cfg, input) => real.playRace({ ...cfg, board: { ...cfg.board, finish: "pass" } }, input) }) },
  { dimension: "players", group: "M2", what: "the last pawn is dropped", subject: broken({ playRace: (cfg, input) => { const st = real.playRace(cfg, input); st.runs = st.runs.slice(0, -1); return st; } }) },
  { dimension: "role", group: "M3", what: "a Co-host code is read as a Host", subject: broken({ parseFrom: ((f: unknown) => { const p = real.parseFrom(f); return p && p.kind === "cohost" ? { kind: "host" as const, hex: p.hex } : p; }) as Subject["parseFrom"] }) },
  { dimension: "link-type", group: "M3", what: "a personal link is case-sensitive", subject: broken({ tokenHash: (async (t: string) => createHash("sha256").update("pj|" + t).digest("hex").slice(0, 32)) as Subject["tokenHash"] }) },
  { dimension: "screen-state", group: "M3", what: "the rules row shows in every state", subject: broken({ rules: { ...real.rules, showRules: () => true } }) },
  { dimension: "theme", group: "M3", what: "any theme text is passed through", subject: broken({ rules: { ...real.rules, look: (t: unknown) => String(t) } }) },
];
describe("every counted dimension can fail (matrix against a broken copy)", () => {
  for (const m of MUTANTS) test(`${m.dimension}: ${m.what}`, async () => {
    const run = m.group === "M1" ? runIdentity : m.group === "M2" ? runGame : runLinks;
    const c = await run(m.subject, { stopAfterFailures: 1 });
    expect(c.fail).toBeGreaterThan(0);
    expect(c.byDimension[m.dimension]?.fail ?? 0).toBeGreaterThan(0);
  });
});
