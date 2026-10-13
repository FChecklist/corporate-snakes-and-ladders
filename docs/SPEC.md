# Corporate Snakes and Ladders: product and build specification (version 1, 2026-10-12)

Owner brief (2026-10-12): a snakes-and-ladders game that thousands play at the same time, from their own phones or laptops, like Corporate Tambola and Corporate Bingo. A separate product with its own website. Status: SPEC ONLY, nothing is built.

Binding owner rules, same as the other games:
- **Separate product.** Own repository, own website (`corporate-snakes-and-ladders.pages.dev`), own Cloudflare project, own database, own secrets. No shared files with Tambola, Bingo or Tic Tac Toe. Only meeting point: the IT Services by Rajat Agarwal payment service and ledger.
- **The game itself uses no server.** Phones and laptops do the work with their own memory. Our server only registers people, takes payment, and keeps the smallest possible collector (section 9).
- **Everything random is unpredictable, even to the software.** All randomness comes from the public random beacon, published after the moment it is needed.

---------------------------------------------------------------------------------------------------

## 1. How the game is played (what we understood)
1. **One game, thousands of players, one shared clock.** Everyone sees the same turn start at the same second.
2. **Every player has their own board.** Same size and the same look as a snakes-and-ladders board, but different snakes and ladders for every player. A player's board does not exist until the beacon value that creates it is published, so nobody (the organizer, the software, any player) can know or choose a board in advance.
3. **Each turn is a 20-second window.** A player taps to throw the dice inside the window. Players who threw get their number; players who did not throw **miss that turn**.
4. **The dice are random and unpredictable.** A roll comes from a beacon value published only after the window has closed, so nobody can know the roll before throwing, and nobody can wait to see it first.
5. **The software checks every throw and moves every player individually**, each on their own board.
6. **Each player sees the crowd:** how many are playing and where they are on the board.
7. **Prizes:** (a) the first to reach the milestone line; (b) the first five to reach the end (1st to 5th). The results always show a clear 1st to 5th and a top-10 list with **no ties** (section 6).
8. The whole game is random: boards, dice, and any tie.

## 2. Principles
1. A known game; the rules screen is five lines.
2. Phones do the work; the server is not in the play loop.
3. Winners are decided by software from public, re-checkable data. No human can announce, change or dispute a winner.
4. One seat per device; the same rules as Tambola for invites, roles, privacy, deletion, report and payment.
5. Guests are never e-mailed. Only the organizer and Hosts get mail.
6. Honest limits are stated (section 15).

## 3. The board
- **Classic 10 x 10 (100 squares)**, numbered in the usual zig-zag from square 1 (bottom left) to square 100 (top). Optional larger boards for longer games: 12 x 12 (144) and 15 x 15 (225). All numbers below are for 100 squares and scale with the board size.
- **Per-player board: 9 snakes and 9 ladders** (organizer may choose 6 to 12 of each).
- **Hard limits on every board** (so no board gives a free win):
  - No snake or ladder starts on square 1 or ends on the last square, and no square is used twice.
  - A ladder rises 8 to 30 squares. A snake drops 8 to 40 squares. (Without these limits some random boards let a player finish in 2 turns.)
  - No ladder starts in the first row and reaches the last two rows.
  - No chain that sends a player back to the start with no way out; every square can reach the end.
- **Fairness band (the key rule).** Boards are different but must be equally hard. Every generated board is measured: the expected number of turns to finish, calculated with the game's own rules, must be **within 5% of the target (default 40 turns)**, and the spread (chance of finishing within 20 turns) must be inside a fixed band. A board outside the band is thrown away and the next one is made from the same player's seed stream. Why: in a simulation of purely random boards the expected finish ranged from 25 to 81 turns (5% to 95%: 27 to 55); only about 18% of boards were within 5% of the median. Without the band, luck of the board would decide the game.
- **Generated on the player's own phone** from `(game id, seat number, beacon value B0)`. B0 is the first beacon value published after registration closes, so the seat-to-board assignment cannot be known earlier. It is deterministic: any phone can regenerate any player's board from the same inputs, which is how results are re-checked and how the crowd view is computed.
- **Theme (organizer choice):** classic jungle, or "Career Ladder" (ladders: Promotion, Mentor, Training, Big Win; snakes: Reply-all, Monday Meeting, Missed Deadline, Audit), plus the company logo on the start square. Names are cosmetic only.

