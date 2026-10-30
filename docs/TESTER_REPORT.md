# TESTER_REPORT: Snakes 1.4.1, test run v3 (31 Oct 2026)

Test branch: `tests/snakes-1.4.1-v3-2026-10-31`
- Built from the product branch `fix/snakes-1.4.1-audit-2026-10-30` at `3d85dcc` (round 2 included).
- Plus the earlier test branch `tests/snakes-1.4.1-2026-10-30` (`a7a74a1`). The merge had no conflicts (the two branches touch different files).
- **No product code was changed.** Final check: `git diff origin/fix/snakes-1.4.1-audit-2026-10-30 --name-only` lists only test files, this report, the old report (renamed) and `tools/breakcheck/run.mjs` (a test runner the earlier author added; it is outside the test folders, so please look at it).
- The previous author's report is kept as `docs/TESTER_REPORT_previous_author_2026-10-30.md`.

## 1. Result (this cloud sandbox, `bun test --isolate <folder>`, one folder at a time)
| Folder | pass | fail | files |
|---|---|---|---|
| packages/shared | 10 | 0 | 1 |
| packages/beacon | 115 | 0 | 10 |
| packages/billing | 26 | 0 | 1 |
| apps/edge | 1536 | 0 | 83 |
| apps/web | 203 | **1** | 29 |
| tools/control-worker | 1 | 0 | 1 |
| `bun run typecheck` | **0 errors** (exit 0) | | |

- The one red test is a **product defect** (PD-6 below). I did not bend it.
- 9 tests are `test.failing`. They are product defects written down as tests: they pass while the product is wrong and turn red the day it is fixed. They are counted in "pass" above. List: PD-1 (2), PD-2 (1), PD-3 (1), PD-4 (4), PD-5 (1).
- Not run: apps/cron, tools/browser-tests, tools/errorlog (no test files). `tools/sim2` (crowd simulation) was not run. `tools/breakcheck/run.mjs` (33 older break checks) was not re-run in this pass.

## 2. What was red when I first ran the merge, and what I decided
First run: beacon 1 red, web 18 red, edge 10 red (29 in all). Every one was looked at:

**Test encoded OLD behaviour, product is right: test fixed (test code only)**
- `beacon sl08-ends-when`: projector page now says "ends sooner when ..." (round 2). Test updated.
- `edge audit141-ids` (lock): sentence now follows what was changed. Kind of ID changed: "...different kind of ID." Only the way of asking (verify) changed: "...different way of asking for IDs." Test now checks both.
- `edge audit141-ids` (old reading): an e-mail in an employee-ID box now gets the same plain refusal on every game. Test updated.
- `edge audit141-ids` (duplicates, 4 tests): duplicates are now named by the ID as typed, and a repeat of someone already listed is named too ("Already on the list."). Tests updated; two old `test.failing` and one "what happens today" test turned into normal tests or were removed.
- `edge audit141-email` matrix: account e-mails now also refuse invisible characters (round 2). The model in the test only knew spaces. Model rebuilt from code points (no literal invisible characters, no backslash typed). Counts changed from 1,728,000 / 1,728,000 refused/kept to 2,592,000 / 864,000.
- `edge audit141-email` source check: the cleaner now has a longer character class. Test builds the exact text from code points.
- `web audit141-console` (7 tests): PB-3, PB-4, PB-5 were fixed in round 2. Their `test.failing` tests turned into normal tests; the two "what happens today" evidence tests were removed; the duplicate summary now shows the typed IDs, not the names.
- `web audit141-release` (PN-3 comment gone) and `web wp14-phone` (PB-9 sound text fixed): `test.failing` turned into normal tests.
- `web audit141-flow`: round 2 removed "Try the new screens" and the pack scripts from `zc.html`, and `?flow=new` now draws the ordinary console. The tests that drove the new dashboard (item 7 words, item 3 waiting tables, PB-6 sign-in key) described a page nobody can reach. They are replaced by three reachability checks (no link, no scripts, `?flow=new` shows the ordinary console). The "Which ID?" tests of the unreachable module are kept (they still pass).
- `web audit141-flow` item 11: `pack/gamelog.*` is back in the pack folder on purpose (vendored byte for byte, in MANIFEST.json). The test now checks what matters: it is not in `pages/build.mjs`, so it does not ship, and no page or script links to it.

