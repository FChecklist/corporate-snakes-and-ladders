// The two sentences the owner fixed on 20 Nov 2026 (suite rules 1.1). One place, so the pages, the tests and the documents say exactly the same thing.
// Pages are plain files and cannot import this one, so a test (apps/web/test/owner-rules-lines.test.ts) checks that each page holds these exact words.

/** The one privacy line. It is true because every ID is sealed with the game and deleted by the purge (apps/edge/src/lifecycle.ts, PURGE_AFTER_MS is 20 hours, the promise 24). */
export const PRIVACY_LINE = "Designed to follow US privacy laws, EU GDPR and India's DPDP. All participant information, including IDs, is deleted within 24 hours after the game ends.";

/**
 * The fairness sentence. It is true because a throw is a fixed function of (game id, seat, turn, b_t) where b_t is the public beacon value published only AFTER that turn's
 * window closes (packages/beacon/src/play.ts rollFor), and no setting can pick a number (packages/beacon/test/fairness-line.test.ts proves each part).
 */
export const FAIRNESS_LINE = "No one knows the next roll: not the organizer, not the host, not even the software.";

/** Words the pages must never use: claims nobody can prove (owner rule, suite rules 1.1 section 5). */
export const FORBIDDEN_CLAIMS: readonly RegExp[] = [/100%\s*secure/i, /most\s+secure\s+(payment\s+)?gateway/i, /played\s+by\s+(major|leading|top|big|fortune)\s+(companies|brands|corporates)/i, /pdf\s+of\s+all\s+details\s+by\s+e-?mail/i];
