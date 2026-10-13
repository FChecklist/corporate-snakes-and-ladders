# Gates: Corporate Snakes and Ladders (local build, not deployed)

Format: `ID | true/false | proof | note`. true = a passing test or a direct file check. OWNER = only the owner can do it. Nothing here was run in a browser or on a deployed site (local only, RAM rule).
Last full local run: 938 tests pass, 2 fail (both in `apps/edge/test/privacy.test.ts`: the report's winner-confirmation text and one exact-deletion-date check, still using Bingo prize names in the fixture).
Suites removed because they tested Bingo-only screens or features that do not exist here: `apps/web/test/pages.test.ts` (console and phone page scenarios), `phone-guest`, `houses-pages`, `testmode-banner`, `visits-dom`, the Bingo HTTP crowd harness, and about 45 Bingo-only edge tests (claims, rounds, two cards, late joiners, patterns). The new engine, game-settings, consent, paid-window and crowd tests replace what applies.

## G. Game life cycle
G1 | true | game-settings.test.ts "settings given at creation are kept" | game type, play mode, board, milestones, turn limit, prizes
G2 | true | game-settings.test.ts (info read back after create and PATCH) |
G3 | true | free-launch.test.ts:72 (publish returns shareUrl) |
G4 | false | join API: game-settings.test.ts "a join returns..." | phone page z.js never opened in a browser
G5 | false | | waiting-room code exists in z.js; not run
G6 | true | unplayed.test.ts (game locked until paid), game-settings.test.ts "sign-up closes at the start" |
G7 | true | RULES.md R1-R43; tests in packages/beacon/test (board, play, race, table-view, config), game-settings.test.ts, consent.test.ts | R42 (nickname only) is covered by nameonly.test.ts
G8 | true | board.test.ts R3, play.test.ts R13/R14, table-view.test.ts R34 (sealed order), view R37 | nothing in the browser can set a board, a roll or an order
G9 | true | game-settings.test.ts (impossible or foreign results dropped), snakes-crowd.test.ts (accepted winners = independent computation) |
G10 | true | table-view.test.ts R40 (pause and stop shift the turns), control.test.ts | pause banner on the phone page not run in a browser
G11 | false | | no test of a phone that loses connection and comes back
G12 | false | engine ends: snakes-crowd.test.ts | results screen not run in a browser
G13 | true | clone.test.ts ("Play again" makes a new game with the same settings; one round per game) |
G14 | false | | luckyWinners exists; no eligibility test
G15 | false | schedule shift for breaks: table-view.test.ts R40 | display and skip not run in a browser
G16 | true | snakes-crowd.test.ts: 6 players; 4, 12, 20 players; a team race of 8 |
G17 | true | snakes-crowd.test.ts: 100 players (the smallest plan), all phones agree |
G18 | false | erasePersonal deletes seats, players and their acceptances (consent.test.ts, privacy.test.ts) | the scheduled job is not deployed (D5)

## P. Product
P1 | false | | copy rewritten, short sentences not checked
P2 | false | shared.test.ts checks PACKS | pricing page numbers not compared by a test here
P3 | true | free-launch.test.ts | no free play tier is promised; building and publishing are free
P4 | false | | no browser
P5 | true | pwa.test.ts (manifest, icons, saved file set incl. consent.js) | offline screen not run
P6 | false | |
P7 | false | seo.test.ts passes (titles, canonical, sitemap, robots) | share image `/img/card.webp` is missing
P8 | false | | first-party report code carried over; delivery not run
P9 | false | files contain rajatsiroffice@gmail.com and +91 96503 97480 | OWNER confirms
P10 | false | gamesbar.test.ts (links listed) | links not fetched
P11 | true | apps/web/public/404.html, site/404.html |
P12 | false | | not deployed

## O. Organizer
O1 | true | account.test.ts, ai-signin.test.ts, consent.test.ts K2 |
O2 | true | pay.test.ts (right amount, from the server) |
O3 | true | pay.test.ts, unplayed.test.ts |
O4 | false | pay.test.ts has invoice and mail rows | real delivery not run
O5 | true | brand-ticket.test.ts (brand and logo) | brand slots on the phone page not run
O6 | true | roles.test.ts, host-setup.test.ts (limits enforced) |
O7 | true | people.test.ts (list, remove), worker.test.ts (erase) |
O8 | false | | report tests partly failing (privacy.test.ts)
O9 | true | cancel.test.ts, credit.test.ts, reopen.test.ts, paid-window.test.ts (no refund; credit; move within 365 days from payment) |
O10 | true | worker.test.ts / privacy.test.ts (erase) |
O11 | false | contact page is a mail link | no auto-reply here

## U. Player
U1 | true | consent.test.ts K4 (boxes before the name field, server refuses without) |
U2 | true | consent.test.ts (row: kind, ref, version, boxes, text hash, time) |
U3 | true | nameonly.test.ts |
U4 | true | game-settings.test.ts (results name seats, never names or numbers) |
U5 | false | |
U6 | false | | organizer-side request exists; no player-side flow test
U7 | true | terms.html clause 17, contact.html |
U8 | true | K4 box B, terms clause 12 |

## A. Admin (owner)
A1 | true | pay.test.ts (central ledger path) |
A2 | true | pay.test.ts (webhook log, bad signature logged) |
A3 | false | |
A4 | false | | no owner refund screen; policy says no refund after payment
A5 | true | mode.test.ts (TEST/LIVE switch) | not a per-site kill switch
A6 | false | |
A7 | false | |
A8 | false | |
A9 | false | |

## E. E-mail
E1-E13 | false | mail bodies are tested through the outbox in pay.test.ts, credit.test.ts, privacy.test.ts | no real send, no DNS lookup (OWNER for DNS)

## D. Data
D1 | false | docs/PRIVACY_AND_LIFECYCLE.md carried over | not re-checked for this game
D2 | false | |
D3 | true | consent.test.ts |
D4 | true | nameonly.test.ts (nickname only), consent.test.ts (no number or address in the log) |
D5 | false | | deletion code is tested; the schedule is not deployed
D6 | true | privacy.test.ts (winners record and payments kept apart) |
D7 | false | |
D8 | true | terms.html clause 17 |
D9 | false | docs/BREACH_RUNBOOK.md carried over |
D10 | false | |
D11 | false | |
D12 | true | audit.test.ts |
D13 | false | |

## R. Rules
R1 | false | no real-money stake wording is on the app pages and every site page (file check) | wording needs the owner's check
R2 | n/a | not a lucky-draw product |
R3 | true | terms.html clause 1 and 17 (IT Services by Rajat Agarwal, grievance officer) |
R4 | true | terms, privacy, refund policy pages exist and are linked in the footer |
R5 | false | | OWNER/CA
R6 | false | |
R7 | false | |
R8 | n/a | |
R9 | false | |
R10 | false | |
R11 | true | paid-window.test.ts (refund page = code: no refund, move within 365 days from payment) |
R12 | false | | OWNER

## Y. Payment
Y1 | false | | OWNER (central catalogue); plan ids `snakes_pack_N`, price table copied from Bingo, owner to confirm
Y2 | true | pay.test.ts |
Y3 | false | | OWNER / live
Y4 | false | | OWNER
Y5 | true | pay.test.ts |
Y6 | false | | OWNER
Y7 | true | pay.test.ts ("verify arriving after the webhook returns the same result") |
Y8 | true | unplayed.test.ts |
Y9 | false | |
Y10 | false | | OWNER

## K. Terms checkboxes (consent.test.ts, falsified once: checkConsent disabled, 9 tests failed, restored)
K1 | true | consent.test.ts: refused without tick / one box / old version; accepted; row re-read; version bump asks again | publish
K2 | true | same file | account creation, code, link, Google
K3 | true | same file | payment and Payment Testing
K4 | true | same file | join, erased with the game's data
K5 | true | same file | Host setup; Co-host acceptance not built
K6 | true | same file | roster and reuse; all list routes
K7 | n/a | |
K9 | n/a | no form in this product; wording present in consent-text.json |
K11 | true | terms.html shows version 2026-10-13, the boxes read the same constant |
K12 | true | consent.test.ts compares every box with the supplied wording file |
K13 | false | | labels and links are in consent.js; not tried with a screen reader
LR-1 | true | consent.test.ts "no code path takes money from a participant" |
LR-6 | true | consent.test.ts (box text; acceptances erased with the game) |
no-internal-notes | true | apps/web/test/no-internal-notes.test.ts |
