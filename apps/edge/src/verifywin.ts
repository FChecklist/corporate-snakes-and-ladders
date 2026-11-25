// Checking a reported win against the public game, before a phone's report is counted (security audit H1, 23 Nov 2026).
//
// Before this file the server trusted what phones said: when enough seats sent the same answer it was settled, even a made-up one, even before the game began.
// Now every report is checked against what the server itself knows:
//   1. THE TURN HAS HAPPENED. The turn named in the report must be one whose public beacon number is already out (the game's own schedule, pauses and stop applied).
//      A report for a turn that has not happened yet is answered "not yet" (409) and the phone sends it again a little later.
//   2. THE SEATS EXIST. Every winner named must be a seat of this game.
//   3. THE GAME IS OVER for the prizes that need the whole game (climb, comeback, never missed, team, and every prize when one-prize-per-person is on).
//   4. THE WIN IS REAL. The server fetches the public beacon numbers (the same ones every phone uses), plays the named seat's own board forward and checks that this seat
//      really reached the milestone, or really got home, on the turn the report says; a biggest-climb or biggest-comeback prize needs a real ladder or a real snake escape;
//      a team prize names a whole team as dealt by the game's own fate; a lucky draw is worked out again from the round that decides it.
// What it cannot do on a free Worker (about 10 ms of work per call): replay every seat of a big game to prove that nobody else got there first. Playing one seat is a few
// hundred hashes; playing 2,000 seats for 150 turns is seconds. So a group of seats can still choose WHICH real winner of a prize is reported, but they cannot invent a win,
// name a seat that does not exist, or settle anything before the game has begun. The organizer's console replays the whole game and can correct the rest (override).
import { QUICKNET, roundAt } from "../../../packages/beacon/src/index";
import { betaRoundOf } from "../../../packages/beacon/src/schedule";
import { boardOf, teamsOf, DEFAULT_MILESTONE, DEFAULT_TURN_CAP } from "../../../packages/beacon/src/race";
import { raceCfgOf, luckyEligible, luckyRound, luckyWinners } from "../../../packages/beacon/src/game";
import { rollFor, runFrom } from "../../../packages/beacon/src/play";
import { seatOfPid } from "../../../packages/beacon/src/seat";
import { endBoundMs, roundMs, scheduleOf } from "./lifecycle";
import { prefixEnd } from "./checkin";
import type { Env } from "./worker";

export interface Claim { pattern: string; ordinal: number; round: number; idx: number; pids: string[] }
export type Verdict = { ok: true } | { ok: false; later: boolean; why: string };
const later = (why: string): Verdict => ({ ok: false, later: true, why });
const no = (why: string): Verdict => ({ ok: false, later: false, why });

/** The prizes that exist only when the whole game is known (the software settles them when the game has ended). */
const END_PATTERNS = new Set(["climb", "comeback", "nevermissed", "team"]);
/** Most beacon numbers fetched by one call: a Worker may make only a few dozen outside requests per call. A long game is checked over a few calls (the phone tries again). */
const MAX_FETCH = 20;

const toHex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const hashOf = async (hex: string) => toHex(await crypto.subtle.digest("SHA-256", Uint8Array.from(hex.match(/../g)!, (h) => parseInt(h, 16))));
const hexOk = (s: unknown, n: number): s is string => typeof s === "string" && s.length === n && /^[0-9a-f]+$/.test(s);

/** One beacon number from the public servers: right round, right shape, and its randomness is the hash of its signature. (A free Worker cannot afford the full signature check; the connection to the beacon's own servers is secure.) */
async function fetchOne(round: number): Promise<string | null> {
  for (const m of QUICKNET.mirrors.slice(0, 2)) {
    try {
      const r = await fetch(`${m}/${QUICKNET.chainHash}/public/${round}`);
      if (!r.ok) continue;
      const j = (await r.json()) as { round?: unknown; randomness?: unknown; signature?: unknown };
      if (j.round !== round || !hexOk(j.randomness, 64) || !hexOk(j.signature, 96)) continue;
      if ((await hashOf(j.signature)) !== j.randomness) continue;
      return j.randomness;
    } catch { /* the next mirror */ }
  }
  return null;
}

