// The whole phone-side game loop, with no UI, so it can be tested without a browser and then wrapped by a thin page.
// It talks to exactly two things: the public beacon (through BeaconOpts) and our one small store (through deps.api).
// Boards, dice, positions and winners are all worked out here from public values; nothing the store says can change them.
import { ALL_SAFETIES, ControlTracker, SAFETY_FAST, SAFETY_STANDARD, pausedAt, type ControlConfig } from "./control";
import { GRACE_ROUNDS, defaultCfg, linesFor, validateCfg, votersFor, keysInPlay, type BreakCfg, type EngagementCfg, type PatternKey } from "./config";
import { RoundStore, activeBreak, callRoundR, luckyEligible, luckyRound, luckyWinners, raceCfgOf, tableCfgOf, settleGame, playGame, type GameState } from "./game";
import { seatOfPid } from "./seat";
import { QUICKNET, fetchRound, roundAt, roundTimeMs, type BeaconOpts } from "./index";
import { betaOffset, turnRounds } from "./schedule";
import { boardOf, crowdOf, rankPlayers, teamTable, teamsOf, DEFAULT_TURN_CAP, type RankRow, type TeamRow, type Settled } from "./race";
import { rankTable } from "./table";
import { rollFor, runFrom, squareOf, type Run, type Step } from "./play";
import type { Board } from "./board";

export interface PhoneDeps {
  /** Calls our store. Must throw an Error with `.status` on HTTP errors, and a plain Error when offline. */
  api(method: string, path: string, body?: unknown): Promise<any>;
  beacon: BeaconOpts;
  /** A monotonic millisecond clock (performance.now in a browser). Never the wall clock. */
  mono(): number;
  store: { get(k: string): string | null; set(k: string, v: string): void };
  /** Optional: reads a public (CDN-cached) JSON file by absolute URL; used for the pause file when the game publishes one, so the Worker is not hit every few seconds. */
  getPublic?(url: string): Promise<any>;
  /** Test hook only: never end the game early because every prize was awarded. */
  noEarlyEnd?: boolean;
  /** Test hook only. */
  verify?: (x: { round: number; signature: string; randomness: string }) => boolean;
}

export type Phase = "boot" | "missing" | "join" | "play" | "ended";
export interface TurnView { index: number; state: "wait" | "open" | "reveal" | "over"; secondsLeft: number | null; windowSec: number; thrown: boolean }
export interface RuntimeView {
  phase: Phase; error: string | null; pid: string | null; seat: number | null; nowRound: number | null;
  locked: boolean;
  startRound: number; scheduledRound: number; callSeconds: number; mode: "live" | "hold" | "blind" | "none"; paused: boolean; stopped: boolean;
  unsent: number;
  results: { pattern: PatternKey | "lucky"; ordinal: number; idx: number; count: number; winners?: string[]; tied?: number; round?: number }[]; pendingChecks: number; discarded: number;
  cfg: EngagementCfg;
  /** The brand break showing right now, with seconds left; null when none. */
  brk: { title: string; kind: BreakCfg["kind"]; mediaUrl?: string; secondsLeft: number; seconds: number; winners?: number } | null;
  lucky: { ordinal: number; title: string; winners: number; published: boolean; won: boolean; style: "draw" | "scratch" }[];
  announcement: { id: string; text: string } | null;
  round: number; rounds: number; intermission: null; past: never[];
  /** Every reward line this phone won. `text` is what the organizer wrote for that line. */
  won: { round: number; pattern: PatternKey; ordinal: number; text: string; idx: number }[];
  allAwarded: boolean; endedByPrizes: boolean; late: null; localWinners: boolean;
  // ---- the game itself
  kind: "race" | "team" | "table";
  board: Pick<Board, "size" | "side" | "snakes" | "ladders"> | null;
  me: { square: number; path: number[]; ladders: number; snakes: number; missed: number; finishedTurn: number | null; lastStep: Step | null; history: Step[] } | null;
  turn: TurnView;
  turnsPlayed: number; turnCap: number; ended: boolean;
  crowd: { players: number; bands: number[]; finished: number; ahead: number } | null;
  top: (RankRow | { rank: number; seat: number; finishedTurn: number | null; square: number; ladders: number; missed: number; note: string })[];
  myRank: number | null;
  team: { rows: TeamRow[]; mine: number | null } | null;
  table: { order: number[]; whoseTurn: number | null; squares: { seat: number; square: number }[] } | null;
  nextTurnInSec: number | null;
}

