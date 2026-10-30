// Scenario matrix, axes and the expected answers (the ORACLE). Everything here is built from known facts by construction (a spelling is made FROM a base ID, so the answer is the base),
// never by calling the product code. No scenario list is ever kept in memory: every axis is a small list and the runner walks the product of them with nested loops / generators.
export const BASES: readonly (readonly [string, string])[] = [["1B", "678"], ["AB", "12"], ["Z", "9"], ["EMP", "007"], ["XY", "1234567890"]];
export const SEPS = ["", " ", "-", "/", ".", "_"] as const;
export const CASES = ["upper", "lower", "mixed"] as const;
export const WIDTHS = ["ascii", "full"] as const;
export const NOISES = ["none", "zwsp-start", "zwj-mid", "emoji-end", "accent-mid"] as const;
export type Era = "old" | "new";
export const ERAS: readonly Era[] = ["old", "new"];

const full = (s: string) => Array.from(s, (ch) => (ch === " " ? "　" : ch.charCodeAt(0) >= 0x21 && ch.charCodeAt(0) <= 0x7e ? String.fromCharCode(ch.charCodeAt(0) + 0xfee0) : ch)).join("");
const styled = (s: string, c: (typeof CASES)[number]) => (c === "upper" ? s.toUpperCase() : c === "lower" ? s.toLowerCase() : Array.from(s, (ch, i) => (i % 2 ? ch.toLowerCase() : ch.toUpperCase())).join(""));

export interface IdSpelling { text: string; clean: string | null; old: string | null; kind: string; sep: string }
/** The ID spellings: 5 bases x 6 separators x 3 cases x 2 widths x 5 noises = 900, then the explicit special cases (symbols only, blanks, long). */
export function* idSpellings(): Generator<IdSpelling> {
  for (const [p, n] of BASES) for (const sep of SEPS) for (const c of CASES) for (const w of WIDTHS) for (const noise of NOISES) {
    const pre = styled(p, c), num = styled(n, c), s = sep;
    const P = w === "full" ? full(pre) : pre, N = w === "full" ? full(num) : num, S = w === "full" ? full(s) : s;
    const mid = noise === "zwj-mid" ? "‍" : noise === "accent-mid" ? "é" : "";
    const text = (noise === "zwsp-start" ? "​" : "") + P + mid + S + N + (noise === "emoji-end" ? "\u{1F600}" : "");
    const clean = (p + n).toUpperCase();
    // the old reading: spaces dropped, upper case, then only A-Z 0-9 . _ - / are allowed. Full-width, zero-width, accents and emoji are NOT allowed there, so they are refused (null).
    const old = w === "full" || noise !== "none" ? null : (p + (s === " " || s === "" ? "" : s) + n).toUpperCase();
    yield { text, clean, old, kind: `base:${w}:${noise}`, sep };
  }
  const sym = ["---", "///", "!@#$%", "\u{1F600}", "\u{1F600}\u{1F600}", "​​", "...", "_-_", "éé"];
  for (const t of sym) yield { text: t, clean: null, old: null, kind: "symbols-only", sep: "" };
  for (const t of ["", " ", "\t", "　", "  \n "]) yield { text: t, clean: "", old: "", kind: "blank", sep: "" };
  yield { text: "A".repeat(30), clean: "A".repeat(30), old: "A".repeat(30), kind: "len30", sep: "" };
  yield { text: "A".repeat(31), clean: null, old: null, kind: "len31", sep: "" };
  yield { text: "a-".repeat(15), clean: "A".repeat(15), old: "A-".repeat(15), kind: "len15-dashed", sep: "-" };
  yield { text: "A-".repeat(31), clean: null, old: null, kind: "len31-dashed", sep: "-" };
  yield { text: "-".repeat(100) + "A".repeat(30) + "-".repeat(100), clean: "A".repeat(30), old: null, kind: "long-symbols", sep: "-" };
  yield { text: "A".repeat(300), clean: null, old: null, kind: "len300", sep: "" };
}
export const ID_SPELLING_COUNT = BASES.length * SEPS.length * CASES.length * WIDTHS.length * NOISES.length + 9 + 5 + 6;

