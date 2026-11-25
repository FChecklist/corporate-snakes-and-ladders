// The two sentences the owner fixed on 20 Nov 2026 (suite rules 1.1). One place, so the pages, the tests and the documents say exactly the same thing.
// Pages are plain files and cannot import this one, so a test (apps/web/test/owner-rules-lines.test.ts) checks that each page holds these exact words.

/** The one privacy line. It is true because every ID is sealed with the game and deleted by the purge (apps/edge/src/lifecycle.ts, PURGE_AFTER_MS is 20 hours, the promise 24). */
export const PRIVACY_LINE = "Designed to follow US privacy laws, EU GDPR and India's DPDP. All player information, including IDs, is deleted within 24 hours after the game ends.";

/**
 * The fairness sentence. It is true because a throw is a fixed function of (game id, seat, turn, b_t) where b_t is the public beacon value published only AFTER that turn's
 * window closes (packages/beacon/src/play.ts rollFor), and no setting can pick a number (packages/beacon/test/fairness-line.test.ts proves each part).
 */
export const FAIRNESS_LINE = "No one knows the next roll: not the organizer, not the co-organizer, not even the software.";

/** Words the pages must never use: claims nobody can prove (owner rule, suite rules 1.1 section 5). */
export const FORBIDDEN_CLAIMS: readonly RegExp[] = [/100%\s*secure/i, /most\s+secure\s+(payment\s+)?gateway/i, /played\s+by\s+(major|leading|top|big|fortune)\s+(companies|brands|corporates)/i, /pdf\s+of\s+all\s+details\s+by\s+e-?mail/i];

/**
 * The rules in one short line each (owner rules of 25 Nov 2026). Pages are plain files and cannot import this one, so a test (packages/beacon/test/rules-lines.test.ts)
 * proves each line by playing the engine and checks that the player page and the how-it-plays page hold these exact words.
 */
/** race.ts `candidates` (pattern "milestone"): earlier turn first; on the same turn the player who landed further on that turn (the square at arrival); then fate. */
export const RULE_MILESTONE_TIE = "If two players reach a milestone on the same turn, the one who landed further on that turn wins it; if they are still level, the public random numbers decide.";
/** play.ts `step` with the default finish "exact": a throw that would pass the last square is not used. */
export const RULE_EXACT_FINISH = "To finish, a player must land exactly on the last square; a throw that is too big is not used and the player stays where they are.";
/** play.ts `step` with finish "pass" (only when the organizer chose it). */
export const RULE_PASS_FINISH = "To finish, a player reaches or passes the last square.";
/** race.ts `compareChain`: earlier finish, higher square, more ladders, fewer missed turns, then fate. A gift is never shared. */
export const RULE_TIE = "No gift is ever shared: if players are level, the earlier finish wins, then the higher square, then more ladders climbed, then fewer missed turns, and then the public random numbers decide.";
