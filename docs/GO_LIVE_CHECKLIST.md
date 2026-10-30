# GO-LIVE CHECKLIST: Corporate Snakes and Ladders (TEST mode stays TEST)
Copied from handover 400 (boss, 30 Oct 2026) and adapted to this game. Nothing goes live until EVERY row is ticked with evidence (test name, commit, screenshot path, deployment id). N/A only with a written reason. Branch: release/snakes-1.4.0. Keep PARITY_MAP.md in step.
Legend: [x] done with evidence; [~] partly done (what is missing is written); [ ] not done; [N/A] reason given.
Nothing below has been run in a browser or on the cloud yet. "Tests" means single files run locally.

## A. Identity and lists
- [~] A1 Employee ID cleaner. Evidence: people.ts cleanEmpId; apps/edge/test/empid-clean.test.ts (7 pass: four examples, 30 cap, empty refused, break check); commit a717293. Missing: plain-words refusal on the join page and organizer screens not checked in a browser.
- [~] A2 Every path. Done: list add (people.ts), join "who" and join (worker.ts); the hash uses the cleaned value. Missing: the console pre-check in zc.js still reads IDs the old way; exports, reports, family, Host/Co-host and the console bridge are not audited.
- [~] A3 Email cleaner. Evidence: emailclean.ts, email-clean.test.ts (17 pass), commit 9d4ad88, used in 11 server files. Missing: "typed email in an ID-criterion game is refused plainly" needs the Email ID criterion (A7).
- [ ] A4 Duplicates after cleaning flagged by name. Today they only count in the existing duplicates figure.
- [~] A5 Hint "The system will read this as 1B678" on the join page (z.js, commit a717293). Missing: email hint, organizer list screens, browser proof.
- [~] A6 Old games keep the old reading: empCleanFor and the test "a game made before the switch" (a717293). EMP_CLEAN_FROM_MS is a PLACEHOLDER (year 2100): the boss sets it to the deploy instant.
- [ ] A7 Criterion choice Employee ID or Email ID, list decides. Not built (next milestone).
- [ ] A8 Test addresses only demoN@demo-test.invalid, fake mobiles, tag TEST-RUN. Existing test logins are demo1/2/3 with code 123456 in TEST mode only (gap wave 1, WP-17); the address format is not checked.

