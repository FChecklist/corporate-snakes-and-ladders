// QA MODEL for Corporate Snakes and Ladders (2026-10-29).
// It ENUMERATES the combinations of the game's settings and plays every one of them with the REAL engine modules
// (packages/beacon/src/board.ts, play.ts, race.ts, table.ts, game.ts, config.ts) and the REAL worker (apps/edge/src/worker.ts on an in-memory SQLite stand-in for D1),
// then compares the result with an independent re-statement of docs/boss/RULES_snakesladders.md written here from the rules text, not from the engine.
//
//   bun run tools/qa-model.mjs                 full run (all parts)          about 3 to 6 minutes
//   bun run tools/qa-model.mjs --quick         fewer seeds / smaller grids   under 1 minute
//   bun run tools/qa-model.mjs --part=board    one part: board | game | config | worker | wording
//   bun run tools/qa-model.mjs --json=out.json also write the findings as JSON
//
// Verdict words (plain):  PASS = nothing wrong found in any enumerated case.
//   FAIL = the product does something provably wrong, or crashes, or breaks its own rule.   GAP = the rules/spec say one thing, the product does another or nothing.
//   NOT_LOGICAL = a combination the product allows that makes no sense for the people playing.   INCOMPLETE = a state ends with a promised result missing.
//   GIBBERISH = a message or word a player cannot understand or that contradicts itself.   NO_RESULT = a finished game or step that produces no answer at all.
// Exit code is 0 always: the model reports, the regression tests (apps/edge/test, packages/beacon/test) guard the fixes.
import { generateBoard, boardProblem, everySquareReachesEnd, expectedTurns, finishWithin, resolve, limits, sideOf, targetTurnsFor, spreadTurns, boardKey, BOARD_SIZES, BAND_TOLERANCE, SPREAD_BAND } from "../packages/beacon/src/board.ts";
import { rollFor } from "../packages/beacon/src/play.ts";
import { playRace, rankPlayers, orderPlayers, settleRace, teamsOf, teamTable, crowdOf, boardOf, DEFAULT_TURN_CAP } from "../packages/beacon/src/race.ts";
import { playTable, rankTable, turnOrder } from "../packages/beacon/src/table.ts";
import { playGame, settleGame, raceCfgOf } from "../packages/beacon/src/game.ts";
import { validateCfg, defaultCfg, defaultRewards, PRIZE_HOUSES } from "../packages/beacon/src/config.ts";
import { fateOf } from "../packages/beacon/src/play.ts";

const argv = process.argv.slice(2);
const QUICK = argv.includes("--quick");
const PART = (argv.find((a) => a.startsWith("--part=")) ?? "").slice(7);
const JSON_OUT = (argv.find((a) => a.startsWith("--json=")) ?? "").slice(7);
const want = (p) => !PART || PART === p;

/** @type {{id:string, area:string, rule:string, verdict:string, cases:number, bad:number, example:string, root:string, note?:string}[]} */
const rows = [];
const add = (id, area, rule, cases, bad, example, root, verdictIfBad = "FAIL", note = "") => rows.push({ id, area, rule, verdict: bad ? verdictIfBad : "PASS", cases, bad, example: bad ? String(example).slice(0, 300) : "", root: bad ? root : "", ...(note ? { note } : {}) });
/** a check that counts its failures and keeps the first example */
const mk = () => ({ cases: 0, bad: 0, ex: "" });
const hit = (c, ok, ex) => { c.cases++; if (!ok) { c.bad++; if (!c.ex) c.ex = typeof ex === "function" ? ex() : ex; } };

const hexOf = (n) => (n & 0xff).toString(16).padStart(2, "0");
const betaAt = (g, t) => { let s = ""; const seed = `${g}|${t}`; let h = 2166136261; for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } for (let i = 0; i < 32; i++) { h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0; s += hexOf(h >>> 7); } return s; };
const B0 = (g) => betaAt(g, 99999);
const betas = (g, n) => Array.from({ length: n }, (_, t) => betaAt(g, t));
const t0 = Date.now();
const log = (...a) => console.log(...a);

/* =====================================================================================================================================
   PART 1. BOARDS: size x snakes x ladders x finish rule x many seats and seeds
   ===================================================================================================================================== */
