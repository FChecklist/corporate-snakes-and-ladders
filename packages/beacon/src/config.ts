// What an organizer can set for a Snakes and Ladders game, beyond the start time and the turn window: the game type, the board, the prizes (reward lines),
// and brand breaks (up to 3 scheduled pauses showing the company's own message or video).
// Pure and shared: the Worker validates with it, the organizer page edits it, every phone and the organizer's settlement read it identically.
import { BOARD_SIZES, MAX_PER_KIND, MIN_PER_KIND } from "./board";
import { DEFAULT_END_PRIZES, DEFAULT_MILESTONE, DEFAULT_TURN_CAP, MAX_END_PRIZES, MAX_TURN_CAP, type Mode, type Play } from "./race";

/** Every prize an organizer can give. A "house" here is one kind of prize; each has reward lines (1st, 2nd ...). */
export type HouseId = "milestone" | "finish" | "team" | "climb" | "comeback" | "nevermissed";
export type PatternId = HouseId;
export type PatternKey = HouseId;
export type Scope = "ticket";
export interface RewardLine { pattern: HouseId; scope: Scope; ordinal: number; text: string }
/**
 * THE one table of prizes: id, label, a short plain "how to win", and the most winners (reward lines: 1st, 2nd, ...) the organizer may give it. The server validates with it, the phone page and the
 * console read it (window.ZG.PRIZE_HOUSES), the AI manual lists it. `dflt` prizes make up the default prize set of a new game: the milestone and the first five home.
 */
export interface PrizeHouse { id: PatternKey; label: string; how: string; max: number; kind: "set" | "lines"; dflt?: true; squares: string }
export const PRIZE_HOUSES: readonly PrizeHouse[] = [
  { id: "milestone", label: "Milestone", how: "The first player on or past the milestone square. Up to 3 milestone squares.", max: 3, kind: "set", dflt: true, squares: "set by the organizer" },
  { id: "finish", label: "Reach the end", how: "Land exactly on the last square. The first five players home win 1st to 5th.", max: 5, kind: "set", dflt: true, squares: "the last square" },
  { id: "team", label: "Team win", how: "Team race only. The best three teams win 1st to 3rd.", max: 3, kind: "set", squares: "all team members" },
  { id: "climb", label: "Biggest climb", how: "The player who took the biggest single ladder.", max: 1, kind: "set", squares: "one ladder" },
  { id: "comeback", label: "Comeback", how: "The biggest fall down a snake that the player then made up.", max: 1, kind: "set", squares: "one snake" },
  { id: "nevermissed", label: "Never missed", how: "Presence mode only. A player who threw in every turn, picked by fate.", max: 1, kind: "set", squares: "every turn" },
];
/** One plain line naming every house and its maximum winners, for the AI manual and the choices list. */
export const HOUSES_LINE: string = PRIZE_HOUSES.map((h) => `${h.id} = ${h.label} (${h.max === 1 ? "1 winner" : `up to ${h.max} winners`})`).join(", ");
/** The same houses with how to win each, one per line (AI manual, organizer guide). */
export const HOUSES_HELP_LIST: string[] = PRIZE_HOUSES.map((h) => `${h.id}: ${h.label}. ${h.how} ${h.max === 1 ? "1 winner." : `Up to ${h.max} winners.`}`);
export const HOUSES_HELP: string = HOUSES_HELP_LIST.join(String.fromCharCode(10));
/** Display order of every house (keysInPlay and the engines follow it). */
export const HOUSE_ORDER: readonly PatternKey[] = PRIZE_HOUSES.map((h) => h.id);
const HOUSE_BY_ID = new Map<string, PrizeHouse>(PRIZE_HOUSES.map((h) => [h.id, h]));
export const houseLabel = (id: string): string => HOUSE_BY_ID.get(id)?.label ?? id;
/** The most winners (reward lines) a house may have. */
export const maxWinnersFor = (id: string): number => HOUSE_BY_ID.get(id)?.max ?? 1;
export const LEGACY_MAX_ORDINAL = 3;
export interface BreakCfg { after: number; seconds: number; kind: "file" | "youtube" | "slides" | "speech" | "lucky"; title: string; mediaUrl?: string; winners?: 1 | 3 | 5 | 10; /** How a lucky draw is shown on phones. The winners are drawn the same way either way; a scratch card only changes the reveal. */ style?: "draw" | "scratch";
  /** True when the software placed this break (evenly spread among the automatic ones) instead of the organizer typing a number. Saving again re-spreads every automatic break. */ auto?: true }
