// The owner's wording rules of 25 Nov 2026, kept true by a scan of every word a person can read (pages, page scripts, Worker messages, mails, the ten facts, llms.txt).
//   1. The word "nickname" is gone everywhere (a player gives a name).
//   2. game / player; co-organizer, never host or co-host; no ticket (there are no tickets in this game); no participant; no guest.
//   3. One payment word set: "Pay now" and "credits". No checkout, buy now, purchase, top up or recharge in what people read.
//   4. Razorpay is never named on a marketing page (it may be named on the payment pages and in the legal documents).
//   5. Never my, mine, your or yours in what people read, except the exact sentence "Copy this link and paste in your AI to work."
// Legal documents are not edited without the lawyer (terms, dpa, privacy, ...), and consent.js holds the recorded tick-box sentences tied to Terms version 2026-11-01: both are left out on purpose.
// Rules 2, 3 and 5 still have older text in the organizer console, the error guide and the Worker's messages; the allowances below (wording-baseline.json) count it, can only go DOWN, and a file that is clean is listed with 0.
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { ROOT, rd, ls, hitsIn } from "./wording-scan";
import { MARKETING, RULES, USER_FILES, countIn } from "./wording-set";

const baseline: Record<string, Record<string, number>> = JSON.parse(rd("apps/web/test/wording-baseline.json"));

describe("rule 1: the word nickname is gone from everything", () => {
  const dirs = ["apps/web/public", "site", "apps/edge/src", "packages/shared/src", "packages/beacon/src", "packages/billing/src", "pages/functions", "apps/cron"];
  const walk = (rel: string, out: string[] = []): string[] => {
    let ents: import("node:fs").Dirent[] = [];
    try { ents = readdirSync(`${ROOT}/${rel}`, { withFileTypes: true }); } catch { return out; }
    for (const e of ents) { if (e.name === "node_modules" || e.name === "vendor" || e.name.startsWith(".")) continue; const p = `${rel}/${e.name}`; if (e.isDirectory()) walk(p, out); else if (/\.(html|js|mjs|ts|json|txt|md|css|svg|webmanifest|toml)$/.test(e.name)) out.push(p); }
    return out;
  };
  const files = [...dirs.flatMap((d) => walk(d)), "README.md", "docs/RULES.md", "docs/SPEC.md", "docs/PRIVACY_AND_LIFECYCLE.md"];
  test("the scan reads many files, then finds the word in none of them (pages, scripts, the bundles, Worker source, release notes, the rules documents)", () => {
    expect(files.length).toBeGreaterThan(150);
    const bad = files.filter((f) => /nicknames?/i.test(rd(f))).map((f) => f);
    expect(bad).toEqual([]);
  });
  test("the scan itself would catch the word", () => { expect(/nicknames?/i.test("Type a Nickname")).toBe(true); });
});

describe("rules 2, 3 and 5: the words people read", () => {
  for (const rule of Object.keys(RULES)) {
    test(`${RULES[rule]!.what}: no file reads worse than its allowance (wording-baseline.json)`, () => {
      const over: string[] = [];
      for (const f of RULES[rule]!.files) {
        const allowed = baseline[rule]?.[f] ?? 0, { n, hits } = countIn(rule, f);
        if (n > allowed) over.push(`${f}: ${n} (allowed ${allowed})\n    ${hits.slice(0, 3).join("\n    ")}`);
      }
      expect(over).toEqual([]);
    });
    test(`${RULES[rule]!.what}: an allowance is never higher than what the file really holds (so it can only go down)`, () => {
      const stale: string[] = [];
      for (const [f, allowed] of Object.entries(baseline[rule] ?? {})) { const { n } = countIn(rule, f); if (n < allowed) stale.push(`${f}: holds ${n}, allowed ${allowed}`); }
      expect(stale).toEqual([]);
    });
  }
  test("the one allowed sentence is the only place a pronoun may stand in a clean file, and only exactly as written", () => {
    const ok = "Copy this link and paste in your AI to work.";
    expect(hitsIn("x.html", `<p>${ok}</p>`, RULES.pronoun!.re)).toEqual([]);
    expect(hitsIn("x.html", `<p>Copy this link and paste in your AI.</p>`, RULES.pronoun!.re).length).toBe(1);
    expect(hitsIn("x.html", `<p>${ok} Open your game.</p>`, RULES.pronoun!.re).length).toBe(1);
  });
  test("the scan sees what a person reads and ignores code (an id or a kind value is not a sentence)", () => {
    expect(hitsIn("x.js", `const k = "host"; if (a.kind === "host") go("cohost"); const s = "Add a Host";`, RULES.host!.re).length).toBe(1);
    expect(hitsIn("x.html", `<div class="host" id="hostadd">Hosting is fine</div><p>Ask the Host</p>`, RULES.host!.re).length).toBe(1);
  });
});

describe("rule 4: Razorpay is not named on a marketing page", () => {
  test("the home page, about, brochure, organizer guide, pricing, demo, contact, partner and the home page script say nothing about Razorpay", () => {
    const bad = MARKETING.filter((f) => f.endsWith(".html") || f.endsWith(".js") || f.endsWith(".txt")).flatMap((f) => hitsIn(f, rd(f), /razorpay/gi));
    expect(bad).toEqual([]);
  });
  test("payment pages and legal documents may still name the gateway (the payer should know), so the rule is about marketing only", () => {
    expect(hitsIn("apps/web/public/pay.js", rd("apps/web/public/pay.js"), /razorpay/gi).length).toBeGreaterThan(0);
  });
});

describe("rule 3: the pay button and the money words", () => {
  test("the console and the pay page say Pay now, and the money is called credit/credits", () => {
    expect(rd("apps/web/public/zc.js").includes("Pay now")).toBe(true);
    expect(rd("apps/web/public/paykit.js").includes("Pay now")).toBe(true);
    expect(/credit/.test(rd("apps/web/public/zc.js"))).toBe(true);
  });
});

describe("consent: no new tick boxes, no new \"I agree\" lines, no Hindi consent lines", () => {
  // The recorded consent boxes (K1 to K6) are a legal act tied to Terms version 2026-11-01: they stay as they are until the owner decides on a new Terms version (docs/KNOWLEDGE.md section 7).
  // Everything else is counted so that nothing new can be added: a file that is not listed here holds none.
  const TICK_BOXES: Record<string, number> = { "apps/web/public/guide.js": 3, "apps/web/public/zc.js": 6 };
  const I_AGREE: Record<string, number> = { "apps/web/public/consent.js": 4, "apps/edge/src/consent-text.json": 4 };
  const files = [...ls("apps/web/public", /\.(html|js)$/), ...ls("apps/edge/src", /\.(ts|json)$/), ...ls("site", /\.html$/)];
  test("tick boxes (input type checkbox) appear only where they were before", () => {
    const over = files.filter((f) => (rd(f).match(/type=\\?["']?checkbox/gi)?.length ?? 0) > (TICK_BOXES[f] ?? 0));
    expect(over).toEqual([]);
  });
  test("the words I agree appear only in the recorded consent sentences", () => {
    const over = files.filter((f) => (rd(f).match(/\bI agree\b/gi)?.length ?? 0) > (I_AGREE[f] ?? 0));
    expect(over).toEqual([]);
  });
  test("no Hindi (Devanagari) text anywhere a person reads", () => {
    expect(files.filter((f) => /[\u0900-\u097F]/.test(rd(f)))).toEqual([]);
  });
});
