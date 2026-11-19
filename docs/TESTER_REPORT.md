# TESTER REPORT: Corporate Snakes and Ladders, branch tests/snakes-2026-10-30
Test author report. Product under test: origin/release/snakes-1.4.0 at 5060c4c. Test branch head when this report was built: d898e0f. Built: 2026-10-30. Runner: 1.4.4 (bun), one folder at a time, `bun test --isolate <folder>`.
Product code was not changed (checked by every break-check script and by `git diff origin/release/snakes-1.4.0 -- apps/edge/src apps/web/public packages pages config site`). Fake data only: demoN@demo-test.invalid, fake mobiles. Raw logs are under results/.

## 1. Verdict
**NOT all green.** The folder logs add up to 1844 pass and 22 fail. The failing tests are listed in section 8 with their first 8 error lines. Some of the red tests are deliberate reproductions of product bugs I found (section 9); some were already red in the coder's own suite before I added anything (section 7).

## 2. Raw counts per folder (copied from results/final/*.log, last lines of each log)
| folder | pass | fail | Ran line |
|---|---|---|---|
| packages/shared/test | 10 | 0 | 10 tests across 1 file. [32.00ms] |
| packages/billing/test | 26 | 0 | 26 tests across 1 file. [30.00ms] |
| packages/beacon/test | 155 | 2 | 157 tests across 13 files. [19.65s] |
| apps/web/test | 182 | 7 | 189 tests across 32 files. [44.15s] |
| tools/control-worker | 1 | 0 | 1 test across 1 file. [53.00ms] |
| tools/sim2/scenarios/matrix | 19 | 0 | 19 tests across 1 file. [19.66s] |
| apps/edge/test | 1451 | 13 | 1464 tests across 85 files. [119.51s] |
| **total** | **1844** | **22** | |

Typecheck (`bunx tsc --noEmit -p tsconfig.json`, results/final/typecheck.log): 68 error(s), of which 0 in files I wrote. All the others are in the coder's older test files (param-people, param-config, join-gaps, demo-pass, param-life, param-harness, shared-read, email-clean). Product code has 0 type errors. GO_LIVE K6 ("typecheck 0 errors") is therefore not met.

## 3. The coder's suite before any test of mine (baseline, results/baseline/*.log)
| folder | pass | fail | Ran line |
|---|---|---|---|
| apps_edge_test | 1372 | 4 | 1376 tests across 79 files. [119.40s] |
| apps_web_test | 134 | 3 | 137 tests across 24 files. [19.60s] |
| packages_beacon_test | 115 | 0 | 115 tests across 10 files. [15.61s] |
| packages_billing_test | 26 | 0 | 26 tests across 1 file. [150.00ms] |
| packages_shared_test | 10 | 0 | 10 tests across 1 file. [111.00ms] |
| tools_control-worker | 1 | 0 | 1 test across 1 file. [73.00ms] |
These 7 failures were already red at 5060c4c. See finding F-9.