## 4. A turn
- **Window:** 20 seconds. (The owner wrote 20 in one place and 15 in another; 20 is the default and the window is a setting: 15 / 20 / 25 / 30.)
- **Reveal:** about 5 seconds after the window closes: the dice shows for everyone, pawns move, snakes and ladders animate. A turn is therefore about 25 seconds.
- **Throw:** the player taps "Throw". The tap is final; there is no re-roll.
- **The roll** for player `s` on turn `t` = 1 + (hash(game id, seat s, beacon value b_t) mod 6), where b_t is the first beacon value published AFTER the window of turn t has closed. The roll is the same for every device that computes it and cannot be known while the window is open.
- **Missed turn:** a player who did not throw inside the window stays where they are for that turn, with a gentle "you missed this turn" note.
- **Movement:** new square = old square + roll; if it is a snake head or ladder bottom on that player's board, move to the other end. **Finishing needs an exact roll** to land on the last square; a roll that would pass it is not used (default; "reach or pass" is an organizer option, see section 18).
- **Game length:** see section 7.

## 5. What each player sees
- Their own board, pawn, last roll, the countdown ring for the 20 seconds, and a "your turn" vibration when a window opens.
- **The crowd strip:** how many people are playing, and a band chart of where they are (for example 10 bands of 10 squares, with a count in each band), plus "you are ahead of 62% of players".
- Their own history: rolls, snakes, ladders.
- A short rules card with the five lines.
- **Anonymity:** other players are never named. The organizer sees only the winners at the end, for prize hand-over (same as Tambola). A short anonymous leader strip ("top 10 squares") is optional (section 18).

## 6. Prizes
Each prize is a reward line, as in Tambola (prize text, how many winners).
1. **Milestone line:** the first player to reach or pass the milestone square at the end of a turn. Default: square 75 on a 100-square board (organizer may set any square, or add more milestones such as 25, 50, 75).
2. **End prizes:** 1st, 2nd, 3rd, 4th and 5th to land on the last square. The first five to finish are always in that order.
3. **NO TIES (owner rule 2026-10-12, all games):** a prize is never shared. If several players reach a prize on the same turn, the next measure in the chain below decides, and the last measure is fate: each tied player gets a number from the beacon (hash of game id, seat and a tie label); the lowest number wins first place, and so on. Anyone can re-check it, and the results screen says in one line how a tie was decided.
4. **Optional extra prizes** (organizer): "Biggest climb" (the largest single ladder), "Comeback" (the biggest recovery after a snake), "Never missed" (a perfect attendance prize in presence mode).
5. A player may win more than one prize (the organizer may switch this off).
6. **The ranking and the top-10 list** (always complete, never tied): places 1 to 5 are the first five finishers in finishing order. Places 6 to 10 are the best-placed of the rest when the game ends. Ordering chain for any set of players who are level: (1) finished earlier (turn number), (2) on a higher square, (3) climbed more ladders, (4) missed fewer turns, (5) **fate** (a beacon number per player; lowest wins). The top-10 list shows place, nickname and square (or "finished on turn N"), and a one-line note whenever a tie was broken.
7. Prizes are decided by software only: each phone computes results; a result counts when enough different phones agree (the same vote and quorum rule as Tambola); the organizer's console only watches.

## 7. How long a game lasts, from simulation (100 squares, nobody misses a turn, boards in the fairness band, finishing by exact roll)
| Players | First to square 75 | 1st finisher | 4th finisher | Median finisher |
|---|---|---|---|---|
| 1,000 | turn 4 | turn 9 | turn 11 | turn 36 |
| 3,000 | turn 4 | turn 8 | turn 11 | turn 39 |

- At about 25 seconds per turn, the four end prizes are decided in roughly 5 minutes with thousands of players. With only 100 players the 4th finisher arrives around turn 12 to 30 (to be measured).
- The more players, the sooner the first four finish (it is the best of thousands), so **a bigger crowd makes a shorter game**. To keep games lively the organizer can choose a bigger board (144 or 225 squares), and the milestone should be a late one (75 or 90).
- **The game ends when the 5th end prize is awarded** (the table above shows the 4th finisher; the 5th arrives a turn or so later). Players who have not finished see the final standings (the crowd chart) and the winners' count.
- A turn cap (default 60) ends a game that is somehow slow; at the cap the ranking is by square.

