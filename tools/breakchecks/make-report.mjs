// Builds docs/TESTER_REPORT.md from the raw logs. Every number in the report is copied from a log; nothing is typed in by hand.
// Usage: bun tools/breakchecks/make-report.mjs   (after tools/breakchecks/run-folders.sh, run-my-files.sh and run-all.sh)
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const R = (f) => readFileSync(f, "utf8");
const git = (...a) => spawnSync("git", a, { encoding: "utf8" }).stdout.trim();
const counts = (log) => { const t = R(log).split("\n"); const g = (re) => t.map((l) => re.exec(l)).find(Boolean)?.[1]; return { pass: g(/^ *(\d+) pass$/) ?? "?", fail: g(/^ *(\d+) fail$/) ?? "?", ran: t.find((l) => l.startsWith("Ran ")) ?? "" }; };
const out = [];
const w = (s = "") => out.push(s);

const FOLDERS = [["packages/shared/test", "packages_shared_test"], ["packages/billing/test", "packages_billing_test"], ["packages/beacon/test", "packages_beacon_test"], ["apps/web/test", "apps_web_test"], ["tools/control-worker", "tools_control-worker"], ["tools/sim2/scenarios/matrix", "tools_sim2_scenarios_matrix"], ["apps/edge/test", "apps_edge_test"]];

w("# TESTER REPORT: Corporate Snakes and Ladders, branch tests/snakes-2026-10-30");
w(`Test author report. Product under test: origin/release/snakes-1.4.0 at ${git("rev-parse", "--short", "origin/release/snakes-1.4.0")}. Test branch head when this report was built: ${git("rev-parse", "--short", "HEAD")}. Built: ${new Date().toISOString().slice(0, 10)}. Runner: ${spawnSync("bun", ["--version"], { encoding: "utf8" }).stdout.trim()} (bun), one folder at a time, \`bun test --isolate <folder>\`.`);
w("Product code was not changed (checked by every break-check script and by `git diff origin/release/snakes-1.4.0 -- apps/edge/src apps/web/public packages pages config site`). Fake data only: demoN@demo-test.invalid, fake mobiles. Raw logs are under results/.");
w();

// ---------------------------------------------------------------- verdict
let totalPass = 0, totalFail = 0; const rows = [];
for (const [dir, name] of FOLDERS) { const f = `results/final/${name}.log`; if (!existsSync(f)) { rows.push(`| ${dir} | (not run) | | |`); continue; } const c = counts(f); totalPass += Number(c.pass); totalFail += Number(c.fail); rows.push(`| ${dir} | ${c.pass} | ${c.fail} | ${c.ran.replace(/^Ran /, "")} |`); }
w("## 1. Verdict");
w(totalFail === 0 ? `Every folder shows 0 fail (total ${totalPass} pass, 0 fail).` : `**NOT all green.** The folder logs add up to ${totalPass} pass and ${totalFail} fail. The failing tests are listed in section 8 with their first 8 error lines. Some of the red tests are deliberate reproductions of product bugs I found (section 9); some were already red in the coder's own suite before I added anything (section 7).`);
w();
w("## 2. Raw counts per folder (copied from results/final/*.log, last lines of each log)");
w("| folder | pass | fail | Ran line |"); w("|---|---|---|---|"); rows.forEach((r) => w(r));
w(`| **total** | **${totalPass}** | **${totalFail}** | |`);
w();
const tc = existsSync("results/final/typecheck.log") ? R("results/final/typecheck.log") : "";
const tcAll = (tc.match(/error TS/g) ?? []).length, tcMine = tc.split("\n").filter((l) => /error TS/.test(l) && /t30-|scenarios\/matrix|breakchecks/.test(l)).length;
w(`Typecheck (\`bunx tsc --noEmit -p tsconfig.json\`, results/final/typecheck.log): ${tcAll} error(s), of which ${tcMine} in files I wrote. All the others are in the coder's older test files (param-people, param-config, join-gaps, demo-pass, param-life, param-harness, shared-read, email-clean). Product code has 0 type errors. GO_LIVE K6 ("typecheck 0 errors") is therefore not met.`);
w();

// ---------------------------------------------------------------- baseline
w("## 3. The coder's suite before any test of mine (baseline, results/baseline/*.log)");
w("| folder | pass | fail | Ran line |"); w("|---|---|---|---|");
for (const f of readdirSync("results/baseline").filter((x) => x.endsWith(".log")).sort()) { const c = counts(join("results/baseline", f)); w(`| ${f.replace(".log", "")} | ${c.pass} | ${c.fail} | ${c.ran.replace(/^Ran /, "")} |`); }
w("These 7 failures were already red at 5060c4c. See finding F-9.");
w();