## 4. Tests added (file, what it proves, raw counts from its own run in results/final/files/)
| file | covers | what it proves | pass | fail |
|---|---|---|---|---|
| apps/web/test/t30-m1-rules-fold.test.ts | HANDOFF M1.1, M1.2 | In the real phone page: no 'Rules in five lines' fold in the waiting room, the fold with 5 numbered rules during play, no fold after the game ends (end text shown); with screenrules.js missing the fold still shows in play and is still hidden after the game; z.html loads screenrules.js before z.js and release-line.js after it; screenrules.js answers right for all 5 states and unknown themes. | 6 | 0 |
| apps/web/test/t30-m1-release-line.test.ts | HANDOFF M1.3 | release-line.js writes 'Version 1.4.0' with no date while the date starts with 'pending', adds ', released <IST> IST' for a real date, shows nothing and raises no error when the fetch fails or the answer is not JSON, uses the footer slot or adds one, asks only for /release.json. | 10 | 0 |
| apps/edge/test/t30-m2-empid.test.ts | HANDOFF M2 ID 1, 2, 3 | 1B-678, 1b-678, 1B/678, 1B 678 are 1B678; full-width, zero-width, emoji, accents, symbols only, 30 cap, duplicates after cleaning; through list upload, the 'who' check and join (same pid, id-used on a second phone); old games keep the old reading. | 23 | 0 |
| apps/web/test/t30-m2-join-hint.test.ts | HANDOFF M2 ID 4 | The join page shows 'The system will read this as 1B678' only when cleaning changes the text, and its reading equals the server's for 60 spellings. | 4 | 0 |
| apps/edge/test/t30-m2-email.test.ts | HANDOFF M2 Email | All 524,288 case mixes of demo1@demo-test.invalid and the full-width, spacing and padding forms are one address; the ID cleaner is never applied to an address (source guard and behaviour); host-setup, visits hashes; organizer sign-in is one account; test-login spelling; finding F-1 stated. | 18 | 0 |
| apps/edge/test/t30-m2-email-routes.test.ts | HANDOFF M2 Email, Risk to check | Through the real routes: e-mail-code sign-in asks with one spelling and confirms with another; Host setup 'different email' check by spelling, the mixed-case legacy address risk, code confirms; Refer & earn enrolment treats spellings as one partner. | 5 | 0 |
| apps/web/test/t30-m3-landing.test.ts | HANDOFF M3 1, 2, 3 | Six menu items and links, three theme dots, Menu button; the real brandkit.js opens/closes the menu, sets the theme, flips Dark/Light, survives blocked storage; old .snav gone; kit footer with Version slot; every own link has a file; old buy box and hero present; no inline script. | 17 | 0 |
| apps/web/test/t30-m3-landing-browser.test.ts | HANDOFF M3 1 (real Chromium) | At 360, 768, 1280 wide in light and dark: no sideways scroll, no CSP error under the _headers rules, kit header present, old header absent, Version line last; Menu button only on a phone and opens six links; theme dots change --bar-a. | 8 | 0 |
| apps/edge/test/t30-regress-join.test.ts | Regression: join, check-in | Phone spellings are one person, bad numbers refused, one phone one board, name-only join, consent refused by the server (no tick, one box, old version), draft/closed/locked/waiting/cap rules, name tidying, check-in off and its code logic. | 21 | 0 |
| packages/beacon/test/t30-regress-results.test.ts | Regression: claims/results (prizes per finisher position), dice | Throw rules, exact finish, manual vs automatic dice, end by finishers or turn limit, strict ranking, finish prizes by position, milestone prize, one-prize-per-person, ties. | 21 | 0 |
| packages/beacon/test/t30-regress-pause.test.ts | Regression: pause | Pause, timed pause, resume, extend, stop with their lead rules; later turns move by exactly the pause; forged, tampered, replayed, gapped and junk messages are dropped. | 19 | 0 |
| apps/edge/test/t30-regress-erase-log-consent.test.ts | Regression: 24 h erase, game log, consent version safe | Purge at 20 h not before, report link at 19 h, whole-database scan finds no guest hash after 24 h, 365-day end on an IST midnight, permanent game record keeps counts and no person, old Terms version does not count, ticks erased per game. | 12 | 0 |
| tools/sim2/scenarios/matrix/matrix.test.ts (+ axes.ts, run.ts, wire.ts) | Scenario matrix | Streams 3.7 million scenarios in four groups against the real product; each counted dimension is proved able to fail with a broken copy. | - | - |
| apps/web/test/t30-audit-parity-matrix.test.ts | Audit of the coder's matrix | Reads parity-matrix.test.ts and shows only 2 of its 8 scenario fields are ever read (F-12). | 3 | 0 |
| apps/edge/test/t30-finding-f4-bidi-names.test.ts, apps/web/test/t30-finding-f2-lone-player.test.ts, apps/web/test/t30-finding-f10-landing-script.test.ts, packages/beacon/test/t30-finding-f3-rank-vs-prize.test.ts | Product bug reproductions (RED on purpose) | Each states the correct behaviour and fails today. See TEST_FINDINGS F-2, F-3, F-4, F-10. | 0 | 15 |
| apps/edge/test/t30-helpers.ts | helper (not a test) | Small world builder used by the edge tests. | - | - |

## 5. Every behaviour in docs/TEST_HANDOFF.md and where it is tested
| handoff item | test file | break check |
|---|---|---|
| M1.1 fold after game / during play / waiting | t30-m1-rules-fold.test.ts | rules-fold.mjs |
| M1.2 z.html order, missing screenrules.js | t30-m1-rules-fold.test.ts | rules-fold.mjs |
| M1.3 Version line | t30-m1-release-line.test.ts | release-line.mjs |
| M2 ID 1 four spellings, list/who/join, same board | t30-m2-empid.test.ts | empid.mjs |
| M2 ID 2 unicode, symbols, 30 cap, duplicates | t30-m2-empid.test.ts | empid.mjs |
| M2 ID 3 older games | t30-m2-empid.test.ts | empid.mjs |
| M2 ID 4 hint | t30-m2-join-hint.test.ts | join-hint.mjs |
| M2 Email: sign-in, Host setup, visits, test logins | t30-m2-email.test.ts, t30-m2-email-routes.test.ts | email.mjs |
| M2 Email: helpdesk, payments, credit (not driven by route; source guard + cleaner tests only) | t30-m2-email.test.ts | email.mjs (partial) |
| M2 ID cleaner never applied to an email | t30-m2-email.test.ts | email.mjs |
| M2 Risk: mixed-case Host address | t30-m2-email-routes.test.ts | email.mjs |
| M3 1 header, dots, Menu, footer Version, no overflow | t30-m3-landing.test.ts, t30-m3-landing-browser.test.ts | landing.mjs, landing-browser.mjs |
| M3 2 menu and legal links | t30-m3-landing.test.ts | landing.mjs |
| M3 3 old buy box works, old header gone | t30-m3-landing.test.ts (header gone), t30-finding-f10 (buy box, RED) | landing.mjs |
| Regression: join, check-in | t30-regress-join.test.ts | join.mjs |
| Regression: claims/results | t30-regress-results.test.ts | results.mjs |
| Regression: pause | t30-regress-pause.test.ts | pause.mjs |
| Regression: game log, 24 h erase, consent version | t30-regress-erase-log-consent.test.ts | erase-log-consent.mjs |
| Matrix | matrix.test.ts | matrix.mjs |
Not built (TEST_HANDOFF says so), so nothing to test beyond what exists: Email ID list criterion, new organizer screens, Retro/Modern look, thank-you strip, Game completed page, consent version on stale pages, game log 365 days. See TEST_FINDINGS 'Not tested'.