## 8. Two ways to run it (decision needed)
| | **Fate mode** | **Presence mode** |
|---|---|---|
| Missed turns | None: every player's throw happens automatically when the window closes. The tap is only the drama (the dice animation, the sound). | A player who does not tap inside the window misses the turn (the owner's rule). |
| Who knows who threw | Nobody needs to | The collector must record each throw with a server time (section 9) |
| Server during play | None. Every phone computes every player's position itself from the public data and the seat list, so the crowd chart and the winners are exact on every phone. | One tiny request per throw (a "ping") |
| Size | Thousands, no extra cost | About 1,000 to 1,500 players on the free plan (estimate, section 9), more only with a paid plan |
| Cheating | Nothing to cheat | A false claim of a throw is blocked because the server timestamps the throw |
Recommendation: build both. Fate mode is the cleanest fit to "no server, thousands". Presence mode honours the "miss a turn if you do not throw" rule for the smaller games.

## 9. The collector (the only server part, kept as small as possible)
- **Why a server timestamp is needed in Presence mode:** after a window closes, the roll for it becomes public. If a phone only had to *claim* "I threw", a cheater could claim every missed turn afterwards and gain moves. Nothing a phone does alone can prove it tapped in time. A timestamp from a third party at the moment of the tap is the only strong proof.
- **Ping:** at each tap the phone sends one small signed note (game id, seat, turn, device signature) to a Cloudflare Worker, which records the arrival time. The answer carries back the latest crowd counts, so one request does both jobs.
- **Cost estimate (not measured):** players x turns. 1,000 players x 12 turns of an end-prize race is about 12,000 requests, easily inside the free daily limits; a full 36-turn game for 1,000 players is about 36,000. Larger crowds multiply this. The free plan allows roughly 100,000 requests per day for everything; a paid plan is needed beyond that, and **no paid add-on is switched on without the owner's yes**.
- **Fate mode needs only the collector that every game already has:** the phones' signed results are collected once (a few requests per phone, not per turn), exactly like Tambola's claims.
- Boards, dice and results are never stored on the server; only throw timestamps (Presence mode) and the winners' votes.

## 10. Roles and everything around the game
Identical to Corporate Tambola, copied once into the new repository and then independent: Organizer, Host (up to 5), Co-host, AI work link; the nine-step console; the big screen (shows the crowd chart and the winners); waiting room; announcements; brand breaks; invites and people lists; clone, reschedule and cancel; pay before start with credit instead of refunds; report e-mailed as a link about 3 minutes after the end (link valid 22 hours); personal data deleted 23 hours after the end; winners kept 365 days; no e-mail ever to a guest.
New for this game: **registration closes before the start** (boards are drawn from the beacon after that moment, so no late joiners; a guest who opens the link later sees the game is already running).

## 11. Sizes, price and the ledger
- **Sizes:** the same ladder as Corporate Tambola (up to 100, 250, 500, 750, 1,000, 2,500, 5,000, 10,000 players). Presence mode is limited to the smaller sizes (section 9); Fate mode may use all of them.
- **Price (decision):** the same price ladder as Corporate Tambola, in INR and US$, no GST while the seller is not GST registered, held in this product's own pricing file.
- **Ledger:** orders go through the central payment service as `razorpay / IT Services / Corporate Snakes and Ladders / sales / snakes_pack_<N>` (plus `payment_test`); refer and earn, sales-team commission and salary use the same template. New site key, new plan rows, no new code in the central service.

## 12. Randomness and fairness, step by step
1. **Registration closes** at a published time T0. The seat list is frozen.
2. **B0** = the first beacon value published after T0. Every board is generated from `(game id, seat, B0)`.
3. **Turn t** opens at a published time. The window is 20 seconds. **b_t** = the first beacon value published after the window closes; every roll comes from `(game id, seat, b_t)`.
4. Tie-breaks and the "who gets extra prizes" draws come from named labels of the same beacon values.
5. Anyone can re-compute any board and any roll from the public beacon values. The organizer, the software and the players have no way to choose or to know a result in advance.
6. Honest limits: the beacon must be reachable from the player's network (mirrors and the organizer's signed fallback file, as in Tambola); a modified browser cannot be made impossible, so a win counts only when enough phones agree.

## 13. Build plan (each with an exit test)
| Phase | Work | Exit test |
|---|---|---|
| S0 | Decisions in section 18; the Razorpay prerequisites (webhook secret, international cards) | Owner answers |
| S1 | Board generator with the fairness band, the dice, the movement rules, the prize and tie rules (pure code) | Unit and property tests green |
| S2 | Phone screen: board, pawn, throw, countdown, crowd chart, rules card, sounds; Fate mode working end to end | A 30-phone simulated game and a 2-phone real-browser game give identical results |
| S3 | Presence mode: collector Worker with throw pings, crowd counts in the ping answer | 1,000 simulated phones inside the request budget; false-claim attack refused |
| S4 | Console, settings, AI manifest, report, lifecycle, payments through the central service, partner features | Life-cycle and matrix scenarios green |
| S5 | Own website (all pages), accessibility, legal pages | Page checks green |
| S6 | Load: 5,000 simulated phones in Fate mode; soft launch | First paid game end to end, report received, data deleted on time |

