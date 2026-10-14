# Gates: Corporate Snakes and Ladders (local build, not deployed)

Format: `ID | true/false | proof | note`. true = a passing test or a direct file check. OWNER = only the owner can do it. Nothing here was run in a browser or on a deployed site (local only, RAM rule).
Last full local run: 940 tests pass, 0 fail.
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
P6 | true | sim S10-01 and S10-02 (axe-core colour-contrast and basic WCAG 2 A/AA rules on home, pricing, host sign-in, player page, big screen) | Found and fixed: heading colour --accd (3.73:1) darkened to #8A5A00; two links whose spoken name did not contain the visible text. run on 2026-10-14
P7 | false | seo.test.ts passes (titles, canonical, sitemap, robots) | share image `/img/card.webp` is missing
P8 | false | | first-party report code carried over; delivery not run
P9 | false | files contain rajatsiroffice@gmail.com and +91 96503 97480 | OWNER confirms
P10 | false | gamesbar.test.ts (links listed) | links not fetched
P11 | true | apps/web/public/404.html, site/404.html |
P12 | true | apps/web/test/version-stamp.test.ts; pages/version.mjs; docs/DEPLOYS.md | pages/build.mjs writes pages/public/version.json {commit, dirty, builtAt, game} (served uncached at /version.json); docs/DEPLOYS.md lists the last deploys read from Cloudflare Pages (node tools/list-deploys.mjs refreshes it). README no longer says nothing is deployed.

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
U5 | true | apps/edge/test/rights.test.ts ("U5: a player can leave at any time": before the start, after the start, only the player's own phone, a cancelled game); apps/web/test/rights-pages.test.ts ("Leave: asks first, then removes the seat and the name"); sim S04-15 (real Chrome) | Leave button and POST /api/z/{id}/leave, proved by the card id AND the phone's own device id. Before the start the seat and details are deleted; once the game has begun the seat stays as an anonymous id (every phone must work out identical results) and loses everything personal. The page says so in plain words. run on 2026-10-14
U6 | true | apps/edge/test/rights.test.ts ("U6 / D7: what do you hold about me, correct it, delete me": access shows what is held, correction, erasure, same request twice, TEST mode); apps/web/test/rights-pages.test.ts ("What do you hold about me"); sim S04-16 | Link on the player page 'What do you hold about me / delete me'. The page shows the promised answer time before sending; the answer comes back on the page (what is held) and the organizer and the owner (raajat.agarwal@gmail.com) are told by e-mail. PROMISE_DAYS = 7 is one constant (apps/edge/src/rights.ts). The 'answer' to an access request is immediate; the 7 days cover anything further. run on 2026-10-14
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
D1 | true | docs/PRIVACY_AND_LIFECYCLE.md (sections 2 and 3); apps/edge/test/data-map.test.ts ("D1: the data map": every row has field, why, where stored, who) | Field, why, where stored, who processes, how long. Section 3a says where the data is and that no backup of our own exists.
D2 | true | apps/edge/test/data-map.test.ts ("D2: the notice and the data map agree": notice fields = data map fields = fields the player page asks for) | Join box A: the nickname; a mobile number only if the organizer switches that on (join setting) - worded as conditional in the notice, listed as conditional in the data map, and the player page (z.js) has the number field for exactly that case.
D3 | true | consent.test.ts |
D4 | true | nameonly.test.ts (nickname only), consent.test.ts (no number or address in the log) |
D5 | false | | deletion code is tested; the schedule is not deployed
D6 | true | privacy.test.ts (winners record and payments kept apart) |
D7 | true | apps/edge/test/rights.test.ts ("a request cannot be made for another player", "the request rows do not outlive the game", "asking the same thing twice ..."); sim S04-16; migration 0023 (data_request) | Access / correction / erasure request, end to end: stored (kind, note, received, answer-by), mailed to organizer and owner, closed at once for erasure. Request rows are deleted with the game's other participant data (23 h) and again with the game (365 days). Closing an open access / correction request is done by the organizer by hand; there is no console button for it (the row ages out with the game).
D8 | true | terms.html clause 17 |
D9 | false | docs/BREACH_RUNBOOK.md carried over |
D10 | false | |
D11 | true | apps/edge/test/data-map.test.ts ("D11: where the data is, and no backup claim"); apps/web/public/subprocessors.html, legal.html; docs/PRIVACY_AND_LIFECYCLE.md section 3a | Read with wrangler d1 info on 2026-10-14: the D1 database runs in Cloudflare's Asia-Pacific region (APAC), no jurisdiction pinned, no read replicas. The pages say: website on Cloudflare's global network, database in its Asia-Pacific region. The '7 days backup roll-off' claim is gone everywhere (no backup process exists).
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
R9 | true | apps/web/test/storage-notice.test.ts (every key a script keeps on a device is in apps/web/storage-registry.json; listed keys are still used; the cookies are exactly the ones listed; the Privacy page carries every sentence; a planted new key / cookie / computed key is noticed) | The only cookie is the first-party visitor cookie on the public pages. Page: legal.html section 'What your device keeps' (written by node tools/make-storage-notice.mjs from the registry).
R10 | true | sim S10-01..S10-04 (tools/sim2/scenarios/ui/s10-accessibility.mjs); legal.html section 'Accessibility' | Accessibility statement (short, plain) with a way to report a problem. axe-core 4.14 (dev dependency of the simulation only) finds no WCAG 2 A/AA violation on the five main pages at phone and laptop width. run on 2026-10-14
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
K13 | true | sim S10-03 (Tab reaches every control of the five main pages, in page order, with a visible focus ring); apps/edge/test/consent.test.ts (every box has a label) | Keyboard proved in real Chrome. A screen reader itself was not run; axe checks names, labels and roles.
LR-1 | true | consent.test.ts "no code path takes money from a participant" |
LR-6 | true | consent.test.ts (box text; acceptances erased with the game) |
no-internal-notes | true | apps/web/test/no-internal-notes.test.ts |
E9 | true | apps/edge/test/owner-mail.test.ts ("E9: the owner is told of each paid order": once per payment whichever of the webhook and the verify call comes first, three at the same instant, TEST mode) | Mail to raajat.agarwal@gmail.com: game, plan, amount, transaction id, organizer name and e-mail. The once-only claim is one kv row per payment. Not tested against a real inbox.
X-7 | true | apps/edge/test/data-map.test.ts ("D2"); apps/edge/src/consent-text.json; apps/web/test/consent-pages.test.ts | Box A said name and mobile number although the game asks for a nickname. Now: the name, and the number only if this game asks for it (the organizer can switch that on). Terms version 2026-10-14.
