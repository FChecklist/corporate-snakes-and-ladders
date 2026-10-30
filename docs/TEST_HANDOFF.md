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
