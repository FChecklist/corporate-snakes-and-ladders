# Corporate Snakes and Ladders: the rules (plain words, draft 1, 2026-10-27, for the owner to read before anything is built)

Model: the Corporate Tambola rules. Shown to a player under "Rules" on the game screen and to the organizer and Hosts in their console. Sections 1 to 9 are the text, 10 the table of messages, 11 is for the builder.

## 1. How to play
1. Everyone races on a board of 100 squares. Your pawn starts on square 1.
2. On your turn you throw one die (1 to 6). Your pawn moves forward by the number thrown.
3. If you land at the bottom of a ladder, you climb up. If you land on a snake's head, you slide down.
4. To finish you must land exactly on square 100. A throw that would go past 100 is not used.
5. The first players to land on 100 win the prizes.

## 2. How you win
1. The first player on square 100 wins 1st prize, the next 2nd, and so on for the prizes the organizer chose.
2. If several players finish on the same turn, the next measure decides: higher square, then more ladders climbed, then fewer missed turns, then fate. Fate is a number anybody can re-check. The order is never tied.
3. The game ends when the last prize is won or when the turn limit is reached. At the turn limit the player on the highest square is ahead.
4. By default one person wins at most one prize.

## 3. The timer
1. Each turn has a throw window of 20 seconds.
2. The timer on your phone is small and quiet. The server's clock is the real timer.
3. The screen always shows the state of the race: "3 of 12 players home · 9 still racing".

## 3b. Manual play has no fixed time
**Fixed time only when the software runs the game.** The turn window (20 seconds) exists because the software runs the game. If a host runs the turns by hand, there is no fixed time between turns, no countdown is shown (the screen says "Waiting for the host"), and no total length is promised. A throw still counts only before the next turn is announced, decided by the server's clock.

## 4. Throwing (decided by the owner's default)
1. Throws are automatic. The game throws the die for you when your turn comes, so there is nothing to press and no late-throw rule.
2. [Only if the owner brings back the Throw button: you may throw only inside your 20-second window, decided by the server's clock. A late press shows "Ohooo! 😊 Sorry, you moved after your turn ended. This move cannot be made." and you miss that turn.]

## 5. Pause
1. The organizer or a Host can pause the game. While it is paused no turn opens and no throw can be made.
2. When play restarts, the turn window starts again in full (20 seconds). Every pause and restart is in the game log.

## 6. If you go away or lose the connection
1. Open the same link again. You see your pawn and the board exactly as they are.
2. Turns that closed while you were away count as missed turns. The page says how many.
3. Tip: switch on Do Not Disturb on your phone so calls and chats do not interrupt your game.

## 7. Fairness
1. Every player has their own board, made from the game id, the seat number and a public random value that did not exist when sign-up closed. Two players never get the same board. Every board is equally hard.
2. Every throw is made from the game id, the seat, the turn and a public random value published after the window closed, so nobody can know a throw in advance.
3. Every phone works out the same board and the same throw. Anybody can re-check them.

## 8. What the organizer and a Host can and cannot do
Can: start, pause, restart, extend with a confirmation, end the game, see every pawn on the board live, the count of players, the log.
Cannot: throw for a player, move a pawn, change a board or a throw, see names or mobile numbers on the live board (only seat numbers).

## 9. Money and privacy
1. Players never pay and never stake money. No cash prize, no betting. Any gift comes from the organizer outside this product.
2. Adults (18+) only. We ask your name only, unless your organizer asked for an employee ID or mobile number.
3. Personal details are deleted within 20 hours after the game ends. The game log (seat numbers only) is kept for 365 days.

## 10. Every message in one table
| When | Text |
|---|---|
| Your turn | Your turn. Press Throw. |
| Others' turn | Waiting for the other players to throw. |
| (only if the Throw button returns) Throw too late | Ohooo! 😊 Sorry, you moved after your turn ended. This move cannot be made. |
| Ladder | You threw {n}. A ladder takes you up to {sq}! |
| Snake | You threw {n}. A snake takes you down to {sq}. |
| Too far | You threw {n}, which is past 100. Stay on {sq} and try again. |
| Home | You are home on square 100. Well played! |
| Missed turn | You missed a turn. Your pawn stays on {sq}. |
| Paused | Game paused by the host at {time}. It restarts soon. Your pawn is safe. |
| Away note | Welcome back. You missed {k} turns while away. |
| Do Not Disturb | Tip: switch on Do Not Disturb so calls and chats do not interrupt your game. |

## 11. For the builder
1. Rule 4 is decided by the server clock: turn t opens at start + t x 20 s (fixed schedule, no drift). `POST /api/z/:id/throw` answers HTTP 409 `late-move` when the server time is after the window, stores nothing, and the phone shows the message.
2. Tests (falsified): a throw at the last millisecond counts; at the end of the window it is refused; pause then restart gives a full window; missed turns are counted.
3. OPEN QUESTION for the owner: the approved options table (OPTIONS_TABLES.md) makes throws automatic. Then a player never presses Throw in time, and the late message can only be seen from an old screen. Should the real Throw button come back (players throw within 20 s, miss it and lose the turn) so that rule 4 is a real rule? This page is written so that both work.
