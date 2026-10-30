# TEST HANDOFF (coder to test author), branch release/snakes-1.4.0
Coder: product code only from now on. This file is updated at every milestone. Status of each item: written by the coder, NOT yet independently tested.

## Test files the coder created so far (the test author takes them over)
- apps/web/test/parity-matrix.test.ts (screen-rule matrix, 1,728,000 streamed scenarios, two break checks, file checks)
- apps/edge/test/empid-clean.test.ts (employee ID cleaner)
- apps/edge/test/email-clean.test.ts (email cleaner and the guard that every email read uses it)
- From gap wave 1 (written by an earlier session): apps/web/test/{sl03-default-join,wp14-wording,wp14-console,wp14-phone}.test.ts, apps/edge/test/{wp14-join,wp14-testlogins}.test.ts, packages/beacon/test/sl08-ends-when.test.ts
Known limits: the matrix covers screen rules only, not the engine; the guard test greps source text.

## How to start the app locally
`bun run dev` (apps/edge/src/local.ts). Pages are in apps/web/public (z.html player, zc.html organizer console, index.html landing). Test logins: demo1/2/3 with code 123456 in TEST mode only. Node modules: junction or install at the repo root (the worktree needs @noble/curves).

## Milestone 1: files and behaviours (commit ce2b78b)
Files: apps/web/public/{screenrules.js, release.json, release-line.js, z.js (rules fold line), z.html, index.html}.
1. Player screen after the game ends (phase ended) must NOT show the "Rules in five lines" fold. During play it must. Waiting room must not (as before).
2. z.html loads screenrules.js before z.js and release-line.js. If screenrules.js is missing the page still hides the fold after the game.
3. release-line.js writes "Version 1.4.0" (no date while releasedAtIST starts with "pending") into the footer; with a real IST string it prints ", released <IST> IST". A failed fetch shows nothing and no error.

## Milestone 2: ID and email rules (commits a717293, 9d4ad88)
Files: apps/edge/src/{people.ts, emailclean.ts, worker.ts, admin.ts, credit.ts, google.ts, helpdesk.ts, hostsetup.ts, mode.ts, partners.ts, pay.ts, testlogins.ts, visits.ts}, apps/web/public/z.js.
Employee ID (games with created_ms >= EMP_CLEAN_FROM_MS, currently year 2100, so tests must pass an explicit threshold or set the constant):
1. 1B-678, 1b-678, 1B/678, 1B 678 -> 1B678 on join, "who" check and organizer add-person/list upload; same person gets the same board (hash from the cleaned value).
2. Full-width, zero-width, emoji, accents are removed. Only symbols -> plain refusal ("An employee ID has letters and numbers only"). More than 30 characters after cleaning -> refused. Duplicates that only match after cleaning count as duplicates.
3. Older games (created before the threshold): old reading unchanged (dots, dashes and slashes kept).
4. Join page shows "The system will read this as 1B678" under the ID box only when cleaning changes the text.
Email (all games): RAJAT1＠DEMO.COM and every case or spacing variant is one address at: organizer sign-in/Google sign-in, helpdesk, Host setup link (hash, sealed address, "different email" check), payment receipts and payer hash, credit, partners, visits hash, test logins (DEMO1@... counts as demo1). Employee ID cleaner is never applied to an email.
Risk to check: Host setup stores the lowercase form; old hashes made from mixed-case addresses will not match.

## Milestone 3: brand kit and landing (commit 4cb8dfc)
Files: apps/web/public/{index.html, tokens.css, components.css, brandkit.js, theme-init.js, fonts.css, favicon.*, icons, manifest.webmanifest, og-card.png}.
1. Landing page shows the kit header (six menu items: How it works, Free demo game, Guide, Brochure, Refer & earn, Log in), theme dots, Menu button on a phone, kit footer with "Version ..." line at the bottom; no horizontal scroll at 360/768/1280, light and dark; no CSP errors in the console.
2. Menu links go to /#how, /demo.html, /organizer-guide.html, /brochure.html, /partner.html, /zc.html; footer legal links go to this site's own pages.
3. The old buy box, hero and "games bar" still work. The kit header and the old header are not both visible (check: the old `.snav` was replaced).
Not done: game pages, console, new look.

## Not built yet (nothing to test): Email ID list criterion, new organizer screens, Retro/Modern player look, thank-you strip, Game completed page, consent version, game log 365 days.

