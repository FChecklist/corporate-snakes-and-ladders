// Checking a reported win against the public game, before a phone's report is counted (security audit H1, 23 Nov 2026).
//
// Before this file the server trusted what phones said: when enough seats sent the same answer it was settled, even a made-up one, even before the game began.
// Now every report is checked against what the server itself knows:
//   1. THE TURN HAS HAPPENED. The turn named in the report must be one whose public beacon number is already out (the game's own schedule, pauses and stop applied).
//      A report for a turn that has not happened yet is answered "not yet" (409) and the phone sends it again a little later.
//   2. THE SEATS EXIST. Every winner named must be a seat of this game.
//   3. THE GAME IS OVER for the prizes that need the whole game (climb, comeback, never missed, team, and every prize when one-prize-per-person is on).
//   4. THE WIN IS REAL. The server fetches the public beacon numbers (the same ones every phone uses) and checks the report against them:
//      - a milestone or a home place: the named seat's own board is played forward and must really reach that square, or get home, on the turn the report says;
//      - a lucky draw is worked out again from the round that decides it;
//      - THE PRIZES THAT NEED EVERY SEAT (biggest climb, biggest comeback, the winning team) and a table game are settled by the server itself, from the whole game, with the same function
//        the phones use (replay.ts, 25 Nov 2026, audit M1 of 1.5.4): a report counts only when it is exactly that answer. Before, any seat that had climbed at all, or any whole team, was accepted.
// What it still cannot prove: for a milestone or a home place it proves the named seat really got there on that turn, not that nobody got there first (the whole game is played only for the
// prizes above). So a group of seats can still choose WHICH real winner of a milestone or a home place is reported; they cannot invent a win, name a seat that does not exist, or settle
// anything before the game has begun. In an older game where players threw by tapping (presence play) the throws are not replayed here: the prizes that need every seat are NOT settled by
// phones there at all (the organizer's console works them out), and the rest get the timing, seat and one-winner checks only.
// About the Workers plan: this file used to say a Worker has about 10 ms of work per call (the free plan). The live account is on the PAID plan (owner, 2026-10-27, `pages/wrangler.toml`), whose
// call may use far more; the whole game is still played in parts of `seatsPerCall` seats because one board costs about 10 ms (see replay.ts).
import { QUICKNET, roundAt } from "../../../packages/beacon/src/index";
import { betaRoundOf } from "../../../packages/beacon/src/schedule";
import { boardOf, DEFAULT_MILESTONE, DEFAULT_TURN_CAP } from "../../../packages/beacon/src/race";
import { raceCfgOf, luckyEligible, luckyRound, luckyWinners, tableCfgOf } from "../../../packages/beacon/src/game";
import { playTable, settleTable } from "../../../packages/beacon/src/table";
import { rollFor, runFrom } from "../../../packages/beacon/src/play";
import { seatOfPid } from "../../../packages/beacon/src/seat";
import { endBoundMs, roundMs, scheduleOf } from "./lifecycle";
import { prefixEnd } from "./checkin";
import { endTruth, sameAsTruth } from "./replay";
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
  // an older game where a missed throw counts (new games always throw by themselves): the throws are not replayed here. The prizes that need every seat are NOT settled by phones in such a game
  // (nobody could check them), the rest keep the timing, seat and one-winner checks.
  if (cfg.play === "presence") return END_PATTERNS.has(x.pattern) ? no("This older game cannot check that prize on the server: the organizer works it out in the console.") : { ok: true };

  // ---- the lines of one prize agree with each other (against the lines already settled)
  if (!table) { const bad = await orderProblem(env, eid, x); if (bad) return no(bad); }

  // ---- 4. the win is real
  const betas: number[] = [];
  for (let t = 0; t <= x.idx; t++) { const r = betaRound(t); if (r === null) return no("That turn never happens: the game was stopped before it."); betas.push(r); }
  const beacon = await beaconFor(env, eid, [first, ...betas], now, spend);
  if (!beacon) return later("The public numbers are being fetched.");
  const b0 = beacon.get(first)!, betaHex = betas.map((r) => beacon.get(r)!);
  const settleWith = async (): Promise<Verdict> => { const t = await endTruth(env, eid, cfg, x.idx, b0, betaHex, (n) => spend(n)); return !t.ok ? t : sameAsTruth(t.lines, x) ? { ok: true } : no("That is not what the whole game gave for this prize."); };

  // a table game (one shared board): played again here, a single board, and the prize must be exactly what the table gave
  if (table) {
    if (x.pattern !== "finish" && x.pattern !== "milestone") return no("This prize does not exist at a table.");
    try {
      const pids = ((await env.DB.prepare("SELECT pid FROM seat WHERE eid=? ORDER BY seq").bind(eid).all<{ pid: string }>()).results ?? []).map((r) => r.pid);
      const lines = settleTable(playTable(tableCfgOf(eid, cfg, pids.length), { b0, betas: betaHex }), cfg.rewards, (s) => pids[s - 1] ?? String(s), 1);
      return sameAsTruth(lines, x) ? { ok: true } : no("That is not what the table game gave.");
    } catch { return no("The table game cannot be worked out."); }
  }

  // the winning team, the biggest climb and the biggest comeback need every seat: the server plays the whole game and settles it as the phones do
  if (x.pattern === "team") { if (!cfg.teams || cfg.mode !== "team") return no("This game has no teams."); return settleWith(); }
  if (cfg.mode === "team") return no("A team game has team prizes only.");
  if (x.pattern === "climb" || x.pattern === "comeback") return settleWith();

  const seat = seatOfPid(x.pids[0]!)!;
  const rc = raceCfgOf(eid, cfg, Math.max(seat, 2)), board = boardOf(rc, seat, b0);
  const run = runFrom(board, seat, betaHex.map((b, t) => rollFor(eid, seat, t, b)), cfg.board?.finish ?? "exact");
  if (x.pattern === "finish") return x.ordinal <= (cfg.endPrizes ?? 5) && run.finishedTurn === x.idx ? { ok: true } : no("That seat did not get home on that turn.");
  if (x.pattern === "milestone") {
    const m = [...(cfg.milestones ?? [DEFAULT_MILESTONE])].sort((a, b) => a - b)[x.ordinal - 1];
    const reached = m === undefined ? -1 : run.pos.findIndex((p) => p >= m);
    return reached === x.idx ? { ok: true } : no("That seat did not reach that square on that turn.");
  }
  return no("This prize cannot be reported.");
}

