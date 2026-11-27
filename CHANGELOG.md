# Changelog: Corporate Snakes and Ladders

Reconstructed on 20 Nov 2026 from git history, tags and the live `/version.json` (https://snakes.corporatetambola.com/version.json). Before this file there was no changelog and no version policy; entries below the live one are approximate (dates from tags and commits). Unknown values are written "unknown", not guessed. From now on follow the standard: marketing-ledger plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md section 2.2 (newest first; Added/Changed/Fixed; what, where, PR, two audit PASS ids, rollback id).

## 1.5.7 - 2026-11-27 (not deployed)
K3 (decision of 27 Nov 2026): hide the public pages of this game without deleting anything. Based on stacked on PR 20 (head 4703850). Nothing is deployed and the switch is OFF by default.
### Added
- `SITE_HIDDEN` switch (`apps/edge/src/site-hidden.ts`, called from `pages/functions/_middleware.ts`). Public pages can be hidden with one switch. With SITE_HIDDEN set to 1 (a Cloudflare Pages variable, no rebuild) the landing page and the sales pages (/, /index, /about, /brochure, /pricing, /trust, /organizer-guide and the how-it-works pages) show a short 'This game is coming soon' page with a link to home.corporatetambola.com, send noindex (meta tag and X-Robots-Tag), and /llms.txt and /sitemap.xml answer 404; that page has no schema, no Open Graph and no agree buttons. Join links (/j/...), the player page, the host and organizer pages, sign-in, payment return, the legal pages, /api and the console links are NOT touched, so people who already have a link or a game still play. Switch off or unset: nothing changes. Nothing is deleted.
- Test `apps/edge/test/site-hidden.test.ts` (switch off = unchanged, switch on = coming soon, join/host/api untouched).
### Changed
- `pages/build.mjs`: `/llms.txt` and `/sitemap.xml` are now served through the function so the switch can answer them (off: they are served exactly as before).
### Rollback
- Unset `SITE_HIDDEN` in Cloudflare Pages (instant, no deploy), or redeploy the previous version (1.5.6).

## 1.5.6 (27 Nov 2026): payment only through the console (PAY_VIA_CONSOLE, off by default)

Owner order 27 Nov 2026. Stacked on `local/pt23-2026-11-25` (1.5.5). New: `POST /api/console/payable` (signed, read-only: is this the organizer's own game, its pack size as a string, already paid) and `POST /api/console/paid` (signed notice, once per order id, unlocks the game's start), through the bridge copied from the console repo (`console-bridge/`, byte for byte); dark until `CONSOLE_PUBKEYS` is set (and 503 without `PUBLIC_ORIGIN`). With `PAY_VIA_CONSOLE` set to 1: pay pages go to the console (302); `/api/checkout`, `/api/proforma`, `/api/payments/test|paytest|verify`, `/api/paylink/*`, `/api/org/credit`, `/api/z/<id>/paylink|credit|apply-credit|pay-with-credit` answer 410 with the console's address; `placeOrder` opens no order; credit-expiry and ledger C jobs are skipped; `/api/payments/webhook` and `/api/payments/status` stay open. Off: unchanged. Tests: `pay-via-console.test.ts` (10), `bridge-copy.test.ts`. Not run against the real console or Moneypenny.

## 1.5.5 (25 Nov 2026): fix after the second audit of 1.5.4 (angle 2, Medium M1)

Same branch line `p1/owner-rules-v1-1` (this PR is based on it).

### Fixed
- **Audit M1 (Medium): a few seats could still pick the winner of "biggest climb", "biggest comeback" and the team prize.** The 1.5.4 check accepted a report when the named seat had climbed at all (or came back at all) and accepted any whole team. Now `apps/edge/src/replay.ts` plays every seat of the game on the server from the public beacon numbers and the seat list, in parts of `REPLAY_SEATS_PER_CALL` seats (default 100, stored as seat numbers and squares only in `kv tru/<game>/<end turn>/<part>`), and `verifywin.ts` accepts one of these four prizes (climb, comeback, never missed, team) only when it equals what `settleRace` (the same function the phones use) gives for the whole game. A report for a turn the game did not end on is refused. Table games are settled with `playTable`/`settleTable`. Games of the older presence kind have no stored throws and cannot be replayed, so they refuse these four prizes and the organizer gives them in the console.
- **Wording put right.** The page for trust, the AI assistant's facts, the winner e-mail and the notes in the console said nobody can choose or change a winner. A correction from the console (a prize given to another card that claimed it, kept with who made it and when) is real, so the text now says exactly that. The legal terms (`terms.html`) were not edited; see the owner question below.
- **Audit L1:** the privacy line (`packages/shared/src/lines.ts`, the home page, the host and organizer pages) now says that a winner's name, mobile number and employee ID are kept for 365 days so the prize can be handed over.
- **Audit L2:** the order checks (a home place, a milestone line) were skipped after the first winner of a line was accepted; `orderProblem` now runs for every pass.

### Plan fact
- `pages/wrangler.toml` states the paid Workers plan (owner, 2026-10-27). The replay depends on it: the old "a free Worker, about 10 ms" limit written in 1.5.4 does not apply to the live setup. `apps/edge/wrangler.toml` is the unused free-plan design. The replay is cut into parts so that no single call is long even for a large game.

### Still open (honest limits)
- Milestone and finish prizes prove that the named seat really got there on that turn, not that nobody got there first (an exclusive-mode milestone likewise).
- The legal terms (`apps/web/public/terms.html`, `site/terms.html`, section 9.1) say that neither the organizer nor IT Services can add, remove or change a winner in the software; the console correction exists, so the owner should decide the wording of a versioned legal text.
- Audit L3, L5, L6 and L7 and the old `GET` prizes call (L4) were left as they are in this version.

### Added
- Tests: `apps/edge/test/verify-end-prizes.test.ts` (10 tests; 9 of them fail against the 1.5.4 source and all 10 pass now: the audit's probe for the biggest climb and the biggest comeback, a seat that never climbed or the wrong turn, one prize per person, a whole team that did not win, the replay in parts, what is kept and its 24-hour deletion, two games kept apart, the presence-game refusal, and the order check at settling).

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
