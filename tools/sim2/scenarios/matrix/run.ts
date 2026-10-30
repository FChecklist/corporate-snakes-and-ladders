// Streamed scenario matrix (TEST AUTHOR, tests/snakes-2026-10-30). Four groups, each walked with nested loops; no scenario is stored.
//   M1 identity   : employee-ID spelling x game era x e-mail spelling x verification setting          (pure product functions, evaluated fresh for every scenario)
//   M2 game       : dice mode x press pattern x turn limit x end prizes x finish rule x players x seed   (the real engine; a game is played once per key, every scenario re-checks it against ITS OWN settings)
//   M3 links/look : role x link type x screen state x theme                                            (invite codes, personal-link tokens, screen rules)
//   M4 wire       : verification mode x era x payment state x ID spelling x device x time x approval    (the real Worker + in-memory database, one real request chain per scenario)
// A dimension is counted only if some assertion of that scenario reads it and could fail; `liveness` below lists, per dimension, the groups where that is true.
// `Subject` is every product function the matrix calls. The mutants in matrix.test.ts replace one of them with a broken copy and the matrix must go red for the dimension that feeds it.
import { createHash } from "node:crypto";
import { normEmp, verifyOf, empHashOf, fromCodeOf, parseFrom, inviterOf, srcOf, tokenHash, newToken } from "../../../../apps/edge/src/people";
import { cleanEmail } from "../../../../apps/edge/src/emailclean";
import { defaultRaceCfg, playRace, settleRace, rankPlayers, type RaceCfg, type RaceState } from "../../../../packages/beacon/src/race";
// @ts-ignore plain UMD file served to phones
import SLR from "../../../../apps/web/public/screenrules.js";
import * as A from "./axes";

export interface Subject {
  normEmp: typeof normEmp; cleanEmail: (s: string) => string; verifyOf: typeof verifyOf; empHashOf: typeof empHashOf;
  fromCodeOf: typeof fromCodeOf; parseFrom: typeof parseFrom; inviterOf: typeof inviterOf; srcOf: typeof srcOf; tokenHash: typeof tokenHash; newToken: typeof newToken;
  rules: { showRules(s: string): boolean; showThanksStrip(s: string): boolean; richElement(s: string): string; look(t: unknown): string };
  playRace: typeof playRace; settleRace: typeof settleRace; rankPlayers: typeof rankPlayers;
}
export const real: Subject = { normEmp, cleanEmail, verifyOf, empHashOf, fromCodeOf, parseFrom, inviterOf, srcOf, tokenHash, newToken, rules: SLR, playRace, settleRace, rankPlayers };

export interface Counts { scenarios: number; checks: number; pass: number; fail: number; firstFailures: string[]; byDimension: Record<string, { scenarios: number; fail: number }> }
const newCounts = (): Counts => ({ scenarios: 0, checks: 0, pass: 0, fail: 0, firstFailures: [], byDimension: {} });
const dimOf = (c: Counts, d: string) => (c.byDimension[d] ??= { scenarios: 0, fail: 0 });
/** Records one scenario: `bad` lists the failed checks, each tagged with the dimension it belongs to. */
function record(c: Counts, nChecks: number, dims: string[], bad: [string, string][], label: () => string) {
  c.scenarios++; c.checks += nChecks;
  for (const d of dims) dimOf(c, d).scenarios++;
  if (bad.length === 0) { c.pass++; return; }
  c.fail++; for (const [d] of bad) dimOf(c, d).fail++;
  if (c.firstFailures.length < 8) c.firstFailures.push(`${label()} :: ${bad.map(([d, m]) => `${d}: ${m}`).join("; ")}`);
}
export const merge = (a: Counts, b: Counts): Counts => {
  const out = newCounts(); for (const x of [a, b]) { out.scenarios += x.scenarios; out.checks += x.checks; out.pass += x.pass; out.fail += x.fail; for (const f of x.firstFailures) if (out.firstFailures.length < 8) out.firstFailures.push(f); for (const [d, v] of Object.entries(x.byDimension)) { const o = dimOf(out, d); o.scenarios += v.scenarios; o.fail += v.fail; } }
  return out;
};