/** A brand moment that is not a pause in the numbers: an OPENING plays while guests wait for the first number, a CLOSING plays on the final screen. */
export interface BrandSlot { kind: "file" | "youtube" | "slides" | "speech"; title: string; mediaUrl?: string; seconds?: number }
/** Who a participant may invite. The organizer switches this on and picks the kinds of guests; each participant may invite at most `per` people (the organizer, hosts and co-hosts any number), and the invitees may invite in turn. */
export const INVITE_CATEGORIES: ReadonlyArray<{ id: string; label: string }> = [
  { id: "family", label: "Family members" }, { id: "colleagues", label: "Colleagues" }, { id: "friends", label: "Friends" }, { id: "dealers", label: "Dealers" }, { id: "vendors", label: "Vendors" },
  { id: "customers", label: "Customers" }, { id: "partners", label: "Business partners" }, { id: "franchisees", label: "Franchisees" }, { id: "neighbours", label: "Neighbours and community" }, { id: "guests", label: "Other guests" },
];
export interface InviteCfg { on: boolean; per: number; cats: string[] }
/** The company's own mark on every ticket: a name, one of 8 fixed colours and, optionally, a small logo kept INSIDE the game's settings as a data URL (nothing is ever fetched from outside). */
export interface BrandCfg { name: string; color: string; logo?: string }
export const BRAND_COLORS: readonly string[] = ["#0B3D91", "#1B7F5C", "#B3261E", "#6A1B9A", "#C26A00", "#00798C", "#37474F", "#AD1457"];
export const BRAND_NAME_MAX = 40;
/** A logo is a PNG, JPEG or WebP of at most 30 KB (decoded). It is checked by its first bytes, not by what the sender called it. */
export const BRAND_LOGO_MAX_BYTES = 30 * 1024;
/** The logo rules, shown to the Organizer and enforced by the page and by the server alike.
 *  Upload: PNG, JPEG or WebP, at most 5 MB, at least 64 x 64 pixels, no wider than 4 times its height (or the other way round).
 *  Kept with the game: a PNG, JPEG or WebP of at most 30 KB whose longest side is 48 to 192 pixels (the page shrinks the upload to fit).
 *  On the ticket it is drawn at most 30 pixels high and 96 wide, on a white tile, so it reads on every brand colour, in the browser and in the installed app. */
export const LOGO_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const LOGO_MIN_SIDE = 64;
export const LOGO_MAX_RATIO = 4;
export const LOGO_STORED_MIN_SIDE = 48;
export const LOGO_STORED_MAX_SIDE = 192;
export const LOGO_RULES_TEXT = "PNG, JPEG or WebP, up to 5 MB, at least 64 x 64 pixels, square or wide (at most 4 times wider than tall). Best: a square 256 x 256 picture with a white or see-through background. We shrink it to fit (30 KB, 192 pixels) and show it 30 pixels high on every board, in the browser and in the installed app.";
/** Width and height of a PNG, JPEG or WebP from its first bytes (a string of raw characters), or null when they cannot be read. */
export function logoSize(raw: string, kind: string): { w: number; h: number } | null {
  const b = (i: number) => raw.charCodeAt(i);
  if (kind === "png") return raw.length >= 24 ? { w: ((b(16) << 24) | (b(17) << 16) | (b(18) << 8) | b(19)) >>> 0, h: ((b(20) << 24) | (b(21) << 16) | (b(22) << 8) | b(23)) >>> 0 } : null;
  if (kind === "jpeg") { let i = 2; while (i + 9 < raw.length) { if (b(i) !== 0xff) { i++; continue; } const m = b(i + 1); if (m === 0xff) { i++; continue; } if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: (b(i + 5) << 8) | b(i + 6), w: (b(i + 7) << 8) | b(i + 8) }; i += 2 + ((b(i + 2) << 8) | b(i + 3)); } return null; }
  if (kind === "webp") {
    const t = raw.slice(12, 16);
    if (t === "VP8 " && raw.length >= 30) return { w: (b(26) | (b(27) << 8)) & 0x3fff, h: (b(28) | (b(29) << 8)) & 0x3fff };
    if (t === "VP8L" && raw.length >= 25) { const v = b(21) | (b(22) << 8) | (b(23) << 16) | (b(24) * 16777216); return { w: (v & 0x3fff) + 1, h: ((v >>> 14) & 0x3fff) + 1 }; }
    if (t === "VP8X" && raw.length >= 30) return { w: (b(24) | (b(25) << 8) | (b(26) << 16)) + 1, h: (b(27) | (b(28) << 8) | (b(29) << 16)) + 1 };
  }
  return null;
}
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/;
/** Returns the decoded size and true type of a logo data URL, or a plain reason it cannot be used. */
export function checkBrandLogo(v: unknown): { ok: true; bytes: number } | { ok: false; error: string } {
  if (typeof v !== "string" || v.length > Math.ceil(BRAND_LOGO_MAX_BYTES / 3) * 4 + 40) return { ok: false, error: `The logo must be a PNG, JPEG or WebP picture of at most ${BRAND_LOGO_MAX_BYTES / 1024} KB.` };
  const m = LOGO_RE.exec(v);
  if (!m || m[2]!.length % 4 !== 0) return { ok: false, error: "The logo must be a PNG, JPEG or WebP picture." };
  let raw: string;
  try { raw = atob(m[2]!); } catch { return { ok: false, error: "The logo picture could not be read." }; }
  if (raw.length > BRAND_LOGO_MAX_BYTES) return { ok: false, error: `The logo is too big. Keep it under ${BRAND_LOGO_MAX_BYTES / 1024} KB.` };
  const b = (i: number) => raw.charCodeAt(i);
  const real = raw.length >= 12 && b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47 ? "png" : raw.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff ? "jpeg" : raw.length >= 12 && raw.slice(0, 4) === "RIFF" && raw.slice(8, 12) === "WEBP" ? "webp" : "";
  if (!real || real !== m[1]) return { ok: false, error: "The logo must really be a PNG, JPEG or WebP picture." };
  const d = logoSize(raw, real);
  if (!d || !d.w || !d.h) return { ok: false, error: "The logo picture could not be read." };
  const long = Math.max(d.w, d.h), short = Math.min(d.w, d.h);
  if (long > LOGO_STORED_MAX_SIDE) return { ok: false, error: `The logo is too large. Its longest side may be at most ${LOGO_STORED_MAX_SIDE} pixels.` };
  if (long < LOGO_STORED_MIN_SIDE) return { ok: false, error: `The logo is too small. Its longest side must be at least ${LOGO_STORED_MIN_SIDE} pixels.` };
  if (long > short * LOGO_MAX_RATIO) return { ok: false, error: `The logo is too long and thin. It may be at most ${LOGO_MAX_RATIO} times wider than tall.` };
  return { ok: true, bytes: raw.length };
}
export const MAX_INVITES_PER_PERSON = 10;
export const defaultInvites = (): InviteCfg => ({ on: false, per: 4, cats: ["family", "colleagues"] });
export type VerifyMode = "mobile" | "id" | "either" | "both";
export const VERIFY_MODES: VerifyMode[] = ["mobile", "id", "either", "both"];
export interface EngagementCfg { /** What a person must give to get in: their mobile number (default), their employee ID, or both. */ verify?: VerifyMode; /** Only the people on my list may play, and nobody may invite anyone. */ employeesOnly?: true; /** What the ID is: an employee ID (default) or an Email ID. One criterion for the whole game; the list decides who is in. */ idKind?: "email"; /** A friendly name the organizer gives the game (optional, up to 60 characters). */ name?: string; /** Always 1: each player has one pawn. Kept so older stored settings stay valid. */ tickets: 1; rewards: RewardLine[]; breaks: BreakCfg[]; rounds: number; invites?: InviteCfg; /** Before the first turn (at most one). Always present after validateCfg. */ opening?: BrandSlot[]; /** On the final screen (at most one). Always present after validateCfg. */ closing?: BrandSlot[]; /** The company's mark on the board (name, colour, optional logo). Absent = the plain board. */ brand?: BrandCfg; /** Unused in this game (kept for older stored settings). */ mark?: "auto" | "tap"; /** How a guest joins from the common link: "name" (the default: just a nickname) or "phone" (a mobile number is asked for as well, to match an invite list). */ join?: "name" | "phone"; /** Common engine (flag, default off): when true this game runs on the vendored game-core rules (elimination rounds, Pause/Resume by role, auto-claimed "You won"). Absent = the live rules, unchanged. */ engine?: true; /** Engine only: players who stay in after each round (0 or absent = nobody is sent out). */ survivors?: number; /** Engine only: turns in a round (default 10). */ roundTurns?: number; /** The organizer's time zone (an IANA name such as America/New_York), used to word times in mails and the report. Absent = Asia/Kolkata. */ tz?: string;
  /** How the game is played: "race" (the default: every player has their own board), "team" (a race between teams) or "table" (2 to 20 players share one board and take turns). */ mode?: Mode;
  /** "fate" (the default: every throw happens by itself when the window closes) or "presence" (a player who does not throw inside the window misses the turn). */ play?: Play;
  /** The board: size 100, 144 or 225, 6 to 12 snakes and as many ladders, and how the last square is reached. Absent = the classic board. */ board?: { size: 100 | 144 | 225; snakes: number; ladders: number; finish: "exact" | "pass" };
  /** The milestone squares (1 to 3). Absent = [75]. */ milestones?: number[];
  /** The game ends after this many turns even if nobody is home. Absent = 60. */ turnCap?: number;
  /** The game ends when this many players are home (1 to 5). Absent = 5. */ endPrizes?: number;
  /** True = nobody wins two prizes. Absent = a player may win several. */ exclusive?: true;
  /** Team race: how many teams (2 to 10). */ teams?: number;
  /** The look of the board: "jungle" (default) or "career" (Career Ladder). Cosmetic only. */ theme?: "jungle" | "career" }