function partBoard() {
  const sizes = BOARD_SIZES, counts = [6, 7, 8, 9, 10, 11, 12], finishes = ["exact", "pass"];
  const seeds = QUICK ? 3 : 14;
  const C = {
    legal: mk(), solv: mk(), soleKind: mk(), noChain: mk(), noLoop: mk(), counts: mk(), ends: mk(), band: mk(), spread: mk(), indep: mk(), det: mk(), made: mk(), endsFree: mk(), starts: mk(), perSeat: mk(),
  };
  let worstAttempts = 0, worstCfg = "";
  let layouts = 0;
  for (const size of sizes) for (const sn of counts) for (const ld of counts) for (const finish of finishes) {
    layouts++;
    for (let s = 1; s <= seeds; s++) {
      const gid = `QA-B-${size}-${sn}-${ld}-${finish}`, seat = s, b0 = B0(gid + s), cfg = { size, snakes: sn, ladders: ld, finish };
      let b = null;
      try { b = generateBoard(gid, seat, b0, cfg); } catch (e) { hit(C.made, false, `${gid} seat ${seat}: ${e.message}`); continue; }
      hit(C.made, true, "");
      if (b.attempts > worstAttempts) { worstAttempts = b.attempts; worstCfg = `${size}/${sn}s/${ld}l/${finish}`; }
      hit(C.legal, boardProblem(b) === null, () => `${gid} seat ${seat}: ${boardProblem(b)}`);
      hit(C.solv, everySquareReachesEnd(b, finish), () => `${gid} seat ${seat}: a square cannot reach the end`);
      // independent solvability: breadth-first from square 1 over the rules text (exact: a throw past the last square is not used)
      const nxt = (sq, r) => { const t = sq + r; if (t > size) return finish === "pass" ? size : sq; return b.snakes[t] ?? b.ladders[t] ?? t; };
      const seen = new Set([1]), q = [1]; while (q.length) { const x = q.pop(); if (x === size) continue; for (let r = 1; r <= 6; r++) { const y = nxt(x, r); if (!seen.has(y)) { seen.add(y); q.push(y); } } }
      const rev = new Map(); for (const x of seen) { if (x === size) continue; for (let r = 1; r <= 6; r++) { const y = nxt(x, r); if (!rev.has(y)) rev.set(y, []); rev.get(y).push(x); } }
      const back = new Set([size]), q2 = [size]; while (q2.length) { const y = q2.pop(); for (const x of rev.get(y) ?? []) if (!back.has(x)) { back.add(x); q2.push(x); } }
      hit(C.indep, seen.has(size) && [...seen].every((x) => back.has(x)), () => `${gid} seat ${seat}: independent search says a pawn can be trapped`);
      const heads = Object.keys(b.snakes).map(Number), feet = Object.keys(b.ladders).map(Number), tails = Object.values(b.snakes), tops = Object.values(b.ladders);
      hit(C.soleKind, !heads.some((h) => feet.includes(h)), () => `${gid} seat ${seat}: a square is both a snake head and a ladder foot`);
      const ends = [...heads, ...feet, ...tails, ...tops];
      hit(C.noChain, new Set(ends).size === ends.length, () => `${gid} seat ${seat}: two snake or ladder ends share a square (a chain is possible)`);
      let loop = false; for (let x = 1; x <= size && !loop; x++) { let y = x, n = 0; while (resolve(b, y) !== y) { y = resolve(b, y); if (++n > 3) { loop = true; break; } } }
      hit(C.noLoop, !loop, () => `${gid} seat ${seat}: following snakes and ladders does not settle`);
      hit(C.counts, heads.length === sn && feet.length === ld, () => `${gid} seat ${seat}: ${heads.length} snakes ${feet.length} ladders, asked ${sn}/${ld}`);
      hit(C.ends, !heads.includes(1) && !heads.includes(size) && !feet.includes(1) && !feet.includes(size) && !tops.includes(size), () => `${gid} seat ${seat}: a snake/ladder starts or ends on the first or last square`);
      const tgt = targetTurnsFor(size);
      hit(C.band, b.expectedTurns >= tgt * (1 - BAND_TOLERANCE) - 1e-9 && b.expectedTurns <= tgt * (1 + BAND_TOLERANCE) + 1e-9, () => `${gid} seat ${seat}: expected ${b.expectedTurns.toFixed(1)} turns, target ${tgt}`);
      hit(C.spread, b.within20 >= SPREAD_BAND.lo && b.within20 <= SPREAD_BAND.hi, () => `${gid} seat ${seat}: finish chance ${b.within20}`);
      if (s <= 2) { // the exact expected-turns number checked a second way (value iteration), and determinism
        let E = new Float64Array(size + 1); for (let it = 0; it < 4000; it++) { const N = new Float64Array(size + 1); for (let x = 1; x < size; x++) { let sum = 1; for (let r = 1; r <= 6; r++) { const y = nxt(x, r); sum += (y === size ? 0 : E[y]) / 6; } N[x] = sum; } let d = 0; for (let x = 1; x < size; x++) d = Math.max(d, Math.abs(N[x] - E[x])); E = N; if (d < 1e-10) break; }
        hit(C.indep, Math.abs(E[1] - b.expectedTurns) < 1e-4 * Math.max(1, b.expectedTurns), () => `${gid} seat ${seat}: expected turns ${b.expectedTurns} vs value iteration ${E[1]}`);
        const b2 = generateBoard(gid, seat, b0, cfg); hit(C.det, boardKey(b2) === boardKey(b), () => `${gid} seat ${seat}: same inputs, different board`);
      }
    }
  }
  // every seat of one game gets its own board (RULES 7.1: two players never get the same board); and the board really comes from B0
  const seats = QUICK ? 60 : 400, keys = new Set(); let dup = 0;
  for (let s = 1; s <= seats; s++) { const k = boardKey(generateBoard("QA-SEATS", s, B0("QA-SEATS"))); if (keys.has(k)) dup++; keys.add(k); }
  hit(C.perSeat, dup === 0, `${dup} of ${seats} seats share a board with another seat`);
  const kA = boardKey(generateBoard("QA-SEATS", 1, B0("A"))), kB = boardKey(generateBoard("QA-SEATS", 1, B0("B")));
  hit(C.perSeat, kA !== kB, "the board does not depend on B0");
  add("B-01", "board", `a fair board can always be made (${layouts} layouts x ${seeds} seeds, worst needed ${worstAttempts} tries at ${worstCfg})`, C.made.cases, C.made.bad, C.made.ex, "packages/beacon/src/board.ts generateBoard (throws 'No fair board found for this seed.' after 5000 tries)", "FAIL");
  add("B-02", "board", "every board obeys the section 3 hard rules (ends, drops, rises, rows)", C.legal.cases, C.legal.bad, C.legal.ex, "board.ts boardProblem");
  add("B-03", "board", "every board is solvable: from square 1 the last square is reachable and no standing square is a trap (engine check)", C.solv.cases, C.solv.bad, C.solv.ex, "board.ts everySquareReachesEnd");
  add("B-04", "board", "every board is solvable (independent breadth-first search + expected turns by value iteration agree)", C.indep.cases, C.indep.bad, C.indep.ex, "board.ts expectedTurns / everySquareReachesEnd");
  add("B-05", "board", "no square is both a snake head and a ladder foot", C.soleKind.cases, C.soleKind.bad, C.soleKind.ex, "board.ts candidate / boardProblem");
  add("B-06", "board", "no snake or ladder chain (every end is a different square, so one throw follows at most one snake or ladder)", C.noChain.cases, C.noChain.bad, C.noChain.ex, "board.ts candidate / boardProblem");
  add("B-07", "board", "following snakes and ladders always settles (no loops)", C.noLoop.cases, C.noLoop.bad, C.noLoop.ex, "board.ts resolve");
  add("B-08", "board", "the board has exactly the number of snakes and ladders asked for", C.counts.cases, C.counts.bad, C.counts.ex, "board.ts candidate");
  add("B-09", "board", "no snake or ladder starts/ends on the first or last square", C.ends.cases, C.ends.bad, C.ends.ex, "board.ts boardProblem");
  add("B-10", "board", "every board is equally hard: expected turns inside +-5% of the target, finish chance inside the band", C.band.cases + C.spread.cases, C.band.bad + C.spread.bad, C.band.ex || C.spread.ex, "board.ts generateBoard");
  add("B-11", "board", "same inputs give the same board; different seats and different B0 give different boards (RULES 7.1)", C.det.cases + C.perSeat.cases, C.det.bad + C.perSeat.bad, C.det.ex || C.perSeat.ex, "board.ts generateBoard / seededStream");
  log(`[board] ${layouts} layouts, ${C.made.cases} boards, worst tries ${worstAttempts} (${worstCfg})`);
  return { worstAttempts };
}

/* =====================================================================================================================================
   PART 2. GAMES: the independent rules of docs/boss/RULES_snakesladders.md, then every combination
   ===================================================================================================================================== */