## 6. Scenario matrix totals (results/matrix-counts.json, written by the matrix test)
| group | what | scenarios | checks | pass | fail |
|---|---|---|---|---|---|
| M1 | ID spelling x era x e-mail spelling x verification setting (pure product functions) | 3709440 | 33384960 | 3709440 | 0 |
| M2 | dice mode x press pattern x turn limit x end prizes x finish rule x players x seed (real engine) | 8640 | 142560 | 8640 | 0 |
| M3 | role x link type x screen state x theme (invite codes, personal-link tokens, screen rules) | 3651 | 27001 | 3651 | 0 |
| M4 | verification mode x era x payment x ID or phone spelling x listed x device x time x approval (real Worker, real requests) | 708 | 1996 | 708 | 0 |
| **total** | | **3722439** | **33556517** | **3722439** | **0** |

Honest note on the size: M1 is a cross product of three independent axes (3709440 scenarios) and gives most of the total. Counting each independent axis once, the number of distinct assertion inputs is 11394. Both numbers are real; only the second says how much was independently varied.
Dimensions counted (each has at least one assertion that reads it and a broken copy that turns the matrix red; the in-process breaks are in matrix.test.ts, the product breaks are in tools/breakchecks/matrix.mjs): employee-id-format, game-era, email-format, validation-mode, employee-id-vs-email, dice-mode, turn-limit, end-prizes, finish-rule, players, role, link-type, screen-state, theme, payment-state, start-time, device, approval.
| dimension | scenarios that read it | failures |
|---|---|---|
| employee-id-format | 3710056 | 0 |
| game-era | 3710056 | 0 |
| email-format | 3709440 | 0 |
| validation-mode | 3710148 | 0 |
| employee-id-vs-email | 3709440 | 0 |
| dice-mode | 8640 | 0 |
| turn-limit | 8640 | 0 |
| end-prizes | 8640 | 0 |
| finish-rule | 8640 | 0 |
| players | 8640 | 0 |
| role | 1150 | 0 |
| link-type | 3651 | 0 |
| screen-state | 3650 | 0 |
| theme | 3650 | 0 |
| payment-state | 708 | 0 |
| start-time | 708 | 0 |
| device | 708 | 0 |
| approval | 616 | 0 |
Not counted as dimensions: the seed (it only varies data, no assertion depends on its value), and the coder's rounds, role, link, device and place of the old matrix (F-12). 'Devices' are tested only in M4 as the phone's own device id (one card, one phone) and 'themes' only as the look() answer; screen sizes are in the Chromium test, not in the matrix.

## 7. Planted-break checks (tools/breakchecks/*.mjs, logs in results/breakchecks/*.log)
Each script copies the repo to a scratch folder, shows the tests GREEN, plants one deliberate break, shows them RED, puts the file back, and at the end shows them GREEN again. The branch is never edited (the last line of every log checks `git status`).

### email
```
BREAKCHECK email  (tests: apps/edge/test/t30-m2-email.test.ts, apps/edge/test/t30-m2-email-routes.test.ts)
  baseline: GREEN  23 pass, 0 fail
  break 1: the cleaner no longer lower-cases  [apps/edge/src/emailclean.ts]  -> RED  9 pass, 14 fail
  break 2: the cleaner no longer folds the full-width at-sign  [apps/edge/src/emailclean.ts]  -> RED  11 pass, 12 fail
  break 3: the cleaner no longer removes inner spaces  [apps/edge/src/emailclean.ts]  -> RED  18 pass, 5 fail
  break 4: sign-in (start, e-mail code, verify) reads the address as typed  [apps/edge/src/worker.ts]  -> RED  20 pass, 3 fail
  break 5: the Host setup link hashes the address as typed  [apps/edge/src/hostsetup.ts]  -> RED  22 pass, 1 fail
  break 6: the visits hash uses the address as typed  [apps/edge/src/visits.ts]  -> RED  22 pass, 1 fail
  break 7: test logins are matched case-sensitively  [apps/edge/src/testlogins.ts]  -> RED  22 pass, 1 fail
  break 8: the employee ID cleaner is applied to e-mail in sign-in (merges a.b-c with abc)  [apps/edge/src/worker.ts]  -> RED  17 pass, 6 fail
  break 9: Host setup compares the address on file with the address typed case-sensitively  [apps/edge/src/hostsetup.ts]  -> RED  22 pass, 1 fail
  break 10: Refer & earn reads the address as typed (a second spelling becomes a second partner)  [apps/edge/src/partners.ts]  -> RED  22 pass, 1 fail
  restored: GREEN  23 pass, 0 fail
  branch product code untouched: yes
RESULT email: every planted break was caught
```

