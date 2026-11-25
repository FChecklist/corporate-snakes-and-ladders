# Changelog: Corporate Snakes and Ladders

Reconstructed on 20 Nov 2026 from git history, tags and the live `/version.json` (https://snakes.corporatetambola.com/version.json). Before this file there was no changelog and no version policy; entries below the live one are approximate (dates from tags and commits). Unknown values are written "unknown", not guessed. From now on follow the standard: marketing-ledger plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md section 2.2 (newest first; Added/Changed/Fixed; what, where, PR, two audit PASS ids, rollback id).

## 1.6.0 (25 Nov 2026): the Snakes and Ladders gaps of the owner's evaluation of 24 Nov

Branch `cloud/snakes-gaps-2026-11-25`, opened as a draft pull request whose base is PR #15's branch `cloud/nickname-name-only-2026-11-25`. **Base note:** PR #15 (name check on a name-only join) sits on `master` (version 1.3.0 plus docs), not on PR #14, and docs/KNOWLEDGE.md says work must be based on the live line. So PR #14's head `p1/owner-rules-v1-1` (version 1.5.4) was merged into this branch first (merge commit `7e0bd33`); the pull request therefore shows PR #14's commits as well as the gap work. Not deployed, the money flag and every secret untouched (`pages/wrangler.toml` and `config/` are unchanged). Audit PASS ids: none yet; nothing is claimed here (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): unknown; nothing of this branch is live.

### Added
- **Retro / Modern board look (gap 2).** The player page has a "Board look" choice (Retro, the default, or Modern) above the board, copied in mechanism from Corporate Tambola (a key on the phone, an attribute on the page, a radio group). Per player: kept only on the player's own phone under `snk-look`, read before the first paint by `looks.js`, nothing is sent to the server. Styles in `looks.css`. 15 tests in `apps/web/test/board-look-picker.test.ts`.
- **Snakes' own colours (gap 3).** The scheme "Ember and Rung" lives in one file, `snakes-scheme.css` (rust, honey-orange, dark brown, clay; no teal, no other game's colours), and every stylesheet, page, icon and theme-colour meta uses it. The copied teal block and the copied blue/maroon/emerald theme dots are gone. Test: `apps/web/test/snakes-colours.test.ts`.
- **AI help (gap 4).** `/ai-manual` (a full public page for an AI assistant, with the payee read from the payee record, never typed in), a new `llms.txt`, the three message fields in both manuals, and one plain refusal: an AI key (`cba_`, prefix kept) cannot pay on any payment route.
- **Winner and closing messages (gap 5).** Settings `preGameMessage`, `winnerMessage` and `closingMessage` (plain text, up to 300 characters); a winner is told what they won, then the organizer's winner message; everyone sees the closing message at the end.
- **Rules in one short line each (gap 7).** The milestone tie-break, the exact finish and what happens on a tie are in `packages/shared/src/lines.ts`, on the player page ("Rules, one line each") and on the home page, and `packages/beacon/test/rules-lines.test.ts` proves each by playing the engine.
- **The AI manual can be found.** The home footer and the page where the organizer gets the AI link both link to `/ai-manual`.
- **Wording tests (gaps 1 and 6).** `apps/web/test/wording-rules.test.ts` fails if the old word for a name appears anywhere, and for host, guest, participant, ticket, payment words and "your" or "my" every scanned file holds zero (`wording-baseline.json` is empty and can only stay that way); no new tick box, no new "I agree" line and no Hindi text can be added; `docs/WORDING_2026-11-25.md` lists the rules.

### Changed
- **A player gives a name (gap 1).** The check of PR #15 stays (2 to 20 letters, numbers or spaces, HTML removed) as `cleanPlayerName`, with plain, kind messages and the codes `bad-name` and `need-name`. The word "nickname" is gone from the join page, share text, consoles, big screen, privacy and trust pages, the AI manuals and the ten facts.
- **Words (gap 6).** game and player; co-organizer (the `cbh_` role) and invite-only co-organizer (the `cbc_` role) instead of host and co-host; boards, never tickets; "Pay now" and credits; Razorpay is not named on marketing pages; no my, mine, your or yours in what is read (see "Not done"). The fairness sentence now says "not the co-organizer" and the privacy sentence says "player information".
- The home and about pages said a turn lasts 20 seconds and that players press the dice; the live line has a 10-second window and the dice roll by themselves.

