# TESTER_REPORT: Snakes 1.4.1 audit fixes
Branch `tests/snakes-1.4.1-2026-10-30` = `origin/tests/snakes-run3-fixes-2026-10-30` (bf97285) + merge of `origin/fix/snakes-1.4.1-audit-2026-10-30` (a4c53dc). **No product code changed.** Only test files, the page-test helper, one new test tool and this report. The previous run-3 report is kept at the end.

## Result (this cloud sandbox, `bun test --isolate <folder>`, one folder at a time, numbers copied from the last summary lines)
| Folder | pass | fail | files |
|---|---|---|---|
| packages/beacon | 115 | 0 | 10 |
| packages/billing | 26 | 0 | 1 |
| packages/shared | 10 | 0 | 1 |
| tools/control-worker | 1 | 0 | 1 |
| apps/web | 209 | 1 | 28 |
| apps/edge | 1438 | 0 | 81 |
| `bun run typecheck` | 0 errors (exit 0) | | |

- **The one red test is a real product defect, not a test problem:** `apps/web/test/guide.test.ts` "every message the server can send has a guide". The new lock message `worker.ts:2010 [409] You already have people listed. Start a new game to use a different kind of ID.` has no entry in guide.js (PB-10). I left it red on purpose.
- Pass counts include `test.failing` tests (they pass while the product bug exists and go red the day it is fixed, see below). There are 17 of them.
- Before this branch: edge 1378, web 138, beacon 115, typecheck 0. New tests: 4 new test files in apps/web, 2 in apps/edge.
- apps/cron, tools/browser-tests, tools/errorlog have no tests; tools/sim2 (crowd simulation) was not run.