### empid
```
BREAKCHECK empid  (tests: apps/edge/test/t30-m2-empid.test.ts)
  baseline: GREEN  23 pass, 0 fail
  break 1: the cleaner keeps dashes (1B-678 stays 1B-678)  [apps/edge/src/people.ts]  -> RED  7 pass, 16 fail
  break 2: no Unicode folding: full-width letters are dropped  [apps/edge/src/people.ts]  -> RED  19 pass, 4 fail
  break 3: the 30 character cap becomes 31  [apps/edge/src/people.ts]  -> RED  20 pass, 3 fail
  break 4: symbols only is accepted as an empty ID instead of refused  [apps/edge/src/people.ts]  -> RED  19 pass, 4 fail
  break 5: a game created exactly at the switch instant is treated as old  [apps/edge/src/people.ts]  -> RED  22 pass, 1 fail
  break 6: organizer list upload ignores the new reading  [apps/edge/src/people.ts]  -> RED  19 pass, 4 fail
  break 7: the 'who' check ignores the new reading  [apps/edge/src/worker.ts]  -> RED  21 pass, 2 fail
  break 8: join ignores the new reading  [apps/edge/src/worker.ts]  -> RED  20 pass, 3 fail
  break 9: the old reading changes: dashes are dropped in old games too  [apps/edge/src/people.ts]  -> RED  19 pass, 4 fail
  break 10: the ID hash no longer depends on the ID (everyone is the same person)  [apps/edge/src/people.ts]  -> RED  16 pass, 7 fail
  restored: GREEN  23 pass, 0 fail
  branch product code untouched: yes
RESULT empid: every planted break was caught
```

### erase-log-consent
```
BREAKCHECK erase-log-consent  (tests: apps/edge/test/t30-regress-erase-log-consent.test.ts)
  baseline: GREEN  12 pass, 0 fail
  break 1: guests' data is kept 30 hours instead of 20  [apps/edge/src/lifecycle.ts]  -> RED  9 pass, 3 fail
  break 2: the report link outlives the data  [apps/edge/src/lifecycle.ts]  -> RED  11 pass, 1 fail
  break 3: the 365 days become 364  [apps/edge/src/lifecycle.ts]  -> RED  11 pass, 1 fail
  break 4: the deletion is not on an IST midnight  [apps/edge/src/lifecycle.ts]  -> RED  11 pass, 1 fail
  break 5: the erase leaves the participants  [apps/edge/src/lifecycle.ts]  -> RED  10 pass, 2 fail
  break 6: the erase leaves the seats  [apps/edge/src/lifecycle.ts]  -> RED  10 pass, 2 fail
  break 7: the erase leaves the guests' consent ticks  [apps/edge/src/lifecycle.ts]  -> RED  11 pass, 1 fail
  break 8: the end of 365 days never deletes the game  [apps/edge/src/worker.ts]  -> RED  11 pass, 1 fail
  break 9: the game record loses its count when the guests are gone  [apps/edge/src/gamerecord.ts]  -> RED  11 pass, 1 fail
  break 10: an acceptance of an old Terms version still counts  [apps/edge/src/consent.ts]  -> RED  11 pass, 1 fail
  break 11: the same acceptance is stored twice  [apps/edge/src/consent.ts]  -> RED  11 pass, 1 fail
  break 12: erasing a game's guests also erases the organizers' ticks for it  [apps/edge/src/consent.ts]  -> RED  11 pass, 1 fail
  break 13: any TERMS_VERSION text is accepted  [apps/edge/src/consent.ts]  -> RED  11 pass, 1 fail
  restored: GREEN  12 pass, 0 fail
  branch product code untouched: yes
RESULT erase-log-consent: every planted break was caught
```