### Fixed
- PR #15's own tests made their game with a 20-second window, which the live line refuses (400); they use 10 seconds now (merged base: 4 failing tests before, 0 after).
- An AI key could start an anonymous checkout before; every payment route now answers it first with the plain refusal.
- Two of the ten AI facts were not true for this game: fact 3 allowed a second board (the game refuses it) and said every player has their own board (a table game shares one); fact 8 now names the three messages and says who pays.
- The error guide and the AI guide pointed to a "Players card" that is not on the screen; they now say The people (step 6), as the screen and the server message do.
- Phrases a word swap left broken ("the own", "on the behalf", "not the doing", "Thank you for the interest", "An game") are written properly again, and a wording rule blocks them.

### Not done on purpose
- Text the wording tests do not read: the legal documents, the invoice terms, the recorded consent sentences (see below), the older release notes, the static `site/` copy and the documents under `docs/`. A person should also read the console and the error guide once for flow: the "your" and "my" sentences were rewritten with a parser-based tool, not by hand (see docs/WORDING_2026-11-25.md).
- The recorded consent tick boxes (K1 to K6) and `consent.js` / `consent-text.json` ("I agree") are a legal act tied to Terms version 2026-11-01 and are not changed; the legal documents are not edited.
- The static `site/` pages (an older copy, not built into the live site) are only partly updated.
- Nothing was deployed, merged or pushed to `master`.

## 1.5.4 (23 Nov 2026): fix after the security audit of 1.5.3

Same branch `p1/owner-rules-v1-1`, same live line (version 1.4.1, commit 042b4d6; checked 23 Nov: it is an ancestor of the branch, 18 ahead and 0 behind with this version, the base `rc/snakes-runner-2026-11-05` is that line, nothing to merge in). Not deployed, no money flag or secret touched (`pages/wrangler.toml` and `config/` are unchanged). Audit of 1.5.3 (head 11841d0c): correctness PASS; security FAIL with one High (H1) and two Mediums (M1, M2). This version fixes all three and the Lows that could be fixed safely, each with a test that fails on the 1.5.3 source. Audit PASS ids: pending (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): unknown, nothing of this branch is live.

### Fixed
- **Audit H1 (High): a few seats could make a winner up, even before the game began.** The server settled a prize when `quorumFor(people)` seats sent the same answer and checked only the shape of the answer. Now `apps/edge/src/verifywin.ts` checks every report before it is counted: (1) the turn named must have happened (its public beacon number is out, with the game's pauses, breaks and stop applied); an early report is answered 409 `not-yet` and the phone keeps it and sends it again; (2) every winner named must be a seat of the game; (3) the prizes that need the whole game (biggest climb, comeback, never missed, team, and every prize when one-prize-per-person is on) wait until the game is over, by its schedule or by the phones' own "over" report; (4) the named seat must really have got there: the server fetches the same public beacon numbers the phones use (kept once per game under `bcn/<game>/<round>`, checked for round, shape and randomness = hash of the signature), plays that one seat's board forward and checks the milestone turn, the home turn, a real ladder or a real snake escape; a team prize must be one whole team as dealt by the game's fate; a lucky draw is worked out again from the round that ends its break; home places and milestone lines must agree with the lines already settled (one seat cannot hold two places, a better place cannot come after a worse one). A report that fails is never counted, so no quorum can form for it. A report that was checked once is remembered (`vok/<game>/<digest>`). Both kinds of rows go with the game's data in the 24-hour deletion.
- **Audit M1 (Medium): a winner's name, mobile number and network address stayed in the security log while the e-mail said they were gone.** The 1.5.2 and 1.5.3 change that wiped a winner's name and number at 24 hours is **reversed on the owner's rule: a winner's name and contact are kept for 365 days on purpose**. What changed instead: a winner's prize confirmation row in the security log is now always split, with no switch: the winner's seat, name and mobile number stay in the core of the row for 365 days (readable as `details.winner`), and the network address, browser, phone id, participant id and everything else of the request are sealed under the game's own key and destroyed with it at 24 hours. Nothing depends on `OWNER_RULES` any more, so there is no mismatch at a deploy or a rollback (tested in all four on/off orders). The report, the e-mails, the home page, `llms.txt`, the trust page and the "deleted" e-mail say exactly this (`reportgen.js` rebuilt).
- **Audit M2 (Medium): an employee ID typed into a link for a game that does not exist was kept for 365 days, and a script could fill the database.** A participant call for a game id that is not a game now writes no log row and makes no key; a failed join for a real game keeps the typed ID only in the sealed part (gone at 24 hours).
- **Audit L1:** the platform key and the scheduler's key are compared in constant time (`sameSecret`).
- **Audit L3:** the join counter counts by network (an IPv6 phone cannot change its address to start again) and in one database step (a burst cannot slip past).
- **Audit L4:** a caller's own `x-request-id` is no longer copied into the log (only the network's `cf-ray`); the country column of a participant row is no longer kept (it is in the sealed part).
- **Audit L5:** the phone asks for its prizes with POST and sends its proof in the body, not in the address (`GET` still answers for older pages). No log row is written for that read.
- **Audit L6:** a report step that fails every time can no longer hold back the 24-hour deletion.

