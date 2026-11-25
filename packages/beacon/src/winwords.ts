// What a winner is told they won, in plain, kind words. Pure: the player's page draws it, a test reads every sentence.
// The organizer's own words for a prize (the reward text of that line) come first; the plain sentence says why. When the organizer wrote nothing, the plain sentence stands alone.
// No "my / your" in any sentence, and no other player is ever named: it is only about the player who is reading.
import { DEFAULT_MILESTONE } from "./race";

/** A win, as the phone holds it: the prize (house), which winner place of it, and the organizer's own text for that reward line (may be empty). A lucky draw is { pattern: "lucky", text: its title }. */
export interface WonLine { pattern: string; ordinal: number; text?: string }
/** What the sentences need from the game's public settings: the milestone squares and how many milestone prizes there are. */
export interface WonContext { milestones?: readonly number[] | null; milestoneLines?: number }

/** 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th, 21st. */
export const ordinalWord = (n: number): string => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? "th" : u === 1 ? "st" : u === 2 ? "nd" : u === 3 ? "rd" : "th"); };

/** The plain sentence for one win (never empty). */
export function plainWin(w: WonLine, ctx: WonContext = {}): string {
  const n = Number.isInteger(w.ordinal) && w.ordinal > 0 ? w.ordinal : 1, place = ordinalWord(n);
  switch (w.pattern) {
    case "milestone": {
      const ms = [...(ctx.milestones && ctx.milestones.length ? ctx.milestones : [DEFAULT_MILESTONE])].sort((a, b) => a - b), sq = ms[n - 1];
      const which = (ctx.milestoneLines ?? 1) > 1 ? place + " " : "";
      return sq !== undefined ? `You reached square ${sq} first and won the ${which}milestone gift.` : `You reached the ${which}milestone square first and won the ${which}milestone gift.`;
    }
    case "finish": return `You came ${place}. You were the ${place} player to get home.`;
    case "team": return `The team you are in came ${place} in the team race and won the team prize.`;
    case "climb": return "You took the biggest ladder of the game and won the biggest climb prize.";
    case "comeback": return "You made up the biggest fall down a snake and won the comeback prize.";
    case "nevermissed": return "You threw in every turn and won the never missed prize.";
    case "lucky": return "You were picked in the lucky draw.";
    default: return "You won a prize.";
  }
}

/** Two lines for one win: `main` is what the organizer wrote for that prize, or else the plain sentence; `sub` is the plain sentence under the organizer's words (empty when `main` already is the plain sentence). */
export function winWords(w: WonLine, ctx: WonContext = {}): { main: string; sub: string } {
  const plain = plainWin(w, ctx), gift = String(w.text ?? "").replace(/\s+/g, " ").trim();
  if (!gift || (w.pattern === "lucky" && gift === "Lucky draw")) return { main: plain, sub: "" }; // a lucky draw with no prize named is only "Lucky draw"
  return { main: gift, sub: plain };
}