### join-checkin
```
BREAKCHECK join-checkin  (tests: apps/edge/test/t30-regress-join.test.ts)
  baseline: GREEN  21 pass, 0 fail
  break 1: a second phone can take over a board  [apps/edge/src/worker.ts]  -> RED  20 pass, 1 fail
  break 2: a game that is not paid does not lock after its start  [apps/edge/src/worker.ts]  -> RED  20 pass, 1 fail
  break 3: sign-up stays open after the start  [apps/edge/src/worker.ts]  -> RED  20 pass, 1 fail
  break 4: a draft game accepts guests  [apps/edge/src/worker.ts]  -> RED  20 pass, 1 fail
  break 5: a 5-digit number is accepted as a mobile number  [apps/edge/src/worker.ts]  -> RED  20 pass, 1 fail
  break 6: the game has no cap (both guards removed)  [apps/edge/src/worker.ts + apps/edge/src/worker.ts]  -> RED  20 pass, 1 fail
  break 7: the Terms version is not checked  [apps/edge/src/consent.ts]  -> RED  20 pass, 1 fail
  break 8: not every consent box is needed  [apps/edge/src/consent.ts]  -> RED  20 pass, 1 fail
  break 9: the leading = + - @ of a name is kept (spreadsheet formula)  [apps/edge/src/people.ts]  -> RED  20 pass, 1 fail
  break 10: names may be longer than 60  [apps/edge/src/people.ts]  -> RED  20 pass, 1 fail
  break 11: check-in is required for every game  [apps/edge/src/checkin.ts]  -> RED  20 pass, 1 fail
  break 12: the check-in code permutation is no longer one-to-one  [apps/edge/src/checkin.ts]  -> RED  19 pass, 2 fail
  break 13: check-in opens after the start  [apps/edge/src/checkin.ts]  -> RED  20 pass, 1 fail
  break 14: card ids are 3 digits  [apps/edge/src/checkin.ts]  -> RED  20 pass, 1 fail
  restored: GREEN  21 pass, 0 fail
  branch product code untouched: yes
RESULT join-checkin: every planted break was caught
```

### join-hint
```
BREAKCHECK join-hint  (tests: apps/web/test/t30-m2-join-hint.test.ts)
  baseline: GREEN  4 pass, 0 fail
  break 1: the hint shows even when cleaning changes nothing  [apps/web/public/z.js]  -> RED  2 pass, 2 fail
  break 2: the hint never shows  [apps/web/public/z.js]  -> RED  2 pass, 2 fail
  break 3: the page reads the ID differently from the server (keeps dashes)  [apps/web/public/z.js]  -> RED  2 pass, 2 fail
  break 4: the hint wording changes  [apps/web/public/z.js]  -> RED  2 pass, 2 fail
  break 5: the hint is not updated while typing  [apps/web/public/z.js]  -> RED  2 pass, 2 fail
  restored: GREEN  4 pass, 0 fail
  branch product code untouched: yes
RESULT join-hint: every planted break was caught
```

### landing-browser
```
BREAKCHECK landing-browser  (tests: apps/web/test/t30-m3-landing-browser.test.ts)
  baseline: GREEN  8 pass, 0 fail
  break 1: a wide element makes the page scroll sideways  [apps/web/public/index.html]  -> RED  2 pass, 6 fail
  break 2: the kit header is gone  [apps/web/public/index.html]  -> RED  2 pass, 6 fail
  break 3: the old header (.snav) is shown again  [apps/web/public/index.html]  -> RED  2 pass, 6 fail
  break 4: the Version slot is removed  [apps/web/public/index.html]  -> RED  2 pass, 6 fail
  break 5: the Menu button stays visible on a laptop  [apps/web/public/components.css]  -> RED  7 pass, 1 fail
  break 6: a theme dot does not change the theme  [apps/web/public/brandkit.js]  -> RED  7 pass, 1 fail
  break 7: the Menu button no longer opens the links  [apps/web/public/brandkit.js]  -> RED  7 pass, 1 fail
  restored: GREEN  8 pass, 0 fail
  branch product code untouched: yes
RESULT landing-browser: every planted break was caught
```

### landing
```
BREAKCHECK landing  (tests: apps/web/test/t30-m3-landing.test.ts)
  baseline: GREEN  17 pass, 0 fail
  break 1: a menu item (Brochure) is missing  [apps/web/public/index.html]  -> RED  16 pass, 1 fail
  break 2: the Guide link points to the wrong page  [apps/web/public/index.html]  -> RED  15 pass, 2 fail
  break 3: the old header (.snav) comes back  [apps/web/public/index.html]  -> RED  16 pass, 1 fail
  break 4: the Version slot is removed from the footer  [apps/web/public/index.html]  -> RED  16 pass, 1 fail
  break 5: a theme dot is missing  [apps/web/public/index.html]  -> RED  15 pass, 2 fail
  break 6: the Menu button does not open the menu  [apps/web/public/brandkit.js]  -> RED  16 pass, 1 fail
  break 7: a theme dot does not change the theme  [apps/web/public/brandkit.js]  -> RED  15 pass, 2 fail
  break 8: Escape no longer closes the menu  [apps/web/public/brandkit.js]  -> RED  16 pass, 1 fail
  break 9: a legal link points to a page that does not exist  [apps/web/public/index.html]  -> RED  15 pass, 2 fail
  break 10: the page stops loading release-line.js  [apps/web/public/index.html]  -> RED  16 pass, 1 fail
  restored: GREEN  17 pass, 0 fail
  branch product code untouched: yes
RESULT landing: every planted break was caught
```