/* ------------------------------------------------------------------ M1 identity */
export async function runIdentity(s: Subject, opts: { stopAfterFailures?: number } = {}): Promise<Counts> {
  const c = newCounts(), salt = { PHONE_SALT: "matrix" };
  const mails = [...A.mailSpellings()], verifies = A.verifyCases(), ids = [...A.idSpellings()];
  const keyOf = new Map<string, string>();
  const key = async (clean: string) => { let k = keyOf.get(clean); if (!k) { k = await s.empHashOf(salt, clean); keyOf.set(clean, k); } return k; };
  const canonKey = await key("1B678"), canonMail = new Map<number, string>(); for (const [bi, [l, d]] of A.MAIL_BASES.entries()) canonMail.set(bi, `${l}@${d}`.toLowerCase());
  const mailKeys = new Map<string, string>(); // e-mail hash must never equal an ID hash (separate identities)
  for (const era of A.ERAS) for (const id of ids) {
    const want = era === "new" ? id.clean : id.old;
    const got = s.normEmp(id.text, era === "new");
    const idOk = got === (want === "" ? "" : want);
    const gotKey = typeof got === "string" && got ? await key(got) : null;
    for (const m of mails) for (const v of verifies) {
      const bad: [string, string][] = [];
      if (!idOk) { const why = `normEmp(${JSON.stringify(id.text)}, ${era}) = ${JSON.stringify(got)}, wanted ${JSON.stringify(want)}`; bad.push(["employee-id-format", why]); if (era === "old") bad.push(["game-era", "an old game did not keep the old reading"]); }
      if (era === "new" && id.kind.startsWith("base:") && id.clean === "1B678" && gotKey !== canonKey) bad.push(["employee-id-format", "the same person did not get the same hash"]);
      if (era === "new" && id.kind.startsWith("base:") && id.clean !== "1B678" && gotKey === canonKey) bad.push(["employee-id-format", "a different ID got the same hash"]);
      const e = s.cleanEmail(m.text); if (e !== m.canon) bad.push(["email-format", `cleanEmail(${JSON.stringify(m.text)}) = ${JSON.stringify(e)}`]);
      for (const [bi, canon] of canonMail) if (bi !== m.base && e === canon) bad.push(["email-format", "two different people read as one address"]);
      if (s.cleanEmail(e) !== e) bad.push(["email-format", "cleaning twice changes the address"]);
      if (gotKey && e === got) bad.push(["employee-id-vs-email", "an ID equals an address"]);
      if (typeof got === "string" && got.includes("@")) bad.push(["employee-id-vs-email", "an ID kept an @"]);
      if (era === "new" && m.canon.length > 0 && s.normEmp(m.canon, true) === m.canon.toUpperCase()) bad.push(["employee-id-vs-email", "the ID reading kept an address as it is"]);
      const vf = s.verifyOf({ config: v.config }); if (vf.mode !== v.mode || vf.employeesOnly !== v.employeesOnly) bad.push(["validation-mode", `verifyOf(${v.label}) = ${vf.mode}/${vf.employeesOnly}`]);
      record(c, 9, ["employee-id-format", "game-era", "email-format", "validation-mode", "employee-id-vs-email"], bad, () => `M1 id=${JSON.stringify(id.text)} era=${era} mail=${JSON.stringify(m.text)} verify=${v.label}`);
      if (opts.stopAfterFailures && c.fail >= opts.stopAfterFailures) return c;
    }
  }
  void mailKeys;
  return c;
}

