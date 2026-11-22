# Changelog: Corporate Snakes and Ladders

Reconstructed on 20 Nov 2026 from git history, tags and the live `/version.json` (https://snakes.corporatetambola.com/version.json). Before this file there was no changelog and no version policy; entries below the live one are approximate (dates from tags and commits). Unknown values are written "unknown", not guessed. From now on follow the standard: marketing-ledger plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md section 2.2 (newest first; Added/Changed/Fixed; what, where, PR, two audit PASS ids, rollback id).

## 1.5.0 (22 Nov 2026): owner rules 1.1

Branch `p1/owner-rules-v1-1`, built on the live line (`rc/snakes-runner-2026-11-05`, commit 042b4d6, the build that is live: version 1.4.1), with the milestone tie-break fix of PR 12 and the 20 Nov docs added. Not deployed. PR: the one opened from this branch. Audit PASS ids: pending (two independent audits on the exact SHA are asked for in the PR). Rollback id (previous deploy): the build of commit 042b4d666c68 (built 2026-11-05 17:13 UTC); its Cloudflare deploy id is unknown.

### Added
- **Invite by ID only.** You paste or upload employee IDs, one per line. No name and no mobile number is asked or kept. `A-1101`, `A 1101` and `A/1101` are the same ID. An ID that is not on your list waits for your yes or no.
- **Paid only from the console.** `POST /api/console/paid` takes the console's notice (signed with the shared secret `CONSOLE_PAID_SECRET`) and marks the game paid, once for each order id. No money is taken by this site. The money flags stay off: the address answers 404 until the secret and `OWNER_RULES=1.1` are both set.
- **One privacy line and one fairness sentence** on the landing pages, the console and the player page. A test proves the fairness sentence is true.
- **Version numbering.** `version.json` in the repository root (number and the last 20 changes), copied into the live `/version.json`; all package files and `release.json` carry 1.5.0.

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
Version 1.4.1 (from `apps/web/public/release.json` in that commit; the live `/version.json` has no version field yet); commit `042b4d666c68`; built 2026-11-05 17:13 UTC. Version 1.5.0 above is built but not deployed.

## History (newest first)
- Live version: unknown (no version field yet). Live build commit 042b4d666c68 built 2026-11-05 17:13 UTC: "publish: record 'e-mail owed' in the same all-or-nothing step, send it on the next visit" (runner branch from 5 Nov 2026; for Lucky Draw: draw tail resumable, publish records 'e-mail owed'). Where: apps/edge/src (publish path). Audit ids and rollback id: unknown.
- 2026-11-14: docs/knowledge map (head of the default branch).
- Release tags (date, commit): snakes-private-2026-11-01 2026-11-01 798b90d; snakes-funnel-2026-11-01 2026-11-01 95afbd2; snakes-cache-2026-10-31 2026-10-31 accd862; snakes-release-2026-10-31 2026-10-31 33e649b.
- 2026-10-31 and 2026-11-01 releases: first live releases, funnel statistics, cache rule, private-site headers. Details: `git log` and docs/DEPLOYS.md.