export class PhoneRuntime {
  phase: Phase = "boot";
  error: string | null = null;
  pid: string | null = null;
  cfg: EngagementCfg = defaultCfg();
  /** The first turn opens here (the time the organizer gave plus GRACE_ROUNDS). */
  startRound = 0;
  /** The time the organizer gave: registration closes here, and B0 is the very next beacon round. */
  scheduledRound = 0;
  /** The turn window in seconds (the stored field is still called callSeconds). */
  callSeconds = 0;
  controlUrl: string | null = null;
  /** The game was not paid for by its start time: nothing is shown until it is. */
  locked = false;
  announcement: { id: string; text: string } | null = null;
  store: RoundStore;
  tracker: ControlTracker | null = null;
  results: RuntimeView["results"] = [];
  private offsetMs: number | null = null; // utc - mono
  private syncedAtMono = -Infinity;
  private lastControlPoll = -Infinity;
  private lastResultPoll = -Infinity;
  private pollBaseMs = 9_000; private pollJitterMs = 3_000;
  private controlFast = false;
  private gated = false;
  private controlState: "unknown" | "none" | "known" = "unknown";
  private unknownSince: number | null = null;
  private cap = 0;
  // game state
  private betas: string[] = [];
  private builtDiscards = 0; private builtMsgs = 0;
  private game: GameState | null = null;
  private gameKey = "";
  private mine: Run | null = null;
  private myBoard: Board | null = null;
  private seatList: { pid: string; ex?: boolean; blk?: boolean }[] = [];
  /** When the server recorded each removal (people removed during the game stay in the public list); read again with every copy of the list. A legacy list of ids only counts as "removed long ago". */
  private removedAt = new Map<string, number>();
  private seatUpto = 0; private seatsFetched = false; private lastSeatPoll = -Infinity; private seatsFreshRound = 0; private wantSeats = false;
  private settled: Settled[] = [];
  private serverResults: NonNullable<RuntimeView["results"]> = [];
  private allResults: NonNullable<RuntimeView["results"]> = [];
  private voted = new Set<string>(); private firstSeen = new Map<string, number>(); private lastVote = -Infinity;
  private luckyLocal: { ordinal: number; idx: number; round: number; winners: string[] }[] = [];
  private luckyBusy = false;
  private thrownSet = new Set<string>(); private thrownUpto = -1; private lastThrowPoll = -Infinity;
  private pingedTurns = new Set<number>();
  private prizesEnded = false;
  private standKey = ""; private stand: { top: RuntimeView["top"]; crowd: RuntimeView["crowd"]; team: RuntimeView["team"]; table: RuntimeView["table"]; myRank: number | null; turnsPlayed: number; ended: boolean } | null = null;

  constructor(readonly eid: string, readonly deps: PhoneDeps) {
    this.store = new RoundStore(deps.beacon, deps.verify);
  }

  private key = (s: string) => `cbz:${this.eid}:${s}`;
  /** Rounds one turn takes, from the window the organizer chose. */
  private get stride() { return turnRounds(this.callSeconds); }
  get seat(): number | null { return this.pid ? seatOfPid(this.pid) : null; }

  /** UTC now from the beacon's own schedule: one verified "latest" answer, then our monotonic clock carries it. Re-synced every minute. */
  async syncClock(): Promise<boolean> {
    const m = this.deps.mono();
    if (this.offsetMs !== null && m - this.syncedAtMono < 60_000) return true;
    const x = await fetchRound("latest", { ...this.deps.beacon, ...(this.deps.verify ? { verify: this.deps.verify as any } : {}) }, 0);
    if (!x) return this.offsetMs !== null;
    this.offsetMs = roundTimeMs(x.round) + (QUICKNET.periodSec * 1000) / 2 - m;
    this.syncedAtMono = m;
    return true;
  }
  get nowRound(): number | null { return this.offsetMs === null ? null : roundAt(this.deps.mono() + this.offsetMs); }

  async boot(): Promise<void> {
    try {
      const info = await this.deps.api("GET", `/api/z/${this.eid}/info`);
      this.cap = Number(info.cap) || 0; this.scheduledRound = info.startRound; this.startRound = info.startRound + GRACE_ROUNDS; this.callSeconds = info.callSeconds; this.controlUrl = typeof info.controlUrl === "string" ? info.controlUrl : null; this.locked = !!info.locked; this.gated = info.locked !== undefined; this.readCfg(info);
    } catch (e: any) {
      this.phase = e?.status === 404 ? "missing" : "boot";
      this.error = e?.status === 404 ? "This game link is not valid." : "Could not reach the game. Check your connection.";
      return;
    }
    const pid = this.deps.store.get(this.key("pid"));
    if (pid) this.adopt(pid); else this.phase = "join";
    this.error = null;
  }

