# TESTER_REPORT: Snakes run 3 test fixes
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
apps/web was run once before the web fixes (135 pass, 2 fail) and again after (138 pass, 0 fail). The 138 is the final count; the new count is 3 more because one test was added to no-internal-notes.test.ts (the narrow-exemption test) and the pack check counts differently. Nothing else in the folder changed.

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