## Milestone 4: Email ID criterion (idKind), same design as Bingo 8d1609a
Files: packages/beacon/src/config.ts (idKind "email" stored; "emp" = absent; PATCH accepts "emp"|"email", anything else refused "What the ID is: an employee ID or an Email ID."), apps/edge/src/people.ts (normId, badIdMessage, looksLikeEmail, verifyOf.idKind), apps/edge/src/worker.ts (idKind in cfg in/out, /info idKind, join and "who" use normId), apps/web/public/z.js (label/hint/input type follow idKind), apps/web/public/zc.js (step 2 "Which ID?" shown when a person must give an ID; saved with the settings).
Behaviours:
1. Default game and every old game: idKind "emp" in /info; behaviour as before.
2. Settings PATCH idKind:"email" then GET /info shows idKind "email"; PATCH "emp" returns it; PATCH "x" is a 400.
3. Email game: join with RAJAT1＠DEMO.COM, Rajat1@Demo.com and rajat1@demo.com is the same person and board; a half address ("rajat1@", "rajat1", "a@b") is refused with "Please check your Email ID. It looks incomplete."; list upload does the same per row and counts case duplicates as duplicates.
4. Employee-ID game (new games): typing "a@b.com" is refused with "This looks like an Email ID. This game asks for an employee ID: letters and numbers only."; 1B-678 etc. still clean to 1B678. Games before the threshold keep the old reading.
5. Join page in an Email game says "Your Email ID" (not employee ID), uses an email keyboard and shows "The system will read this as rajat1@demo.com" when cleaning changes the text; the box accepts up to 254 characters.
6. Console step 2: "Which ID?" appears only when "What must a person give" is not "Mobile number"; choice survives save and reload.
Not done: list template, CSV/PDF/Excel headers and the people list viewer still say "Employee ID" for email games; gamerecord export does not carry idKind; Host/Co-host sign-in is not by Email ID in this game.