/**
 * The lines of one prize agree with each other: nobody takes two home places, and a better place never comes after a worse one, against the lines ALREADY SETTLED. Cheap (one read, no public numbers).
 * It is asked again every time a result is about to be settled (winners.ts), not only the first time a report is checked: a report that passed once is remembered, so two reports that both
 * passed before either settled could otherwise both settle (audit L2 of 1.5.4: one seat could hold two home places). Null = fine.
 */
export async function orderProblem(env: Env, eid: string, x: { pattern: string; ordinal: number; round: number; idx: number; pids: string[] }): Promise<string | null> {
  if (x.pattern !== "finish" && x.pattern !== "milestone") return null;
  const lines = (await env.DB.prepare("SELECT ordinal, idx, pids FROM settled WHERE eid=? AND round=? AND pattern=?").bind(eid, x.round, x.pattern).all<{ ordinal: number; idx: number; pids: string }>()).results ?? [];
  for (const l of lines) {
    if (l.ordinal === x.ordinal) continue;
    if (x.pattern === "finish" && (JSON.parse(l.pids) as string[]).includes(x.pids[0]!)) return "That seat already has another place.";
    if ((l.ordinal < x.ordinal && l.idx > x.idx) || (l.ordinal > x.ordinal && l.idx < x.idx)) return "That place does not fit the places already settled.";
  }
  return null;
}