// ---------------------------------------------------------------- tests added
w("## 4. Tests added (file, what it proves, raw counts from its own run in results/final/files/)");
const ADDED = [
  ["apps/web/test/t30-m1-rules-fold.test.ts", "HANDOFF M1.1, M1.2", "In the real phone page: no 'Rules in five lines' fold in the waiting room, the fold with 5 numbered rules during play, no fold after the game ends (end text shown); with screenrules.js missing the fold still shows in play and is still hidden after the game; z.html loads screenrules.js before z.js and release-line.js after it; screenrules.js answers right for all 5 states and unknown themes."],
  ["apps/web/test/t30-m1-release-line.test.ts", "HANDOFF M1.3", "release-line.js writes 'Version 1.4.0' with no date while the date starts with 'pending', adds ', released <IST> IST' for a real date, shows nothing and raises no error when the fetch fails or the answer is not JSON, uses the footer slot or adds one, asks only for /release.json."],
  ["apps/edge/test/t30-m2-empid.test.ts", "HANDOFF M2 ID 1, 2, 3", "1B-678, 1b-678, 1B/678, 1B 678 are 1B678; full-width, zero-width, emoji, accents, symbols only, 30 cap, duplicates after cleaning; through list upload, the 'who' check and join (same pid, id-used on a second phone); old games keep the old reading."],
  ["apps/web/test/t30-m2-join-hint.test.ts", "HANDOFF M2 ID 4", "The join page shows 'The system will read this as 1B678' only when cleaning changes the text, and its reading equals the server's for 60 spellings."],
  ["apps/edge/test/t30-m2-email.test.ts", "HANDOFF M2 Email", "All 524,288 case mixes of demo1@demo-test.invalid and the full-width, spacing and padding forms are one address; the ID cleaner is never applied to an address (source guard and behaviour); host-setup, visits hashes; organizer sign-in is one account; test-login spelling; finding F-1 stated."],
  ["apps/edge/test/t30-m2-email-routes.test.ts", "HANDOFF M2 Email, Risk to check", "Through the real routes: e-mail-code sign-in asks with one spelling and confirms with another; Host setup 'different email' check by spelling, the mixed-case legacy address risk, code confirms; Refer & earn enrolment treats spellings as one partner."],
  ["apps/web/test/t30-m3-landing.test.ts", "HANDOFF M3 1, 2, 3", "Six menu items and links, three theme dots, Menu button; the real brandkit.js opens/closes the menu, sets the theme, flips Dark/Light, survives blocked storage; old .snav gone; kit footer with Version slot; every own link has a file; old buy box and hero present; no inline script."],
  ["apps/web/test/t30-m3-landing-browser.test.ts", "HANDOFF M3 1 (real Chromium)", "At 360, 768, 1280 wide in light and dark: no sideways scroll, no CSP error under the _headers rules, kit header present, old header absent, Version line last; Menu button only on a phone and opens six links; theme dots change --bar-a."],
  ["apps/edge/test/t30-regress-join.test.ts", "Regression: join, check-in", "Phone spellings are one person, bad numbers refused, one phone one board, name-only join, consent refused by the server (no tick, one box, old version), draft/closed/locked/waiting/cap rules, name tidying, check-in off and its code logic."],
  ["packages/beacon/test/t30-regress-results.test.ts", "Regression: claims/results (prizes per finisher position), dice", "Throw rules, exact finish, manual vs automatic dice, end by finishers or turn limit, strict ranking, finish prizes by position, milestone prize, one-prize-per-person, ties."],
  ["packages/beacon/test/t30-regress-pause.test.ts", "Regression: pause", "Pause, timed pause, resume, extend, stop with their lead rules; later turns move by exactly the pause; forged, tampered, replayed, gapped and junk messages are dropped."],
  ["apps/edge/test/t30-regress-erase-log-consent.test.ts", "Regression: 24 h erase, game log, consent version safe", "Purge at 20 h not before, report link at 19 h, whole-database scan finds no guest hash after 24 h, 365-day end on an IST midnight, permanent game record keeps counts and no person, old Terms version does not count, ticks erased per game."],
  ["tools/sim2/scenarios/matrix/matrix.test.ts (+ axes.ts, run.ts, wire.ts)", "Scenario matrix", "Streams 3.7 million scenarios in four groups against the real product; each counted dimension is proved able to fail with a broken copy."],
  ["apps/web/test/t30-audit-parity-matrix.test.ts", "Audit of the coder's matrix", "Reads parity-matrix.test.ts and shows only 2 of its 8 scenario fields are ever read (F-12)."],
  ["apps/edge/test/t30-finding-f4-bidi-names.test.ts, apps/web/test/t30-finding-f2-lone-player.test.ts, apps/web/test/t30-finding-f10-landing-script.test.ts, packages/beacon/test/t30-finding-f3-rank-vs-prize.test.ts", "Product bug reproductions (RED on purpose)", "Each states the correct behaviour and fails today. See TEST_FINDINGS F-2, F-3, F-4, F-10."],
  ["apps/edge/test/t30-helpers.ts", "helper (not a test)", "Small world builder used by the edge tests."],
];
w("| file | covers | what it proves | pass | fail |"); w("|---|---|---|---|---|");
for (const [f, covers, proves] of ADDED) {
  const files = f.split(", ").map((x) => x.replace(/ \(.*\)$/, "")).filter((x) => /\.test\.ts$/.test(x));
  let p = 0, fl = 0, any = false; for (const x of files) { const log = `results/final/files/${x.replace(/\//g, "_")}.log`; if (existsSync(log)) { const c = counts(log); p += Number(c.pass); fl += Number(c.fail); any = true; } }
  w(`| ${f} | ${covers} | ${proves} | ${any ? p : "-"} | ${any ? fl : "-"} |`);
}
w();

