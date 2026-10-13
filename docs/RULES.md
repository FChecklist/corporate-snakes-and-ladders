# Corporate Snakes and Ladders: the rules, one sentence each

Written first, before the code (recipe step A). Each rule has at least one test; the test name starts with the rule number (for example `R12 ...`). Plain words, for the owner.
The SPEC (`docs/SPEC.md`) is the source for rules, formats and prices. Where this page adds a mode the SPEC does not describe (Table mode), it says so.

## The board
- R1. The classic board has 100 squares in a zig-zag, square 1 at the bottom left. Boards of 144 and 225 squares are optional, for longer games.
- R2. Every player has their own board. It is made from the game id, the seat number and B0, the first public random value published after sign-up closed.
- R3. A board cannot be made before B0 exists.
- R4. The same inputs always make the same board, on any phone.
- R5. Two players of one game never get the same board.
- R6. A board has 9 snakes and 9 ladders. The organizer may choose 6 to 12 of each.
- R7. No snake or ladder starts on square 1 or ends on the last square, and no square is used twice.
- R8. A ladder climbs 8 to 30 squares. A snake drops 8 to 40 squares. (Scaled up on the larger boards.)
- R9. No ladder goes from the first row to the last two rows.
- R10. Nobody can be trapped: from every square the last square can be reached.
- R11. Every board is equally hard. The average number of turns to finish, worked out exactly with the game's own rules, is within 5% of the target (40 on the classic board). The chance of finishing within 20 turns also has to sit inside a fixed band. A board outside the band is thrown away and the next one is made from the same seat.

## The dice
- R12. A roll is 1 to 6, each equally likely.
- R13. A roll is made from the game id, the seat, the turn and b_t, the public value published after that turn's window closed. It cannot be made without b_t.
- R14. Every device gets the same roll for the same seat and turn.
- R15. Different seats, and different turns, get independent rolls.

## Moving
- R16. A pawn starts on square 1. The new square is the old square plus the roll.
- R17. Landing at the bottom of a ladder takes the pawn up. Landing on the head of a snake takes it down. Landing at the other ends does nothing.
- R18. Finishing needs the exact roll to land on the last square. A roll that would pass it is not used.
- R19. Option: "reach or pass". Any roll that reaches or passes the last square finishes.
- R20. A pawn that has finished stays finished.
- R21. Presence mode: a player who did not throw inside the window misses that turn and stays where they are.
- R22. Fate mode: every throw happens by itself when the window closes.

## Prizes in the group race
- R23. Milestone prize: the first player to be on or past the milestone square (default 75) at the end of a turn. The organizer may set up to three milestones.
- R24. End prizes: the first five players to land on the last square win 1st to 5th. The game ends when the 5th prize is awarded, or at the turn limit (default 60).
- R25. There are no ties. If several players reach a prize on the same turn, the next measure decides: higher square, then more ladders climbed, then fewer missed turns, then fate.
- R26. Fate is a number made from public values only. The lowest number wins first place, and so on. Anyone can re-check it.
- R27. The ranking is always a complete order from 1st to last, never tied. Places 1 to 5 are the first five to finish. The top-10 list carries a one-line note whenever a tie was broken.
- R28. A player may win more than one prize. The organizer can switch that off.
- R29. Optional extra prizes: biggest climb, comeback after a snake, and never missed (presence mode only).
- R30. At the turn limit the ranking is by square.

## Team race
- R31. A team race has 2 to 10 teams. Players are dealt into teams by fate from B0, and team sizes differ by at most one.
- R32. A team finishes when all of its players have landed on the last square. The game ends when the first team finishes, or at the turn limit.
- R33. Teams are ranked by: finished earlier, higher average square, more ladders per player, fewer missed turns per player, then fate. Never tied.

## Table mode (not in the SPEC; added for small groups)
- R34. 2 to 20 players share one board and take turns in a sealed random order made from B0.
- R35. A pawn that has finished is skipped. The first one to three players to finish win. The game ends then, or at the throw limit.
- R36. Only one pawn moves at a time, so the finishing order is never tied.

## Watching and fairness around the game
- R37. A spectator sees counts and the top-10 list by nickname. A spectator never sees a board seed or a future throw, and cannot throw.
- R38. Presence mode: a throw counts only if it reaches the collector from the right device inside that turn's window. Late, repeated or borrowed claims are refused.
- R39. The crowd chart always adds up to the number of players.
- R40. Sign-up closes at the start time. B0 is the first value published after that. Turn t opens at a fixed beacon round, the window is 15, 20, 25 or 30 seconds, and b_t is the first value published after the window closed.

## Around the game (from the platform shell, unchanged in meaning)
- R41. Players never pay, and nobody stakes money. There are no cash prizes and no betting. The organizer gives non-cash gifts.
- R42. Players use a nickname only. The organizer sees real names only at prize hand-over.
- R43. Sign-up is closed once the game starts. A guest who opens the link later is told the game is already running.