### Added
- Tests: `apps/edge/test/vote-check.test.ts` (the probe of the audit; made-up wins before the game, before the turn, for a seat that does not exist, for a real seat that did not get there; the honest flow with the true result of a whole game worked out the way a phone works it out, with a brand break, a lucky draw and a team race; the public numbers: unreachable, wrong, fetched once), `apps/edge/test/audit-lows.test.ts`, and the new section "1.5.4" of `apps/edge/test/owner-rules.test.ts`. `apps/edge/test/beacon.ts` is a stand-in for the public beacon's servers and `apps/edge/test/truth.ts` the true result of a game; the older tests that put a winner in place now report the true winner.
- `scheduleOf` is exported from `apps/edge/src/lifecycle.ts`; `winnerPart` and `sameSecret` are new exports.

### Changed
- A phone's report of a win can now be answered 409 `not-yet` (the turn or the end has not come, or the public numbers are still being fetched, 20 per call). The phone page already keeps a report that was not accepted and sends it again; a long game (up to 150 turns) is checked over a few of those calls.
- The guide lists "Not yet: the game has not got there" as a message between phones and the server (nobody reads it).
- Decision of the owner, taken from the audit task of 23 Nov: winners are kept 365 days. The consent sentence ("the name and mobile number I confirm for the hand-over are kept for 365 days") and the Terms retention table already said so; they are not changed.

### Not changed on purpose
- **What the server cannot do on a free Worker (about 10 ms of work per call): replay every seat of a big game.** It proves that the named seat really got there, not that nobody else got there first. A few seats can still choose which REAL winner of a prize is reported (for example the second finisher as the first), but they cannot invent a win, name a seat that does not exist, or settle anything before it has happened. The organizer's console replays the whole game and its override stays the final word. A game where a missed throw counts (`play: "presence"`, older games only) and the shared-board table game get the timing, seat and one-winner checks only.
- The signature of each fetched beacon number is not checked on the server (a free Worker cannot afford it); it is fetched over a secure connection from the beacon's own servers only (not through our relay), and only its shape is checked. The phones still check the signature.
- Audit-log rows written by an earlier version keep what they hold until 365 days: rows are chained and cannot be edited. The live version (1.4.1) writes a winner's confirmation whole, with the network address. From this version on the address is sealed and destroyed at 24 hours.
- Audit L2 (the platform key doubles as the data key if `DATA_KEY` or `PHONE_SALT` is unset; `STRICT_KEYS` not set in `pages/wrangler.toml`): this needs the owner's secrets set first (`DATA_KEY`, `PHONE_SALT`, then `STRICT_KEYS=1`), so `pages/wrangler.toml` is not touched here.
- The "ID matched, not proven" decision, the `content-length` cap and the one-address limit for a whole office are unchanged (owner decisions).

## 1.5.3 (23 Nov 2026): fix after the security audit of 1.5.2

Same branch `p1/owner-rules-v1-1`, same live line (version 1.4.1, commit 042b4d6; checked 23 Nov: it is an ancestor of the branch, head 16 ahead and 0 behind, the base `rc/snakes-runner-2026-11-05` is that line, nothing to merge in). Not deployed, no money flag or secret touched (`pages/wrangler.toml` and `config/` are unchanged by this version). Audit of 1.5.2 (head 62c123b9): correctness PASS; security FAIL with one Medium (M1). This version fixes M1 and the Lows that could be fixed safely, each with a test that fails without the fix.