/**
 * Who decides the winners: the software, never a person. Every phone works out the winners from the public numbers and reports them; our store accepts a result
 * only when this many DIFFERENT phones (one ticket per phone) reported exactly the same winners. Tiny games need half their people; larger ones 5% (3 to 25).
 */
export const quorumFor = (people: number): number => (people <= 6 ? Math.max(1, Math.ceil(people / 2)) : Math.min(25, Math.max(3, Math.ceil(people * 0.05))));
/** How many phones report each result (the rest stay quiet, to keep the free request allowance): everyone in a small game, four times the quorum in a big one. Silent phones step in if no result appears. */
export const votersFor = (people: number): number => (people <= 12 ? people : 4 * quorumFor(people));
export const MAX_ROUNDS = 1;
/** A game lasts at most this many turns (the organizer's turn limit is 10 to this). Kept under its old name because the prize and break checks use it. */
export const MAX_CALLS = MAX_TURN_CAP;
/** Registration closes at the time the organizer gave and B0 is the next beacon round. The first turn opens this many 3 s rounds (2 minutes) after the time given, so boards are made and openings can play. */
export const GRACE_ROUNDS = 40;
/** Kept for older callers: nobody joins after the game starts in this game. */
export const LATE_LAG_ROUNDS = 30;
/** Between two rounds everyone waits this many 3 s beacon rounds (90 s) before the next round's first turn. */
export const INTERMISSION_ROUNDS = 30;
/** Round 1 keeps the engagement's own id; later rounds use a derived id, so each round has its own numbers and its own tickets. */
export const roundEid = (eid: string, round: number): string => (round <= 1 ? eid : `${eid}~r${round}`);

