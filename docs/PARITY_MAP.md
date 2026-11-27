# Parity map: Corporate Tambola (1.7.0 to 1.8.5) -> Corporate Snakes and Ladders (TEST mode stays TEST)

Statuses: ADOPTED, ADAPTED (how), NOT APPLICABLE (reason), TODO. Sources: handover notes 300, 200, 210 sec D, compare report data\ui\compare-2026-10-30, Tambola branches wip/join-redesign (1.8.3) and feat/tambola-1.8.5-empid. Keep this file current: update the row in the same commit as the work.
Branch: release/snakes-1.4.0. Last updated: 2026-10-30.

| # | Tambola feature | Status | Snakes and Ladders note |
|---|---|---|---|
| 1 | Gap wave 1 (17 items) | ADOPTED | merged, cloud run pending |
| 2 | Uniform employee ID (NFKC, A-Z 0-9, 30 cap, EMP_CLEAN_FROM_MS) | ADOPTED | people.ts cleanEmpId; EMP_CLEAN_FROM_MS is a placeholder (year 2100) until deploy; browser hint on join page |
| 3 | Email ID case-insensitive cleaner | ADOPTED | emailclean.ts used at every email read (sign-in, Host setup, payments, partners, helpdesk, visits, test logins) |
| 4 | Email ID as a list criterion (Employee ID or Email ID, list decides) | ADOPTED (untested) | config idKind emp/email, PATCH settings, /info, join and list cleaned per kind, email in an ID game refused, console step 2 "Which ID?", join label follows. Same design as Bingo 8d1609a. List template/CSV headers still say Employee ID |
| 5 | Open join (Name, Mobile, Email, referred-by from link) | TODO | Snakes today: mobile / employee ID / both |
| 6 | Brand kit header, footer, logo | ADAPTED | landing page done; game pages and console TODO |
| 7 | Version + release date/time IST in footer | ADAPTED | release.json + release-line.js; date filled at release |
| 8 | Fairness wording true for the game's code | TODO | needs a read of the dice code |
| 9 | Rules row only inside the game | ADOPTED | screenrules.js, z.js |
| 10 | Retro / Modern player look, board the only rich element | TODO | |
| 11 | Thank-you strip with Share + WhatsApp | ADAPTED | end card has both; strip at top TODO |
| 12 | Game completed page 30 min after end | TODO | phone does not know the end time; needs a small engine/view field |
| 13 | Participant first-time screens (welcome, not listed, waiting) in the new look | TODO | |
| 14 | Consent version safe | TODO | port from Tambola consent |
| 15 | Claim / heartbeat signals | NOT APPLICABLE / TODO | Snakes has no claim; heartbeat check to be read |
| 16 | Game log 365 days | TODO | |
| 17 | 24 h erase | ADOPTED | Snakes lifecycle already erases (constants in lifecycle.ts: 20 h purge, 19 h report link); re-check against 1.8.x wording |
| 18 | New organizer console, 5 steps, ?flow=new then default, ?flow=old | ADOPTED as opt-in (untested) | pack/ vendored byte for byte from console repo head 66f2ff8 (tools/vendor-pack.mjs); descriptor zc-flow-game.js; "Try the new screens / Use the previous screens" link; default switch TODO after tester evidence. Prize step relies on ZG.PRIZE_HOUSES (milestone, finish, team, climb, comeback, nevermissed); not checked against the pack |
| 19 | Game dashboard (status pills, plain banners) | TODO | |
| 20 | Host and Co-host links, approvals by role | ADAPTED / TODO | Co-host accept exists; Tambola 1.8.0 approval rules to port |
| 21 | Host/Co-host passcode sign-in | NOT APPLICABLE | hidden in Tambola 1.7.0 too |
| 22 | Family Passes (card, approvals, 30-min lapse, 15-min cutoff) | TODO | only where Snakes rules allow; decide with owner |
| 23 | Check-in | TODO | gap wave 1 SL-?? kept check-in for prizes |
| 24 | Payment lifecycle, Razorpay, IT Services by Rajat Agarwal | ADOPTED | TEST mode takes no live payment |
| 25 | Rehearsals | ADOPTED | exists (demo, practice) |
| 26 | Claims / results | ADAPTED | prizes per finisher position; no claim button |
| 27 | Pause in all modes | TODO | check engine: pause exists; all modes to verify |
| 28 | Manual roll = "Press to Roll Out the Next Number" | TODO | wording for the dice button |
| 29 | Dice rounds | ADOPTED | engine |
| 30 | Ticket 1/2, A/B, houses, Super Ticket, Super Bumper, Lucky Draw prize | NOT APPLICABLE | Tambola only (note 34) |
| 31 | Crossed numbers on ticket | NOT APPLICABLE | board is the snakes board |
| 32 | Referral tag "brought by" | NOT APPLICABLE until engine supports it | hidden in 1.7.0 |
| 33 | Demo cap 10, TEST label | ADOPTED | unchanged |
| 34 | Test standard: unit, logic, wire, smoke, regression, 1M+ scenarios, one break per rule | ADAPTED | parity-matrix.test.ts (1,728,000 screen-rule scenarios); more per feature |