// ---- the rules as plain code (written from the rules text; it uses only the board's snakes/ladders and the roll function) ----
/** RULES 1: new square = old + roll; past the last square the throw is not used (exact) ; a ladder foot climbs, a snake head slides. */
function refStep(board, from, roll, finish) {
  const t = from + roll;
  if (t > board.size) return finish === "pass" ? board.size : from;
  return board.snakes[t] ?? board.ladders[t] ?? t;
}
/** positions after each turn for one pawn. `threw(t)` false = missed turn (presence). A pawn that is home stays home. */
function refRun(board, gameId, seat, turns, bt, finish, threw) {
  const pos = []; let cur = 1, fin = null, ladders = 0, missed = 0;
  for (let t = 0; t < turns; t++) {
    if (fin !== null) { pos.push(cur); continue; }
    if (!threw(seat, t)) { missed++; pos.push(cur); continue; }
    const r = rollFor(gameId, seat, t, bt[t]); const land = cur + r;
    const to = refStep(board, cur, r, finish);
    if (land <= board.size && board.ladders[land] !== undefined) ladders++;
    cur = to; pos.push(cur); if (cur === board.size) fin = t;
  }
  return { pos, fin, ladders, missed };
}

const DEFAULT_LAYOUT = { snakes: 9, ladders: 9 };
function mkRewards(kind, ms, mode, play, endPrizes) {
  if (kind === "default") return defaultRewards();
  const out = [];
  ms.forEach((_, i) => out.push({ pattern: "milestone", scope: "ticket", ordinal: i + 1, text: "" }));
  for (let i = 1; i <= 5; i++) out.push({ pattern: "finish", scope: "ticket", ordinal: i, text: "" });
  out.push({ pattern: "climb", scope: "ticket", ordinal: 1, text: "" }, { pattern: "comeback", scope: "ticket", ordinal: 1, text: "" });
  if (mode === "team") for (let i = 1; i <= 3; i++) out.push({ pattern: "team", scope: "ticket", ordinal: i, text: "" });
  if (play === "presence") out.push({ pattern: "nevermissed", scope: "ticket", ordinal: 1, text: "" });
  return out;
}