/** The default prize set, in order: what a new game rewards until the organizer says otherwise (Line, Four Corners, X, Blackout). All houses, in order: HOUSE_ORDER. */
export const PATTERN_ORDER: readonly PatternId[] = PRIZE_HOUSES.filter((h) => h.dflt).map((h) => h.id as PatternId);
/** Brand moments are allowed PER TICKET each participant holds: 1 opening, 3 during the game and 1 closing for every ticket (5 with one ticket, 10 with two). */
export const MAX_MID_PER_TICKET = 3;
export const MAX_BREAKS = MAX_MID_PER_TICKET; // the allowance with one ticket; use maxMidFor(tickets) for the real limit
export const maxMidFor = (tickets: number): number => MAX_MID_PER_TICKET * tickets;
export const maxEdgeFor = (tickets: number): number => tickets; // openings, and separately closings
export const brandMomentsFor = (tickets: number): number => 5 * tickets;
/** Every opening has to fit inside the 2 minutes the game waits for everyone before its first number. */
export const OPENING_WINDOW_SECONDS = GRACE_ROUNDS * 3;
/** Even spread over a typical game of 60 turns: with `n` during-the-game moments, the k-th (1-based) goes after turn round(60 x k / (n + 1)). */
export const autoAfter = (n: number, k: number): number => Math.min(DEFAULT_TURN_CAP - 1, Math.max(1, Math.round((DEFAULT_TURN_CAP * k) / (n + 1))));
/** Room for every house at its own maximum (stays at least 30, the old limit). */
export const MAX_REWARD_LINES = Math.max(30, PRIZE_HOUSES.reduce((n, h) => n + h.max, 0));
export const MAX_ORDINAL = Math.max(LEGACY_MAX_ORDINAL, ...PRIZE_HOUSES.map((h) => h.max));
const KINDS = new Set(["file", "youtube", "slides", "speech", "lucky"]);
export const LUCKY_WINNERS = [1, 3, 5, 10] as const;

/** One reward line for each house, no text: what an engagement has until the organizer says otherwise. */
export const defaultRewards = (): RewardLine[] => [{ pattern: "milestone", scope: "ticket", ordinal: 1, text: "" }, ...[1, 2, 3, 4, 5].map((ordinal) => ({ pattern: "finish" as const, scope: "ticket" as const, ordinal, text: "" }))];
export const defaultCfg = (): EngagementCfg => ({ tickets: 1, rewards: defaultRewards(), breaks: [], rounds: 1, invites: defaultInvites(), opening: [], closing: [] });

export const keyOfLine = (l: Pick<RewardLine, "pattern" | "scope">): PatternKey => l.pattern;
export const lineKey = (l: RewardLine) => `${keyOfLine(l)}#${l.ordinal}`;
/** The distinct houses in play, in a stable order. */
export const keysInPlay = (rewards: readonly RewardLine[]): PatternKey[] => {
  const seen = new Set<PatternKey>();
  const order: readonly PatternKey[] = HOUSE_ORDER;
  for (const l of rewards) seen.add(keyOfLine(l));
  return order.filter((k) => seen.has(k));
};
export const linesFor = (rewards: readonly RewardLine[], key: PatternKey) => rewards.filter((l) => keyOfLine(l) === key).sort((a, b) => a.ordinal - b.ordinal);

/** Rounds (3 s each) a break adds before call index `k`: every break that starts at or before it. */
export const breakShift = (breaks: readonly BreakCfg[], k: number): number => breaks.reduce((s, b) => s + (b.after <= k ? b.seconds / 3 : 0), 0);