/* ------------------------------------------------------------------ M2 game */
const hex = (x: string) => createHash("sha256").update(x).digest("hex");
const betasOf = (seed: string, n: number) => Array.from({ length: n }, (_, i) => hex(`${seed}|${i}`));
export async function runGame(s: Subject, opts: { stopAfterFailures?: number } = {}): Promise<Counts> {
  const c = newCounts(), lines = [{ pattern: "milestone", ordinal: 1 }, ...[1, 2, 3, 4, 5].map((o) => ({ pattern: "finish", ordinal: o }))];
  for (const seed of A.SEEDS) { const betas = betasOf(seed, 150), b0 = hex("b0|" + seed);
    for (const players of A.PLAYERS) for (const finish of A.FINISH) for (const cap of A.TURN_CAPS) for (const end of A.END_PRIZES) for (const dice of A.DICE) {
      const cfg: RaceCfg = { ...defaultRaceCfg("MX-" + seed, players), board: { size: 100, snakes: 9, ladders: 9, finish }, turnCap: cap, endPrizes: end, play: dice === "fate" ? "fate" : "presence" };
      const thrown = dice === "presence-all" ? () => true : dice === "presence-none" ? () => false : dice === "presence-alternate" ? (st: number, t: number) => (st + t) % 2 === 0 : undefined;
      const bad: [string, string][] = [];
      const st: RaceState = s.playRace(cfg, { b0, betas, ...(thrown ? { thrown } : {}) });
      const again = s.playRace(cfg, { b0, betas, ...(thrown ? { thrown } : {}) });
      if (JSON.stringify(st.runs.map((r) => r.pos)) !== JSON.stringify(again.runs.map((r) => r.pos))) bad.push(["dice-mode", "the same inputs gave two different games"]);
      if (!st.ended) bad.push(["turn-limit", "150 values were given and the game is not over"]);
      if (st.turnsPlayed > cap) bad.push(["turn-limit", `played ${st.turnsPlayed} turns with a limit of ${cap}`]);
      if (st.endReason === "finishers") { if (st.finishedCount < end) bad.push(["end-prizes", `ended by finishers with ${st.finishedCount} home, wanted ${end}`]); }
      else if (st.endReason === "cap") { if (st.turnsPlayed !== cap) bad.push(["turn-limit", `ended by the limit after ${st.turnsPlayed} of ${cap}`]); if (st.finishedCount >= end) bad.push(["end-prizes", "reached the limit although enough players were home"]); }
      else bad.push(["turn-limit", "state is 'running'"]);
      for (const r of st.runs) {
        for (const p of r.pos) if (p < 1 || p > 100) bad.push(["finish-rule", `square ${p} is off the board`]);
        if (r.finishedTurn !== null && r.pos[r.finishedTurn] !== 100) bad.push(["finish-rule", "a finisher is not on 100"]);
        for (const h of r.history) { if (finish === "exact" && h.kind === "finish" && h.from + h.roll !== 100) bad.push(["finish-rule", `exact finish used a throw from ${h.from} with a ${h.roll}`]); if (finish === "pass" && h.kind === "overshoot") bad.push(["finish-rule", "pass finish refused a throw past the end"]); }
        if (dice === "fate" && r.missed !== 0) bad.push(["dice-mode", "automatic dice missed a turn"]);
        if (dice === "presence-none" && (r.missed !== st.turnsPlayed || r.pos[r.pos.length - 1] !== 1)) bad.push(["dice-mode", "nobody pressed but a pawn moved"]);
        if (dice === "presence-alternate") { const upto = r.finishedTurn ?? st.turnsPlayed; let want = 0; for (let t = 0; t < upto; t++) if ((r.seat + t) % 2 !== 0) want++; if (r.missed !== want) bad.push(["dice-mode", `half-pressing: pawn ${r.seat} missed ${r.missed}, wanted ${want}`]); }
      }
      if (st.runs.length !== players) bad.push(["players", "wrong number of pawns"]);
      const won = s.settleRace(st, lines, (x) => "p" + x), fin = won.filter((w) => w.pattern === "finish");
      if (fin.length !== Math.min(end, st.runs.filter((r) => r.finishedTurn !== null).length)) bad.push(["end-prizes", `${fin.length} finish prizes for ${st.runs.filter((r) => r.finishedTurn !== null).length} finishers and ${end} end prizes`]);
      if (new Set(fin.map((w) => w.pids[0])).size !== fin.length) bad.push(["end-prizes", "one player won two finish places"]);
      const rows = s.rankPlayers(st, players); if (rows.length !== players || rows.some((r, i) => r.rank !== i + 1)) bad.push(["players", "ranking has gaps or repeats"]);
      record(c, 12 + st.runs.length, ["dice-mode", "turn-limit", "end-prizes", "finish-rule", "players"], bad, () => `M2 seed=${seed} players=${players} finish=${finish} cap=${cap} end=${end} dice=${dice}`);
      if (opts.stopAfterFailures && c.fail >= opts.stopAfterFailures) return c;
    }
  }
  return c;
}