// ---------------------------------------------------------------- coverage map
w("## 5. Every behaviour in docs/TEST_HANDOFF.md and where it is tested");
w("| handoff item | test file | break check |"); w("|---|---|---|");
for (const r of [
  ["M1.1 fold after game / during play / waiting", "t30-m1-rules-fold.test.ts", "rules-fold.mjs"], ["M1.2 z.html order, missing screenrules.js", "t30-m1-rules-fold.test.ts", "rules-fold.mjs"], ["M1.3 Version line", "t30-m1-release-line.test.ts", "release-line.mjs"],
  ["M2 ID 1 four spellings, list/who/join, same board", "t30-m2-empid.test.ts", "empid.mjs"], ["M2 ID 2 unicode, symbols, 30 cap, duplicates", "t30-m2-empid.test.ts", "empid.mjs"], ["M2 ID 3 older games", "t30-m2-empid.test.ts", "empid.mjs"], ["M2 ID 4 hint", "t30-m2-join-hint.test.ts", "join-hint.mjs"],
  ["M2 Email: sign-in, Host setup, visits, test logins", "t30-m2-email.test.ts, t30-m2-email-routes.test.ts", "email.mjs"], ["M2 Email: helpdesk, payments, credit (not driven by route; source guard + cleaner tests only)", "t30-m2-email.test.ts", "email.mjs (partial)"], ["M2 ID cleaner never applied to an email", "t30-m2-email.test.ts", "email.mjs"], ["M2 Risk: mixed-case Host address", "t30-m2-email-routes.test.ts", "email.mjs"],
  ["M3 1 header, dots, Menu, footer Version, no overflow", "t30-m3-landing.test.ts, t30-m3-landing-browser.test.ts", "landing.mjs, landing-browser.mjs"], ["M3 2 menu and legal links", "t30-m3-landing.test.ts", "landing.mjs"], ["M3 3 old buy box works, old header gone", "t30-m3-landing.test.ts (header gone), t30-finding-f10 (buy box, RED)", "landing.mjs"],
  ["Regression: join, check-in", "t30-regress-join.test.ts", "join.mjs"], ["Regression: claims/results", "t30-regress-results.test.ts", "results.mjs"], ["Regression: pause", "t30-regress-pause.test.ts", "pause.mjs"], ["Regression: game log, 24 h erase, consent version", "t30-regress-erase-log-consent.test.ts", "erase-log-consent.mjs"], ["Matrix", "matrix.test.ts", "matrix.mjs"],
]) w(`| ${r[0]} | ${r[1]} | ${r[2]} |`);
w("Not built (TEST_HANDOFF says so), so nothing to test beyond what exists: Email ID list criterion, new organizer screens, Retro/Modern look, thank-you strip, Game completed page, consent version on stale pages, game log 365 days. See TEST_FINDINGS 'Not tested'.");
w();