## What I did not have to change vs what I had to
Six old tests encoded the old behaviour that the audit changed on purpose. I updated them (test code only):
- `email-clean.test.ts` guard (every account door now imports `cleanAccountEmail`), `usecases.test.ts` UC-5 (an account email with an inner space is now refused, not repaired), `verify.test.ts` nickname test (after someone joined, `verify` is locked: split into two tests), `verify-ui.test.ts` (CSV header now follows the game's kind of ID), `wp14-phone.test.ts` SL-11 (sound default is ON now), `packages/beacon/test/sl08-ends-when.test.ts` (new chip wording).
- `apps/web/test/harness.ts`: new optional `pub` folder so a break check can run the real page with one changed line.

## Items 1 to 12: what is tested and where
| # | Item | Result | Tests |
|---|---|---|---|
| 1 | Account / sign-in / Google / host / add-Host emails refuse an inner space; `isTestLogin('demo 1＠xyz.in')` false; participant Email IDs still remove inner spaces | **Done, one product bug (PB-1)** | `apps/edge/test/audit141-email.test.ts` (34 tests) |
| 2 | `EMP_CLEAN_FROM_MS` placeholder: promises only where the server cleans the new way; release build fails with the placeholder | **Done** | `audit141-screens`, `audit141-console`, `audit141-release` |
| 3 | Email in an employee-ID box: no "read this as", plain refusal; Email-ID tables | **Done; the table part fails (PB-8)** | `audit141-screens`, `audit141-ids`, `audit141-flow` |
| 4 | `idKind` / `verify` locked once anyone is listed or joined | **Done, found PB-4** | `audit141-ids` |
| 5 | "Which ID?" and "Your Employee ID" preview only where effective | **Done** | `audit141-flow`, `audit141-console` |
| 6 | "Ends when N players are home" true for team games and shows the cap | **Done for the phone and the console; the projector page is still untrue (PB-3)** | `audit141-console` |
| 7 | Dice-game words, feed hidden, no gamelog | **Feed and gamelog done; words are NOT clean (PN-1)** | `audit141-flow` |
| 8 | Clone re-hashes people with the new game's rule | **Done** | `audit141-ids` |
| 9 | No maxlength on the ID box; over-long IDs refused after cleaning | **Done** | `audit141-screens`, `audit141-ids` |
| 10 | Duplicates after cleaning named row by row | **Done, with a gap (PB-2)** | `audit141-ids`, `audit141-console` |
| 11 | release.json and public files hold no internal notes; gamelog removed or unlinked | **Done** (one source comment, PN-3) | `audit141-release`, `audit141-flow` |
| 12 | Sound default for players with no saved choice | **Done; the page text contradicts it (PB-9)** | `audit141-release`, `wp14-phone` |

### Email matrix (item 1), exact count
- **3,456,000 distinct addresses**, streamed (generator, one counter, nothing stored). Built from 6,000 distinct cores (letters including `s`, digits) x 3 cases (lower, upper, mixed) x 2 at-signs (`@`, full-width `＠`) x 3 plus tags (none, `+t`, `+s1`) x 2 dot styles x 4 space styles (none, around the ends, inner space, inner tab) x 2 zero-width (none, U+200B) x 2 lengths (normal, 300+ characters).
- Result: **0 wrong**. 1,728,000 refused (inner space or tab) and 1,728,000 kept, as an independent model says (the model lists white-space characters one by one and uses no regex).
- Distinctness is proven with a Set on the first 1,100,000 addresses (0 repeats). The rest are distinct by the same construction (the core number is different for each core and the other parts are fixed labels), but I did not hold all 3.4 million in memory.
- Backslash check by behaviour: tab, newline, no-break space, ideographic space, line separator inside an address are refused; the letters `s`, `d`, the digit `5`, `ss@sss.com` are kept. The regexes written by the coder are `/\s/` and `/\s+/g` (emailclean.ts), `/\s+/g` and `/[^A-Z0-9]/g` (z.js showRead), `/EMP_CLEAN_FROM_MS\s*=\s*(\d+)/` (build.mjs). Each is tested by behaviour (the build gate also with `EMP_CLEAN_FROM_MS=...` written with no spaces). Breaking the first one to `/s/` makes 8 tests red; breaking the build one to `(d+)` makes 4 red.

## Deliberate-break checks (red then green)
Two kinds:
1. **33 real product mutations** (`tools/breakcheck/run.mjs`, run it with `bun tools/breakcheck/run.mjs [id]`). For each: copy the repo to a scratch folder, change ONE piece of product code there, run the test file (red), run the same file on an unchanged copy (green). The repo itself is never edited. All 33 went red then green.
2. **In-file break tests** (named "DELIBERATE BREAK" in the test files): a copy of the page folder with one line changed, or a broken cleaner passed to the same matrix, and the test expects the check to fail.

| id | what was broken (one line of product code, in a scratch copy) | file | broken: pass/fail | restored: pass/fail | red then green |
|---|---|---|---|---|---|
| M1a | 1 account email: inner space accepted | apps/edge/src/emailclean.ts | 27/7 | 34/0 | yes |
| M1b | 1 account email: regex lost its backslash (/s/) | apps/edge/src/emailclean.ts | 26/8 | 34/0 | yes |
| M1c | 1 isTestLogin repairs inner spaces again | apps/edge/src/testlogins.ts | 32/2 | 34/0 | yes |
| M1d | 1 sign-in (/api/start) repairs inner spaces again | apps/edge/src/worker.ts | 33/1 | 34/0 | yes |
| M1e | 1 participant Email ID stops removing inner spaces | apps/edge/src/people.ts | 32/2 | 34/0 | yes |
| M3a | 3 email in an employee-ID box no longer refused (new reading) | apps/edge/src/people.ts | 22/2 | 24/0 | yes |
| M4a | 4 id-locked ignores LISTED people | apps/edge/src/worker.ts | 22/2 | 24/0 | yes |
| M4b | 4 id-locked ignores JOINED people | apps/edge/src/worker.ts | 23/1 | 24/0 | yes |
| M4c | 4 id-locked removed | apps/edge/src/worker.ts | 21/3 | 24/0 | yes |
| M4d | 4 id-locked also refuses unchanged values | apps/edge/src/worker.ts | 23/1 | 24/0 | yes |
| M6a | idClean not sent by /info | apps/edge/src/worker.ts | 23/1 | 24/0 | yes |
| M8a | 8 clone does not re-hash with the new game's rule | apps/edge/src/clone.ts | 22/2 | 24/0 | yes |
| M8b | 8 clone keeps a person the new rule refuses | apps/edge/src/clone.ts | 23/1 | 24/0 | yes |
| M9a | 9 server accepts IDs longer than 30 after cleaning | apps/edge/src/people.ts | 22/2 | 24/0 | yes |
| M10a | 10 duplicate rows not named | apps/edge/src/people.ts | 21/3 | 24/0 | yes |
| M2a | 2 release gate removed from pages/build.mjs | pages/build.mjs | 17/5 | 22/0 | yes |
| M2b | 2 release gate lets the placeholder through | pages/build.mjs | 18/4 | 22/0 | yes |
| M2c | 2 release gate ignores an empty releasedAtIST | pages/build.mjs | 21/1 | 22/0 | yes |
| M2d | 2 gate number pattern loses its backslash | pages/build.mjs | 18/4 | 22/0 | yes |
| M2e | 2 phone says 'read this as' for any game (no idClean) | apps/web/public/z.js | 8/2 | 10/0 | yes |
| M2f | 2 console promises 'Dashes and spaces are ignored' for any game | apps/web/public/zc.js | 17/2 | 19/0 | yes |
| M2g | 2 /info drops idClean for the phone page | apps/web/public/z.js | 8/2 | 10/0 | yes |
| M3b | 3 email in an employee-ID box falls to 'read this as' | apps/web/public/z.js | 8/2 | 10/0 | yes |
| M5a | 5 new flow shows 'Which ID?' + preview again | apps/web/public/zc-flow-game.js | 17/3 | 20/0 | yes |
| M5b | 5 old console shows 'Which ID?' for mobile games | apps/web/public/zc.js | 17/2 | 19/0 | yes |
| M6b | 6 console duration line: no team rule, no cap | apps/web/public/zc.js | 15/4 | 19/0 | yes |
| M6c | 6 player chip loses the team rule and the cap | apps/web/public/z.js | 18/1 | 19/0 | yes |
| M7a | 7 new flow shows the feed and asks for /gamelog | apps/web/public/zc-flow-game.js | 17/3 | 20/0 | yes |
| M7b | 7 a gamelog link comes back into a page | apps/web/public/z.html | 19/1 | 20/0 | yes |
| M9b | 9 maxlength=30 back on the ID box | apps/web/public/z.js | 8/2 | 10/0 | yes |
| M10b | 10 console summary drops the duplicate names | apps/web/public/zc.js | 17/2 | 19/0 | yes |
| M11a | 11 internal note back in release.json | apps/web/public/release.json | 21/1 | 22/0 | yes |
| M12a | 12 sound default off again | apps/web/public/z.js | 20/2 | 22/0 | yes |

In-file break tests (all pass, meaning the check caught the break): matrix with `/s/` cleaner, matrix with the old spaces-removed cleaner, matrix with no lower-casing; phone hint without `idClean`; email falling through to "read this as"; `maxlength="30"` back; console promise without `idClean`; "Which ID?" for mobile games; duration line without team rule/cap; old chip; duplicate names dropped; descriptor `idKind: true`; descriptor `feed: true`; build gate removed; gate threshold 2200; gate regex `(d+)`; sound default off; internal note in release.json.

## Product bugs (evidence; NOT fixed)
Each has a `test.failing` test that turns red when the bug is fixed (then change it to `test`).
- **PB-1 Add-Host silently drops a bad e-mail.** `POST /api/org/host {email:"ho st@acme.com", mobile:"9876500009"}` returns 200. The route cleans the address to "" and then treats it as "no e-mail typed", so the Host is made from the mobile number alone. With e-mail only it correctly gives 400. (worker.ts ~1095). Test: audit141-email "spaced e-mail AND a mobile number".
- **PB-2 Duplicate count and names disagree.** Second upload of an already-listed ID: `duplicates: 1`, `duplicateRows: []`. Only duplicates inside one upload are named (people.ts:302/308/312). The ones counted at 325, 359, 360 are not. This is the common case (organizer uploads the sheet again). Also `raw` in duplicateRows is "name phone", not the ID text, so two people with the same name cannot be told apart. Tests: audit141-ids.
- **PB-3 "Ends when" still untrue in three places.** Projector page `big.js:151` still says "ends when N players are home" for team games and shows no cap. The help line under the choice (`zc.js:246`, fixed text) still says "this many players" in a team game. `legal.html:67` says "The game ends when the fifth place is decided" (not tested). Tests: audit141-console.
- **PB-4 An Email ID game cannot be re-saved in the old console once it has people.** `zc.js:1244` builds the console settings from the server record but leaves out `idKind`. The form shows "Employee ID" for an Email game, and "Save and continue" in step 2 sends `idKind:"emp"`, which the new lock refuses: the organizer sees "You already have people listed. Start a new game..." although they changed nothing. Evidence: DOM test `CON-P4B` shows the form text "Your list has an employee ID for each person." and the refusal on Save. Test: audit141-console "PB-4".
- **PB-5 Paste help shows code.** For "ID only" games the paste line is a normal double-quoted string holding `${idLow()}`: the organizer reads `Paste one person per line: name, ${idLow()} (and a mobile number if you have it)` (zc.js, rosterTxt label). PB-5b: for "mobile and ID" games the paste line still says "employee ID" even in an Email ID game.
- **PB-6 The new organizer flow cannot sign in.** The vendored pack reads the key from storage name `ctz-org` (pack/zc-flow.js:404); the game stores `cbz-org` (google.js:71, keep.js). A person who signs in and presses "Try the new screens" gets a page with no key: the dashboard never opens and the waiting list never loads (test: with only `cbz-org` the dashboard text never appears). My flow tests set both names to get past it. Its key pattern `ct[hcak]_` also does not match the game's `cbk_/cbh_/cbc_` keys in the `?k=` link.
- **PB-7 Stray "null" in the Ready check** of a normal published free game: "Paymentnull", "Prizes chosennull" (new flow dashboard).
- **PB-8 Email-ID games in the new-flow tables.** Waiting table of an Email ID game: column "Employee ID", value `ASHARAOACMECOM` for `asha.rao@acme.com` (the pack squashes it with its employee-ID cleaner). Winner details do the same. The coder listed this as not fixable here; it is still wrong and the new flow is reachable (see PB-6 for how far).
- **PB-9 Sound text contradicts the new default.** The waiting room says "Sound is off until you turn it on." (z.js:500) while the button says "Sound on".
- **PB-10 No guide entry for the new lock message** (see the red test above).

## Product notes (not bugs in the changed lines, or not confirmed)
- **PN-1 Tambola words still in the vendored pack (item 7).** Reaching the Snakes organizer: waiting-table column **"Ticket number"**; step 3 called **"Tickets and prizes"**; the report note and the completed note say "(by **ticket number** only)"; prize/claim lines "won by Ticket number N" / "It has been won by Ticket N" (lines 321, 332); live control words **"Numbers are called automatically"** (line 338) and **"Press to Roll Out the Next Number"**; "Tickets" in `readBack`. Housie, Tambola, Bumper, Full House, Lucky draw, Rehearsal and Claim do not appear on the dashboard. Each leftover has its own `test.failing`. The fix is in the console repo plus re-vendor. Until then the new flow should stay opt-in.
- **PN-2** `release.json` says version `1.4.0` on the 1.4.1 fix branch. If the page footer should say 1.4.1, the release session must change it.
- **PN-3** `site.js:23` still has a source comment "Boss ruling Q8". The build strips comments, so the built site is clean (tested on a real build); the source folder is not.
- **PN-4** Wording disagrees on an old-reading game (before the date): typing `a@b.com` shows "This looks like an Email ID..." on the phone, but the server answers "An employee ID has letters and numbers only (up to 30)." (tested both).
- **PN-5** A zero-width character (U+200B) inside an account email is accepted by the sign-in doors: `a\u200bb@x.com` becomes its own account that looks like `ab@x.com`. It is not white space, so the new rule does not refuse it (the matrix pins this as current behaviour).
- **PN-6** `pack/MANIFEST.json` was hand-edited (the `pack.css` line has a different indent from the rest, and the file says "Do not edit here"). The seven recorded SHA-256 values still match the files (tested), but `node tools/vendor-pack.mjs --check` in the console repo was not run here.
- Nothing in these tests sets the real `EMP_CLEAN_FROM_MS`. A game "after the date" is simulated by setting `created_ms` past the placeholder. The release session must set the constant and `releasedAtIST` (the gate test proves the build refuses until then).
- Cleaning-date risk named earlier is unchanged: Host setup stores the lowercase address, so old hashes made from mixed-case addresses will not match.

## Files added or changed
- New tests: `apps/edge/test/audit141-email.test.ts`, `audit141-ids.test.ts`; `apps/web/test/audit141-screens.test.ts`, `audit141-console.test.ts`, `audit141-flow.test.ts`, `audit141-release.test.ts`.
- New tool: `tools/breakcheck/run.mjs` (not part of `bun test`; plain .mjs so typecheck is unaffected).
- Updated old tests: listed above. Helper: `apps/web/test/harness.ts` (`pub` option).

---
# Previous report (run 3)
Branch `tests/snakes-run3-fixes-2026-10-30`, from `origin/release/snakes-1.4.0` at 173b6e6. Only test files changed. No product code, no deploy.

## Result (this cloud sandbox, one folder at a time, `bun test --isolate <folder>`, counts from the last summary lines)
| Folder | pass | fail | files |
|---|---|---|---|
| packages/beacon | 115 | 0 | 10 |
| packages/billing | 26 | 0 | 1 |
| packages/shared | 10 | 0 | 1 |
| tools/control-worker | 1 | 0 | 1 |
| apps/web | 138 | 0 | 24 |
| apps/edge | 1378 | 0 | 79 |
| `bun run typecheck` | 0 errors | | |

Not run: apps/cron, tools/browser-tests, tools/errorlog (no `*.test.ts` files). `tools/sim2` (crowd simulation, `bun run sim`, 15 min timeout) is outside the repo's `test` script and was not run in this pass.
apps/web was run once before the web fixes (135 pass, 2 fail, 137 tests) and again after (138 pass, 0 fail). The one extra test is the new narrow-exemption test in no-internal-notes.test.ts.

## What I changed (all test code)
1. **verify.test.ts** (the 188/198 tests): the service was in LIVE mode. The tests now call the product's own `setMode(env, "TEST", ...)` (apps/edge/src/mode.ts, same way wp14-testlogins.test.ts does it) before the demo1/2/3 sign-ins. Added a LIVE case that refuses 123456 with 400 and no token.
2. **Typecheck 68 to 0**: 67 errors came from one wrong return type of the test helper `keyH` in `param-harness.ts` (it returned a union with an optional header). It now returns `Record<string, string>`. This fixed demo-pass, join-gaps, param-people, param-config, param-life and shared-read at once. The last error was `email-clean.test.ts` line 14 comparing two different string literals; they are now typed `string`. No `any` was added.
3. **Email ID**: `usecases.test.ts` UC-5 expected `"a b@c.com"` to be refused. Under the owner rule (NFKC, trim, remove inner spaces, lowercase) it is the address `ab@c.com`. The old case is removed from the refusal list and a new UC-5 test proves the cleaned form is accepted and is the same account as `ab@c.com`. email-clean.test.ts already checks that the employee ID cleaner is not the email cleaner; no other test expected otherwise.
4. **shred.test** (see below).
5. **UC-32** (`usecases.test.ts`, not on your list): found flaky while re-running. 40 joins fire together and only 5 get in, but the test then re-joined phone number 1, which is not always one of the 5. It now re-joins one that really got in. 6 runs in a row green after the fix.
6. **seo.test**: the font regex now accepts `font-display:swap` with or without a space (the kit file has no space); `theme-init.js` added to the no-defer list (kit rule, it must run first, like theme.js).
7. **no-internal-notes.test**: the vendored pack (`public/pack/`) uses `todo` as a CSS state class. I blank only those two exact uses (`.zf-ready.todo` and `? "ok" : "todo"`) in pack files. The rest of the pack is still scanned. A new test proves a real `TODO:` note in a pack file and the class outside the pack are still caught.

## shred.test flake (item d)
- I could not make it fail. The file has no sleeps or timers; the clock is fixed and every test gets a fresh database, so there is no order or time effect to remove. The coder's theory (an audit_log row from an earlier test) does not fit: the database is rebuilt in `beforeEach`.
- Most likely cause of a rare red: the check "audit data does not contain `Asha`" looks for 4 letters in sealed base64 text, which can appear by chance. I now check the full name `Asha Rao`, which is what a real leak would show. This is a reasoned guess, not a reproduction. If it fails again, send me the output.
- Three runs alone before the change: 10 pass 0 fail, 10 pass 0 fail, 10 pass 0 fail. Three runs alone after the change: 10 pass 0 fail, 10 pass 0 fail, 10 pass 0 fail.

## Deliberate-break checks (red then green)
| Rule | Break | Broken | Restored |
|---|---|---|---|
| (a) verify TEST mode | remove the setMode TEST line | 19 pass, 1 fail | 20 pass, 0 fail |
| (b) typecheck | remove the `keyH` return type | 67 errors | 0 errors |
| (b) typecheck | remove the `string` typing in email-clean | 1 error | 0 errors |
| (c) Email ID cleaned (UC-5) | second address made different | 55 pass, 1 fail | 56 pass, 0 fail |
| (d) shred leak check | forbidden list gets a word that is in the dump | 9 pass, 1 fail | 10 pass, 0 fail |
| seo font regex | old regex put back | 23 pass, 1 fail | 24 pass, 0 fail |
| notes pack exemption | exemption removed | 3 pass, 2 fail | 5 pass, 0 fail |

## Remaining failures
None in this run.

## Possible product issues (not fixed, not confirmed)
- None found. No typecheck error was in product code.
- Risk the coder already named: Host setup stores the lowercase email, so old hashes made from mixed-case addresses will not match. No test covers an existing mixed-case record. Product owner should decide if old data needs a migration.
- The vendored pack contains the word `todo` as a class name. It is harmless, but the test now carries an exemption for it; it can be removed if the console repo renames the class.
- The "who gets in" order in simultaneous joins (UC-32) is not fixed. That is fine for the limit rule, but note it if a fair-order rule is ever promised.