const cleanText = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/[<>`]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const YT = /^https:\/\/((www|m|music)\.)?(youtube\.com|youtu\.be)\//i; // a phone copies m.youtube.com or music.youtube.com links; any other address (youtube.com.evil.example) is still refused
/** A media file kept on our own site (for example the demo's built-in video): a path with no folders, and only a media file type. */
export const SITE_MEDIA = /^\/[A-Za-z0-9._-]{1,80}\.(mp4|webm|m4a|mp3)$/i;

/** Validates what the organizer sent. `opts.stored`: this is a game read back from storage, not new input, so a house may keep up to LEGACY_MAX_ORDINAL winners even where today's limit is lower (old games stay valid). Returns the cleaned config, or a plain-English reason. Missing parts keep their defaults. */
export const DEFAULT_TZ = "Asia/Kolkata";
/** True for a real IANA time zone name this runtime knows. */
export const isTimeZone = (z: unknown): z is string => { if (typeof z !== "string" || z.length > 64 || !/^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+-]+){0,2}$/.test(z)) return false; try { new Intl.DateTimeFormat("en-US", { timeZone: z }); return true; } catch { return false; } };
export function validateCfg(input: { verify?: unknown; employeesOnly?: unknown; idKind?: unknown; tz?: unknown; join?: unknown; mark?: unknown; tickets?: unknown; rewards?: unknown; breaks?: unknown; rounds?: unknown; invites?: unknown; opening?: unknown; closing?: unknown; name?: unknown; brand?: unknown; mode?: unknown; play?: unknown; board?: unknown; milestones?: unknown; turnCap?: unknown; engine?: unknown; survivors?: unknown; roundTurns?: unknown; endPrizes?: unknown; exclusive?: unknown; teams?: unknown; theme?: unknown }, base: EngagementCfg = defaultCfg(), opts: { stored?: boolean } = {}): { ok: true; cfg: EngagementCfg } | { ok: false; error: string } {
  const cfg: EngagementCfg & { opening: BrandSlot[]; closing: BrandSlot[] } = { tickets: base.tickets, rewards: base.rewards, breaks: base.breaks, rounds: base.rounds ?? 1, invites: base.invites ?? defaultInvites(), opening: base.opening ?? [], closing: base.closing ?? [], ...(base.verify ? { verify: base.verify } : {}), ...(base.employeesOnly ? { employeesOnly: true as const } : {}), ...(base.idKind === "email" ? { idKind: "email" as const } : {}), ...(base.name ? { name: base.name } : {}), ...(base.brand ? { brand: base.brand } : {}), ...(base.mark ? { mark: base.mark } : {}), ...(base.join ? { join: base.join } : {}), ...(base.tz ? { tz: base.tz } : {}), ...(base.mode ? { mode: base.mode } : {}), ...(base.play ? { play: base.play } : {}), ...(base.board ? { board: base.board } : {}), ...(base.milestones ? { milestones: base.milestones } : {}), ...(base.turnCap ? { turnCap: base.turnCap } : {}), ...(base.endPrizes ? { endPrizes: base.endPrizes } : {}), ...(base.exclusive ? { exclusive: base.exclusive } : {}), ...(base.teams ? { teams: base.teams } : {}), ...(base.theme ? { theme: base.theme } : {}) };
  if (input.rounds !== undefined) {
    if (!Number.isInteger(input.rounds) || (input.rounds as number) < 1 || (input.rounds as number) > MAX_ROUNDS) return { ok: false, error: "A game has one round. To play again, use Play again: it makes a new game with the same settings." };
    cfg.rounds = input.rounds as number;
  }
  if (input.tickets !== undefined) {
    if (input.tickets !== 1) return { ok: false, error: "Each player has one pawn." };
    cfg.tickets = 1;
  }
  if (input.rewards !== undefined) {
    if (!Array.isArray(input.rewards) || input.rewards.length < 1 || input.rewards.length > MAX_REWARD_LINES) return { ok: false, error: `Add between 1 and ${MAX_REWARD_LINES} rewards.` };
    const out: RewardLine[] = []; const seen = new Set<string>();
    for (const r of input.rewards as any[]) {
      const pattern = r?.pattern as HouseId; const scope: Scope = "ticket"; const ordinal = r?.ordinal === undefined ? 1 : r.ordinal;
      if (!HOUSE_ORDER.includes(pattern)) return { ok: false, error: "Unknown prize in the rewards." };
      if (!Number.isInteger(ordinal) || ordinal < 1) return { ok: false, error: "A winner number must be 1 or more." };
      const most = Math.max(maxWinnersFor(pattern), opts.stored ? LEGACY_MAX_ORDINAL : 0);
      const kept = base.rewards.some((x) => x.pattern === pattern && x.scope === scope && x.ordinal === ordinal); // already saved in this game: it stays
      if (ordinal > most && !kept) return { ok: false, error: `${houseLabel(pattern)} can have ${most === 1 ? "only 1 winner" : `at most ${most} winners`}. Please remove the extra ones.` };
      const id = `${scope}:${pattern}#${ordinal}`;
      if (seen.has(id)) return { ok: false, error: "The same reward is listed twice." };
      seen.add(id);
      out.push({ pattern, scope, ordinal, text: cleanText(r?.text, 80) });
    }
    for (const l of out) if (l.ordinal > 1 && !out.some((x) => x.pattern === l.pattern && x.scope === l.scope && x.ordinal === l.ordinal - 1)) return { ok: false, error: "A 2nd, 3rd... reward needs the one before it. Note that sending rewards REPLACES the whole list, so send every reward line each time, with ordinals starting at 1 for each house." };
    cfg.rewards = out;
  }
  if (cfg.rewards.length === 0) cfg.rewards = defaultRewards();
  if (input.breaks !== undefined) {
    if (!Array.isArray(input.breaks) || input.breaks.length > maxMidFor(cfg.tickets)) return { ok: false, error: `At most ${maxMidFor(cfg.tickets)} brand moments during the game with ${cfg.tickets} card${cfg.tickets === 1 ? "" : "s"} per person (lucky draws count too).` };
    const out: BreakCfg[] = [];
    for (const b of input.breaks as any[]) {
      // No number typed (or `auto: true` from an earlier save): the software places it, evenly spread among the automatic ones, and it lasts 60 s unless told otherwise.
      const auto = b?.auto === true || b?.after === undefined || b?.after === null || b?.after === "";
      const after = auto ? 0 : b?.after, seconds = auto && (b?.seconds === undefined || b?.seconds === null || b?.seconds === "") ? 60 : b?.seconds, kind = b?.kind;
      if (!auto && (!Number.isInteger(after) || after < 1 || after > MAX_CALLS - 1)) return { ok: false, error: `A break starts after 1 to ${MAX_CALLS - 1} turns have been played.` };
      if (!Number.isInteger(seconds) || seconds < 15 || seconds > 600 || seconds % 3) return { ok: false, error: "A break lasts 15 to 600 seconds, in steps of 3." };
      if (!KINDS.has(kind)) return { ok: false, error: "A break is a file, a YouTube link, slides, a speech or a lucky draw." };
      const winners = kind === "lucky" ? (b?.winners === undefined ? 3 : b.winners) : undefined;
      if (kind === "lucky" && !(LUCKY_WINNERS as readonly number[]).includes(winners)) return { ok: false, error: "A lucky draw picks 1, 3, 5 or 10 people." };
      const style = kind === "lucky" ? (b?.style === undefined || b.style === "" ? "draw" : b.style) : undefined;
      if (kind === "lucky" && style !== "draw" && style !== "scratch") return { ok: false, error: "A lucky draw is shown as a draw or as a scratch card." };
      if (kind !== "lucky" && b?.style !== undefined && b.style !== "") return { ok: false, error: "Only a lucky draw has a style." };
      const title = cleanText(b?.title, 80);
      if (title.length < 2) return { ok: false, error: "Give each break a short title." };
      let mediaUrl: string | undefined;
      if (b?.mediaUrl !== undefined && b.mediaUrl !== "") {
        if (typeof b.mediaUrl !== "string" || b.mediaUrl.length > 300 || !(/^https:\/\/[^\s<>"'`]+$/i.test(b.mediaUrl) || SITE_MEDIA.test(b.mediaUrl))) return { ok: false, error: "The link must start with https:// and have no spaces." };
        if (kind === "youtube" && !YT.test(b.mediaUrl)) return { ok: false, error: "That is not a YouTube video link (a youtube.com or youtu.be address). Copy it again from the YouTube Share button, or use a video file link instead." };
        mediaUrl = b.mediaUrl;
      }
      if ((kind === "file" || kind === "youtube") && !mediaUrl) return { ok: false, error: "This kind of break needs a link." };
      if (kind === "lucky" && mediaUrl) return { ok: false, error: "A lucky draw has no link." };
      out.push({ after, seconds, kind, title, ...(mediaUrl ? { mediaUrl } : {}), ...(winners ? { winners } : {}), ...(style === "scratch" ? { style } : {}), ...(auto ? { auto: true as const } : {}) });
    }
    { const nAuto = out.filter((x) => x.auto).length; let k = 0; for (const x of out) if (x.auto) x.after = autoAfter(nAuto, ++k); }
    out.sort((a, b) => a.after - b.after);
    for (let i = 1; i < out.length; i++) if (out[i]!.after === out[i - 1]!.after) return { ok: false, error: "Two breaks cannot start at the same turn." };
    cfg.breaks = out;
  }
  if (input.mark !== undefined) { if (input.mark !== "auto" && input.mark !== "tap") return { ok: false, error: "Marking is not used in this game." }; if (input.mark === "tap") cfg.mark = "tap"; else delete cfg.mark; }
  if (input.join !== undefined) { if (input.join !== "name" && input.join !== "phone") return { ok: false, error: "Joining is \"name\" (guests type their name) or \"phone\" (guests also give a mobile number)." }; if (input.join === "phone") cfg.join = "phone"; else delete cfg.join; }
  if (input.tz !== undefined) { if (input.tz === null || input.tz === "") delete cfg.tz; else if (isTimeZone(input.tz)) { if (input.tz === DEFAULT_TZ) delete cfg.tz; else cfg.tz = input.tz; } else return { ok: false, error: "That time zone is not known. Use a name such as America/New_York or Asia/Kolkata." }; }
  if (input.name !== undefined) { const nm = cleanText(input.name, 60); if (nm) cfg.name = nm; else delete cfg.name; }
  if (input.brand !== undefined) { // null (or an empty object) removes the brand; otherwise the whole brand is replaced
    const bd = input.brand as any;
    if (bd === null || (typeof bd === "object" && !Array.isArray(bd) && Object.keys(bd).length === 0)) delete cfg.brand;
    else {
      if (typeof bd !== "object" || Array.isArray(bd)) return { ok: false, error: "The brand needs a name and a colour." };
      for (const k of Object.keys(bd)) if (k !== "name" && k !== "color" && k !== "logo") return { ok: false, error: "The brand has only a name, a colour and a logo." };
      const nm = typeof bd.name === "string" ? bd.name.replace(/[<>`"'&\\]/g, "").replace(/\s+/g, " ").trim() : "";
      if (nm.length < 1 || nm.length > BRAND_NAME_MAX) return { ok: false, error: `The brand name is 1 to ${BRAND_NAME_MAX} characters.` };
      const color = typeof bd.color === "string" ? bd.color.trim().toUpperCase() : "";
      if (!BRAND_COLORS.includes(color)) return { ok: false, error: "Pick one of the brand colours from the list." };
      let logo: string | undefined;
      if (bd.logo !== undefined && bd.logo !== null && bd.logo !== "") { const lg = checkBrandLogo(bd.logo); if (!lg.ok) return lg; logo = bd.logo as string; }
      cfg.brand = { name: nm, color, ...(logo ? { logo } : {}) };
    }
  }
  for (const [field, label, max, isOpening] of [["opening", "before the game starts", maxEdgeFor(cfg.tickets), true], ["closing", "at the end of the game", maxEdgeFor(cfg.tickets), false]] as const) {
    const raw = (input as any)[field];
    if (raw === undefined) continue;
    if (!Array.isArray(raw) || raw.length > max) return { ok: false, error: `At most ${max} brand moment${max === 1 ? "" : "s"} ${label} with ${cfg.tickets} card${cfg.tickets === 1 ? "" : "s"} per person.` };
    const slots: BrandSlot[] = [];
    for (const b of raw as any[]) {
      const kind = b?.kind;
      if (kind === "lucky") return { ok: false, error: "A lucky draw can only be placed during the game." };
      if (!KINDS.has(kind)) return { ok: false, error: "A brand moment is a message, slides, a YouTube link or a video or audio file." };
      const title = cleanText(b?.title, 80);
      if (title.length < 2) return { ok: false, error: "Give each brand moment a short message or title." };
      let mediaUrl: string | undefined;
      if (b?.mediaUrl !== undefined && b.mediaUrl !== "") {
        if (typeof b.mediaUrl !== "string" || b.mediaUrl.length > 300 || !(/^https:\/\/[^\s<>"'`]+$/i.test(b.mediaUrl) || SITE_MEDIA.test(b.mediaUrl))) return { ok: false, error: "The link must start with https:// and have no spaces." };
        if (kind === "youtube" && !YT.test(b.mediaUrl)) return { ok: false, error: "That is not a YouTube video link (a youtube.com or youtu.be address). Copy it again from the YouTube Share button, or use a video file link instead." };
        mediaUrl = b.mediaUrl;
      }
      if ((kind === "file" || kind === "youtube") && !mediaUrl) return { ok: false, error: "This kind of brand moment needs a link." };
      let seconds: number | undefined;
      if (isOpening) {
        seconds = b?.seconds === undefined || b?.seconds === null || b?.seconds === "" ? 60 : b.seconds;
        if (!Number.isInteger(seconds) || (seconds as number) < 15 || (seconds as number) > OPENING_WINDOW_SECONDS || (seconds as number) % 3) return { ok: false, error: `An opening lasts 15 to ${OPENING_WINDOW_SECONDS} seconds, in steps of 3 (for example 30, 60 or 90). A time left empty counts as 60.` };
      }
      slots.push({ kind, title, ...(mediaUrl ? { mediaUrl } : {}), ...(seconds !== undefined ? { seconds } : {}) });
    }
    if (isOpening && slots.reduce((t, x) => t + (x.seconds ?? 0), 0) > OPENING_WINDOW_SECONDS) return { ok: false, error: `Openings must fit together in the ${OPENING_WINDOW_SECONDS / 60} minutes before the first turn. An opening with no time counts as 60 seconds.` };
    if (isOpening) cfg.opening = slots; else cfg.closing = slots;
  }

  if (input.mode !== undefined) { if (input.mode !== "race" && input.mode !== "team" && input.mode !== "table") return { ok: false, error: "The game type is \"race\", \"team\" or \"table\"." }; if (input.mode === "race") delete cfg.mode; else cfg.mode = input.mode; }
  if (input.play !== undefined) { if (input.play !== "fate" && input.play !== "presence") return { ok: false, error: "Play is \"fate\" (every throw is automatic) or \"presence\" (a player who does not throw in time misses the turn)." }; if (input.play === "fate") delete cfg.play; else cfg.play = "presence"; }
  if (input.board !== undefined) {
    const bd = input.board as any;
    if (bd === null) delete cfg.board;
    else {
      if (typeof bd !== "object" || Array.isArray(bd)) return { ok: false, error: "The board needs a size, snakes, ladders and a finish rule." };
      const size = bd.size ?? 100, snakes = bd.snakes ?? 9, ladders = bd.ladders ?? 9, finish = bd.finish ?? "exact";
      if (!(BOARD_SIZES as readonly number[]).includes(size)) return { ok: false, error: "The board has 100, 144 or 225 squares." };
      if (!Number.isInteger(snakes) || !Number.isInteger(ladders) || snakes < MIN_PER_KIND || snakes > MAX_PER_KIND || ladders < MIN_PER_KIND || ladders > MAX_PER_KIND) return { ok: false, error: `A board has ${MIN_PER_KIND} to ${MAX_PER_KIND} snakes and ${MIN_PER_KIND} to ${MAX_PER_KIND} ladders.` };
      if (finish !== "exact" && finish !== "pass") return { ok: false, error: "The finish is \"exact\" (the exact roll) or \"pass\" (reach or pass the last square)." };
      if (size === 100 && snakes === 9 && ladders === 9 && finish === "exact") delete cfg.board; else cfg.board = { size, snakes, ladders, finish };
    }
  }
  if (input.milestones !== undefined) {
    const ms = input.milestones as any;
    if (ms === null) delete cfg.milestones;
    else {
      const size = cfg.board?.size ?? 100;
      if (!Array.isArray(ms) || ms.length < 1 || ms.length > 3 || ms.some((m: unknown) => !Number.isInteger(m) || (m as number) < 2 || (m as number) >= size) || new Set(ms).size !== ms.length) return { ok: false, error: `A milestone is a square from 2 to ${size - 1}. Give 1 to 3 different squares.` };
      const sorted = [...ms].sort((a: number, b: number) => a - b);
      if (sorted.length === 1 && sorted[0] === DEFAULT_MILESTONE) delete cfg.milestones; else cfg.milestones = sorted;
    }
  }
  if (input.turnCap !== undefined) { const v = input.turnCap as any; if (v === null || v === DEFAULT_TURN_CAP) delete cfg.turnCap; else if (!Number.isInteger(v) || v < 10 || v > MAX_TURN_CAP) return { ok: false, error: `The turn limit is 10 to ${MAX_TURN_CAP}.` }; else cfg.turnCap = v; }
  if (input.endPrizes !== undefined) { const v = input.endPrizes as any; if (v === null || v === DEFAULT_END_PRIZES) delete cfg.endPrizes; else if (!Number.isInteger(v) || v < 1 || v > MAX_END_PRIZES) return { ok: false, error: `The game can end when 1 to ${MAX_END_PRIZES} players are home.` }; else cfg.endPrizes = v; }
  if (input.exclusive !== undefined) { if (input.exclusive === true) cfg.exclusive = true; else if (input.exclusive === false || input.exclusive === null) delete cfg.exclusive; else return { ok: false, error: "One prize per person is on (true) or off (false)." }; }
  if (input.teams !== undefined) { const v = input.teams as any; if (v === null) delete cfg.teams; else if (!Number.isInteger(v) || v < 2 || v > 10) return { ok: false, error: "A team race has 2 to 10 teams." }; else cfg.teams = v; }
  if (input.theme !== undefined) { if (input.theme !== "jungle" && input.theme !== "career") return { ok: false, error: "The look is \"jungle\" or \"career\"." }; if (input.theme === "career") cfg.theme = "career"; else delete cfg.theme; }
  if ((cfg.mode === "team") !== (cfg.teams !== undefined) && (input.mode !== undefined || input.teams !== undefined)) return { ok: false, error: cfg.mode === "team" ? "A team race needs the number of teams (2 to 10)." : "Teams only exist in a team race." };
  if (cfg.rewards.some((l) => l.pattern === "team") && cfg.mode !== "team") return { ok: false, error: "The team prize belongs to a team race." };
  if (cfg.rewards.some((l) => l.pattern === "nevermissed") && cfg.play !== "presence") return { ok: false, error: "The never-missed prize belongs to presence play." };
  if (cfg.milestones && cfg.milestones.some((m) => m >= (cfg.board?.size ?? 100))) return { ok: false, error: "A milestone must be before the last square." };
  if (cfg.rewards.some((l) => l.pattern === "milestone" && l.ordinal > (cfg.milestones ?? [DEFAULT_MILESTONE]).length)) return { ok: false, error: "Each milestone prize needs its own milestone square." };
  { // the allowance follows the tickets: changing from 2 tickets to 1 must not leave more than one ticket's worth switched on
    const t = cfg.tickets;
    if (cfg.breaks.length > maxMidFor(t) || cfg.opening.length > maxEdgeFor(t) || cfg.closing.length > maxEdgeFor(t))
      return { ok: false, error: `With ${t} card${t === 1 ? "" : "s"} per person you can use ${brandMomentsFor(t)} brand moments: ${maxEdgeFor(t)} before the game, ${maxMidFor(t)} during it and ${maxEdgeFor(t)} at the end. Please switch some off.` };
  }
  if (input.verify !== undefined) {
    if (!VERIFY_MODES.includes(input.verify as VerifyMode)) return { ok: false, error: "What a person must give: choose mobile number, employee ID, mobile number or employee ID, or both." };
    if (input.verify === "mobile") delete cfg.verify; else cfg.verify = input.verify as VerifyMode;
  }
  if (input.engine !== undefined) {
    if (typeof input.engine !== "boolean") return { ok: false, error: "The new rules: say yes or no." };
    if (input.engine) cfg.engine = true; else { delete cfg.engine; delete cfg.survivors; delete cfg.roundTurns; }
  }
  if (input.survivors !== undefined) {
    if (!Number.isInteger(input.survivors) || (input.survivors as number) < 0 || (input.survivors as number) > 2000) return { ok: false, error: "Players who stay in after each round: a whole number from 0 to 2000 (0 = nobody is sent out)." };
    if (input.survivors && cfg.engine) cfg.survivors = input.survivors as number; else delete cfg.survivors;
  }
  if (input.roundTurns !== undefined) {
    if (!Number.isInteger(input.roundTurns) || (input.roundTurns as number) < 1 || (input.roundTurns as number) > 60) return { ok: false, error: "Turns in a round: a whole number from 1 to 60." };
    if (input.roundTurns !== 10 && cfg.engine) cfg.roundTurns = input.roundTurns as number; else delete cfg.roundTurns;
  }
  if (input.idKind !== undefined) {
    if (input.idKind !== "email" && input.idKind !== "emp") return { ok: false, error: "What the ID is: an employee ID or an Email ID." };
    if (input.idKind === "email") cfg.idKind = "email"; else delete cfg.idKind;
  }
  if (input.employeesOnly !== undefined) {
    if (typeof input.employeesOnly !== "boolean") return { ok: false, error: "Employees only: say yes or no." };
    if (input.employeesOnly) cfg.employeesOnly = true; else delete cfg.employeesOnly;
  }
  if (input.invites !== undefined) {
    const v = input.invites as any;
    if (!v || typeof v !== "object" || typeof v.on !== "boolean") return { ok: false, error: "Invites: say whether they are on or off." };
    const per = v.per === undefined ? cfg.invites!.per : v.per;
    if (!Number.isInteger(per) || per < 1 || per > MAX_INVITES_PER_PERSON) return { ok: false, error: `Each person can invite 1 to ${MAX_INVITES_PER_PERSON} people.` };
    const cats = v.cats === undefined ? cfg.invites!.cats : v.cats;
    if (!Array.isArray(cats) || cats.some((c: unknown) => !INVITE_CATEGORIES.some((k) => k.id === c))) return { ok: false, error: "Pick the kinds of guests from the list." };
    const uniq = [...new Set(cats as string[])];
    if (v.on && uniq.length < 1) return { ok: false, error: "Pick at least one kind of guest people may invite." };
    cfg.invites = { on: v.on, per, cats: uniq };
  }
  if (cfg.employeesOnly) { cfg.invites = { on: false, per: cfg.invites!.per, cats: cfg.invites!.cats }; cfg.join = "phone"; } // employees only: nobody invites anyone, and a guest is known by mobile number or ID, never by a nickname
  return { ok: true, cfg };
}

/** The game-specific settings, picked out of any object (a request body, stored JSON) so every place that reads or writes settings handles them the same way. */
export const GAME_FIELDS = ["mode", "play", "board", "milestones", "turnCap", "endPrizes", "exclusive", "teams", "theme"] as const;
export const gameFields = (src: any): Record<string, unknown> => { const o: Record<string, unknown> = {}; if (src && typeof src === "object") for (const k of GAME_FIELDS) if (src[k] !== undefined) o[k] = src[k]; return o; };
/** The same settings out of a validated config, only those that differ from the defaults (validateCfg already drops the defaults). */
export const gameOut = (c: EngagementCfg): Record<string, unknown> => { const o: Record<string, unknown> = {}; for (const k of GAME_FIELDS) if ((c as any)[k] !== undefined) o[k] = (c as any)[k]; return o; };