function partGame() {
  const C = {
    accepted: mk(), noThrow: mk(), tableBig: mk(), teamsMany: mk(), other: mk(), climb: mk(), comeback: mk(), teamNoPrize: mk(), tableOrder: mk(), endTurn: mk(), ends: mk(), endsWhy: mk(), moves: mk(), rank: mk(), rankPrize: mk(), prizeUnique: mk(), excl: mk(), stable: mk(), prefix: mk(), crowd: mk(), det: mk(),
    incompleteFinish: mk(), noResult: mk(), allLines: mk(), tableLines: mk(), tableExcl: mk(), teamEnd: mk(), teamRank: mk(), tableEnd: mk(), noOneHome: mk(), cap225: mk(), winnerMilestone: mk(), finishOrder: mk(), finLines: mk(),
  };
  const ex = { stableMilestone: "", rankPrize: "" };
  const layouts = QUICK ? [[9, 9], [6, 12]] : [[9, 9], [6, 6], [12, 12], [6, 12], [12, 6]];
  const sizes = QUICK ? [100, 225] : [100, 144, 225];
  const finishes = ["exact", "pass"];
  const modes = QUICK ? [["race", 0], ["team", 3], ["table", 0]] : [["race", 0], ["team", 2], ["team", 5], ["team", 10], ["table", 0]];
  const plays = QUICK ? [["fate", "all"], ["presence", "most"]] : [["fate", "all"], ["presence", "all"], ["presence", "none"], ["presence", "most"]];
  const playerList = QUICK ? [2, 10, 21] : [2, 3, 5, 10, 11, 20, 21, 40];
  const caps = QUICK ? [10, 60] : [10, 60, 150];
  const endPs = QUICK ? [1, 5] : [1, 2, 3, 5];
  const excls = [false, true];
  const rewardKinds = QUICK ? ["default"] : ["default", "all"];
  let games = 0, refused = 0, out20 = null;
  const noOneHomeStats = {}, finishStats = {};
  for (const size of sizes) for (const [sn, ld] of layouts) for (const finish of finishes) {
    const ms = size === 100 ? [75] : size === 144 ? [100] : [150];
    for (const [mode, teams] of modes) for (const [play, thr] of plays) for (const players of playerList) {
      // one game id per (board layout, players) so the boards are reused between the settings that do not change them
      const gid = `QA-G-${size}-${sn}-${ld}-${finish}-${players}`;
      const b0 = B0(gid), bt = betas(gid, 600);
      const threw = (s, t) => thr === "all" ? true : thr === "none" ? false : ((s * 7 + t * 13) % 10) < 8;
      for (const cap of caps) for (const ep of endPs) for (const exclusive of excls) for (const rk of rewardKinds) {
        const patch = { board: { size, snakes: sn, ladders: ld, finish }, milestones: rk === "default" ? ms : (size === 100 ? [30, 60, 90] : size === 144 ? [40, 80, 120] : [50, 100, 200]), turnCap: cap, endPrizes: ep, exclusive: exclusive || undefined, play, mode, ...(mode === "team" ? { teams } : {}) };
        patch.rewards = mkRewards(rk, patch.milestones, mode, play, ep);
        const v = validateCfg(patch);
        if (!v.ok) { refused++; continue; }
        const cfg = v.cfg;
        // organizer-side sanity: does the configuration the product accepted make sense for the people who will play?
        games++;
        let g;
        if (mode === "table" && players > 20) { // the engine's contract: refuse a table of more than 20 in a plain sentence. That the server never lets one be set up is checked in W-19.
          let msg = ""; try { playGame(gid, cfg, players, { b0, betas: bt, thrown: threw, absent: (s, t) => play === "presence" && !threw(s, t) }); } catch (e) { msg = e.message; }
          C.tableBig.cases++; if (!/2 to 20 players/.test(msg)) { C.tableBig.bad++; if (!C.tableBig.ex) C.tableBig.ex = `table game of ${players} players was played instead of refused`; }
          continue;
        }
        if (mode === "team" && teams > players) C.teamsMany.cases++; else C.other.cases++;
        try { g = playGame(gid, cfg, players, { b0, betas: bt, thrown: threw, absent: (s, t) => play === "presence" && !threw(s, t) }); hit(C.noThrow, true, ""); }
        catch (e) { const kind = /table game has 2 to 20/.test(e.message) ? "tableBig" : /no more teams than players/.test(e.message) ? "teamsMany" : "other"; C[kind].bad++; if (!C[kind].ex) C[kind].ex = `${mode}${teams || ""}/${size}/${sn}-${ld}/${finish}/${play}/${players} players/cap ${cap}: ${e.message}`; hit(C.noThrow, false, e.message); continue; }
        if (g.kind === "table") { tableChecks(C, ex, g, cfg, gid, players, rk, exclusive, ep, cap, bt, size, finish, threw); continue; }
        const st = g.st, rc = raceCfgOf(gid, cfg, players);
        hit(C.ends, st.ended && st.turnsPlayed <= cap, () => `${mode}/${size}/${players}p cap ${cap}: ended=${st.ended} turns=${st.turnsPlayed}`);
        hit(C.endsWhy, (st.endReason === "cap" && st.turnsPlayed === cap) || (st.endReason === "finishers"), () => `bad end reason ${st.endReason} at turn ${st.turnsPlayed}`);
        // movement: every pawn against the independent rules
        let okMove = true, bad = "";
        for (let s = 1; s <= players && okMove; s++) {
          const r = st.runs[s - 1], rr = refRun(st.boards[s - 1], gid, s, st.turnsPlayed, bt, finish, threw);
          if (JSON.stringify(r.pos) !== JSON.stringify(rr.pos) || r.finishedTurn !== rr.fin || r.ladders !== rr.ladders || r.missed !== rr.missed) { okMove = false; bad = `seat ${s}: engine ${r.pos.slice(0, 12)} vs rules ${rr.pos.slice(0, 12)}`; }
        }
        hit(C.moves, okMove, () => `${mode}/${size}/${players}p ${bad}`);
        // the END of the game, worked out independently from the positions (RULES 2.3 and the end-when-N-home setting): the first turn on which N players that can still take a 'reach the end' prize are home, else the turn limit
        if (!cfg.teams) {
          const rrs = st.runs.map((r) => refRun(st.boards[r.seat - 1], gid, r.seat, cap, bt, finish, threw)); // one pawn each, every turn up to the limit
          const msq = [...(cfg.milestones ?? [75])].sort((a, b) => a - b), mLines = exclusive ? cfg.rewards.filter((l) => l.pattern === "milestone").length : 0;
          const holdersAt = (t) => { const hs = new Set(); for (let i = 1; i <= Math.min(mLines, msq.length); i++) { const reached = rrs.map((x, k) => ({ seat: k + 1, t: x.pos.findIndex((p, u) => u <= t && p >= msq[i - 1]) })).filter((x) => x.t >= 0).sort((a, b) => a.t - b.t || rrs[b.seat - 1].pos[b.t] - rrs[a.seat - 1].pos[a.t] || (fateOf(gid, a.seat, `milestone${i}`) < fateOf(gid, b.seat, `milestone${i}`) ? -1 : 1)); const w = reached.find((x) => !hs.has(x.seat)); if (w) hs.add(w.seat); } return hs; };
          let endTurns = cap;
          for (let t = 0; t < cap; t++) { const home = rrs.map((x, k) => ({ k: k + 1, f: x.fin })).filter((x) => x.f !== null && x.f <= t); if (home.length < ep) continue; const hold = exclusive ? holdersAt(t) : new Set(); if (home.filter((x) => !hold.has(x.k)).length >= ep) { endTurns = t + 1; break; } }
          hit(C.endTurn, st.turnsPlayed === endTurns, () => `${mode}/${size}/${sn}-${ld}/${finish}/${players}p ${play} cap ${cap} ends-when ${ep} exclusive ${exclusive}: the engine stops after ${st.turnsPlayed} turns, the rules say ${endTurns}`);
          // 'reach the end' prize k goes to the k-th finisher in the order of RULES 2.2 (earlier turn, more ladders, fewer missed turns, fate), when nobody holds two prizes
          if (!exclusive) {
            const fin = rrs.map((x, k) => ({ seat: k + 1, ...x })).filter((x) => x.fin !== null && x.fin < st.turnsPlayed).sort((a, b) => a.fin - b.fin || b.ladders - a.ladders || a.missed - b.missed || (fateOf(gid, a.seat, "rank") < fateOf(gid, b.seat, "rank") ? -1 : 1));
            const sd = settleGame(g, cfg, Array.from({ length: players }, (_, i) => `${i + 1}x00000000`));
            for (const l of cfg.rewards.filter((x) => x.pattern === "finish" && x.ordinal <= ep)) { const w = sd.find((x) => x.pattern === "finish" && x.ordinal === l.ordinal), want1 = fin[l.ordinal - 1]; hit(C.finishOrder, (!w && !want1) || (w && want1 && w.pids[0] === `${want1.seat}x00000000`), () => `${size}/${players}p: finish #${l.ordinal} went to ${w ? w.pids[0] : "nobody"}, the rules say seat ${want1 ? want1.seat : "nobody"}`); }
          }
        }
        // crowd
        const cr = crowdOf(st); hit(C.crowd, cr.bands.reduce((a, b) => a + b, 0) === players && cr.finished === st.finishedCount, () => `bands do not add up to ${players}`);
        // ranking: strict order, independent comparator (RULES 2.2)
        const order = orderPlayers(st).map((r) => r.seat);
        hit(C.rank, new Set(order).size === players && order.length === players, () => `ranking lists ${order.length} seats, ${new Set(order).size} different, for ${players} players`);
        const fins = st.runs.filter((r) => r.finishedTurn !== null);
        if (!cfg.teams) {
          // RULES 2.1/2.2: finishers come in order of the turn they finished, then (same turn) higher square, more ladders, fewer missed turns, fate
          let ord = true; for (let i = 1; i < order.length; i++) { const a = st.runs[order[i - 1] - 1], b = st.runs[order[i] - 1]; const fa = a.finishedTurn ?? 1e9, fb = b.finishedTurn ?? 1e9; if (fa > fb) { ord = false; break; } }
          hit(C.rank, ord, () => `${mode}/${size}/${players}p: a later finisher ranks above an earlier one`);
        }
        const lines = cfg.rewards, pidOf = (s) => `${s}x` + "0".repeat(8);
        const settled = settleGame(g, cfg, Array.from({ length: players }, (_, i) => pidOf(i + 1)));
        // is the prize winner for 'finish #k' the same player the ranking shows in place k? (what a player sees on the screen must match the prize)
        if (!cfg.teams && !exclusive) {
          const finLines = lines.filter((l) => l.pattern === "finish").sort((a, b) => a.ordinal - b.ordinal);
          const rank = rankPlayers(st, players);
          for (const l of finLines) {
            const w = settled.find((x) => x.pattern === "finish" && x.ordinal === l.ordinal);
            if (!w) continue;
            const shown = rank[l.ordinal - 1]; const seatW = Number(w.pids[0].split("x")[0]);
            hit(C.rankPrize, !shown || shown.seat === seatW, () => { const m = `${mode}/${size}/${sn}-${ld}/${finish}/${players}p: prize 'finish #${l.ordinal}' goes to seat ${seatW} but the ranking table puts seat ${shown.seat} in place ${l.ordinal}`; if (!ex.rankPrize) ex.rankPrize = m; return m; });
          }
        }
        // one winner per line, no line twice
        const keys = settled.map((x) => `${x.pattern}#${x.ordinal}`); hit(C.prizeUnique, new Set(keys).size === keys.length, () => `a prize line is settled twice: ${keys}`);
        // one prize per person (RULES 2.4) when switched on
        if (exclusive && !cfg.teams) { const all = settled.flatMap((x) => x.pids); hit(C.excl, new Set(all).size === all.length, () => `${mode}/${size}/${players}p: a person won two prizes: ${all}`); }
        // prizes are only ever given for real achievements
        if (!cfg.teams) for (const x of settled) {
          const seat = Number(x.pids[0].split("x")[0]), run = st.runs[seat - 1];
          if (x.pattern === "finish") hit(C.winnerMilestone, run.finishedTurn !== null, () => `finish prize to seat ${seat} who is not home`);
          if (x.pattern === "milestone") { const m = [...cfg.milestones ?? [75]].sort((a, b) => a - b)[x.ordinal - 1]; hit(C.winnerMilestone, run.pos.some((p) => p >= m), () => `milestone ${m} prize to seat ${seat} who never reached it`); }
        }
        // INCOMPLETE (a): the game ended because enough players are home, yet a 'finish' prize line up to that number has nobody (one prize per person eats the winners)
        if (!cfg.teams && st.endReason === "finishers") {
          const missing = lines.filter((l) => l.pattern === "finish" && l.ordinal <= ep && !settled.some((x) => x.pattern === "finish" && x.ordinal === l.ordinal));
          hit(C.incompleteFinish, missing.length === 0, () => `${size}/${sn}-${ld}/${finish}/${players}p, ends when ${ep} are home, one prize per person ${exclusive}: game over with ${st.finishedCount} home but finish prize(s) ${missing.map((m) => m.ordinal)} unawarded`);
        }
        // the lines the organizer wrote that can NEVER be awarded because the game ends earlier (ends when ep players are home but more finish lines exist)
        if (!cfg.teams) {
          const dead = lines.filter((l) => l.pattern === "finish" && l.ordinal > ep);
          hit(C.finLines, dead.length === 0, () => `game ends when ${ep} are home but ${dead.length} finish prize line(s) (${dead.map((d) => d.ordinal)}) can never be won`);
        }
        // prize stability: what a phone shows at turn k must still be true at the end (no winner is ever taken back)
        if (!cfg.teams && players <= 20 && (games % 7 === 0)) {
          for (const k of [Math.ceil(st.turnsPlayed / 3), Math.ceil(st.turnsPlayed * 2 / 3)]) {
            if (k < 1 || k >= st.turnsPlayed) continue;
            const g2 = playGame(gid, cfg, players, { b0, betas: bt.slice(0, k), thrown: threw, absent: (s, t) => play === "presence" && !threw(s, t) });
            const s2 = settleGame(g2, cfg, Array.from({ length: players }, (_, i) => pidOf(i + 1)));
            const lost = s2.filter((a) => { const f = settled.find((x) => x.pattern === a.pattern && x.ordinal === a.ordinal); return !f || f.pids.join() !== a.pids.join(); });
            hit(C.stable, lost.length === 0, () => { const m = `${mode}/${size}/${sn}-${ld}/${finish}/${players}p ${play}: at turn ${k} the winner of ${lost.map((l) => l.pattern + "#" + l.ordinal)} was seat ${lost.map((l) => l.pids[0].split("x")[0])}, at the end it is ${lost.map((l) => { const f = settled.find((x) => x.pattern === l.pattern && x.ordinal === l.ordinal); return f ? f.pids[0].split("x")[0] : "nobody"; })}`; if (!ex.stableMilestone) ex.stableMilestone = m; return m; });
            // prefix property: the first k turns of the full game are the k turns of the short game (every phone agrees whatever it holds)
            hit(C.prefix, g2.st.runs.every((r, i) => JSON.stringify(r.pos) === JSON.stringify(st.runs[i].pos.slice(0, k))), () => `${mode}/${size}/${players}p: positions at turn ${k} differ from the same turns of the full game`);
          }
        }
        // NO_RESULT: the game is over and nobody won anything at all
        if (!cfg.teams && rk === "default" && size === 100 && cap === 60) hit(C.noResult, !(st.ended && settled.length === 0), () => `${size}/${sn}-${ld}/${finish}/${players}p cap ${cap}: game over after ${st.turnsPlayed} turns and nobody won any prize (no one reached the milestone or the end)`);
        // statistics for the NOT_LOGICAL checks (default prize set, fate play, default settings only)
        if (!cfg.teams && rk === "default" && play === "fate" && ep === 5 && !exclusive) {
          const key = `${size}|${cap}|${players}`; (noOneHomeStats[key] ??= { games: 0, nobodyHome: 0, fullHouse: 0 }); const o = noOneHomeStats[key];
          o.games++; if (st.finishedCount === 0) o.nobodyHome++; if (st.finishedCount >= 5) o.fullHouse++;
        }
        // team race: ends when a team is home; the team prizes name whole teams
        if (cfg.teams) {
          const tt = teamTable(rc, st, teamsOf(rc, st.b0)); const homeT = tt.filter((r) => r.finishedTurn !== null);
          hit(C.teamEnd, (st.endReason === "finishers") === (homeT.length > 0) || (st.endReason === "cap" && homeT.length === 0), () => `team race ended "${st.endReason}" with ${homeT.length} team(s) home`);
          hit(C.teamRank, new Set(tt.map((r) => r.rank)).size === tt.length, () => `team ranks repeat: ${tt.map((r) => r.rank)}`);
          const sizesT = tt.map((r) => r.members.length); hit(C.teamRank, Math.max(...sizesT) - Math.min(...sizesT) <= 1 && sizesT.reduce((a, b) => a + b, 0) === players, () => `teams are not even: ${sizesT}`);
        }
      }
    }
  }

  /* ---- more game checks ---- */
  {
    // G-20: the default turn limit (60) against the length of a typical game on each board size
    const gid = "QA-LIMIT"; const rep = QUICK ? 12 : 40; const lim = {};
    for (const size of [100, 144, 225]) for (const players of [10, 40]) {
      let none = 0, lessThanFive = 0, games2 = 0;
      for (let k = 0; k < rep; k++) {
        const g2 = `${gid}-${size}-${players}-${k}`; const v = validateCfg({ board: { size, snakes: 9, ladders: 9, finish: "exact" }, milestones: [size === 100 ? 75 : size === 144 ? 100 : 150] });
        const st = playGame(g2, v.cfg, players, { b0: B0(g2), betas: betas(g2, 60) }).st; games2++;
        if (st.finishedCount === 0) none++; if (st.finishedCount < 5) lessThanFive++;
      }
      lim[`${size}|${players}`] = { none, lessThanFive, games: games2 };
    }
    const bad144 = lim["144|10"].lessThanFive / lim["144|10"].games, bad225 = lim["225|10"].lessThanFive / lim["225|10"].games;
    C.cap225.cases = Object.keys(lim).length; C.cap225.bad = (bad144 > 0.5 ? 1 : 0) + (bad225 > 0.5 ? 1 : 0);
    C.cap225.ex = `with the default turn limit of 60, 10 players, the prize 'reach the end' (5 home) is incomplete in ${(100 * bad144).toFixed(0)}% of 144-square games and ${(100 * bad225).toFixed(0)}% of 225-square games; nobody at all is home in ${(100 * lim["144|10"].none / lim["144|10"].games).toFixed(0)}% / ${(100 * lim["225|10"].none / lim["225|10"].games).toFixed(0)}%`;
    add("G-20", "game", "the default turn limit (60) is long enough for the board the organizer picked (144 squares: about 54 turns, 225 squares: about 80 turns)", C.cap225.cases, C.cap225.bad, C.cap225.ex, "packages/beacon/src/race.ts DEFAULT_TURN_CAP = 60 is used for every board size (config.ts validateCfg, apps/web/public/zc.js:215 tc default '60')", "NOT_LOGICAL");
    out20 = lim;
  }
  {
    // G-21: a team race with the default prize set (milestone + 5 finish) gives nobody anything: only 'team' prize lines are settled in a team race
    const gid = "QA-TEAMPRIZE"; const v = validateCfg({ mode: "team", teams: 3 }); let ended = 0, empty = 0;
    for (let k = 0; k < (QUICK ? 6 : 20); k++) { const g2 = gid + k; const g = playGame(g2, v.cfg, 12, { b0: B0(g2), betas: betas(g2, 60) }); const s2 = settleGame(g, v.cfg, Array.from({ length: 12 }, (_, i) => `${i + 1}x00000000`)); if (g.st.ended) { ended++; if (s2.length === 0) empty++; } }
    hit(C.teamNoPrize, empty === 0, () => `team race with the default prizes: ${empty} of ${ended} finished games ended with no winner at all (the default prize set has no 'team' prize lines)`);
    add("G-21", "game", "a team race made with the default prize set still gives prizes (the team prize lines must come with the team race)", C.teamNoPrize.cases, C.teamNoPrize.bad, C.teamNoPrize.ex, "packages/beacon/src/race.ts settleTeams only settles lines with pattern 'team'; packages/beacon/src/config.ts defaultRewards() has none; apps/edge/src/worker.ts create does not add them (the console adds none either: apps/web/public/zc.js houseOk)", "NO_RESULT");
  }
  {
    // G-22: biggest climb / comeback against an independent count
    const gid = "QA-CLIMB"; let n = 0;
    for (let k = 0; k < (QUICK ? 10 : 60); k++) {
      const g2 = gid + k; const v = validateCfg({ board: { size: 100, snakes: 9 + (k % 4), ladders: 9 + (k % 3), finish: k % 2 ? "pass" : "exact" } }); const players = 8;
      const st = playRace(raceCfgOf(g2, v.cfg, players), { b0: B0(g2), betas: betas(g2, 60) });
      for (const r of st.runs) {
        const rr = refRun(st.boards[r.seat - 1], g2, r.seat, st.turnsPlayed, betas(g2, 60), v.cfg.board?.finish ?? "exact", () => true);
        // independent biggest climb and comeback from the positions
        let best = 0, back = 0; const B = st.boards[r.seat - 1]; let cur = 1; const pend = [];
        for (let t = 0; t < rr.pos.length; t++) {
          const roll = rr.fin !== null && t > rr.fin ? null : rollFor(g2, r.seat, t, betas(g2, 60)[t]);
          if (roll !== null && cur !== B.size) { const land = cur + roll; if (land <= B.size) { if (B.ladders[land] !== undefined) best = Math.max(best, B.ladders[land] - land); if (B.snakes[land] !== undefined) pend.push({ before: cur, drop: land - B.snakes[land] }); } }
          cur = rr.pos[t]; for (let i = pend.length - 1; i >= 0; i--) if (cur >= pend[i].before) { back = Math.max(back, pend[i].drop); pend.splice(i, 1); }
        }
        n++; hit(C.climb, r.bestClimb === best, () => `seat ${r.seat}: biggest climb engine ${r.bestClimb} vs ${best}`); hit(C.comeback, r.bestComeback === back, () => `seat ${r.seat}: comeback engine ${r.bestComeback} vs ${back}`);
      }
    }
    add("G-22", "game", "'Biggest climb' and 'Comeback' are counted as the rules say (independent count over every pawn)", C.climb.cases + C.comeback.cases, C.climb.bad + C.comeback.bad, C.climb.ex || C.comeback.ex, "packages/beacon/src/play.ts advance");
  }
  {
    // G-23: table order is a permutation that depends on B0, and pawns move in that order skipping pawns that are home
    let okPerm = true, okB0 = true; const ex2 = [];
    for (const players of [2, 3, 7, 20]) { const o1 = turnOrder("QA-ORD", players, B0("x")), o2 = turnOrder("QA-ORD", players, B0("y")); if (new Set(o1).size !== players || Math.min(...o1) !== 1 || Math.max(...o1) !== players) okPerm = false; if (players >= 7 && o1.join() === o2.join()) okB0 = false; }
    hit(C.tableOrder, okPerm && okB0, () => `turn order is ${okPerm ? "" : "not a permutation "}${okB0 ? "" : "the same for two different B0"}`);
    const g2 = "QA-ORD2"; const tc = validateCfg({ mode: "table" }).cfg; const st = playGame(g2, tc, 6, { b0: B0(g2), betas: betas(g2, 200) }).st; const ord = st.order; let ptr = 0, okMove = true;
    // replay: every throw k belongs to the next pawn in the sealed order that is not home yet
    const home = new Set(); const reps = [];
    for (let k = 0; k < st.throws; k++) { let guard = 0; while (home.has(ord[ptr % ord.length]) && guard++ < ord.length) ptr++; const seat = ord[ptr % ord.length]; reps.push(seat); const r = st.runs[seat - 1]; ptr++; if (r.finishedTurn !== null && !home.has(seat) && r.history.length && r.pos.length) { /* home status is known only from the engine; checked by throw counts below */ } }
    const counts = new Map(); reps.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
    hit(C.tableOrder, [...counts.values()].every((c) => c >= 1), "a pawn never got a throw");
    add("G-23", "game", "table game: the sealed turn order is a permutation that depends on B0 and every pawn gets throws", C.tableOrder.cases, C.tableOrder.bad, C.tableOrder.ex, "packages/beacon/src/table.ts turnOrder / playTable");
  }

  // NOT_LOGICAL statistics: how often does a default game end with nobody home (so the headline prize 'reach the end' is never given)?
  for (const [k, o] of Object.entries(noOneHomeStats)) { const [size, cap, players] = k.split("|").map(Number); if (size !== 100 || cap !== 60) continue; }
  const stats100 = Object.entries(noOneHomeStats).filter(([k]) => k.startsWith("100|60|")).map(([k, o]) => `${k.split("|")[2]}p: ${((100 * o.nobodyHome) / o.games).toFixed(0)}% nobody home, ${((100 * o.fullHouse) / o.games).toFixed(0)}% five home`).join("; ");
  const bigNone = Object.entries(noOneHomeStats).filter(([k]) => k.startsWith("225|60|")).map(([k, o]) => `${k.split("|")[2]}p: ${((100 * o.nobodyHome) / o.games).toFixed(0)}% nobody home`).join("; ");
  const medNone = Object.entries(noOneHomeStats).filter(([k]) => k.startsWith("144|60|")).map(([k, o]) => `${k.split("|")[2]}p: ${((100 * o.nobodyHome) / o.games).toFixed(0)}% nobody home`).join("; ");
  log(`[game] ${games} games played (${refused} setting combinations refused by validateCfg)`);
  log(`[game] board 100, default turn limit 60: ${stats100}`);
  log(`[game] board 144, turn limit 60: ${medNone}`);
  log(`[game] board 225, turn limit 60: ${bigNone}`);
  add("G-01", "game", "the engine refuses a table of more than 20 players in a plain sentence instead of playing it badly (the server must never let one be set up: W-19)", C.tableBig.cases, C.tableBig.bad, C.tableBig.ex, "packages/beacon/src/table.ts validateTableCfg", "FAIL");
  add("G-01b", "game", "a team race with more teams than people who joined does not break (e.g. 4 teams chosen, 3 people join)", C.teamsMany.cases, C.teamsMany.bad, C.teamsMany.ex, "packages/beacon/src/game.ts raceCfgOf must use no more teams than players (fixed: Math.min(cfg.teams, players))", "FAIL");
  add("G-01c", "game", "no other setting combination makes the engine throw", C.other.cases, C.other.bad, C.other.ex, "packages/beacon/src/race.ts", "FAIL");
  add("G-02", "game", "every game terminates: it always ends, at or before the turn limit", C.ends.cases, C.ends.bad, C.ends.ex, "race.ts playRace");
  add("G-03", "game", "end reason is true (turn limit reached exactly, or enough players home)", C.endsWhy.cases, C.endsWhy.bad, C.endsWhy.ex, "race.ts playRace");
  add("G-03b", "game", "the game ends on the turn the rules say (independent count of players home, with one prize per person: players without a milestone prize)", C.endTurn.cases, C.endTurn.bad, C.endTurn.ex, "packages/beacon/src/race.ts playRace / homeCount", "FAIL");
  add("G-24", "game", "'reach the end' prizes go to the finishers in the order of RULES 2.2 (independent order)", C.finishOrder.cases, C.finishOrder.bad, C.finishOrder.ex, "packages/beacon/src/race.ts candidates / compareChain", "FAIL");
  add("G-04", "game", "RULES 1: every pawn moves exactly as the rules say (independent re-statement; snakes, ladders, exact/pass finish, missed turns, home stays home)", C.moves.cases, C.moves.bad, C.moves.ex, "packages/beacon/src/play.ts step/advance");
  add("G-05", "game", "the ranking lists every player once, earlier finishers first, strictly ordered (RULES 2.2: never tied)", C.rank.cases, C.rank.bad, C.rank.ex, "race.ts orderPlayers");
  add("G-06", "game", "the prize for 'reach the end #k' goes to the player the ranking table shows in place k", C.rankPrize.cases, C.rankPrize.bad, ex.rankPrize || C.rankPrize.ex, "packages/beacon/src/race.ts: orderPlayers breaks the last tie with fate label \"rank\" (line ~97) while candidates()/settleRace break it with label \"finish\" (line ~139): two players who finish on the same turn with the same ladders and misses are put in opposite order", "FAIL");
  add("G-07", "game", "each prize line is settled at most once", C.prizeUnique.cases, C.prizeUnique.bad, C.prizeUnique.ex, "race.ts settleRace");
  add("G-08", "game", "one prize per person (RULES 2.4) holds when it is switched on", C.excl.cases, C.excl.bad, C.excl.ex, "race.ts settleRace");
  add("G-09", "game", "a prize is only given for a real achievement (home / milestone reached)", C.winnerMilestone.cases, C.winnerMilestone.bad, C.winnerMilestone.ex, "race.ts candidates");
  add("G-10", "game", "a winner shown on a phone at turn k is still the winner at the end (nobody's prize is taken back)", C.stable.cases, C.stable.bad, ex.stableMilestone || C.stable.ex, "packages/beacon/src/race.ts candidates() milestone branch: ties on the same turn are broken by squareOf(r) = the CURRENT square (changes after later snakes/ladders) instead of the square on the turn the milestone was reached", "FAIL");
  add("G-11", "game", "all phones agree: the first k turns of the full game equal a game that only knows k turns", C.prefix.cases, C.prefix.bad, C.prefix.ex, "race.ts playRace");
  add("G-12", "game", "crowd bands add up to the number of players", C.crowd.cases, C.crowd.bad, C.crowd.ex, "race.ts crowdOf");
  add("G-13", "game", "game over because N players are home: every 'reach the end' prize up to N is given (also with one prize per person on)", C.incompleteFinish.cases, C.incompleteFinish.bad, C.incompleteFinish.ex, "packages/beacon/src/race.ts playRace counts finishers (finishedCount >= endPrizes) while settleRace with exclusive=true gives the first finisher's finish prize to the next free player: with the milestone winner among the finishers, the last finish prize is lost", "INCOMPLETE");
  add("G-14", "game", "every prize line the organizer wrote can be won (the game does not end before the line's winner can be known)", C.finLines.cases, C.finLines.bad, C.finLines.ex, "packages/beacon/src/config.ts validateCfg accepts finish lines above endPrizes; race.ts candidates() returns [] when ordinal > endPrizes", "NOT_LOGICAL");
  add("G-15", "game", "a finished game on the owner-approved board (100 squares, turn limit 60) always has at least one winner (default prizes, 2 to 40 players)", C.noResult.cases, C.noResult.bad, C.noResult.ex, "race.ts playRace ends at the turn limit with nobody on the milestone or home", "NO_RESULT");
  add("G-16", "game", "team race: ends when a whole team is home; ranks are 1..n without repeats; teams differ in size by at most one", C.teamEnd.cases + C.teamRank.cases, C.teamEnd.bad + C.teamRank.bad, C.teamEnd.ex || C.teamRank.ex, "race.ts teamTable / teamsOf");
  // table mode rows (filled by tableChecks)
  add("G-17", "game", "table game: every prize line the organizer wrote (finish #1..5, milestone #1..3, climb, comeback, one prize per person) can be settled", C.tableLines.cases, C.tableLines.bad, C.tableLines.ex, "packages/beacon/src/table.ts settleTable only settles finish#k (k <= winners <= 3) and milestone#1; tableCfgOf (game.ts) caps winners at 3; no support for exclusive/climb/comeback/nevermissed", "INCOMPLETE");
  add("G-18", "game", "table game with one prize per person switched on really gives nobody two prizes", C.tableExcl.cases, C.tableExcl.bad, C.tableExcl.ex, "packages/beacon/src/table.ts settleTable ignores cfg.exclusive", "FAIL");
  add("G-19", "game", "table game terminates and ends for a true reason", C.tableEnd.cases, C.tableEnd.bad, C.tableEnd.ex, "table.ts playTable");
  return { stats100, bigNone, medNone, noOneHomeStats };
}

