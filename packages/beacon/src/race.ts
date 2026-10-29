// Snakes and Ladders: the group race and the team race (every player has their own board; everyone throws in the same window).
// Pure and deterministic: given the settings, the seat count, B0 and the published b_t values, every phone gets exactly the same positions, winners and ranking.
import { generateBoard, defaultBoardCfg, type Board, type BoardCfg } from "./board";
import { advance, fateOf, newRun, rollFor, squareOf, type Run } from "./play";

export type Mode = "race" | "team" | "table";
export type Play = "fate" | "presence";
export const DEFAULT_TURN_CAP = 60, MAX_TURN_CAP = 150, DEFAULT_END_PRIZES = 5, MAX_END_PRIZES = 5, DEFAULT_MILESTONE = 75;

/** What the game needs to know to play (public settings, the same on every device). */
export interface RaceCfg {
  gameId: string;
  players: number;              // seats 1..players
  board: BoardCfg;
  milestones: number[];         // squares; the first player at or past each wins that milestone prize
  turnCap: number;
  endPrizes: number;            // the game ends when this many players have landed on the last square (1 to 5)
  play: Play;                   // fate: every throw is automatic; presence: a player who does not throw in the window misses the turn
  exclusive: boolean;           // true = nobody wins two prizes
  milestonePrizes?: number;     // with one prize per person: how many milestone prizes the organizer gave (a holder cannot also take a 'reach the end' prize, so the game waits for one more player home per holder)
  teams?: number;               // team race: number of teams (2 to 10); absent = group race
}
export const defaultRaceCfg = (gameId: string, players: number): RaceCfg => ({ gameId, players, board: defaultBoardCfg(), milestones: [DEFAULT_MILESTONE], turnCap: DEFAULT_TURN_CAP, endPrizes: DEFAULT_END_PRIZES, play: "fate", exclusive: false });

/** The public inputs: B0 and b_0, b_1, ... (as many as have been published). `thrown` is the collector's record in presence mode (true = the tap arrived inside the window). */
export interface RaceInput { b0: string; betas: readonly string[]; thrown?: (seat: number, turn: number) => boolean }

export interface RaceState {
  cfg: RaceCfg;
  b0: string;
  runs: Run[];                  // index seat-1
  boards: Board[];              // index seat-1
  turnsPlayed: number;
  ended: boolean;
  endReason: "finishers" | "cap" | "running";
  finishedCount: number;
}

const boardCache = new Map<string, Board>();
export function boardOf(cfg: Pick<RaceCfg, "gameId" | "board">, seat: number, b0: string): Board {
  const key = `${cfg.gameId}|${seat}|${b0}|${cfg.board.size}|${cfg.board.snakes}|${cfg.board.ladders}|${cfg.board.finish}|${cfg.board.targetTurns ?? ""}`;
  let b = boardCache.get(key);
  if (!b) { if (boardCache.size > 30000) boardCache.clear(); b = generateBoard(cfg.gameId, seat, b0, cfg.board); boardCache.set(key, b); }
  return b;
}

export function validateRaceCfg(c: RaceCfg): string | null {
  if (!Number.isInteger(c.players) || c.players < 2 || c.players > 10000) return "A game has 2 to 10,000 players.";
  if (!Number.isInteger(c.turnCap) || c.turnCap < 10 || c.turnCap > MAX_TURN_CAP) return `The turn limit is 10 to ${MAX_TURN_CAP}.`;
  if (!Number.isInteger(c.endPrizes) || c.endPrizes < 1 || c.endPrizes > MAX_END_PRIZES) return "1 to 5 players can win an end prize.";
  if (!Array.isArray(c.milestones) || c.milestones.length > 3 || c.milestones.some((m) => !Number.isInteger(m) || m < 2 || m >= c.board.size)) return "A milestone is a square between 2 and the one before the last. At most 3 milestones.";
  if (new Set(c.milestones).size !== c.milestones.length) return "Two milestones cannot be the same square.";
  if (c.play !== "fate" && c.play !== "presence") return "Play mode is fate or presence.";
  if (c.teams !== undefined && (!Number.isInteger(c.teams) || c.teams < 2 || c.teams > 10 || c.teams > c.players)) return "A team race has 2 to 10 teams, and no more teams than players.";
  return null;
}