## 14. Tests required
- **Boards:** over 100,000 generated boards: ranges, no overlap, every square can reach the end, expected-turns inside the band, spread inside its band, same board from the same inputs, different boards for different seats, no board is ever the same as another seat's in a game of 10,000.
- **Dice:** a roll is a uniform 1-6 over many seeds; the same on every device; cannot be computed before the beacon value exists (test by construction: the function needs b_t).
- **Movement:** snakes, ladders, exact finish, bounce, missed turn (Presence), auto-throw (Fate).
- **Prizes:** milestone and end prizes, ties by fate, a player winning two prizes, game end at the 4th finisher and at the turn cap.
- **Crowd chart:** counts add up to the number of players; equal on every phone in Fate mode.
- **Presence:** a phone that claims a throw it did not make is refused; pings stay inside the budget; ping answers carry the crowd counts.
- **Scale:** 5,000 simulated phones in virtual time; the 30-phone and 2-phone real-browser games; the life-cycle, matrix and UI scenarios copied from Tambola and adapted.

## 15. Honest limits (to tell customers)
- A modified browser cannot be made impossible; winners are accepted only when enough phones agree.
- Clearing browser data gives a new device id.
- In Presence mode the throw timestamps need a server and so limit the size on the free plan.
- With thousands of players the first five finishers are the luckiest of thousands, so the end prizes are decided early (about turn 11 to 12). That is the nature of the game, and larger boards lengthen it.
- Games above about 2,000 players stop registering the pause check (existing free-plan rule from Tambola).

## 16. US and India notes
- Players never pay to play; the product never holds or pays prize money (same legal position as Tambola and Bingo; needs a lawyer for the US terms).
- Snakes and Ladders is a generic name. "Chutes and Ladders" is a trademark of another company and must not be used.
- Accessibility: contrast, labels for the board squares, a "no animation" option, vibration and sound optional.

## 17. Acceptance criteria (testable)
- SG-01 No player or board of one game is the same as another's; every board is inside the fairness band.
- SG-02 A board is generated only after B0 exists and cannot be computed earlier.
- SG-03 A roll cannot be computed before its window has closed.
- SG-04 In Fate mode every phone shows the same crowd chart and the same winners without any server call during play.
- SG-05 In Presence mode a player who does not throw in the window misses the turn, and a false claim of a throw is refused.
- SG-06 Winners and tie-breaks are decided by software only and can be re-computed by anyone from the public values.
- SG-07 A game with 5,000 simulated players finishes inside the free-plan budget in Fate mode.
- SG-08 The game ends when the 5th end prize is awarded or at the turn cap.
- SG-12 **No ties:** every game gives a strict 1st to 5th and a top-10 list; a tie is broken by the chain in section 6 ending in fate, with a one-line explanation; a prize is never shared.
- SG-09 Orders appear in the central ledger as `Corporate Snakes and Ladders / sales / snakes_pack_<N>`.
- SG-10 Report, deletion and e-mail rules equal Tambola's; no guest is ever e-mailed.
- SG-11 Separation: no import, path or link to any other game's repository; it builds and tests alone.

## 18. Decisions the owner must make
1. **Window:** 20 seconds (default) or 15.
2. ~~Mode~~ DECIDED 2026-10-12: build BOTH Fate mode and Presence mode; the organizer picks one when creating the game.
3. **Milestone line:** default square 75, or another; one milestone or several.
4. **Finish rule:** exact roll to land on the last square (default) or "reach or pass".
5. **Board size:** classic 100 squares only, or also 144 and 225 for longer games.
6. ~~Ties~~ DECIDED 2026-10-12: never shared; always a clear order (section 6).
7. **Extra prizes:** none, or Biggest climb / Comeback / Never missed.
8. ~~Crowd strip~~ DECIDED 2026-10-12: players use **nicknames** (chosen when they join); the top-10 list shows nicknames; the crowd chart shows counts. The organizer sees real names only for prize hand-over.
9. **Theme:** jungle, Career Ladder, or both.
10. **Price:** the Tambola ladder (default) or its own.