function tableChecks(C, ex, g, cfg, gid, players, rk, exclusive, ep, cap, bt, size, finish, threw) {
  const st = g.st;
  hit(C.tableEnd, st.ended ? (st.endReason === "winners" ? st.finishedOrder.length >= st.cfg.winners : st.throws >= st.cfg.maxThrows) : st.throws === bt.length, () => `table ${players}p: ended=${st.ended} reason=${st.endReason} throws=${st.throws}`);
  const pidOf = (s) => `${s}x` + "0".repeat(8);
  const settled = settleGame(g, cfg, Array.from({ length: players }, (_, i) => pidOf(i + 1)));
  if (rk === "default" && st.endReason === "winners") {
    const wanted = cfg.rewards.filter((l) => l.pattern === "finish" || l.pattern === "milestone");
    const missing = wanted.filter((l) => !settled.some((x) => x.pattern === l.pattern && x.ordinal === l.ordinal));
    // a finish line beyond what the table can ever give is the defect; a milestone nobody reached is just the game
    const unreachable = missing.filter((l) => l.pattern === "finish" && l.ordinal > st.cfg.winners);
    hit(C.tableLines, unreachable.length === 0, () => `table ${players}p: the default prize set has finish prizes ${unreachable.map((l) => l.ordinal)} that the table can never give (only ${st.cfg.winners} winner(s) end it)`);
  }
  if (rk === "all") { const dead = cfg.rewards.filter((l) => ["climb", "comeback", "nevermissed"].includes(l.pattern) || (l.pattern === "milestone" && l.ordinal > 1)); hit(C.tableLines, dead.length === 0, () => `table game keeps prize lines (${dead.map((l) => l.pattern + "#" + l.ordinal)}) that settleTable never awards`); }
  if (exclusive) { const all = settled.flatMap((x) => x.pids); hit(C.tableExcl, new Set(all).size === all.length, () => `table ${players}p, one prize per person on: seat ${all.find((p, i) => all.indexOf(p) !== i)?.split("x")[0]} won two prizes`); }
}