/** Plays the race forward turn by turn for as long as the published values allow, or until it ends. Needs B0 to exist. */
export function playRace(cfg: RaceCfg, input: RaceInput): RaceState {
  const err = validateRaceCfg(cfg); if (err) throw new Error(err);
  const boards: Board[] = [], runs: Run[] = [];
  for (let s = 1; s <= cfg.players; s++) { boards.push(boardOf(cfg, s, input.b0)); runs.push(newRun(s)); }
  const st: RaceState = { cfg, b0: input.b0, runs, boards, turnsPlayed: 0, ended: false, endReason: "running", finishedCount: 0 };
  for (let t = 0; t < input.betas.length && !st.ended; t++) {
    const bt = input.betas[t]!;
    for (let s = 1; s <= cfg.players; s++) {
      const run = runs[s - 1]!;
      const throws = cfg.play === "fate" || (input.thrown ? input.thrown(s, t) : false);
      advance(boards[s - 1]!, run, throws ? rollFor(cfg.gameId, s, t, bt) : null, cfg.board.finish);
    }
    st.turnsPlayed = t + 1;
    st.finishedCount = runs.reduce((n, r) => n + (r.finishedTurn !== null ? 1 : 0), 0);
    if (cfg.teams) { if (teamsFinished(cfg, st).length > 0) { st.ended = true; st.endReason = "finishers"; } }
    else if (homeCount(st) >= cfg.endPrizes) { st.ended = true; st.endReason = "finishers"; }
    if (!st.ended && st.turnsPlayed >= cfg.turnCap) { st.ended = true; st.endReason = "cap"; }
  }
  return st;
}

/** Players home who can still take a 'reach the end' prize. With one prize per person a player who holds a milestone prize cannot also take one, so the game waits for `endPrizes` players WITHOUT a milestone prize (otherwise it would end with a 'reach the end' prize unawarded). */
function homeCount(st: RaceState): number {
  const cfg = st.cfg, home = st.runs.filter((r) => r.finishedTurn !== null);
  if (!cfg.exclusive || !cfg.milestonePrizes || home.length < cfg.endPrizes) return home.length;
  const holders = new Set<number>();
  for (let i = 1; i <= Math.min(cfg.milestonePrizes, cfg.milestones.length); i++) { const w = candidates(st, "milestone", i).find((c) => !holders.has(c.seat)); if (w) holders.add(w.seat); }
  return home.filter((r) => !holders.has(r.seat)).length;
}

/* ---------------- ranking (no ties, ever) ---------------- */

export interface RankRow { rank: number; seat: number; finishedTurn: number | null; square: number; ladders: number; missed: number; note: string }
const KEYS = ["finished earlier", "a higher square", "more ladders climbed", "fewer turns missed", "fate"] as const;

/** Compares two players by the chain of section 6: earlier finish, higher square, more ladders, fewer missed turns, then fate. Returns the order and the index of the key that decided it. */
function compareChain(gameId: string, a: Run, b: Run, label: string): { order: number; key: number } {
  const fa = a.finishedTurn ?? Infinity, fb = b.finishedTurn ?? Infinity;
  if (fa !== fb) return { order: fa < fb ? -1 : 1, key: 0 };
  const sa = squareOf(a), sb = squareOf(b);
  if (sa !== sb) return { order: sa > sb ? -1 : 1, key: 1 };
  if (a.ladders !== b.ladders) return { order: a.ladders > b.ladders ? -1 : 1, key: 2 };
  if (a.missed !== b.missed) return { order: a.missed < b.missed ? -1 : 1, key: 3 };
  const x = fateOf(gameId, a.seat, label), y = fateOf(gameId, b.seat, label);
  return { order: x < y ? -1 : x > y ? 1 : a.seat < b.seat ? -1 : 1, key: 4 };
}