/** The randomness of each wanted round: kept once per game (`bcn/<game>/<round>`, public numbers, no personal data), fetched when missing. Null = some are still missing (try again). */
async function beaconFor(env: Env, eid: string, want: number[], now: number, spend: (n: number) => Promise<boolean>): Promise<Map<number, string> | null> {
  const have = new Map<number, string>();
  const rows = (await env.DB.prepare("SELECT k, v FROM kv WHERE k >= ? AND k < ?").bind(`bcn/${eid}/`, prefixEnd(`bcn/${eid}/`)).all<{ k: string; v: string }>()).results ?? [];
  for (const r of rows) have.set(Number(r.k.slice(`bcn/${eid}/`.length)), r.v);
  const missing = [...new Set(want)].filter((r) => !have.has(r)).sort((a, b) => a - b);
  if (!missing.length) return have;
  const out = roundAt(now);
  if (missing.some((r) => r > out)) return null; // not published yet
  const batch = missing.slice(0, MAX_FETCH);
  if (!(await spend(batch.length))) return null;
  const got = await Promise.all(batch.map(async (r) => [r, await fetchOne(r)] as const));
  const fresh = got.filter((x): x is readonly [number, string] => x[1] !== null);
  if (fresh.length) await env.DB.batch(fresh.map(([r, v]) => env.DB.prepare("INSERT OR IGNORE INTO kv(k,v) VALUES(?,?)").bind(`bcn/${eid}/${r}`, v)));
  for (const [r, v] of fresh) have.set(r, v);
  return want.every((r) => have.has(r)) ? have : null;
}

async function seatsThatExist(env: Env, eid: string, pids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < pids.length; i += 50) {
    const part = pids.slice(i, i + 50);
    const r = (await env.DB.prepare(`SELECT pid FROM seat WHERE eid=? AND pid IN (${part.map(() => "?").join(",")})`).bind(eid, ...part).all<{ pid: string }>()).results ?? [];
    for (const x of r) found.add(x.pid);
  }
  return found;
}