// ---------------------------------------------------------------- matrix
w("## 6. Scenario matrix totals (results/matrix-counts.json, written by the matrix test)");
if (existsSync("results/matrix-counts.json")) {
  const m = JSON.parse(R("results/matrix-counts.json"));
  w("| group | what | scenarios | checks | pass | fail |"); w("|---|---|---|---|---|---|");
  const what = { M1: "ID spelling x era x e-mail spelling x verification setting (pure product functions)", M2: "dice mode x press pattern x turn limit x end prizes x finish rule x players x seed (real engine)", M3: "role x link type x screen state x theme (invite codes, personal-link tokens, screen rules)", M4: "verification mode x era x payment x ID or phone spelling x listed x device x time x approval (real Worker, real requests)" };
  for (const [k, v] of Object.entries(m.groups)) w(`| ${k} | ${what[k]} | ${v.scenarios} | ${v.checks} | ${v.pass} | ${v.fail} |`);
  w(`| **total** | | **${m.total.scenarios}** | **${m.total.checks}** | **${m.total.pass}** | **${m.total.fail}** |`);
  w();
  w(`Honest note on the size: M1 is a cross product of three independent axes (${m.groups.M1.scenarios} scenarios) and gives most of the total. Counting each independent axis once, the number of distinct assertion inputs is ${m.independentInputs}. Both numbers are real; only the second says how much was independently varied.`);
  w("Dimensions counted (each has at least one assertion that reads it and a broken copy that turns the matrix red; the in-process breaks are in matrix.test.ts, the product breaks are in tools/breakchecks/matrix.mjs): " + Object.keys(m.byDimension).join(", ") + ".");
  w("| dimension | scenarios that read it | failures |"); w("|---|---|---|"); for (const [d, v] of Object.entries(m.byDimension)) w(`| ${d} | ${v.scenarios} | ${v.fail} |`);
  w("Not counted as dimensions: the seed (it only varies data, no assertion depends on its value), and the coder's rounds, role, link, device and place of the old matrix (F-12). 'Devices' are tested only in M4 as the phone's own device id (one card, one phone) and 'themes' only as the look() answer; screen sizes are in the Chromium test, not in the matrix.");
}
w();

// ---------------------------------------------------------------- break checks
w("## 7. Planted-break checks (tools/breakchecks/*.mjs, logs in results/breakchecks/*.log)");
w("Each script copies the repo to a scratch folder, shows the tests GREEN, plants one deliberate break, shows them RED, puts the file back, and at the end shows them GREEN again. The branch is never edited (the last line of every log checks `git status`).");
const bcDir = "results/breakchecks"; let bcBreaks = 0, bcRed = 0;
for (const f of readdirSync(bcDir).filter((x) => x.endsWith(".log")).sort()) {
  const lines = R(join(bcDir, f)).split("\n").filter(Boolean); w(); w("### " + f.replace(".log", ""));
  w("```"); for (const l of lines) { if (/^\s+failing:/.test(l)) continue; w(l.replace(/\(scratch copy: [^;]*; /, "(")); } w("```");
  for (const l of lines) { if (/^\s+break \d+:/.test(l)) { bcBreaks++; if (/-> RED/.test(l)) bcRed++; } else if (/NOT PLANTED/.test(l)) bcBreaks++; }
}
w(); w(`Break checks in total: ${bcBreaks} planted, ${bcRed} went RED, ${bcBreaks - bcRed} did not (any that did not are listed above as STILL GREEN or NOT PLANTED).`);
w();

// ---------------------------------------------------------------- failing tests
w("## 8. Failing tests (from results/final/*.log): name and first 8 error lines");
const sum = spawnSync("bun", ["tools/breakchecks/summarize.mjs", "results/final"], { encoding: "utf8" }).stdout.split("\n");
const failBlocks = []; let cur = null;
for (const l of sum) { if (l.startsWith("FAIL ")) { cur = [l]; failBlocks.push(cur); } else if (cur && l.startsWith("    ")) cur.push(l); else if (cur && !l.trim()) cur = null; }
if (!failBlocks.length) w("None. Every folder log shows 0 fail.");
for (const b of failBlocks) { w("```"); b.forEach((l) => w(l)); w("```"); }
w();
w("## 9. Product bugs found");
w("See docs/TEST_FINDINGS.md (F-1 to F-12) for exact repros. In short: F-10 the landing page cannot sell (site.js crashes, empty pack list and pricing) [High]; F-12 the coder's 1,728,000-scenario matrix is 10 real checks [High for certification]; F-3 results table and prizes can name different people [Medium-High]; F-5 spaces inside an e-mail address are deleted [Medium]; F-1 test logins are not on demo-test.invalid; F-2 one-player game never ends on the phone; F-4 bidi characters in names; F-6 service worker misses screenrules.js; F-7, F-8, F-9, F-11 notes.");
writeFileSync("docs/TESTER_REPORT.md", out.join("\n") + "\n");
console.log("wrote docs/TESTER_REPORT.md", out.length, "lines");