### Fixed
- **Superseded by 1.5.4: the winner part of this version (M1 and L4) was reversed on the owner's rule that winners' name and contact are kept 365 days; see 1.5.4.**
- **Audit 2 M1: a winner's name, mobile number and phone id stayed readable in the security log for 365 days.** The prize confirmation (`/confirm`, event `prize`) was the one participant event kept whole: its sealed row held `{pid, name, phone}`, the phone's own id (`device_id`) and the network address and browser, under the platform key, so the 24-hour deletion (which only cleared the `prize` table) never reached it. Now, under owner rules 1.1, a participant's `prize` rows are split like every other participant row (`apps/edge/src/audit.ts`, `splitsPersonal`): the personal part goes into `audit_pii`, sealed under the game's own key, and the 24-hour deletion destroys that key (`shredParticipantAudit`). What stays in the open part of the row is not personal: that a confirmation happened, when, its status and the country. The chain still verifies after the deletion. A try after the deletion (403) writes no personal part either. A legal hold keeps the sealed part until it is lifted, as for every other participant row. Without the rules the older behaviour is unchanged (the older pages say 365 days).
- **Audit 2 L4: the public pages contradicted the privacy line.** The home page (`index.html`, the "Privacy by design" card and the data FAQ), `llms.txt`, the trust-page source and the "deleted" e-mail now say what the code does: a winner's confirmed name and mobile number are deleted with everyone else's within 24 hours, so hand the prizes over the same day; only the winners record (seat, prize, round, time, given or not; no names) and the organizer's details are kept 365 days. The organizer's report PDF and e-mail say the same for games on the rules (`winnersGone`, set from `OWNER_RULES`) and keep the older text otherwise. `reportgen.js` was rebuilt with `bun run build:report` (the rebuild also renames minified variables: the committed file was built with another bun version).
- **Audit 2 L1: a lost reply after a committed batch freed the order id.** If the database committed the paid notice but reported an error, the old code deleted the claim row while the game stayed paid, so the same order id could mark a second game. Now the code looks first: a paid game with this notice's own claim row is finished as a success and the claim stays.
- **Audit 2 L2: the published and paid-by markers were written after the batch only.** If they failed, the retry said `already` and never wrote them. A repeat for a paid game now writes them (insert-or-ignore).

### Added
- Tests in `apps/edge/test/owner-rules.test.ts` (section "1.5.2", which holds the 1.5.2 and 1.5.3 tests): confirm a winner with name, number, phone id and network address; run the deletion; read the opened audit log and every column of every table and find none of them; the chain verifies; a late try leaves nothing; a legal hold keeps it until lifted; the older rules keep the row whole; the lost-reply case; the missed-markers case. The M1 test, the hold test, L1 and L2 fail on the 1.5.2 source.

### Not changed on purpose
- Audit-log rows written before this version by a Worker with owner rules on keep their winner details sealed whole until 365 days (a row cannot be edited without breaking the chain). Owner rules 1.1 is not deployed (the live Worker has no `OWNER_RULES`), so no such row exists in production.
- The Terms retention table (`terms.html`, `site/terms.html`) still lists "details a winner confirms" at 365 days. That is legal text tied to the Terms of 1 Nov 2026 and the consent ticks; it states a maximum, and deleting earlier breaks nothing. The owner decides when to word it again.
- Audit Lows left for the owner as before: the notice size cap trusting `content-length`, `jbm/` and `jlim/` using the whole address, and "ID matched, not proven".
- Not run here: the live `/version.json` could not be read from this session; the ancestry check uses the recorded live commit `042b4d666c68`.

## 1.5.2 (23 Nov 2026): fixes after the two audits of 1.5.1

Same branch `p1/owner-rules-v1-1`, same live line (version 1.4.1, commit 042b4d6 as recorded in the PR on 22 Nov; the live `/version.json` could not be read from the writing session on 23 Nov, see the PR). Not deployed, no money flag or secret touched. Both audits of 1.5.1 (head 86494588) said FAIL on one Medium each. Audit PASS ids: pending (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): the build of commit 042b4d666c68 (built 2026-11-05 17:13 UTC); its Cloudflare deploy id is unknown.