## B. Organizer (5 steps + dashboard)
- [ ] B1 Step 1 date/time, occasion, time zone, how the game starts, who rolls (dice by themselves or Press to Roll Out the Next Number).
- [ ] B2 Step 2 who is it for, validation, criterion, list upload/paste/viewer 600+ rows, list check.
- [N/A] B3 Tickets, houses, Super Bumper, Lucky Draw prize, A/B: Tambola only (note 34). This game's step 3 has board size, snakes, ladders, finish rule, players-home count and prizes per finisher position (to be built into the new step 3).
- [ ] B4 Brand and Breaks (zc.js already has breaks and a brand moment; new-screen port not done).
- [ ] B5 Check and publish with warning and read-back, Host/Co-host emails, payment, rehearsals.
- [ ] B6 Game dashboard: Game ID, status pills with plain banners, share card, payment, rehearsals, waiting table, board, prizes, feed.
- [ ] B7 Previous-screens link both ways (?flow=old), remembered per browser.
- [ ] B8 Existing games open correctly in the new console.
(zc.js is separate from Tambola's pack/ flow; porting plan is PARITY_MAP row 18.)

## C. Roles
- [ ] C1 Host.
- [ ] C2 Co-host (a Co-host accept flow exists today; limits and own-people admit to be ported).
- [ ] C3 Family Passes: only where this game's rules allow; owner decision needed. If not allowed: N/A with the decision written here.
- [ ] C4 Role screens say who approves whom; role chips.
- [ ] C5 Authorization negative tests (nobody approves themselves; cross-game).

## D. Join and approvals
- [ ] D1 Listed ID / email.
- [ ] D2 Open join (Name, Mobile, Email, automatic referral, cap, same person returns the same board).
- [ ] D3 Not-on-list approval by role, 30-minute limit.
- [~] D4 Consent, check-in, rehearsal join. Today consent.js exists and check-in stays for prize eligibility; version-safe consent and the stale-page "reload" answer are not ported.

## E. Before the game (participant)
- [ ] E1 Landing, not-listed, waiting, board before start, reconnect, in the new Retro/Modern look.

## F. During the game
- [~] F1 Dice rounds: the engine exists and is covered by packages/beacon race/play tests (cloud run pending); same dice on every phone by construction. "Turn x of N / ends when 5 players are home": sl08-ends-when test. Not re-verified here.
- [ ] F2 Retro and Modern look on phone/tablet/laptop; the board is the only rich element.
- [N/A] F3 Claims (CLAIM button, bogey, claim checking): this game has no claim; prizes follow finisher position.
- [ ] F3b Prizes per finisher position, results and ties, pause in all modes, manual roll button wording "Press to Roll Out the Next Number".
- [N/A] F4 Super Bumper, Super Ticket, Lucky Draw prize: Tambola only.

## G. After the game
- [~] G1 Thank-you: the end card has Share and WhatsApp today (z.js finalCard); the Rules row no longer shows after the game (screenrules.js, parity-matrix.test.ts, commit ce2b78b). Missing: strip at the top, wording per note 26, "Game completed" page 30 minutes after the end (needs the phone to know the end time: a small engine/view change), completed report email check.

## H. Messages and language
- [~] H1 Gap wave 1 removed "private" and fixed "ticket"/"engagement" wording on player pages (wp14-wording test). Missing: re-scan after all new pages; AI manual (ai-link.ts, ai-functions.ts) still has Tambola-era text; legal pages left for the lawyer; fairness wording true to this game's code.

## I. Look and feel
- [~] I1 Brand kit vendored; landing page has kit header and footer with a Version line (commit 4cb8dfc). The release date/time IST is a placeholder in release.json until release. Game pages and console not restyled.
- [ ] I2 Side-by-side compare against the mock (data\ui\ux-mock-5step), screen by screen. Not started.

## J. Payment and data
- [~] J1 Payee wording only IT Services by Rajat Agarwal (gap wave 1 review checked pay.ts). TEST mode takes no live payment, unchanged. Pay-later link 7 days not re-checked.
- [~] J2 Lifecycle constants in lifecycle.ts: purge 20 h, report link 19 h; pages quote them (gap wave 1). Game log 365 days not done; email key and rate-limit key deletion not checked.

## K. Tests (every release)
- [~] K1 Unit/logic: empid-clean, email-clean, parity-matrix, wp14-* files (local single files). Wire and smoke not run.
- [ ] K2 Regression of all earlier features: cloud run.
- [~] K3 Streamed matrix: parity-matrix.test.ts, 1,728,000 distinct screen-rule scenarios (dice mode x rounds x roles x links x states x devices x themes x finisher place). Screen rules only; a matrix over the real engine and the join/approval rules is still needed.
- [~] K4 One deliberate break per new rule: done for empid, email, Rules row, thank-you strip. Needed for every later rule.
- [ ] K5 Full suites per folder on the cloud, results branch read (worker.test.ts timed out locally in wave 1).
- [ ] K6 Typecheck 0 errors (not run).
- [ ] K7 One-Chrome check 360/768/1280 light+dark.
- [ ] K8 Skeptic audit.
- [ ] K9 Live gate.
- [ ] K10 Deploy with rollback id.
- [ ] K11 Live smoke.
- [ ] K12 version.json = commit (pages/version.mjs writes it at build).
- [ ] K13 Register 150 and this file updated.

## L. Master console
- [ ] L1 Row for this game, features from config/games.json (declared by the master-console session).
- [N/A] L2-L4 belong to the master console product.

## M. Campaign
- [ ] M1 Layer A. [ ] M2 Layer B real Chromium. [ ] M3 Layer C on the real site (TEST-RUN cleanup).

## Status
Not ready to go live. Done: gap wave 1 merge, ID and email cleaners, Rules row, landing header and footer. Next: Email ID criterion, console flow, player look, end pages, hardening ports, tests.