/** The full strict order of every player (1st to last), with no ties. */
export function orderPlayers(st: RaceState): Run[] {
  const label = "rank";
  return [...st.runs].sort((a, b) => compareChain(st.cfg.gameId, a, b, label).order);
}

/** The ranking and the top-N list: places 1 to 5 are the first five to finish, then the best of the rest. A tie that had to be broken gets a one-line note. */
export function rankPlayers(st: RaceState, n = 10): RankRow[] {
  const all = orderPlayers(st), out: RankRow[] = [];
  const label = "rank";
  for (let i = 0; i < Math.min(n, all.length); i++) {
    const r = all[i]!; let note = "";
    // players level with this one on the main measure (finishing turn for finishers, square for the others)
    const level = (x: Run) => (r.finishedTurn !== null ? x.finishedTurn === r.finishedTurn : x.finishedTurn === null && squareOf(x) === squareOf(r));
    const group = all.filter(level);
    if (group.length > 1) {
      let deepest = 0;
      for (let j = 1; j < group.length; j++) deepest = Math.max(deepest, compareChain(st.cfg.gameId, group[j - 1]!, group[j]!, label).key);
      const where = r.finishedTurn !== null ? `finished on turn ${r.finishedTurn + 1}` : `are on square ${squareOf(r)}`;
      note = `${group.length} players ${where}; decided by ${KEYS[Math.max(deepest, 2)]}`;
      if (r.finishedTurn !== null && deepest < 2) note = `${group.length} players ${where}; decided by ${KEYS[2]}`;
    }
    out.push({ rank: i + 1, seat: r.seat, finishedTurn: r.finishedTurn, square: squareOf(r), ladders: r.ladders, missed: r.missed, note });
  }
  return out;
}

/* ---------------- prizes ---------------- */

export interface RewardLike { pattern: string; ordinal: number; text?: string }
/** The shape the rest of the product already uses: one winner per reward line. `pids` holds one pid (a team prize holds the whole team). */
export interface Settled { pattern: string; ordinal: number; idx: number; pids: string[]; round: number; tied?: number }

export const PRIZE_IDS = ["milestone", "finish", "team", "climb", "comeback", "nevermissed"] as const;

function reachTurn(r: Run, m: number): number { for (let t = 0; t < r.pos.length; t++) if (r.pos[t]! >= m) return t; return -1; }

/** Candidates for one reward line, best first. The first is the winner; with one-prize-per-person the first not already a winner takes it. Each entry says on which turn the prize was won. */
function candidates(st: RaceState, pattern: string, ordinal: number): { seat: number; idx: number; tied?: number }[] {
  const g = st.cfg.gameId, runs = st.runs;
  const endTurn = Math.max(0, st.turnsPlayed - 1);
  if (pattern === "finish") {
    const fin = runs.filter((r) => r.finishedTurn !== null).sort((a, b) => compareChain(g, a, b, "rank").order); // the same order the ranking table shows (same fate label), so the prize list and the table never disagree
    if (ordinal > st.cfg.endPrizes) return [];
    return fin.map((r) => { const same = fin.filter((x) => x.finishedTurn === r.finishedTurn).length; return { seat: r.seat, idx: r.finishedTurn!, ...(same > 1 ? { tied: same } : {}) }; });
  }
  if (pattern === "milestone") {
    const ms = [...st.cfg.milestones].sort((a, b) => a - b), m = ms[ordinal - 1]; if (m === undefined) return [];
    const reached = runs.map((r) => ({ r, t: reachTurn(r, m) })).filter((x) => x.t >= 0);
    reached.sort((a, b) => a.t - b.t || b.r.pos[b.t]! - a.r.pos[a.t]! || // same turn: the higher square ON THAT TURN wins (never the square now, which changes with later snakes and ladders: a prize shown on a phone is never taken back)
       (fateOf(g, a.r.seat, `milestone${ordinal}`) < fateOf(g, b.r.seat, `milestone${ordinal}`) ? -1 : 1));
    return reached.map((x) => { const same = reached.filter((y) => y.t === x.t).length; return { seat: x.r.seat, idx: x.t, ...(same > 1 ? { tied: same } : {}) }; });
  }
  if (!st.ended) return [];
  if (pattern === "climb" || pattern === "comeback") {
    const val = (r: Run) => (pattern === "climb" ? r.bestClimb : r.bestComeback);
    const c = runs.filter((r) => val(r) > 0).sort((a, b) => val(b) - val(a) || (fateOf(g, a.seat, pattern) < fateOf(g, b.seat, pattern) ? -1 : 1));
    return c.map((r) => { const same = c.filter((x) => val(x) === val(r)).length; return { seat: r.seat, idx: endTurn, ...(same > 1 ? { tied: same } : {}) }; });
  }
  if (pattern === "nevermissed") {
    if (st.cfg.play !== "presence") return [];
    const c = runs.filter((r) => r.missed === 0).sort((a, b) => (fateOf(g, a.seat, pattern) < fateOf(g, b.seat, pattern) ? -1 : 1));
    return c.map((r) => ({ seat: r.seat, idx: endTurn, ...(c.length > 1 ? { tied: c.length } : {}) }));
  }
  return [];
}