### matrix
```
BREAKCHECK matrix  (tests: tools/sim2/scenarios/matrix/matrix.test.ts)
  baseline: GREEN  19 pass, 0 fail
  break 1: employee ID cleaner keeps dashes  [apps/edge/src/people.ts]  -> RED  16 pass, 3 fail
  break 2: old games read IDs the new way  [apps/edge/src/people.ts]  -> RED  17 pass, 2 fail
  break 3: e-mail cleaner does not lower-case  [apps/edge/src/emailclean.ts]  -> RED  14 pass, 5 fail
  break 4: 'either' is read as 'mobile'  [apps/edge/src/people.ts]  -> RED  13 pass, 6 fail
  break 5: a Co-host link is read as a Host link  [apps/edge/src/people.ts]  -> RED  17 pass, 2 fail
  break 6: a personal link is case-sensitive  [apps/edge/src/people.ts]  -> RED  17 pass, 2 fail
  break 7: the rules row shows in every state  [apps/web/public/screenrules.js]  -> RED  14 pass, 5 fail
  break 8: dice 'presence' mode throws for everybody  [packages/beacon/src/race.ts]  -> RED  15 pass, 4 fail
  break 9: the turn limit is one turn late  [packages/beacon/src/race.ts]  -> RED  14 pass, 5 fail
  break 10: exact finish is lost  [packages/beacon/src/play.ts]  -> RED  17 pass, 2 fail
  break 11: (wire) an unpaid game does not lock after its start  [apps/edge/src/worker.ts]  -> RED  17 pass, 2 fail
  break 12: (wire) sign-up stays open after the start  [apps/edge/src/worker.ts]  -> RED  17 pass, 2 fail
  break 13: (wire) a second phone can take a board  [apps/edge/src/worker.ts]  -> RED  17 pass, 2 fail
  break 14: (wire) the organizer's 'admit' does nothing  [apps/edge/src/people.ts]  -> RED  17 pass, 2 fail
  break 15: (wire) 'decline' lets the person in  [apps/edge/src/people.ts]  -> RED  17 pass, 2 fail
  break 16: (wire) a 5-digit number is accepted as a mobile number  [apps/edge/src/worker.ts]  -> RED  17 pass, 2 fail
  break 17: (wire) an ID that is not on the list gets a card instead of waiting  [apps/edge/src/worker.ts]  -> RED  17 pass, 2 fail
  restored: GREEN  19 pass, 0 fail
  branch product code untouched: yes
RESULT matrix: every planted break was caught
```

### pause
```
BREAKCHECK pause  (tests: packages/beacon/test/t30-regress-pause.test.ts)
  baseline: GREEN  19 pass, 0 fail
  break 1: a pause may be signed with no lead time  [packages/beacon/src/control.ts]  -> RED  17 pass, 2 fail
  break 2: a pause no longer moves later turns  [packages/beacon/src/control.ts]  -> RED  16 pass, 3 fail
  break 3: an open-ended pause lasts for ever  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  break 4: a second pause while paused is accepted  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  break 5: a stop needs no lead  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  break 6: a timed pause may be any length  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  break 7: signatures are not checked  [packages/beacon/src/control.ts]  -> RED  16 pass, 3 fail
  break 8: a message for another game is accepted  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  break 9: the signed text no longer covers the end round  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  break 10: messages are applied in arrival order, not seq order  [packages/beacon/src/control.ts]  -> RED  18 pass, 1 fail
  restored: GREEN  19 pass, 0 fail
  branch product code untouched: yes
RESULT pause: every planted break was caught
```

### release-line
```
BREAKCHECK release-line  (tests: apps/web/test/t30-m1-release-line.test.ts)
  baseline: GREEN  10 pass, 0 fail
  break 1: a 'pending' date is printed as if it were real  [apps/web/public/release-line.js]  -> RED  8 pass, 2 fail
  break 2: a real date is never printed  [apps/web/public/release-line.js]  -> RED  6 pass, 4 fail
  break 3: a failed fetch writes an error text  [apps/web/public/release-line.js]  -> RED  8 pass, 2 fail
  break 4: the line says Release instead of Version  [apps/web/public/release-line.js]  -> RED  4 pass, 6 fail
  break 5: the line asks for another address  [apps/web/public/release-line.js]  -> RED  9 pass, 1 fail
  break 6: the shipped release.json is not 1.4.0  [apps/web/public/release.json]  -> RED  9 pass, 1 fail
  restored: GREEN  10 pass, 0 fail
  branch product code untouched: yes
RESULT release-line: every planted break was caught
```

