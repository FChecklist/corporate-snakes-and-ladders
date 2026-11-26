# Changelog: Corporate Snakes and Ladders

Newest first. Release entries below are taken from `apps/edge/src/releases.json` (the source of truth, served to the owner at `/api/owner/releases`); this file mirrors them. The number a running site reports is `version` in `/version.json`.

## Unreleased (27 Nov 2026, versioning order)
Added
- `/version.json` now also carries `version` (the newest release number in `releases.json`), next to `commit`, `dirty`, `builtAt`, `game`. Where: `pages/version.mjs`, `apps/web/test/version-stamp.test.ts`, `docs/DEPLOYS.md`.
- This CHANGELOG.md and `docs/REPO-KNOWLEDGE.md`.
No game, edge or page behaviour changes. No version bump: the current release stays 1.3.0. Not deployed.

## 1.3.0 - 2026-10-27 (commit 778e6dc)
Snakes and Ladders gets the Tambola hardening
- Joining: a person can give a mobile number or an employee ID (or both, when the organizer asks), a name-only guest still joins, and the same person on the same phone always gets the same board; a join that gets no answer is asked again by the page itself
- A vote or a game-over report is accepted only from the phone that holds the board (device proof); forged ones are refused
- A Co-host must accept the role before paying or using credit; a game cannot be erased while it is being played; a second order while one is being confirmed is refused
- Every refusal comes with what happened, where, and how to fix it (the guide)
- Personal data is deleted 20 hours after a game ends, and the clean-up also runs by itself when the scheduler is late
- The beacon can be read through our own site when a company network blocks it; a slow mirror is skipped
- The big screen shows a red bar when it loses its connection
- A demo link (zc.html?pass=) can be redeemed, also when the console opens straight into a game
- A game that is published but not yet paid for never blocks a new game: only drafts that were never published count toward the limit of ten, when creating and when copying
- The daily database-write guard is raised to 2,000,000 (a runaway guard only), because the account is on the paid Workers plan
- Late move: in a game where players throw, a throw counts only if the server receives it before the turn window ends (the server clock decides). After that the server refuses it with the plain message "Ohooo! Sorry, you moved after your turn ended. This move cannot be made." and records nothing; the player's button goes off and the message goes away with the next turn
- A 10-player Rs 0 demo game is tested end to end (10 join, the 11th is refused, the same phone gets the same board)
- Release history for the owner (this page)

## 1.2.2 - 2026-10-23 (commit 274c350)
Product protection and a new sign-in
- Files sent to the browser are minified, search and AI crawlers are told to stay away, terms 2.4
- Organizer sign-in redesigned: e-mail first, six-box code screen, one sign-in door
- The console remembers the state of each step

## 1.2.1 - 2026-10-21 (commit 13888c4)
Guided errors and the error log
- Every error shows a polite explanation, the steps to fix it, and takes the person there and back
- Errors caught on a visitor's own device are saved with a complete report

## 1.2.0 - 2026-10-15 (commit 881b49d)
Own domain and the same footer as the other games
- The game lives on corporatetambola.com, with one contact address, [Game] mail subjects, the old pages.dev address redirecting, and a top rail with all the games
- New logo; the header mark is a real home link

## 1.1.0 - 2026-10-14 (commit 19c77db)
Rights, consent and the central ledger
- A player can leave at any time and ask what is held about them; terms boxes (K1 to K6) are checked on the server
- Payments, refunds, fees and tax are posted to the central ledger
- Real 3D dice, short animations, an installable app, a big screen for the room

## 1.0.0 - 2026-10-13 (commit 674ba0f)
First release
- Snakes and Ladders for a company event: every player has a pawn on a board, the dice come from a public random beacon, winners are worked out by the software
- Organizer console, Host and Co-host roles, pay-to-publish, 24-hour deletion of participants' data