### Added
- Tests in `apps/edge/test/owner-rules.test.ts` (section "1.5.2"): a database failure in the paid notice, a leftover claim row, an order id of another game, a winner's details after the deletion, and the older rules left alone. The test database (`apps/edge/test/d1-sqlite.ts`) now runs a batch as one all-or-nothing step, like D1.

### Fixed
- **Audit 1 M1: the paid notice could use up an order id and then say ok for an unpaid game.** 1.5.1 wrote the order id and marked the game in two separate steps; a database error between them left the order id used and the game unpaid, and the console's retry then got `already: true`. Now both are one batch (all or nothing) and the game is marked only if the order id row names this game, so one order id still cannot mark two games. If the batch fails the answer is 503 `try-again` and nothing is left behind. A repeat answers `already` only when the game really is paid; a leftover order id row for an unpaid game is finished by the repeat.
- **Superseded by 1.5.4: the winner part of this version was reversed (winners' name and contact are kept 365 days, the owner's rule).**
- **Audit 2 M1: the privacy line was false for winners.** "All participant information, including IDs, is deleted within 24 hours after the game ends" was not true for a winner: the prize record kept the sealed ID (and the name and number the winner typed) for 365 days. Under owner rules 1.1 the deletion (`erasePersonal`) now clears the sealed details, the first copy and the change history of every prize record. The winners record stays: seat, prize, round, time, confirmed or not, given or not. Without the rules the older behaviour is unchanged. The owner's wording of the line is not touched.

### Changed
- Decision taken without a BOSS comment on the PR (none exists): the line is made true in code instead of softened in words, because the words are the owner's and a privacy promise must be true. If the owner would rather keep winners' name and number for 365 days, the line must then say so with the owner's own words; that is the owner's call and needs a new version.
- Typo: "anyone" starts a sentence with a capital in 1.5.1 below.

### Not changed on purpose
- Audit Lows left for the owner: no change to the "matched, not proven" decision; the notice size cap trusts `content-length` (Cloudflare caps the body; no data risk); the join counters `jbm/` and `jlim/` still use the whole address; the AI guide line for older-rules games still says "names and mobile numbers"; the `SUITE_RULES.md` line for the ID decision is the owner's file.

## 1.5.1 (22 Nov 2026): fixes after the first two audits of 1.5.0

Same branch `p1/owner-rules-v1-1`, same live line (version 1.4.1, commit 042b4d6). Not deployed. Both audits of 1.5.0 (head 6cba1ef3) said FAIL; this version fixes what they found. Audit PASS ids: pending (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): the build of commit 042b4d666c68 (built 2026-11-05 17:13 UTC); its Cloudflare deploy id is unknown.

### Fixed
- **Wrong employee IDs are now really limited.** In 1.5.0 the limit counted each wrong ID with a read and then a write, so guesses sent at the same moment could pass; it used the whole address, so a phone on mobile data could change the last half of its IPv6 address and start again; and the "Is this you?" check and joining were counted by separate code. Now one count is shared by both, it is raised in one step in the database, and an IPv6 address counts by its first 64 bits (its network). The limit is 30 wrong IDs for each game, each network and each 10 minutes. The 31st is refused with "Too many tries" and is not added to your waiting list. The counters hold only a hash of the network (no ID) and are deleted with the game's other participant data (and by the daily clean-up).
- **The AI guide names the button the way the screens do:** "Your people" (it said "My people"), and "List your games". A test now checks the AI guide text as well.
- **One order id can never mark two games paid.** The console's notice now claims its order id first and marks a game only if it won the claim. A notice for a game that is already paid answers "already" and no longer uses up its order id.
- **A secret shorter than 32 characters is not accepted** for `CONSOLE_PAID_SECRET` (the notice address then answers 404, as if no secret were set). Use a long random value.
- A label in the owner's price tool said "Rs 1": it says the rupee sign now.