### results
```
BREAKCHECK results  (tests: packages/beacon/test/t30-regress-results.test.ts)
  baseline: GREEN  21 pass, 0 fail
  break 1: the game goes on one turn past the limit  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  break 2: the game waits for one more finisher  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  break 3: a throw past the last square finishes (exact finish is lost)  [packages/beacon/src/play.ts]  -> RED  20 pass, 1 fail
  break 4: the later finisher ranks first  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  break 5: every finish prize goes to the first finisher  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  break 6: manual dice: everybody throws whether or not they pressed  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  break 7: the dice never show a 6  [packages/beacon/src/play.ts]  -> RED  20 pass, 1 fail
  break 8: a one-player game is allowed  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  break 9: a pawn that is on a snake head is not moved  [packages/beacon/src/board.ts]  -> RED  7 pass, 14 fail
  break 10: the milestone prize goes to the LAST player to reach it  [packages/beacon/src/race.ts]  -> RED  20 pass, 1 fail
  restored: GREEN  21 pass, 0 fail
  branch product code untouched: yes
RESULT results: every planted break was caught
```

### rules-fold
```
BREAKCHECK rules-fold  (tests: apps/web/test/t30-m1-rules-fold.test.ts)
  baseline: GREEN  6 pass, 0 fail
  break 1: the fold also shows after the game  [apps/web/public/z.js]  -> RED  3 pass, 3 fail
  break 2: the fold also shows in the waiting room  [apps/web/public/z.js]  -> RED  4 pass, 2 fail
  break 3: the fold never shows  [apps/web/public/z.js]  -> RED  3 pass, 3 fail
  break 4: screenrules says rules show in every state but the waiting room  [apps/web/public/screenrules.js]  -> RED  5 pass, 1 fail
  break 5: screenrules shows the thank-you strip in every state  [apps/web/public/screenrules.js]  -> RED  5 pass, 1 fail
  break 6: an unknown theme is not turned into retro  [apps/web/public/screenrules.js]  -> RED  5 pass, 1 fail
  break 7: z.html loads screenrules.js after z.js  [apps/web/public/z.html]  -> RED  5 pass, 1 fail
  break 8: z.html stops loading release-line.js  [apps/web/public/z.html]  -> RED  4 pass, 2 fail
  break 9: with screenrules.js missing the page no longer hides the fold after the game  [apps/web/public/z.js]  -> RED  5 pass, 1 fail
  restored: GREEN  6 pass, 0 fail
  branch product code untouched: yes
RESULT rules-fold: every planted break was caught
```

Break checks in total: 121 planted, 121 went RED, 0 did not (any that did not are listed above as STILL GREEN or NOT PLANTED).