/** Email spellings: 3 addresses x 4 case styles x 2 at-signs x 4 paddings = 96. `canon` is what every spelling must clean to. */
export const MAIL_BASES: readonly (readonly [string, string])[] = [["demo1", "demo-test.invalid"], ["demo23", "demo-test.invalid"], ["rajat1", "demo.com"]];
export interface MailSpelling { text: string; canon: string; base: number }
export function* mailSpellings(): Generator<MailSpelling> {
  for (const [bi, [l, d]] of MAIL_BASES.entries()) for (const cs of ["lower", "UPPER", "Title", "aLtErNaTiNg"] as const) for (const at of ["@", "＠"] as const) for (const pad of ["none", "ends", "around-at", "tab-newline"] as const) {
    const st = (s: string) => (cs === "lower" ? s.toLowerCase() : cs === "UPPER" ? s.toUpperCase() : cs === "Title" ? s[0]!.toUpperCase() + s.slice(1) : Array.from(s, (ch, i) => (i % 2 ? ch.toUpperCase() : ch.toLowerCase())).join(""));
    const L = st(l), D = st(d);
    const text = pad === "none" ? L + at + D : pad === "ends" ? `  ${L}${at}${D} ` : pad === "around-at" ? `${L} ${at} ${D}` : `\t${L}${at}${D}\n`;
    yield { text, canon: `${l}@${d}`.toLowerCase(), base: bi };
  }
}
export const MAIL_SPELLING_COUNT = MAIL_BASES.length * 4 * 2 * 4;

/** What a game's saved settings must read as. */
export interface VerifyCase { config: string | null; mode: "mobile" | "id" | "either" | "both"; employeesOnly: boolean; label: string }
export function verifyCases(): VerifyCase[] {
  const out: VerifyCase[] = [];
  for (const mode of ["mobile", "id", "either", "both"] as const) for (const eo of [true, false, undefined] as const) out.push({ config: JSON.stringify({ verify: mode, ...(eo === undefined ? {} : { employeesOnly: eo }) }), mode, employeesOnly: eo === true, label: `${mode}/${eo}` });
  const junk: [string | null, string][] = [[JSON.stringify({ verify: "passport" }), "passport"], [JSON.stringify({ verify: "ID" }), "upper-case ID"], [JSON.stringify({ verify: 5 }), "number"], [JSON.stringify({ verify: null }), "null"], ["{bad json", "bad json"], [null, "no config"], ["[]", "array"], [JSON.stringify({ verify: "id", employeesOnly: "true" }), "employeesOnly as text"], [JSON.stringify({ verify: "id", employeesOnly: 1 }), "employeesOnly as 1"]];
  for (const [config, label] of junk) out.push({ config, mode: label.startsWith("employeesOnly") ? "id" : "mobile", employeesOnly: false, label: "junk:" + label });
  return out;
}

export const STATES = ["invite", "waiting", "notlisted", "playing", "ended"] as const;
export const THEMES: readonly (string | null | undefined)[] = ["retro", "modern", "", "Modern", "dark", "blue", "maroon", "emerald", null, undefined];
export const expectLook = (t: unknown) => (t === "modern" ? "modern" : "retro");

/** Link kinds. A common link carries the inviter's code: one role each. */
export const ROLES = ["organizer", "host", "cohost", "guest"] as const;
export const HEXES = ["0000000", "0000001", "00fffff", "1234567", "7ffffff", "8000000", "abcdef0", "fffffff"] as const;
export const SEQS = [1, 2, 9, 99, 12345, 999_999_999] as const;
export const inviterIds = (role: (typeof ROLES)[number]): string[] => (role === "organizer" ? ["o"] : role === "host" ? HEXES.map((h) => "h:" + h) : role === "cohost" ? HEXES.map((h) => "c:" + h) : SEQS.map((s) => "s:" + s));
export const TOKEN_ALPHA = "abcdefghjkmnpqrstuvwxyz23456789";
export const personalTokens = (): string[] => Array.from({ length: 50 }, (_, i) => Array.from({ length: 10 }, (_, k) => TOKEN_ALPHA[(i * 7 + k * 13 + i * k) % TOKEN_ALPHA.length]!).join(""));

/** Game axes (the engine). */
export const DICE = ["fate", "presence-all", "presence-none", "presence-alternate"] as const;
export const TURN_CAPS = [10, 15, 20, 30, 45, 60, 90, 120, 150] as const;
export const END_PRIZES = [1, 2, 3, 4, 5] as const;
export const FINISH = ["exact", "pass"] as const;
export const PLAYERS = [2, 3, 5, 8] as const;
export const SEEDS = ["s1", "s2", "s3", "s4", "s5", "s6"] as const;