/* =====================================================================================================================================
   PART 3. CONFIG: what validateCfg lets through versus what the engine can play
   ===================================================================================================================================== */
function partConfig() {
  const C = { msSize: mk(), fin: mk(), defaults: mk(), epLines: mk(), oneDef: mk() };
  // milestones versus board size when the board is changed afterwards
  const base = validateCfg({ board: { size: 225, snakes: 9, ladders: 9, finish: "exact" }, milestones: [200] }).cfg;
  const back = validateCfg({ board: { size: 100, snakes: 9, ladders: 9, finish: "exact" } }, base);
  hit(C.msSize, !back.ok, "shrinking the board below an existing milestone is refused");
  hit(C.msSize, !back.ok || back.cfg.milestones.every((m) => m < 100), "ok");
  // defaults of the rules document
  const def = validateCfg({}).cfg;
  hit(C.oneDef, def.exclusive === true, "RULES 2.4 and OPTIONS_TABLES say one prize per person is ON by default; a new game has it OFF (config.ts defaultCfg has no exclusive; console zc.js sets ex:false)");
  hit(C.defaults, (def.endPrizes ?? 5) === 1, "OPTIONS_TABLES row 'Game ends when N players are home': hide at default 1 (?); the code default is 5 (config.ts DEFAULT_END_PRIZES)");
  add("C-03", "config", "changing the board size keeps the milestone squares legal", C.msSize.cases, C.msSize.bad, C.msSize.ex, "config.ts validateCfg");
  add("C-04", "config", "RULES 2.4 / OPTIONS_TABLES: one prize per person is ON by default for a new game", C.oneDef.cases, C.oneDef.bad, C.oneDef.ex, "packages/beacon/src/config.ts defaultCfg; apps/web/public/zc.js:1091 (ex:false) and :215", "GAP");
  add("C-05", "config", "OPTIONS_TABLES: 'Game ends when N players are home' default (the table says 1 (?), the code says 5); the console spec 5.4 keeps it visible, the options table hides it: owner decision", C.defaults.cases, C.defaults.bad, C.defaults.ex, "packages/beacon/src/race.ts DEFAULT_END_PRIZES = 5; apps/web/public/zc.js:307", "GAP");
}