## 8. Failing tests (from results/final/*.log): name and first 8 error lines
```
FAIL apps/edge/test/branding.test.ts :: pages: one title pattern, icons, manifest, theme colour > the PWA manifest and the build ship the brand
    error: expect(received).toBe(expected)
    Expected: "Corporate Snakes and Ladders"
    Received: "Snakes and Ladders"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/branding.test.ts:106:147)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > LRE (U+202A) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash‪a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > RLE (U+202B) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash‫a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > PDF (U+202C) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash‬a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > LRO (U+202D) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash‭a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > RLO (U+202E) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash‮a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > LRI (U+2066) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash⁦a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > RLI (U+2067) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash⁧a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > FSI (U+2068) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash⁨a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/t30-finding-f4-bidi-names.test.ts :: F-4: names carry no bidirectional control characters > PDI (U+2069) is removed from a name
    error: expect(received).toBe(expected)
    Expected: "Asha"
    Received: "Ash⁩a"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/t30-finding-f4-bidi-names.test.ts:7:143)
```
```
FAIL apps/edge/test/verify.test.ts :: the owner's three test sign-ins > demo1/2/3@xyz.in sign in with 123456, no e-mail is sent, the same account comes back each time, and a wrong code or another address is refused
    error: Received value must be a string: undefined
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/verify.test.ts:188:113)
```
```
FAIL apps/edge/test/verify.test.ts :: the owner's three test sign-ins > the test sign-ins are limited per network per day, record no Terms consent, never send mail, and keep only their latest six keys
    error: expect(received).toBe(expected)
    Expected: 200
    Received: 400
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/verify.test.ts:198:64)
```
```
FAIL apps/edge/test/usecases.test.ts :: A. organizer: getting in > UC-5 invalid emails are refused everywhere
    error: expect(received).toBe(expected)
    Expected: 400
    Received: 200
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/edge/test/usecases.test.ts:89:68)
```
```
FAIL apps/web/test/t30-finding-f2-lone-player.test.ts :: F-2: a game with one player > after the turn limit the page shows 'Game over' and must not show the Rules fold; the ended banner must appear
    error: expect(received).toBe(expected)
    Expected: false
    Received: true
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/t30-finding-f2-lone-player.test.ts:48:33)
```
```
FAIL apps/web/test/seo.test.ts :: each indexable page > quick loading: fonts are self-hosted and swap in, the two main fonts are preloaded, scripts do not block the page, nothing third-party is loaded on the home page
    TypeError: null is not an object (evaluating 'f.match(/font-display: swap/g).length')
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/seo.test.ts:74:41)
```
```
FAIL apps/web/test/t30-finding-f10-landing-script.test.ts :: FINDING F-10: the old buy box and the pricing section on the landing page (RED on release/snakes-1.4.0, see docs/TEST_FINDINGS.md) > no script error when the page loads
    error: expect(received).toEqual(expected)
    - []
    + [
    +   "Cannot read properties of null (reading 'addEventListener')",
    + ]
    - Expected  - 1
    + Received  + 3
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/t30-finding-f10-landing-script.test.ts:39:71)
```
```
FAIL apps/web/test/t30-finding-f10-landing-script.test.ts :: FINDING F-10: the old buy box and the pricing section on the landing page (RED on release/snakes-1.4.0, see docs/TEST_FINDINGS.md) > the 'Number of players' list has packs in it and the pricing section shows a price card
    error: expect(received).toBeGreaterThanOrEqual(expected)
    Expected: >= 4
    Received: 0
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/t30-finding-f10-landing-script.test.ts:44:23)
```
```
FAIL apps/web/test/t30-finding-f10-landing-script.test.ts :: FINDING F-10: the old buy box and the pricing section on the landing page (RED on release/snakes-1.4.0, see docs/TEST_FINDINGS.md) > 'Create your Corporate Snakes and Ladders' opens the checkout sheet without a script error
    error: expect(received).toEqual(expected)
    - []
    + [
    +   "Cannot read properties of null (reading 'addEventListener')",
    +   "Cannot access 'xbtn' before initialization",
    + ]
    - Expected  - 1
    + Received  + 4
```
```
FAIL apps/web/test/pwa.test.ts :: installable app (PWA) > manifest is installable: name, standalone, start url, 192 and 512 icons, one maskable
    error: expect(received).toBe(expected)
    Expected: "/z.html"
    Received: "/"
          at <anonymous> (/home/user/corporate-snakes-and-ladders/apps/web/test/pwa.test.ts:15:32)
```
```
FAIL apps/web/test/pwa.test.ts :: installable app (PWA) > the game pages (every file the phone screen loads) are all in the saved set
    error: expect(received).toContain(expected)
    Expected to contain: "/screenrules.js"
    Received: [
      "/offline.html", "/offline.js", "/z.html", "/zc.html", "/big.html", "/z.js", "/rights.js", "/zc.js",
      "/big.js", "/zgame.js", "/consent.js", "/blackbox.js", "/guide.js", "/control.js", "/audio.js",
      "/common.js", "/app.css", "/z.css", "/big.css", "/fonts.css", "/pwa.js", "/autoupdate.js", "/keep.js",
      "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/fonts/Fraunces-italic-500.woff2",
      "/fonts/Fraunces-normal-500-700.woff2", "/fonts/IBMPlexMono-normal-500.woff2", "/fonts/Inter-normal-400.woff2"
```
```
FAIL packages/beacon/test/t30-finding-f3-rank-vs-prize.test.ts :: F-3: results table and finish prizes agree on who is 1st to 5th > game PRZ1 (20 players, turn limit 150, 5 end prizes): the 5th finisher in the table is the winner of the 5th-place prize
    error: expect(received).toEqual(expected)
    @@ -5,3 +5,3 @@
        5,
    -   1,
    +   14,
      ]
    - Expected  - 1
    + Received  + 1
```
```
FAIL packages/beacon/test/t30-finding-f3-rank-vs-prize.test.ts :: F-3: results table and finish prizes agree on who is 1st to 5th > over 40 generated games the table and the prizes never disagree
    error: expect(received).toBe(expected)
    Expected: 0
    Received: 5
          at <anonymous> (/home/user/corporate-snakes-and-ladders/packages/beacon/test/t30-finding-f3-rank-vs-prize.test.ts:26:17)
```

## 9. Product bugs found
See docs/TEST_FINDINGS.md (F-1 to F-12) for exact repros. In short: F-10 the landing page cannot sell (site.js crashes, empty pack list and pricing) [High]; F-12 the coder's 1,728,000-scenario matrix is 10 real checks [High for certification]; F-3 results table and prizes can name different people [Medium-High]; F-5 spaces inside an e-mail address are deleted [Medium]; F-1 test logins are not on demo-test.invalid; F-2 one-player game never ends on the phone; F-4 bidi characters in names; F-6 service worker misses screenrules.js; F-7, F-8, F-9, F-11 notes.