**Product is wrong against the rules: NOT bent, listed below as defects.** Only PD-6 stays red; the others are `test.failing`.

## 3. PRODUCT DEFECTS (file, input, expected, actual)
**PD-1 Over-long employee ID has the wrong sentence.**
- Files: `apps/edge/src/people.ts:74` (`badIdMessage`), `apps/web/public/z.js:905` (`showRead`).
- Input: 31 letters in the ID box of a game on the new reading (`verify:"id"`, `created_ms >= EMP_CLEAN_FROM_MS`).
- Expected: `This ID is too long. An employee ID may be up to 30 characters once cleaned.`
- Actual (server join, `400 bad-id`, and the phone's hint): `An employee ID has letters and numbers only (up to 30).` That sentence also appears for a box with only punctuation, where it is fine; for too-long it says nothing about length.
- Tests: `v3-rules` "31-letter ID ... too-long sentence (server)", `v3-hints` "31 letters: the too-long sentence" (both `test.failing`), plus "evidence" tests of today's words.

**PD-2 Payment door silently drops an e-mail with a hidden character.**
- Files: `apps/edge/src/pay.ts:362` and `:404` check the address with `EMAIL = /^[^\s@]{1,64}@.../` (white space only), then `:382` and `:413` clean it with `cleanAccountEmail`, which returns "" for an invisible character.
- Input: `POST /api/checkout {email:"ab​c@x.com", pack:100}` (same for U+200C, U+200D, U+2060, U+FEFF, U+0085, U+2028, U+2029).
- Expected: refused, 400 "Enter a valid e-mail address." (the same as an inner space, which IS refused).
- Actual: **200**, an order is made, and the payment row is stored with `email = ""`.
- Test: `v3-rules` "PD-2: checkout refuses an invisible character ..." (`test.failing`); the inner-space version is a normal passing test.

**PD-3 The ID lock is wider than the rule.**
- File: `apps/edge/src/worker.ts:2011` (id-locked line). It counts every participant and every listed person.
- Rule: locked once anyone **holding an ID hash** is listed or joined.
- Input: a game with `verify:"mobile"` where one guest joined by mobile number only (no ID), then `PATCH settings {idKind:"email"}`.
- Expected: 200 (nobody holds an ID hash, nothing is orphaned).
- Actual: `409 id-locked`, "You already have people listed. Start a new game to use a different kind of ID."
- Note for the owner: this may be intended safety (changing `verify` for phone-only guests changes how they get back in). If so, the rule text should say "anyone listed or joined". Test: `v3-rules` "a game whose only people joined by mobile number ..." (`test.failing`) and an evidence test of today's 409.

**PD-4 `endedAtMs` does not exist.**
- Searched every answer: public `info`, organizer `summary`, `life`, `report`, `control`, the organizer's games list, and all of `apps/` and `packages/`: no field called `endedAtMs`.
- The only end value is `endMs` on `GET /api/z/:id/life` (`worker.ts:1908`). It is **always** returned, with the planned end while the game can still be live. That breaks "absent while the game can be live".
- Expected: `endedAtMs` absent while live; scheduled end (bound + 60 s) returned only once `now >= bound`; phones-confirmed or organizer end returned whatever the clock says; never moves once returned; purge/erase and cancel are not an end.
- Actual: none of this is implemented. (The rows `life.end_src` = schedule / phones / organizer / cancel exist; `erasePersonal` writes an `organizer` row with `end_ms = now` for a purge, which would wrongly look like an end if `endedAtMs` were built on `life` as it is.)
- Tests: 4 `test.failing` (scheduled end at bound, never moves, phones end early, organizer end early) and 3 guards that pass today (absent while live, cancel is not an end, purge/erase of a live game is not an end) so a future implementation cannot break those.
- I could not tell from the rules which endpoint should carry the field, so the tests look for the key anywhere in the answers above. If it is put somewhere else, the helper `endedAt` in `v3-rules.test.ts` needs that path added.

**PD-5 Phone hint for an Email ID ignores invisible characters.**
- File: `apps/web/public/z.js:903` (Email branch of `showRead`: trim and remove white space only).
- Input: `ab​c@x.com` in an Email ID game.
- Expected: `The system will read this as abc@x.com` (the server removes the hidden character).
- Actual: no hint at all (the hidden character is invisible, so the text looks unchanged to the phone's check). Small, but the hint is the only warning the person gets. Test: `v3-hints` (`test.failing`).

**PD-6 The new guide card has a step with no ending punctuation.**
- File: `apps/web/public/guide.js:137` (the id-locked card). Step 1 is `Keep the kind of ID this game uses, or` (ends with "or").
- The house test (every step ends with a full stop, "!" or ",") fails: `guide.test.ts` "every catalog entry has a short title ...". It is the only red test.
- Fix is one line of text (join the two steps or finish the sentence).

**Latent (not reachable now, because round 2 hid the new organizer flow):** the pack still has the other game's words ("Ticket number", "Tickets and prizes", "Numbers are called automatically"), a stray "null" in the Ready check, and an "Employee ID" column holding squashed addresses for an Email ID game (earlier PN-1, PB-7, PB-8). No test covers them now. If the new flow is ever switched on again, they come back.

**Things still open from the earlier report that I did not re-test:** none of the rest of the earlier PB/PN items remain except those above (PB-1, PB-2, PB-3, PB-4, PB-5, PB-6, PB-9, PB-10, PN-2, PN-3, PN-4, PN-5, PN-6 were checked and are fixed).

## 4. Gap tests added (all from the owner's rules, not from the code)
Files: `apps/edge/test/v3-rules.test.ts` (94 tests), `apps/edge/test/v3-matrix.test.ts` (5), `apps/web/test/v3-hints.test.ts` (7).
- **Employee ID cleaning:** NFKC, upper case, keep A-Z 0-9 (full-width, ligature, sharp s, dotless i, Kelvin sign, circled digits, accents dropped, emoji dropped, invisible characters dropped); 20,000 random inputs against a second copy of the rule with no regex; cap 30 *after* cleaning (30 ok, 31 refused, 41 typed that clean to 28 ok, 70 typed that clean to 30 ok); empty after cleaning refused; nothing typed gives "nothing typed"; all spellings of one listed ID join as that person; a second person with another spelling does not become a second participant; the hash is the same for every spelling.
- **E-mail in an employee-ID game:** `@` and full-width `＠`, both readings, server join and list door: plain sentence, no letter of the address in the answer.
- **Participant Email ID:** each of 10 kinds of white space and each of the 8 invisible characters removed inside and at both ends; NFKC; lower case; dots, plus tags untouched; 20,000 random inputs against the second copy; complete/incomplete address rules; a listed address with a hidden character is the same person as the plain one; duplicates by case, space and hidden character in one upload.
- **Account / sign-in / host / payment e-mails:** each of the 18 characters (10 white space kinds, 8 invisible) refused inside; trim at the ends allowed; `/api/start`, `/api/auth/email`, `/api/auth/verify`, `/api/org/host` (with and without a mobile number), `/api/host/setup/email` all 400 with no account and no mail made; checkout: white space refused (passes), invisible characters accepted (PD-2).
- **Lock:** sentence follows what changed (kind of ID vs verify only vs both), code `id-locked`, game unchanged, same values still save, a removed person unlocks, joined-with-ID locks (PD-3 for phone-only guests).
- **endedAtMs:** see PD-4 (4 failing, 3 guards, 1 evidence test).
- **Guide/hint words:** "The system will read this as ..." only where the server cleans (new reading, Email ID); nothing on old-reading games; e-mail refusal exact sentence; exact lock sentences; too-long sentence (PD-1).

## 5. Matrix
- **ID matrix (new): `apps/edge/test/v3-matrix.test.ts`.** Streamed (a generator; only one Set of exact strings is kept to prove distinctness).
  - **Generated 1,060,891; distinct 1,050,000; repeats skipped and not re-checked: 10,891.** The run stops when 1,050,000 distinct inputs have been checked (the owner asked for at least 1,000,000).
  - Each input goes through six paths: `cleanEmpId`, `normEmp` (new reading), `normId` for an employee game, `normId` for an Email ID game, `cleanEmail`, `cleanAccountEmail`. Each answer is compared with a second copy of the rule (no regex, no product calls). **Wrong answers: 0.**
  - The stream reaches every kind of answer: 301,195 kept as an employee ID, 450,026 refused because of `@`, 298,707 refused as too long, 72 refused as empty after cleaning, 907,957 refused as account e-mails (inner space or hidden character).
  - 4 in-file deliberate breaks (no 30 cap, Email ID keeps hidden characters, account cleaner repairs spaces, no upper-case) are each caught.
  - Shapes: 3 cases, 6 separators, full-width or not, 6 hidden-character choices, 3 edge-space choices, 4 length pads, 14 endings (8 plain, 6 e-mail shapes), 1,050 bodies.
- **E-mail matrix (existing, rebuilt for round 2): 3,456,000 addresses**, 0 wrong, 0 repeats in the first 1,100,000 (Set); the rest are distinct by construction. 2,592,000 refused, 864,000 kept.

## 6. Deliberate-break proof (product file changed in the working copy, tests run, file restored with `git checkout`)
| # | Rule broken (one line of product code) | File | v3 tests | older tests | Restored |
|---|---|---|---|---|---|
| B1 | employee ID no longer upper-cased | `apps/edge/src/people.ts` | v3-rules 78 pass / **16 fail**; v3-matrix 4 / **1 fail** | audit141-ids 21 / **2 fail** | green |
| B2 | 30 cap removed after cleaning | `apps/edge/src/people.ts` | v3-rules 91 / **3 fail**; v3-matrix 4 / **1 fail** | audit141-ids 21 / **2 fail** | green |
| B3 | account e-mail repairs inner spaces instead of refusing | `apps/edge/src/emailclean.ts` | v3-rules 73 / **21 fail**; v3-matrix 4 / **1 fail** | audit141-email 20 / **14 fail** | green |
| B4 | lock sentence always says "kind of ID" | `apps/edge/src/worker.ts` | v3-rules 92 / **2 fail** | audit141-ids 21 / **2 fail** | green |
| B5 | phone hint promises "read this as" on every game | `apps/web/public/z.js` | v3-hints 6 / **1 fail** | | green |
- After each break `git checkout -- <file>` restored it. The final runs in section 1 were made after all five, on the restored tree.
- **Product-code diff at the end: empty** (`git diff origin/fix/snakes-1.4.1-audit-2026-10-30 --name-only` shows no file outside test folders except this report and `tools/breakcheck/run.mjs`).
- A backslash check: I typed no backslash in any new test string or regex; characters come from `String.fromCharCode`. I re-read the files after writing. The only place the product regex text is compared (`audit141-email` source check) builds `[\s​-‍...]` from code points, and it fails if that text changes.

## 7. Limits and things to know
- `EMP_CLEAN_FROM_MS` is still the year-2100 placeholder, and `release.json` has `releasedAtIST: ""`. So on this branch **no real game uses the new cleaning rule**; every test simulates "after the date" by setting `created_ms`. The release build gate (tested) refuses until both are set.
- The rules do not say what to do with an invisible character at the very edge of an account e-mail (U+200B is not trimmed by JavaScript `trim`). The product refuses it. I did not pin that either way.
- Every number above was copied from the last summary line of the run named. Run time in this sandbox: edge about 4.5 minutes, web under 1 minute, beacon about 35 seconds.