/**
 * Who won each reward line, decided by software only. `lines` are the organizer's reward lines, most valuable first.
 * Nothing here can be changed by a person: it is a function of the public values. Prizes that need the whole game (climb, comeback, never missed,
 * and every prize when one-prize-per-person is on) appear when the game has ended.
 */
export function settleRace(st: RaceState, lines: readonly RewardLike[], pidOf: (seat: number) => string = (s) => String(s), round = 1): Settled[] {
  if (st.cfg.teams) return settleTeams(st, lines, pidOf, round);
  const out: Settled[] = [], won = new Set<number>();
  if (st.cfg.exclusive && !st.ended) return out;
  for (const l of lines) {
    if (l.pattern === "team") continue;
    const cand = candidates(st, l.pattern, l.ordinal);
    let pick: { seat: number; idx: number; tied?: number } | undefined;
    if (l.pattern === "finish") pick = cand.filter((c) => !st.cfg.exclusive || !won.has(c.seat))[st.cfg.exclusive ? 0 : l.ordinal - 1];
    else pick = cand.find((c) => !st.cfg.exclusive || !won.has(c.seat));
    if (l.pattern === "finish" && st.cfg.exclusive) { const free = cand.filter((c) => !won.has(c.seat)); pick = free[0]; }
    if (!pick) continue;
    won.add(pick.seat);
    out.push({ pattern: l.pattern, ordinal: l.ordinal, idx: pick.idx, pids: [pidOf(pick.seat)], round, ...(pick.tied ? { tied: pick.tied } : {}) });
  }
  return out;
}

/* ---------------- team race ---------------- */

/** Deals players into teams with fate: the order is a function of the game id and B0 only (so it is unknown until registration closes), and team sizes differ by at most one. */
export function teamsOf(cfg: Pick<RaceCfg, "gameId" | "players" | "teams">, b0: string): number[] {
  const seats = Array.from({ length: cfg.players }, (_, i) => i + 1).sort((a, b) => { const x = fateOf(cfg.gameId, a, `team|${b0}`), y = fateOf(cfg.gameId, b, `team|${b0}`); return x < y ? -1 : x > y ? 1 : a - b; });
  const o = new Array<number>(cfg.players); seats.forEach((s, i) => { o[s - 1] = i % cfg.teams!; });
  return o;
}
export interface TeamRow { team: number; members: number[]; finishedTurn: number | null; avgSquare: number; ladders: number; missed: number; rank: number; note: string }

