/**
 * Spoken text for the one fixed voice: what the dice and the pawn did, in short plain words.
 *   roll 4, ladder    -> "You rolled four. A ladder! Up to square 38."
 *   roll 6, snake     -> "You rolled six. A snake. Down to square 21."
 * The browser's own speech voice is used (no audio files ship with the app).
 */
const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

export function numberWords(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 999) throw new RangeError("number must be 1..999");
  if (n < 20) return ONES[n]!;
  if (n < 100) { const t = Math.floor(n / 10), o = n % 10; return o === 0 ? TENS[t]! : `${TENS[t]}-${ONES[o]}`; }
  const h = Math.floor(n / 100), r = n % 100;
  return r === 0 ? `${ONES[h]} hundred` : `${ONES[h]} hundred ${numberWords(r)}`;
}

export const numberDigits = (n: number): string => String(n).split("").map((d) => ONES[Number(d)]).join(" ");

export type SpokenKind = "move" | "ladder" | "snake" | "overshoot" | "finish";
export function spokenRoll(roll: number, kind: SpokenKind = "move", to?: number): string {
  const r = `You rolled ${numberWords(roll)}.`;
  if (kind === "ladder") return `${r} A ladder! Up to square ${to ?? ""}.`.replace(" .", ".");
  if (kind === "snake") return `${r} A snake. Down to square ${to ?? ""}.`.replace(" .", ".");
  if (kind === "overshoot") return `${r} Too many for the last square. You stay.`;
  if (kind === "finish") return `${r} You are home!`;
  return r;
}

/** Version of the voice wording; bump when it changes so devices that cached a voice line refresh it. */
export const AUDIO_PACK_VERSION = "v2-en-in-speech";