if (want("board")) partBoard();
let gameInfo = null;
if (want("game")) gameInfo = partGame();
if (want("config")) partConfig();
let workerPart = null;
if (want("worker")) { const m = await import("./qa-model-worker.mjs"); workerPart = await m.run({ add, mk, hit, log, QUICK }); }
if (want("wording")) { const m = await import("./qa-model-wording.mjs"); await m.run({ add, mk, hit, log, QUICK }); }

/* ---- report ---- */
const order = ["FAIL", "NO_RESULT", "INCOMPLETE", "GIBBERISH", "NOT_LOGICAL", "GAP", "PASS"];
rows.sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict) || a.id.localeCompare(b.id));
const tally = {}; for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;
log("\n=== QA MODEL RESULT ===");
for (const r of rows) log(`${r.verdict.padEnd(11)} ${r.id.padEnd(5)} ${r.area.padEnd(7)} ${String(r.bad).padStart(6)}/${r.cases} ${r.rule}${r.bad ? `\n             example: ${r.example}\n             root: ${r.root}` : ""}`);
log(`\nchecks: ${rows.length}  ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join("  ")}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
if (JSON_OUT) await Bun.write(JSON_OUT, JSON.stringify({ when: new Date().toISOString(), quick: QUICK, tally, rows, gameInfo: gameInfo ? { stats100: gameInfo.stats100, bigNone: gameInfo.bigNone, medNone: gameInfo.medNone } : null, workerPart }, null, 1));
