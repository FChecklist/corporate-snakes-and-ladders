# Changelog: Corporate Snakes and Ladders

Reconstructed on 20 Nov 2026 from git history, tags and the live `/version.json` (https://snakes.corporatetambola.com/version.json). Before this file there was no changelog and no version policy; entries below the live one are approximate (dates from tags and commits). Unknown values are written "unknown", not guessed. From now on follow the standard: marketing-ledger plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md section 2.2 (newest first; Added/Changed/Fixed; what, where, PR, two audit PASS ids, rollback id).

## 1.5.2 (23 Nov 2026): fixes after the two audits of 1.5.1

Same branch `p1/owner-rules-v1-1`, same live line (version 1.4.1, commit 042b4d6 as recorded in the PR on 22 Nov; the live `/version.json` could not be read from the writing session on 23 Nov, see the PR). Not deployed, no money flag or secret touched. Both audits of 1.5.1 (head 86494588) said FAIL on one Medium each. Audit PASS ids: pending (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): the build of commit 042b4d666c68 (built 2026-11-05 17:13 UTC); its Cloudflare deploy id is unknown.

### Added
- Tests in `apps/edge/test/owner-rules.test.ts` (section "1.5.2"): a database failure in the paid notice, a leftover claim row, an order id of another game, a winner's details after the deletion, and the older rules left alone. The test database (`apps/edge/test/d1-sqlite.ts`) now runs a batch as one all-or-nothing step, like D1.

### Fixed
- **Audit 1 M1: the paid notice could use up an order id and then say ok for an unpaid game.** 1.5.1 wrote the order id and marked the game in two separate steps; a database error between them left the order id used and the game unpaid, and the console's retry then got `already: true`. Now both are one batch (all or nothing) and the game is marked only if the order id row names this game, so one order id still cannot mark two games. If the batch fails the answer is 503 `try-again` and nothing is left behind. A repeat answers `already` only when the game really is paid; a leftover order id row for an unpaid game is finished by the repeat.
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