### Changed
- **The help text and the notes now say what the ID check is.** An ID is matched, not proven: it is matched to your list and nothing more. Anyone who types an ID on your list takes that person's place, so send the game link only to the people you invite. This is the owner's accepted decision (`docs/SUITE_RULES.md`). The limit above applies to wrong IDs only: **a right ID is never counted** and is never refused by it, because an office shares one network address. It slows a guesser down; it does not stop one. A refusal also tells a guesser which tries were wrong; that is part of the same decision.
- The fairness sentence in `docs/KNOWLEDGE.md` now reads "next roll", the same words as the pages (the owner's source note in `docs/SUITE_RULES.md` says "next number").

### Not changed on purpose
- No limit on right IDs, and no per-game limit on wrong IDs (it would let one person lock out people who are really on their way in).
- `verify` and the Razorpay webhook still finish an order opened before the deploy, so "paid only from the console" is true for every order opened after it (KNOWLEDGE section 4a).
- Audit notes left for the owner: `apps/web/test/version-numbering.test.ts` runs `pages/build.mjs` and rewrites `pages/public` (a folder that git ignores).

## 1.5.0 (22 Nov 2026): owner rules 1.1

Branch `p1/owner-rules-v1-1`, built on the live line (`rc/snakes-runner-2026-11-05`, commit 042b4d6, the build that is live: version 1.4.1), with the milestone tie-break fix of PR 12 and the 20 Nov docs added. Not deployed. PR: the one opened from this branch. Audit PASS ids: pending (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): the build of commit 042b4d666c68 (built 2026-11-05 17:13 UTC); its Cloudflare deploy id is unknown.

### Added
- **Invite by ID only.** You paste or upload employee IDs, one per line. No name and no mobile number is asked or kept. `A-1101`, `A 1101` and `A/1101` are the same ID. An ID that is not on your list waits for your yes or no.
- **Paid only from the console.** `POST /api/console/paid` takes the console's notice (signed with the shared secret `CONSOLE_PAID_SECRET`) and marks the game paid, once for each order id. No money is taken by this site. The money flags stay off: the address answers 404 until the secret and `OWNER_RULES=1.1` are both set.
- **One privacy line and one fairness sentence** on the landing pages, the console and the player page. A test proves the fairness sentence is true.
- **Version numbering.** `version.json` in the repository root (number and the last 20 changes), copied into the live `/version.json`; all package files and `release.json` carry the version number (1.5.1 now).

### Changed
- **Every organizer and host screen says you**, never I, my or me (a test keeps it that way).
- **The game starts by itself and every throw happens by itself.** "Players throw" is gone for new games.
- **Prices carry the rupee sign** (console, mails, pricing, AI manual).
- The footer no longer offers the Rs 1 payment test; it says you pay once, in the console.

### Fixed
- Milestone tie on the same turn is decided by the square at arrival (PR 12).

### Not changed on purpose (owner to decide)
- The recorded tick-box sentences (`consent.js`, `consent-text.json`, K1 to K9) are still first person ("I agree"): they are the legal record tied to Terms version 2026-11-01. A change needs a new Terms version.
- `OWNER_RULES=1.1` in `pages/wrangler.toml` turns the new rules on for games made after the deploy. Games made before keep the rules they were made with. Remove the line to go back.

## Live now
Version 1.4.1 (from `apps/web/public/release.json` in that commit; the live `/version.json` has no version field yet); commit `042b4d666c68`; built 2026-11-05 17:13 UTC. Version 1.5.1 above (which includes 1.5.0) is built but not deployed.

## History (newest first)
- Live version: unknown (no version field yet). Live build commit 042b4d666c68 built 2026-11-05 17:13 UTC: "publish: record 'e-mail owed' in the same all-or-nothing step, send it on the next visit" (runner branch from 5 Nov 2026; for Lucky Draw: draw tail resumable, publish records 'e-mail owed'). Where: apps/edge/src (publish path). Audit ids and rollback id: unknown.
- 2026-11-14: docs/knowledge map (head of the default branch).
- Release tags (date, commit): snakes-private-2026-11-01 2026-11-01 798b90d; snakes-funnel-2026-11-01 2026-11-01 95afbd2; snakes-cache-2026-10-31 2026-10-31 accd862; snakes-release-2026-10-31 2026-10-31 33e649b.
- 2026-10-31 and 2026-11-01 releases: first live releases, funnel statistics, cache rule, private-site headers. Details: `git log` and docs/DEPLOYS.md.