/** Is a reported win true? "later" means it may become true (the turn or the end has not come yet): the phone is told to send it again. */
export async function checkClaim(env: Env, e: any, eid: string, x: Claim, now: number, spend: (n: number) => Promise<boolean>): Promise<Verdict> {
  const sch = await scheduleOf(env, e), cfg = sch.cfg, table = cfg.mode === "table";
  const lucky = x.pattern === "lucky";
  const first = e.start_round + 1; // B0: the first beacon number after registration closed
  if (now < roundMs(first)) return later("The game has not started.");
  if (x.pids.length < 1) return no("Nobody is named.");

  // ---- 2. the seats exist
  const there = await seatsThatExist(env, eid, x.pids);
  if (x.pids.some((p) => !there.has(p))) return no("A seat that is named is not in this game.");

  // ---- the lucky draw: worked out again from the round that decides it
  if (lucky) {
    const brk = cfg.breaks.filter((b) => b.kind === "lucky")[x.ordinal - 1];
    if (!brk || x.idx !== brk.after) return no("There is no such lucky draw.");
    const round = luckyRound(sch.st, sch.start, sch.stride, cfg.breaks, brk);
    if (round === null) return no("That draw never happens.");
    if (now < roundMs(round)) return later("The draw has not happened yet.");
    const n = brk.winners || 3;
    if (x.pids.length > n) return no("Too many winners for this draw.");
    const beacon = await beaconFor(env, eid, [round], now, spend);
    if (!beacon) return later("The beacon number of the draw is not here yet.");
    const seats = (await env.DB.prepare("SELECT seq, pid, role FROM seat WHERE eid=? ORDER BY seq").bind(eid).all<{ seq: number; pid: string; role: string | null }>()).results ?? [];
    let blkAt: Record<string, number> = {};
    try { const v = JSON.parse((await env.DB.prepare("SELECT v FROM kv WHERE k=?").bind(`seats-blk/${eid}`).first<{ v: string }>())?.v ?? "{}"); if (Array.isArray(v)) for (const p of v) blkAt[String(p)] = 0; else if (v && typeof v === "object") blkAt = v; } catch { blkAt = {}; }
    const eligible = luckyEligible(seats.map((s) => ({ pid: s.pid, ex: s.role !== null, removedMs: s.pid in blkAt ? (typeof blkAt[s.pid] === "number" ? blkAt[s.pid]! : 0) : null })), roundMs(round));
    const truth = luckyWinners(eid, brk.after, beacon.get(round)!, eligible, n).sort();
    return JSON.stringify(truth) === JSON.stringify([...x.pids].sort()) ? { ok: true } : no("That is not what the draw gave.");
  }

  // ---- 1. the turn has happened
  const cap = table ? 600 : cfg.turnCap ?? DEFAULT_TURN_CAP;
  if (x.idx >= cap) return no("The game has no such turn.");
  const betaRound = (t: number) => betaRoundOf(sch.st, sch.start, e.call_seconds, cfg.breaks, t);
  const br = betaRound(x.idx);
  if (br === null) return no("That turn never happens: the game was stopped before it.");
  if (now < roundMs(br)) return later("That turn has not happened yet.");

  // ---- 3. the game is over, for the prizes that need all of it
  if (END_PATTERNS.has(x.pattern) || cfg.exclusive === true) {
    const life = await env.DB.prepare("SELECT end_src FROM life WHERE eid=?").bind(eid).first<{ end_src: string }>();
    if (life?.end_src !== "phones" && now < (await endBoundMs(env, e))) return later("The game is not over yet.");
  }

  // ---- how many winners a line has
  if (x.pattern !== "team" && x.pids.length !== 1) return no("This prize has one winner.");
  if (x.pattern === "nevermissed" && cfg.play !== "presence") return no("Nobody can miss a turn in this game.");
  if (table || cfg.play === "presence") return { ok: true }; // a shared board, or a game where a missed throw counts: the throws are not worked out here (older games; new games always throw by themselves)

  // ---- the lines of one prize agree with each other: nobody takes two home places, and a better place never comes after a worse one (against the lines already settled)
  if (x.pattern === "finish" || x.pattern === "milestone") {
    const lines = (await env.DB.prepare("SELECT ordinal, idx, pids FROM settled WHERE eid=? AND round=? AND pattern=?").bind(eid, x.round, x.pattern).all<{ ordinal: number; idx: number; pids: string }>()).results ?? [];
    for (const l of lines) {
      if (l.ordinal === x.ordinal) continue;
      if (x.pattern === "finish" && (JSON.parse(l.pids) as string[]).includes(x.pids[0]!)) return no("That seat already has another place.");
      if ((l.ordinal < x.ordinal && l.idx > x.idx) || (l.ordinal > x.ordinal && l.idx < x.idx)) return no("That place does not fit the places already settled.");
    }
  }

  // ---- 4. the win is real
  const betas: number[] = [];
  for (let t = 0; t <= x.idx; t++) { const r = betaRound(t); if (r === null) return no("That turn never happens: the game was stopped before it."); betas.push(r); }
  const beacon = await beaconFor(env, eid, [first, ...betas], now, spend);
  if (!beacon) return later("The public numbers are being fetched.");
  const b0 = beacon.get(first)!;

  if (x.pattern === "team") {
    if (!cfg.teams || cfg.mode !== "team") return no("This game has no teams.");
    const players = (await env.DB.prepare("SELECT COUNT(*) AS c FROM seat WHERE eid=?").bind(eid).first<{ c: number }>())?.c ?? 0;
    const deal = teamsOf({ gameId: eid, players, teams: cfg.teams }, b0);
    const seats = x.pids.map((p) => seatOfPid(p)!), team = deal[seats[0]! - 1];
    if (team === undefined || seats.some((s) => deal[s - 1] !== team)) return no("Those seats are not one team.");
    return deal.filter((t) => t === team).length === new Set(seats).size ? { ok: true } : no("That is not the whole team.");
  }
  if (cfg.mode === "team") return no("A team game has team prizes only.");

  const seat = seatOfPid(x.pids[0]!)!;
  const rc = raceCfgOf(eid, cfg, Math.max(seat, 2)), board = boardOf(rc, seat, b0);
  const run = runFrom(board, seat, betas.map((r, t) => rollFor(eid, seat, t, beacon.get(r)!)), cfg.board?.finish ?? "exact");
  if (x.pattern === "finish") return x.ordinal <= (cfg.endPrizes ?? 5) && run.finishedTurn === x.idx ? { ok: true } : no("That seat did not get home on that turn.");
  if (x.pattern === "milestone") {
    const m = [...(cfg.milestones ?? [DEFAULT_MILESTONE])].sort((a, b) => a - b)[x.ordinal - 1];
    const reached = m === undefined ? -1 : run.pos.findIndex((p) => p >= m);
    return reached === x.idx ? { ok: true } : no("That seat did not reach that square on that turn.");
  }
  if (x.pattern === "climb") return run.bestClimb > 0 ? { ok: true } : no("That seat climbed no ladder.");
  if (x.pattern === "comeback") return run.bestComeback > 0 ? { ok: true } : no("That seat made no comeback.");
  return no("This prize cannot be reported.");
}