export function teamTable(cfg: RaceCfg, st: RaceState, teamOf: readonly number[]): TeamRow[] {
  const n = cfg.teams!, rows: TeamRow[] = Array.from({ length: n }, (_, t) => ({ team: t, members: [] as number[], finishedTurn: null as number | null, avgSquare: 0, ladders: 0, missed: 0, rank: 0, note: "" }));
  for (const r of st.runs) { const t = rows[teamOf[r.seat - 1]!]!; t.members.push(r.seat); t.avgSquare += squareOf(r); t.ladders += r.ladders; t.missed += r.missed; }
  for (const t of rows) {
    const rs = t.members.map((s) => st.runs[s - 1]!);
    t.avgSquare = t.members.length ? t.avgSquare / t.members.length : 0;
    t.finishedTurn = rs.length && rs.every((r) => r.finishedTurn !== null) ? Math.max(...rs.map((r) => r.finishedTurn!)) : null;
    t.ladders = t.members.length ? t.ladders / t.members.length : 0; t.missed = t.members.length ? t.missed / t.members.length : 0; // per member: teams differ by one player at most
  }
  const cmp = (a: TeamRow, b: TeamRow): { order: number; key: number } => {
    const fa = a.finishedTurn ?? Infinity, fb = b.finishedTurn ?? Infinity;
    if (fa !== fb) return { order: fa < fb ? -1 : 1, key: 0 };
    if (a.avgSquare !== b.avgSquare) return { order: a.avgSquare > b.avgSquare ? -1 : 1, key: 1 };
    if (a.ladders !== b.ladders) return { order: a.ladders > b.ladders ? -1 : 1, key: 2 };
    if (a.missed !== b.missed) return { order: a.missed < b.missed ? -1 : 1, key: 3 };
    const x = fateOf(cfg.gameId, `team${a.team}`, "teamrank"), y = fateOf(cfg.gameId, `team${b.team}`, "teamrank");
    return { order: x < y ? -1 : x > y ? 1 : a.team - b.team, key: 4 };
  };
  rows.sort((a, b) => cmp(a, b).order);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    const level = rows.filter((x) => (r.finishedTurn !== null ? x.finishedTurn === r.finishedTurn : x.finishedTurn === null && x.avgSquare === r.avgSquare));
    if (level.length > 1) { let d = 0; for (let j = 1; j < level.length; j++) d = Math.max(d, cmp(level[j - 1]!, level[j]!).key); r.note = `${level.length} teams level; decided by ${KEYS[Math.max(d, 2)]}`; }
  });
  return rows;
}
function teamsFinished(cfg: RaceCfg, st: RaceState): number[] {
  if (!cfg.teams) return [];
  return teamTable(cfg, st, teamsOf(cfg, st.b0)).filter((r) => r.finishedTurn !== null).map((r) => r.team);
}

function settleTeams(st: RaceState, lines: readonly RewardLike[], pidOf: (seat: number) => string, round: number): Settled[] {
  const out: Settled[] = [], cfg = st.cfg, table = teamTable(cfg, st, teamsOf(cfg, st.b0));
  if (!st.ended) return out;
  for (const l of lines) {
    if (l.pattern !== "team") continue;
    const row = table[l.ordinal - 1]; if (!row) continue;
    out.push({ pattern: "team", ordinal: l.ordinal, idx: Math.max(0, st.turnsPlayed - 1), pids: row.members.map(pidOf), round, ...(row.note ? { tied: 2 } : {}) });
  }
  return out;
}

/* ---------------- the crowd (what every player sees) ---------------- */

export interface Crowd { players: number; turn: number; bands: number[]; finished: number; aheadOf: (seat: number) => number }
/** How many players are in each band of the board (default 10 bands) and the share of players a seat is ahead of. Counts add up to the number of players. */
export function crowdOf(st: RaceState, bandCount = 10): Crowd {
  const size = st.cfg.board.size, bands = new Array<number>(bandCount).fill(0), per = size / bandCount;
  const sq = st.runs.map(squareOf);
  for (const s of sq) bands[Math.min(bandCount - 1, Math.floor((s - 1) / per))]!++;
  const sorted = [...sq].sort((a, b) => a - b);
  const lower = (x: number) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m]! < x) lo = m + 1; else hi = m; } return lo; };
  return { players: st.runs.length, turn: st.turnsPlayed, bands, finished: st.finishedCount, aheadOf: (seat) => Math.round((100 * lower(squareOf(st.runs[seat - 1]!))) / Math.max(1, st.runs.length)) };
}