/* ------------------------------------------------------------------ M3 links, roles, look */
export async function runLinks(s: Subject, opts: { stopAfterFailures?: number } = {}): Promise<Counts> {
  const c = newCounts(), seen = new Map<number, string>(), tokens = A.personalTokens(), seenTok = new Map<string, string>();
  const looks: [string, ReturnType<typeof Object>][] = [];
  void looks;
  type Link = { role?: string; inviter?: string; token?: string };
  const links: Link[] = [];
  for (const role of A.ROLES) for (const inviter of A.inviterIds(role)) links.push({ role, inviter });
  for (const token of tokens) links.push({ token });
  for (const l of links) for (const state of A.STATES) for (const theme of A.THEMES) {
    const bad: [string, string][] = [];
    if (l.inviter) {
      const code = s.fromCodeOf(l.inviter), p = code === null ? null : s.parseFrom(code);
      const [k, v] = l.inviter.split(":");
      if (code === null || p === null) bad.push(["role", `no code for ${l.inviter}`]);
      else {
        const wantKind = l.role === "organizer" ? "org" : l.role;
        if (p.kind !== wantKind) bad.push(["role", `${l.inviter} parsed as ${p.kind}`]);
        if (s.inviterOf(p) !== l.inviter) bad.push(["link-type", `${l.inviter} came back as ${s.inviterOf(p)}`]);
        const wantSrc = k === "c" ? "co:" + v : k === "h" ? "ho:" + v : "link";
        if (s.srcOf(l.inviter) !== wantSrc) bad.push(["role", `src of ${l.inviter} is ${s.srcOf(l.inviter)}, wanted ${wantSrc}`]);
        const other = seen.get(code); if (other !== undefined && other !== l.inviter) bad.push(["role", `code ${code} is shared by ${other} and ${l.inviter}`]); seen.set(code, l.inviter);
      }
    } else {
      const t = l.token!, h = await s.tokenHash(t);
      if (h !== (await s.tokenHash(t.toUpperCase()))) bad.push(["link-type", "a personal link read in capitals is another person"]);
      if (!/^[0-9a-f]{32}$/.test(h)) bad.push(["link-type", "token hash is not 32 hex"]);
      const clash = seenTok.get(h); if (clash !== undefined && clash !== t) bad.push(["link-type", "two links share a hash"]); seenTok.set(h, t);
    }
    if (s.rules.showRules(state) !== (state === "playing")) bad.push(["screen-state", `showRules(${state})`]);
    if (s.rules.showThanksStrip(state) !== (state === "ended")) bad.push(["screen-state", `showThanksStrip(${state})`]);
    if (s.rules.richElement(state) !== (state === "playing" ? "board" : "none")) bad.push(["screen-state", `richElement(${state})`]);
    if (s.rules.look(theme) !== A.expectLook(theme)) bad.push(["theme", `look(${String(theme)})`]);
    record(c, 4 + (l.inviter ? 4 : 3), l.inviter ? ["role", "link-type", "screen-state", "theme"] : ["link-type", "screen-state", "theme"], bad, () => `M3 link=${JSON.stringify(l)} state=${state} theme=${String(theme)}`);
    if (opts.stopAfterFailures && c.fail >= opts.stopAfterFailures) return c;
  }
  // newToken() produces only the allowed characters, 10 of them
  const bad: [string, string][] = []; const made = new Set<string>(); for (let i = 0; i < 300; i++) { const t = s.newToken(); made.add(t); if (!/^[abcdefghjkmnpqrstuvwxyz23456789]{10}$/.test(t)) bad.push(["link-type", `token ${t}`]); }
  if (made.size < 299) bad.push(["link-type", "tokens repeat"]);
  record(c, 301, ["link-type"], bad, () => "M3 newToken x300");
  return c;
}
export const liveness: Record<string, string> = {
  "employee-id-format": "M1 (normEmp new/old, hash), M4", "game-era": "M1 (old vs new expectations differ), M4", "email-format": "M1 (cleanEmail), M4 is not used", "validation-mode": "M1 (verifyOf), M4 (id and mobile modes)",
  "employee-id-vs-email": "M1", "dice-mode": "M2", "turn-limit": "M2", "end-prizes": "M2", "finish-rule": "M2", "players": "M2",
  "role": "M3 (common links), M4 not used", "link-type": "M3", "screen-state": "M3", "theme": "M3",
  "approval": "M4", "payment-state": "M4", "device": "M4", "start-time": "M4",
};

if (import.meta.main) {
  const { runWire } = await import("./wire");
  const parts: Record<string, Counts> = {};
  const t0 = Date.now();
  parts.M1 = await runIdentity(real); console.log("M1", JSON.stringify({ scenarios: parts.M1.scenarios, fail: parts.M1.fail, ms: Date.now() - t0 }));
  parts.M2 = await runGame(real); console.log("M2", JSON.stringify({ scenarios: parts.M2.scenarios, fail: parts.M2.fail }));
  parts.M3 = await runLinks(real); console.log("M3", JSON.stringify({ scenarios: parts.M3.scenarios, fail: parts.M3.fail }));
  parts.M4 = await runWire(); console.log("M4", JSON.stringify({ scenarios: parts.M4.scenarios, fail: parts.M4.fail }));
  const total = Object.values(parts).reduce(merge, newCounts());
  console.log(JSON.stringify({ total: { scenarios: total.scenarios, checks: total.checks, pass: total.pass, fail: total.fail }, firstFailures: total.firstFailures, byDimension: total.byDimension, ms: Date.now() - t0 }, null, 1));
}
export { newCounts, record };