  /** Board, prizes and brand breaks come from the game's public settings; anything malformed falls back to the plain game. */
  private readCfg(info: any) {
    const v = validateCfg({ tickets: info?.tickets, rewards: info?.rewards, breaks: info?.breaks, rounds: info?.rounds, invites: info?.invites, opening: info?.opening, closing: info?.closing, mode: info?.mode, play: info?.play, board: info?.board, milestones: info?.milestones, turnCap: info?.turnCap, endPrizes: info?.endPrizes, exclusive: info?.exclusive, teams: info?.teams, theme: info?.theme }, undefined, { stored: true });
    this.cfg = v.ok ? v.cfg : defaultCfg();
  }
  private adopt(pid: string) { this.pid = pid; this.phase = "play"; }

  /** This device's own random id (made once, kept on the device). A pawn belongs to the one device that joined with it; the store only keeps a hash. */
  private device(): string {
    let d = this.deps.store.get("cbz:device");
    if (!d || !/^[0-9a-f]{32}$/.test(d)) { d = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""); this.deps.store.set("cbz:device", d); }
    return d;
  }

  /** Joins with a nickname (and a mobile number if the organizer asked for one). The same number again returns the same player. */
  async join(phone: string, name?: string, invite?: { from?: number; cat?: string }, consent?: unknown): Promise<boolean> {
    try {
      const r = await this.deps.api("POST", `/api/z/${this.eid}/join`, { phone, name, device: this.device(), ...(invite && Number.isInteger(invite.from) ? { from: invite.from, cat: invite.cat } : {}), ...(consent ? { consent } : {}) });
      this.scheduledRound = r.startRound; this.startRound = r.startRound + GRACE_ROUNDS; this.callSeconds = r.callSeconds;
      if (r.rewards !== undefined || r.breaks !== undefined || r.board !== undefined || r.mode !== undefined) this.readCfg(r);
      this.deps.store.set(this.key("pid"), r.pid);
      this.adopt(r.pid); this.error = null;
      return true;
    } catch (e: any) {
      this.error = e?.status === 423 || e?.code === "invite-full" ? String(e.message || "This place is already on another phone.") : e?.status === 409 ? "This game is full." : e?.status === 410 || e?.code === "closed" ? "Sign-up for this game has closed. It is already running." : e?.status === 400 ? "Enter a valid nickname." : e?.status === 503 ? "It is a busy day. Please try again in a few minutes." : "Could not join. Check your connection and try again.";
      return false;
    }
  }

  private async pollControl(now: number) {
    const m = this.deps.mono();
    if (this.controlState === "none" && !this.locked) {
      const toStart = this.scheduledRound - now;
      if (toStart < -20) return;
      if (m - this.lastControlPoll < (this.gated && toStart < 40 ? 9_000 : 60_000) + (Math.floor(m) % 3000)) return;
    } else if (m - this.lastControlPoll < this.pollBaseMs + (Math.floor(m) % this.pollJitterMs)) return;
    this.lastControlPoll = m;
    let body: any = null;
    try { body = this.controlUrl && this.deps.getPublic ? await this.deps.getPublic(this.controlUrl) : await this.deps.api("GET", `/api/z/${this.eid}/control`); } catch (e: any) {
      if (e?.status === 404) { if (this.locked) { this.locked = false; await this.reloadSchedule(); } this.tracker = null; this.controlState = "none"; return; }
      this.tracker?.failed(now); return;
    }
    this.announcement = body && body.ann && typeof body.ann.id === "string" && typeof body.ann.text === "string" ? { id: body.ann.id, text: body.ann.text.slice(0, 200) } : null;
    const wasLocked = this.locked; this.locked = !!body?.locked;
    if (wasLocked && !this.locked) await this.reloadSchedule();
    if (!body?.pubKey) { this.tracker?.failed(now); return; }
    if (!this.tracker) {
      const cfg: ControlConfig = { pubKey: body.pubKey, maxPauseRounds: body.maxPauseRounds, leadRounds: body.leadRounds };
      this.controlFast = body.leadRounds === SAFETY_FAST.leadRounds;
      const safety = ALL_SAFETIES.find((s) => s.leadRounds === body.leadRounds) ?? SAFETY_STANDARD;
      if (safety !== SAFETY_FAST && safety !== SAFETY_STANDARD) { this.pollBaseMs = Math.round(safety.pollMaxSec * 750); this.pollJitterMs = Math.round(safety.pollMaxSec * 250); }
      else { this.pollBaseMs = this.controlFast ? 6_000 : 9_000; this.pollJitterMs = 3_000; }
      this.tracker = new ControlTracker(cfg, this.eid, safety, now);
    }
    if (await this.tracker.ingest(now, body)) this.controlState = "known";
  }

  private async reloadSchedule() {
    try { const info = await this.deps.api("GET", `/api/z/${this.eid}/info`); this.scheduledRound = info.startRound; this.startRound = info.startRound + GRACE_ROUNDS; this.callSeconds = info.callSeconds; this.gated = info.locked !== undefined; this.readCfg(info); } catch { /* the next poll tries again */ }
  }
  private modeAt(now: number): RuntimeView["mode"] {
    if (this.locked) return "hold";
    if (this.controlState === "none") return "none";
    if (this.controlState === "unknown") return this.unknownSince !== null && now - this.unknownSince >= SAFETY_STANDARD.giveUpRounds ? "blind" : "hold";
    return this.tracker!.mode(now);
  }
  /** The beacon round turn t opens at (plain schedule, brand breaks, signed pauses). Null = stopped before it. */
  private openRound(t: number): number | null { return callRoundR(this.tracker ? this.tracker.state : null, this.startRound, this.stride, this.cfg.breaks, 1, t); }
  /** The beacon round whose value is b_t: the first one published after the window of turn t closed. */
  private betaRound(t: number): number | null { const o = this.openRound(t); return o === null ? null : o + betaOffset(this.callSeconds); }
  private get b0Round() { return this.scheduledRound + 1; }
  private get turnCap() { return this.cfg.turnCap ?? DEFAULT_TURN_CAP; }
  private get maxThrows() { return this.cfg.mode === "table" ? 600 : this.turnCap; }

  /** One pass of the loop. Call about once a second. Safe to call while offline (it simply makes no progress). */
  async tick(): Promise<RuntimeView> {
    if (this.phase === "ended") { await this.pollResults(); await this.castVotes(); return this.view(); }
    if (this.phase !== "play") return this.view();
    if (!(await this.syncClock())) { this.error = "Waiting for the clock. Check your connection."; return this.view(); }
    this.error = null;
    const now = this.nowRound!;
    await this.pollControl(now);
    if (this.controlState === "unknown" && this.unknownSince === null) this.unknownSince = now;
    const m = this.modeAt(now);
    const live = m === "live" || m === "none" || m === "blind";
    // beacon rounds we are entitled to use: B0 and every b_t whose round has been published
    const want: number[] = [];
    if (this.b0Round <= now && !this.store.rounds.has(this.b0Round)) want.push(this.b0Round);
    for (let t = this.betas.length; t < this.maxThrows && want.length < 8; t++) {
      const br = this.betaRound(t);
      if (br === null || br > now) break;
      if (!this.store.rounds.has(br)) want.push(br);
    }
    await Promise.all(want.map((br, i) => (now - br <= 2 ? this.store.fetchLive(br, i) : this.store.fetchBackfill(br, i))));
    this.store.verifySome(2);
    if (live) this.buildBetas(now);
    await this.pollSeats(now);
    await this.pollThrows(now);
    this.syncGame();
    await this.pollResults();
    await this.castVotes();
    const stopped = this.tracker?.state.stopRound != null && now >= this.tracker.state.stopRound;
    const g = this.game, over = !!g && (g.kind === "race" ? g.st.ended : g.st.ended);
    if (over && !this.deps.noEarlyEnd) this.prizesEnded = true;
    if ((over && this.breaksPlayed(now)) || stopped) this.phase = "ended";
    return this.view();
  }

  /** Extends the list of b_t values with newly available rounds. Rebuilds from scratch only if a provisional round was thrown away or an organizer message arrived (it can move later turns). */
  private buildBetas(now: number) {
    const msgs = this.tracker?.log.length ?? 0;
    if (this.store.discarded !== this.builtDiscards || msgs !== this.builtMsgs) { this.betas = []; this.builtDiscards = this.store.discarded; this.builtMsgs = msgs; this.gameKey = ""; }
    for (let t = this.betas.length; t < this.maxThrows; t++) {
      const br = this.betaRound(t);
      if (br === null || br > now) break;
      const x = this.store.rounds.get(br);
      if (!x) break;
      this.betas.push(x.randomness);
    }
  }
  private get b0(): string | null { return this.store.rounds.get(this.b0Round)?.randomness ?? null; }
  private get gameId() { return this.eid; }

  /** Brings this phone's own pawn, and (when the seat list is here) the whole game, up to date with the values it holds. */
  private syncGame() {
    const b0 = this.b0, seat = this.seat;
    if (!b0) return;
    if (seat && !this.myBoard && this.cfg.mode !== "table") { try { this.myBoard = boardOf(raceCfgOf(this.gameId, this.cfg, Math.max(seat, 2)), seat, b0); } catch { this.error = "Could not make the board."; } }
    const players = this.seatList.length;
    if (!this.seatsFetched || players < 2) { this.mineAlone(); return; }
    const key = `${this.betas.length}|${players}|${this.thrownSet.size}|${b0}`;
    if (key === this.gameKey) return;
    this.gameKey = key;
    try {
      const g = playGame(this.gameId, this.cfg, players, { b0, betas: this.betas, thrown: (s, t) => this.thrownSet.has(`${s}:${t}`), absent: (s, t) => this.cfg.play === "presence" && !this.thrownSet.has(`${s}:${t}`) });
      this.game = g;
      const pids = Array.from({ length: players }, (_, i) => this.seatList[i]?.pid ?? "");
      const seatPid = (s: number) => this.seatList.find((x) => seatOfPid(x.pid) === s)?.pid ?? `${s}`;
      this.settled = settleGame(g, this.cfg, Array.from({ length: players }, (_, i) => seatPid(i + 1)), 1);
      void pids;
      if (g.kind === "race" && seat) this.mine = g.st.runs[seat - 1] ?? this.mine;
      if (g.kind === "table" && seat) this.mine = g.st.runs[seat - 1] ?? this.mine;
      if (g.kind === "race" && seat) this.myBoard = g.st.boards[seat - 1] ?? this.myBoard;
      if (g.kind === "table") this.myBoard = g.st.board;
    } catch (e: any) { this.error = String(e?.message || "Could not work out the game."); }
  }
  /** Before the seat list is known: this phone's own pawn from its own board and the public dice. */
  private mineAlone() {
    const seat = this.seat; if (!seat || !this.myBoard || this.cfg.mode === "table" || this.cfg.play === "presence") return;
    const rolls = this.betas.map((b, t) => rollFor(this.gameId, seat, t, b));
    this.mine = runFrom(this.myBoard, seat, rolls, this.cfg.board?.finish ?? "exact");
  }

  /** Round 1 holds the brand breaks: the game does not end before the last one has been played. */
  private breaksPlayed(now: number): boolean {
    if (!this.cfg.breaks.length) return true;
    return this.cfg.breaks.every((b) => this.betas.length >= b.after) && this.currentBreak(now) === null;
  }
  private seatEveryMs(): number { const c = this.cap; return c <= 250 ? 15_000 : c <= 1000 ? 25_000 : c <= 2500 ? 40_000 : 50_000; }
  private async pollSeats(now: number) {
    const m = this.deps.mono();
    if (now < this.b0Round || (!this.wantSeats && m - this.lastSeatPoll < (this.seatsFetched ? this.seatEveryMs() : 5_000) + (Math.floor(m) % 2000))) return;
    if (this.seatsFetched && this.game && (this.game.kind === "race" ? this.game.st.ended : this.game.st.ended) && !this.wantSeats) return; // registration is closed: the list cannot change
    this.lastSeatPoll = m; this.wantSeats = false;
    const askedAt = this.nowRound ?? 0;
    try {
      const r = await this.deps.api("GET", `/api/z/${this.eid}/seats?after=${this.seatUpto}`);
      if (!r || !r.ready || !Array.isArray(r.seats)) return;
      const known = new Set(this.seatList.map((x) => x.pid));
      const blk = new Set<string>(Array.isArray(r.blk) ? r.blk.filter((x: unknown): x is string => typeof x === "string") : []);
      const at = r.blkAt && typeof r.blkAt === "object" ? (r.blkAt as Record<string, unknown>) : {};
      this.removedAt = new Map([...blk].map((p) => [p, typeof at[p] === "number" ? (at[p] as number) : 0] as const));
      for (const [, pid, , ex] of r.seats as [number, string, number, number?][]) if (!known.has(pid)) { known.add(pid); this.seatList.push({ pid, ex: ex === 1, blk: blk.has(pid) }); }
      this.seatList.sort((a, b) => (seatOfPid(a.pid) ?? 0) - (seatOfPid(b.pid) ?? 0));
      this.seatUpto = Math.max(this.seatUpto, Number(r.upto) || 0);
      this.seatsFetched = true; this.seatsFreshRound = Math.max(this.seatsFreshRound, askedAt);
    } catch { /* the next poll tries again; until then the organizer's published results (if any) are used */ }
  }

  /** Presence mode: the collector's record of who threw in each finished turn. */
  private async pollThrows(now: number) {
    if (this.cfg.play !== "presence" || !this.seatsFetched) return;
    const m = this.deps.mono(); if (m - this.lastThrowPoll < 6_000) return;
    if (this.thrownUpto >= this.betas.length - 1) return;
    this.lastThrowPoll = m;
    try {
      const r = await this.deps.api("GET", `/api/z/${this.eid}/throws?from=${this.thrownUpto + 1}&to=${this.betas.length - 1}`);
      if (r && Array.isArray(r.throws)) { for (const [seat, turn] of r.throws as [number, number][]) this.thrownSet.add(`${seat}:${turn}`); this.thrownUpto = this.betas.length - 1; }
    } catch { /* tried again */ }
    void now;
  }
  /** The player taps "Throw" (presence mode). The collector stamps the arrival; the answer carries the crowd count back. */
  async throwNow(): Promise<boolean> {
    const t = this.currentTurn();
    if (this.cfg.play !== "presence" || !this.pid || t.state !== "open" || this.pingedTurns.has(t.index)) return false;
    try { await this.deps.api("POST", `/api/z/${this.eid}/throw`, { pid: this.pid, device: this.device(), turn: t.index }); this.pingedTurns.add(t.index); return true; } catch { return false; }
  }

  private get localOk(): boolean { return this.seatsFetched && !!this.game && this.seatList.length >= 2; }
  private async pollResults() {
    const m = this.deps.mono();
    const nowR = this.nowRound;
    if (nowR !== null) await this.computeLucky(nowR);
    const local = this.localOk;
    if (local) {
      const mine: NonNullable<RuntimeView["results"]> = this.settled.map((x) => ({ pattern: x.pattern as PatternKey, ordinal: x.ordinal, idx: x.idx, count: x.pids.length, round: 1, winners: x.pids, ...(x.tied ? { tied: x.tied } : {}) }));
      this.allResults = [...mine, ...this.luckyResults(), ...this.serverResults.filter((x) => x.pattern === "lucky" && !this.luckyLocal.some((l) => l.ordinal === x.ordinal))];
    }
    const luckyDue = this.luckyView().some((l, i) => !l.published && this.betas.length >= (this.cfg.breaks.filter((b) => b.kind === "lucky")[i]?.after ?? Infinity));
    const needServer = !local || luckyDue;
    if (!needServer || m - this.lastResultPoll < (local ? 10_000 : 15_000) || !this.betas.length) return;
    this.lastResultPoll = m;
    try {
      this.serverResults = (await this.deps.api("GET", `/api/z/${this.eid}/results`)).results ?? this.serverResults;
      this.allResults = this.localOk ? [...this.allResults.filter((x) => x.pattern !== "lucky"), ...this.luckyResults(), ...this.serverResults.filter((x) => x.pattern === "lucky" && !this.luckyLocal.some((l) => l.ordinal === x.ordinal))] : this.serverResults;
    } catch { /* shown next time */ }
  }
  private luckyResults(): NonNullable<RuntimeView["results"]> { return this.luckyLocal.map((l) => ({ pattern: "lucky" as const, ordinal: l.ordinal, idx: l.idx, count: l.winners.length, round: 1, winners: l.winners })); }
  /** A lucky draw is worked out here, from the public randomness of the round that ends its break and the public seat list: the same on every phone, and nobody can steer it. */
  private async computeLucky(now: number) {
    if (this.luckyBusy || !this.seatsFetched) return;
    const L = this.cfg.breaks.filter((b) => b.kind === "lucky");
    if (!L.length) return;
    this.luckyBusy = true;
    try {
      for (let i = 0; i < L.length; i++) {
        if (this.luckyLocal.some((x) => x.ordinal === i + 1)) continue;
        const round = luckyRound(this.tracker ? this.tracker.state : null, this.startRound, this.stride, this.cfg.breaks, L[i]!);
        if (round === null || round > now) continue;
        if (this.seatsFreshRound < round) { this.wantSeats = true; continue; }
        const x = this.store.rounds.get(round) ?? (await fetchRound(round, { ...this.deps.beacon, ...(this.deps.verify ? { verify: this.deps.verify as any } : {}) }, 0));
        if (!x) continue;
        const pids = luckyEligible(this.seatList.map((s) => ({ pid: s.pid, ex: s.ex, removedMs: this.removedAt.get(s.pid) ?? null })), roundTimeMs(round));
        this.luckyLocal.push({ ordinal: i + 1, idx: L[i]!.after, round, winners: luckyWinners(this.eid, L[i]!.after, x.randomness, pids, L[i]!.winners || 3) });
      }
    } catch { /* tried again on the next pass */ } finally { this.luckyBusy = false; }
  }
  private sampled(seat: number, key: string, p: number): boolean {
    if (p >= 1) return true;
    let h = 2166136261; const s = seat + "|" + key;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h / 4294967296 < p;
  }
  /** Reports this phone's own result for every prize to the store. Only a share of the phones speak up at first (so a big game stays inside the free request allowance); the rest join in, wave by wave, if no result appears. */
  private async castVotes() {
    const m = this.deps.mono();
    if (!this.pid || !this.localOk || m - this.lastVote < 4_000) return;
    const seat = seatOfPid(this.pid);
    if (seat === null) return;
    this.lastVote = m;
    const people = Math.max(1, this.seatList.length), p0 = votersFor(people) / people;
    const items: { key: string; body: object }[] = [];
    for (const x of this.settled) items.push({ key: `1:${x.pattern}:${x.ordinal}`, body: { pattern: x.pattern, ordinal: x.ordinal, round: 1, idx: x.idx, pids: [...x.pids].sort() } });
    for (const l of this.luckyLocal) items.push({ key: `1:lucky:${l.ordinal}`, body: { pattern: "lucky", ordinal: l.ordinal, round: 1, idx: l.idx, pids: [...l.winners].sort() } });
    const send: { key: string; body: object }[] = [];
    for (const it of items) {
      if (this.voted.has(it.key)) continue;
      const first = this.firstSeen.get(it.key) ?? (this.firstSeen.set(it.key, m), m);
      const wave = Math.min(12, Math.floor((m - first) / 30_000));
      if (this.sampled(seat, it.key, Math.min(1, p0 * 2 ** wave))) send.push(it);
    }
    for (let i = 0; i < send.length; i += 3) {
      const part = send.slice(i, i + 3);
      try { await this.deps.api("POST", `/api/z/${this.eid}/vote`, { pid: this.pid, results: part.map((x) => x.body) }); for (const x of part) this.voted.add(x.key); }
      catch { break; /* kept: the next pass reports it again */ }
    }
  }

  private currentBreak(now: number | null): RuntimeView["brk"] {
    if (now === null || this.phase !== "play" || !this.cfg.breaks.length) return null;
    const a = activeBreak(this.tracker ? this.tracker.state : null, this.startRound, this.stride, this.cfg.breaks, now);
    if (!a || this.offsetMs === null) return null;
    return { title: a.brk.title, kind: a.brk.kind, ...(a.brk.mediaUrl ? { mediaUrl: a.brk.mediaUrl } : {}), ...(a.brk.winners ? { winners: a.brk.winners } : {}), seconds: a.brk.seconds, secondsLeft: Math.max(0, Math.round((roundTimeMs(a.endsAtRound) - (this.deps.mono() + this.offsetMs)) / 1000)) };
  }
  private luckyView(): RuntimeView["lucky"] {
    const out: RuntimeView["lucky"] = []; let n = 0;
    for (const b of this.cfg.breaks) {
      if (b.kind !== "lucky") continue;
      n++;
      const r = this.allResults.find((x) => x.pattern === "lucky" && x.ordinal === n);
      out.push({ ordinal: n, title: b.title, winners: b.winners ?? 3, style: b.style === "scratch" ? "scratch" : "draw", published: !!r, won: !!r && !!this.pid && (r.winners ?? []).includes(this.pid) });
    }
    return out;
  }
  private wonView(): RuntimeView["won"] {
    const out: RuntimeView["won"] = [];
    if (!this.pid) return out;
    for (const x of this.allResults) {
      if (x.pattern === "lucky" || !(x.winners ?? []).includes(this.pid)) continue;
      const line = linesFor(this.cfg.rewards, x.pattern as PatternKey).find((l) => l.ordinal === x.ordinal);
      out.push({ round: 1, pattern: x.pattern as PatternKey, ordinal: x.ordinal, text: line?.text ?? "", idx: x.idx });
    }
    return out;
  }
  private prizesAwarded(): boolean {
    const keys = keysInPlay(this.cfg.rewards);
    return keys.length > 0 && keys.every((k) => linesFor(this.cfg.rewards, k).every((l) => this.allResults.some((x) => x.pattern === k && x.ordinal === l.ordinal)));
  }

  /** Where the current turn stands: waiting for it to open, the window is open (tap Throw), the reveal, or all over. */
  private currentTurn(): TurnView {
    const now = this.nowRound, w = this.callSeconds;
    const none: TurnView = { index: 0, state: "wait", secondsLeft: null, windowSec: w, thrown: false };
    if (now === null || this.offsetMs === null || !this.startRound) return none;
    const utc = this.deps.mono() + this.offsetMs, secs = (r: number) => Math.max(0, Math.round((roundTimeMs(r) - utc) / 1000));
    const played = this.betas.length;
    // the turn being shown: the first one whose reveal has not finished
    for (let t = Math.max(0, played - 1); t < this.maxThrows; t++) {
      const o = this.openRound(t); if (o === null) return { ...none, index: t, state: "over" };
      const closeMs = roundTimeMs(o) + w * 1000, endMs = roundTimeMs(o + this.stride);
      if (utc < roundTimeMs(o)) return { index: t, state: "wait", secondsLeft: secs(o), windowSec: w, thrown: false };
      if (utc < closeMs) return { index: t, state: "open", secondsLeft: Math.max(0, Math.ceil((closeMs - utc) / 1000)), windowSec: w, thrown: this.pingedTurns.has(t) || this.cfg.play !== "presence" };
      if (utc < endMs) return { index: t, state: "reveal", secondsLeft: Math.max(0, Math.ceil((endMs - utc) / 1000)), windowSec: w, thrown: true };
      if (t >= played) return { index: t, state: "reveal", secondsLeft: 0, windowSec: w, thrown: true };
    }
    return { ...none, state: "over" };
  }

  view(): RuntimeView {
    const now = this.nowRound, st = this.tracker?.state;
    const g = this.game, seat = this.seat;
    const run = this.mine, board = this.myBoard;
    // the standings are worked out once per game state (a new throw, a new seat list), not once per screen refresh
    if (this.standKey !== this.gameKey + "|" + (g ? "g" : "-") + this.betas.length + "|" + (seat ?? 0)) {
      let top: RuntimeView["top"] = [], crowd: RuntimeView["crowd"] = null, team: RuntimeView["team"] = null, table: RuntimeView["table"] = null, myRank: number | null = null, turnsPlayed = this.betas.length, ended = false;
      if (g?.kind === "race") {
        const s = g.st; turnsPlayed = s.turnsPlayed; ended = s.ended;
        top = rankPlayers(s, 10);
        const c = crowdOf(s); crowd = { players: c.players, bands: c.bands, finished: c.finished, ahead: seat ? c.aheadOf(seat) : 0 };
        if (seat) { const all = rankPlayers(s, s.runs.length); myRank = all.find((r) => r.seat === seat)?.rank ?? null; }
        if (s.cfg.teams) { const rows = teamTable(s.cfg, s, teamsOf(s.cfg, s.b0)); const mine = seat ? teamsOf(s.cfg, s.b0)[seat - 1] ?? null : null; team = { rows, mine }; }
      } else if (g?.kind === "table") {
        const s = g.st; turnsPlayed = s.throws; ended = s.ended;
        const rk = rankTable(s); top = rk.slice(0, 10).map((r) => ({ rank: r.rank, seat: r.seat, finishedTurn: r.finishedAtThrow, square: r.square, ladders: s.runs[r.seat - 1]!.ladders, missed: s.runs[r.seat - 1]!.missed, note: "" }));
        myRank = seat ? rk.find((r) => r.seat === seat)?.rank ?? null : null;
        table = { order: s.order, whoseTurn: s.whoseTurn, squares: s.runs.map((r) => ({ seat: r.seat, square: squareOf(r) })) };
        crowd = { players: s.runs.length, bands: new Array(10).fill(0).map((_, i) => s.runs.filter((r) => Math.min(9, Math.floor((squareOf(r) - 1) / (s.board.size / 10))) === i).length), finished: s.finishedOrder.length, ahead: 0 };
      }

      this.stand = { top, crowd, team, table, myRank, turnsPlayed, ended }; this.standKey = this.gameKey + "|" + (g ? "g" : "-") + this.betas.length + "|" + (seat ?? 0);
    }
    const { top, crowd, team, table, myRank, turnsPlayed, ended } = this.stand!;
    const turn = this.currentTurn();
    const nextTurnInSec = turn.state === "wait" ? turn.secondsLeft : null;
    return {
      phase: this.phase, error: this.error, pid: this.pid, seat, nowRound: now, startRound: this.startRound, scheduledRound: this.scheduledRound, callSeconds: this.callSeconds,
      locked: this.locked, announcement: this.announcement,
      mode: now === null ? (this.controlState === "none" ? "none" : "hold") : this.modeAt(now), paused: !!st && now !== null && pausedAt(st, now), stopped: !!st && now !== null && st.stopRound !== null && now >= st.stopRound,
      unsent: 0, results: this.allResults, pendingChecks: this.store.pending(), discarded: this.store.discarded,
      cfg: this.cfg, brk: this.currentBreak(now), lucky: this.luckyView(),
      round: 1, rounds: 1, intermission: null, past: [], won: this.wonView(), allAwarded: this.prizesAwarded(), endedByPrizes: this.prizesEnded, late: null, localWinners: this.localOk,
      kind: this.cfg.mode === "table" ? "table" : this.cfg.mode === "team" ? "team" : "race",
      board: board ? { size: board.size, side: board.side, snakes: board.snakes, ladders: board.ladders } : null,
      me: run ? { square: squareOf(run), path: [1, ...run.pos], ladders: run.ladders, snakes: run.snakes, missed: run.missed, finishedTurn: run.finishedTurn, lastStep: run.history[run.history.length - 1] ?? null, history: run.history } : (board ? { square: 1, path: [1], ladders: 0, snakes: 0, missed: 0, finishedTurn: null, lastStep: null, history: [] } : null),
      turn, turnsPlayed, turnCap: this.turnCap, ended, crowd, top, myRank, team, table, nextTurnInSec,
    };
  }
}