## Milestone 5: run-1 product fixes and the opt-in new organizer flow
Run-1 fixes (commit d15fc5c): manifest.webmanifest restored to the 1.3.0 game manifest (name/short_name "Corporate Snakes and Ladders", start /z.html, theme #0B5D5B, 192/512 + maskable icons); zsw.js FILES has /screenrules.js and /release-line.js, cache cb-game-v30; index.html scripts: brandkit.js and release-line.js deferred in the head, common/consent/google/site last. Open for the tester/boss: seo.test allow-list does not know theme-init.js (kit says no defer); verify.test sign-ins need the service in TEST mode (WP-17 rule), UC-5 updated by the test author.
Found while wiring: pages/build.mjs FILES did not list the files added in milestones 1 and 3 (screenrules.js, release-line.js, release.json, tokens.css, components.css, theme-init.js, brandkit.js), so a build would not have shipped them. Added now. Please test that pages/public contains every file index.html, z.html and zc.html reference.
New flow (this milestone): files apps/web/public/pack/* (vendored byte for byte; drift check: node tools/vendor-pack.mjs --game <this repo> --check in the console repo), zc-flow-game.js (descriptor), zc-modelink.js, zc.html, zc.js (returns early when ?flow=new), pages/build.mjs.
Behaviours: 1. /zc.html shows "Try the new screens"; click goes to /zc.html?flow=new and the label becomes "Use the previous screens"; the old console is unchanged without ?flow=new. 2. With ?flow=new the old console code does not draw and the 5-step flow draws; no console errors. 3. Steps ask "Which ID?" (Employee ID / Email ID) and save idKind. 4. Prize step lists this game's prizes (Milestone, Reach the end, Team win, Biggest climb, Comeback, Never missed), no tickets A/B, no Super Bumper, no sample ticket, no Lucky Draw, no rehearsals. 5. Publish, payment strip and dashboard calls the game's real endpoints; any endpoint the game lacks (claims, prizes, rehearsals) must not show an error to the organizer.
Unknown / likely gaps: the pack may call /claims and /prizegiven (claims are off in the descriptor); window.ZG.roundAt exists; ticketsFor is not used (sample false). The pack's Host/Co-host and approvals parts need the game's endpoints; not checked. Default switch to the new flow is NOT done.

## Milestone 6: cloud run 2 product fixes
Product fixed:
1. manifest.webmanifest was CORRUPT in 42e79bb (my redirect of git show added a trailing line of tool noise, so JSON.parse failed in branding.test and pwa.test). Rewritten byte-exact from d2a3ebd and parsed with JSON.parse before saving. Expect branding PWA test and pwa.test to pass.
2. data-map D2: the Email ID box on the join page was type="email"; it is now type="text" inputmode="email", so the page source has no type="email".
3. storage-notice R9: theme-init.js keeps ct-theme and cg-theme; both listed under the "theme" item in apps/web/storage-registry.json.
Not product bugs (for the test author / boss):
- verify.test.ts 188 and 198: the owner's test sign-ins are accepted only when the service is in TEST mode (gap wave 1, WP-17, boss ruling Q7). The test database starts in LIVE mode. The test must set mode TEST (mode table row id=1, mode 'TEST') first. Add a second case: LIVE refuses 123456.
- usecases UC-5: an email with an inner space is now cleaned (owner rule), so the old expectation of 400 is wrong.
- seo.test line 74 reads fonts.css with /font-display: swap/; the brand kit file (byte-identical copy, pinned by checksum) writes "font-display:swap" without a space. The regex should allow an optional space. Same test: theme-init.js loads without defer (kit rule) and needs adding to the allow-list.
- no-internal-notes: pack/zc-flow.css and pack/zc-flow.js (vendored byte for byte from the console repo) contain the CSS class "todo" (.zf-ready.todo). Either the test skips apps/web/public/pack/ or the console repo renames the class and the pack is vendored again. I cannot edit the pack here.
Test-file typing items (typecheck, all in test files): demo-pass.test.ts (8), join-gaps.test.ts (11) "x-organizer" header union type; email-clean.test.ts line 14 compares two string literals of different case (a typed-literal comparison; use a variable or cast). The other typecheck errors listed in the results are also in test files; none in product code.

## Run 3 answers (coder)
- verify.test 188 and 198: the TEST IS WRONG, not the product. verify.test.ts never puts the service in TEST mode (it has no mode setup), and the test database starts in LIVE. Since gap wave 1 (WP-17, boss ruling Q7) the fixed code 123456 for demo1/2/3@xyz.in is accepted only in TEST mode, so the answer is {error} with status 400 and no token. The working example is apps/edge/test/wp14-testlogins.test.ts (it switches the mode). Fix: in verify.test.ts set mode TEST before those two tests (and a LIVE case that refuses). If the boss wants the logins to work in LIVE mode again, say so and the coder reverts WP-17 in worker.ts (two places) and testlogins.ts.
- shred.test "personal part stored apart": passes alone and on base; order/time flake in the test (audit_log row from an earlier test in the same run contains "Asha"). Not a product change. Test author: isolate the database per test or clear audit_log in beforeEach.
- Typecheck errors (68): test-file typing only (x-organizer header union in demo-pass and join-gaps; email-clean.test.ts line 14 compares literals of different case).
- seo.test, no-internal-notes, usecases UC-5: unchanged from Milestone 6 notes.

## Milestone 7: audit fixes, branch fix/snakes-1.4.1-audit-2026-10-30 (product code only, not run by the coder)
Exact new behaviours (file:line):
1. Account emails refuse an inner space. `cleanAccountEmail` (apps/edge/src/emailclean.ts:5): NFKC, trim, lower case; a space inside gives "" (refused). Used on sign-in, Google, helpdesk, Host setup, mode, partners, pay, credit, visits, admin, worker and `isTestLogin` (testlogins.ts: 'demo 1＠xyz.in' is no longer a test login). Participant Email IDs still use `cleanEmail` (people.ts normId), which removes inner spaces.
2. Employee-ID wording follows the server. /info and the organizer game info carry `idClean` (worker.ts:103, and the organizer info next to idKind) = empCleanFor(game). z.js:902 (showRead) shows "The system will read this as X" only when idClean is true; zc.js:349 shows "Dashes and spaces are ignored" only when idClean. Release gate: `RELEASE=1 bun pages/build.mjs` throws while EMP_CLEAN_FROM_MS (people.ts) is the year-2100 placeholder or release.json has no releasedAtIST (pages/build.mjs:8-9). RELEASE SESSION SETS AT DEPLOY: EMP_CLEAN_FROM_MS = deploy instant (ms) in apps/edge/src/people.ts, and releasedAtIST in apps/web/public/release.json.
3. Employee-ID game, an email-looking value: the join box shows the plain refusal "This looks like an Email ID. This game asks for an employee ID: letters and numbers only." and never the read-as hint (z.js:902). Email game keeps the read-as hint for the Email cleaner. Console list headers, template, CSV, paste help follow the game (zc.js:537 idLbl: "Email ID" or "Employee ID"; examples are addresses in an Email game).
4. Changing idKind or the verify kind after anyone is listed or joined: 409 "You already have people listed. Start a new game to use a different kind of ID." code id-locked (worker.ts:2010). Unchanged values still save.
5. New organizer flow descriptor: idKind:false, feed:false (zc-flow-game.js). No "Which ID?" radio or "Your Employee ID" preview, no feed block, no GET /gamelog call. (The old console still has "Which ID?", shown only where the join page really asks for an ID.)
6. Ends-when text is true: player chip "Turn N of CAP, ends sooner when K players are home" (team game: "the first whole team is home") (z.js:403); console duration line names the cap and the team rule (zc.js:295, and the "ends when" label for team games).
7. pack/gamelog.html and gamelog.js removed (they loaded /live-game.js, not in the repo), also from MANIFEST.json and pages/build.mjs FILES. release.json is now {"version","releasedAtIST":""}; no internal note ships.
8. clone with people re-hashes ID-known people with the NEW game's rule (clone.ts:28-37; copyPeople gets the new game's config and created_ms); a person the new rule refuses is left out.
9. z.js: the employee-ID box has no maxlength; over 30 characters after cleaning shows the plain refusal and the server refuses it.
10. Duplicates after cleaning: add-people answers `duplicateRows` [{raw, why}] beside the count (people.ts:288); the console summary names up to five (zc.js:607).
11. Sound: no saved choice means sound ON again (z.js:65: !== "off"). NOTE for the boss: gap wave 1 (commit 2f0a74f, SL-11) had deliberately made it quiet by default; this reverts that on the audit's instruction.
NOT fixable here (pack is vendored byte for byte, edit in the console repo and re-vendor): pack/zc-flow.js still has Tambola words ("Ticket number" waiting-table column and winners text, "Numbers are called automatically" at line 338 for non-manual mode) and shows stored Email IDs through cleanEmployeeId with an "Employee ID" column in the waiting/winner tables. Until the console repo adds descriptor switches for those words, the new flow must not be made the default.

## Round 2 (audit fixes, same branch; product code only, not run by the coder)
- PB-10: guide card for the id-locked message in apps/web/public/guide.js (before the "Test payments" entry); server answers the "different kind of ID" sentence when the kind changed and "different way of asking for IDs" when only the verify kind changed (worker.ts id-locked line).
- PB-1: add Host with an e-mail typed but unusable: 400 "That e-mail address does not look right. Please check it." even with a mobile number (worker.ts, /api/org/host, line before the "at least one" check).
- PB-2: every duplicate row is named in duplicateRows (people.ts: three in-list dedupe points, already-listed, seat, and the two insert-ignored loops); raw is the typed ID (or typed number), why says "Already on the list." / "Already in the game." / "Same person as an earlier row ...".
- PB-3: ends-when text: big.js meta line, zc.js help line ep, legal.html milestone item: cap shown, team game ends when the first whole team is home.
- PB-4: zc.js settings (S.cfg) now carries idKind from the server record; Save never sends "emp" for an Email game.
- PB-5: zc.js paste help uses a real string (name, <ID kind>) and the mobile-and-ID line says Email ID in an Email game.
- PB-6: "Try the new screens" entry removed from zc.html with the modelink and pack scripts and styles; zc.js no longer returns early for ?flow=new (the old console always draws). Files stay in the repo and the pack is untouched.
- PB-9: z.js tip now says sound is on unless the player turns it off.
- PN-2 release.json version 1.4.1. PN-3 site.js comment removed. PN-4: an email in an employee-ID box is refused with ONE sentence ("This looks like an Email ID. This game asks for an employee ID: letters and numbers only.") by the server in every game (people.ts normId, badIdMessage), as the phone already does.
- PN-5: cleanAccountEmail refuses \s, U+200B-U+200D, U+2060, U+FEFF, U+0085, U+2028, U+2029; cleanEmail (participant Email ID) removes them (emailclean.ts lines 2 and 5).
- PN-6: pack/MANIFEST.json and pack/gamelog.* are restored byte for byte from origin/release/snakes-1.4.0 (I cannot run the vendor tool: the console repo is not here). gamelog.* is NOT in pages/build.mjs FILES, so it does not ship; the console repo should drop it, then re-vendor. Item 11 of Milestone 7 is amended accordingly.
