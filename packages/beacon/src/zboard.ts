// Engine-flag board for Snakes and Ladders: one shared board drawn as ONE inline SVG (printed-tile look: rainbow tiles, illustrated snakes and wooden ladders, wooden frame),
// square occupancy counts, live "ahead / behind", the phone-side race clock (120 s waiting room, 8 min game, 10 s window per throw, 10 s gap) and the Reaction hooks.
// PHONES compute: nothing here talks to the server; the server only stores and relays (it does no game work). Everything is drawn here: no image files, no remote fonts.
import { snakesRules, ownerBoard, squareXY, squareKind, playersOn, standing, WINDOW_MS, WAITING_ROOM_MS, timeLimitMsFor, windowOpen, finalRanking, winnerOf, noteFor, move } from "../../../vendor/game-core/packages/snakes/src";
import type { Board, SnakesState } from "../../../vendor/game-core/packages/snakes/src";
import { createReactions, reactionsForEvent } from "../../../vendor/game-core/packages/ui/src/reactions";
import type { ReactionScheduler } from "../../../vendor/game-core/packages/ui/src/reactions";

export type Look = "retro" | "modern";
const NS = "http://www.w3.org/2000/svg";
export const WORDS: Record<string, string> = { plain: "", start: "Start", finish: "Finish", "snake-head": "Snake", "ladder-foot": "Ladder", reward: "Reward", penalty: "Penalty" };

/** CSS: the board is one SVG that scales to the width (360 px phones included); the page around it follows light and dark. */
export const BOARD_CSS = `
.zb{width:100%;max-width:640px;margin:0 auto;line-height:0}
.zb svg{display:block;width:100%;height:auto;border-radius:12px;box-shadow:0 5px 16px rgba(0,0,0,.35)}
.zb text{font-family:'Arial Rounded MT Bold','Nunito','Trebuchet MS',Arial,sans-serif;font-weight:900}
.zb-stand{margin:6px auto;max-width:640px;display:flex;gap:8px;flex-wrap:wrap;font:600 14px system-ui,sans-serif}
.zb-stand span{padding:6px 10px;border-radius:999px;background:#0001}
.zb-note{min-height:22px;margin:4px auto;max-width:640px;font:700 15px system-ui,sans-serif}
`;

const C = 60, O = 40;
const PAL = ["#ef4b5b", "#ff8a1f", "#ffcf24", "#7ccb3a", "#2f9bf0", "#ff72b8", "#9a5be0"], PALE = "#e6eaee";
const SK = [{ b: "#34a853", d: "#14532d", l: "#c9f0b0" }, { b: "#5fba3c", d: "#2f6b1a", l: "#e6f7b8" }, { b: "#1f9d84", d: "#0b4a3c", l: "#b5efe0" }, { b: "#7a9f1f", d: "#3d5210", l: "#e5efb0" }, { b: "#f08a24", d: "#8a3d05", l: "#ffe2b5" }, { b: "#c4533f", d: "#6b1f12", l: "#ffd2c4" }];
type A = Record<string, string | number>;
const el = (t: string, a: A, p: Element): SVGElement => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, String(a[k])); p.appendChild(e); return e as SVGElement; };
const txt = (p: Element, a: A, s: string): void => { el("text", a, p).textContent = s; };
/** Where a square's pictures are anchored: a little below and right of the middle, so the number chip in the top-left corner stays clear. */
const cx = (n: number, head = false): [number, number] => { const { col, row } = squareXY(n); return [O + col * C + C / 2 + (head ? 9 : 5), O + (9 - row) * C + C / 2 + (head ? 11 : 6)]; };

function defs(S: Element): void {
  const d = el("defs", {}, S);
  const g = el("linearGradient", { id: "zbwd", x1: 0, y1: 0, x2: 1, y2: 1 }, d);
  el("stop", { offset: 0, "stop-color": "#d49a5c" }, g); el("stop", { offset: ".5", "stop-color": "#a8703a" }, g); el("stop", { offset: 1, "stop-color": "#865326" }, g);
  const h = el("linearGradient", { id: "zbhl", x1: 0, y1: 0, x2: 0, y2: 1 }, d);
  el("stop", { offset: 0, "stop-color": "#fff", "stop-opacity": 0.42 }, h); el("stop", { offset: ".45", "stop-color": "#fff", "stop-opacity": 0 }, h); el("stop", { offset: 1, "stop-color": "#000", "stop-opacity": 0.2 }, h);
  const f = el("filter", { id: "zbsh", x: "-20%", y: "-20%", width: "140%", height: "140%" }, d);
  el("feDropShadow", { dx: 2, dy: 3.5, stdDeviation: 2.6, "flood-color": "#000", "flood-opacity": 0.4 }, f);
  const r = el("radialGradient", { id: "zbbl", cx: ".35", cy: ".3", r: ".8" }, d); el("stop", { offset: 0, "stop-color": "#6f8cff" }, r); el("stop", { offset: 1, "stop-color": "#1a2f9a" }, r);
}
function frame(S: Element): void {
  defs(S);
  el("rect", { x: 0, y: 0, width: 680, height: 680, rx: 18, fill: "url(#zbwd)" }, S);
  for (let i = 0; i < 15; i++) el("path", { d: `M0 ${14 + i * 46} C170 ${2 + i * 46} 340 ${30 + i * 46} 680 ${12 + i * 46}`, stroke: "#5e3a18", opacity: 0.12, "stroke-width": 2, fill: "none" }, S);
  el("rect", { x: 3, y: 3, width: 674, height: 674, rx: 16, fill: "none", stroke: "#f3d9a8", "stroke-opacity": 0.7, "stroke-width": 2 }, S);
  el("rect", { x: O - 9, y: O - 9, width: C * 10 + 18, height: C * 10 + 18, rx: 6, fill: "#6b4118" }, S);
  el("rect", { x: O - 6, y: O - 6, width: C * 10 + 12, height: C * 10 + 12, rx: 4, fill: "#f6ead0" }, S);
}
/** One snake: a single tapered filled path from the head square to the tail square, a belly stripe, a diamond pattern, a head with eyes, nostrils and a forked tongue. */
function snake(S: Element, h: number, t: number, i: number): void {
  const col = SK[i % SK.length]!, flip = i % 2 ? 1 : -1, a = cx(h, true), z = cx(t), dx = z[0] - a[0], dy = z[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, amp = Math.min(24, L * 0.17) * flip, M = 70, P: number[][] = [];
  const waves = L > 260 ? 3 : L > 140 ? 2.5 : 2;
  for (let k = 0; k <= M; k++) { const u = k / M, s = Math.sin(u * Math.PI * waves) * amp * Math.min(1, u * 5) * Math.min(1, (1 - u) * 6 + 0.15); P.push([a[0] + dx * u + nx * s, a[1] + dy * u + ny * s, 2.2 + 12.5 * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62)), 0.75)]); }
  const nrm = (k: number): number[] => { const q = P[Math.min(M, k + 1)]!, r = P[Math.max(0, k - 1)]!, tx = q[0]! - r[0]!, ty = q[1]! - r[1]!, tl = Math.hypot(tx, ty) || 1; return [-ty / tl, tx / tl, tx / tl, ty / tl]; };
  const edge = (sc: number): string => { const l: number[][] = [], r: number[][] = []; for (let k = 0; k <= M; k++) { const p = P[k]!, n = nrm(k); l.push([p[0]! + n[0]! * p[2]! * sc, p[1]! + n[1]! * p[2]! * sc]); r.push([p[0]! - n[0]! * p[2]! * sc, p[1]! - n[1]! * p[2]! * sc]); } return l.concat(r.reverse()).map((q, j) => (j ? "L" : "M") + q[0]!.toFixed(1) + " " + q[1]!.toFixed(1)).join("") + "Z"; };
  const g = el("g", { filter: "url(#zbsh)" }, S);
  el("path", { d: edge(1), fill: col.b, stroke: col.d, "stroke-width": 2.4, "stroke-linejoin": "round" }, g);
  el("path", { d: edge(0.42), fill: col.l, opacity: 0.9 }, g);
  for (let k = 4; k < M - 3; k += 4) { const p = P[k]!, n = nrm(k), w = p[2]! * 0.62, len = Math.max(2.4, p[2]! * 0.7), ang = Math.atan2(n[3]!, n[2]!) * 180 / Math.PI; el("path", { d: `M${-len} 0L0 ${-w}L${len} 0L0 ${w}Z`, transform: `translate(${p[0]!.toFixed(1)} ${p[1]!.toFixed(1)}) rotate(${ang.toFixed(0)})`, fill: col.d, opacity: 0.85 }, g); }
  const p0 = P[0]!, p1 = P[3]!, deg = Math.atan2(p0[1]! - p1[1]!, p0[0]! - p1[0]!) * 180 / Math.PI, hg = el("g", { transform: `translate(${p0[0]} ${p0[1]}) rotate(${deg}) scale(1.22)`, filter: "url(#zbsh)" }, S);
  el("path", { d: "M16 0L29 0M29 0L36 -5M29 0L36 5", stroke: "#e0262f", "stroke-width": 2.6, fill: "none", "stroke-linecap": "round", "stroke-linejoin": "round" }, hg);
  el("path", { d: "M-8 -10C4 -17 22 -13 25 0C22 13 4 17 -8 10Z", fill: col.b, stroke: col.d, "stroke-width": 2.4, "stroke-linejoin": "round" }, hg);
  el("path", { d: "M-4 -4C6 -9 16 -6 20 0C16 6 6 9 -4 4Z", fill: col.l, opacity: 0.55 }, hg);
  for (const sy of [-1, 1]) { el("circle", { cx: 9, cy: sy * 8, r: 5, fill: "#fff", stroke: col.d, "stroke-width": 1.3 }, hg); el("circle", { cx: 10.4, cy: sy * 8, r: 2.7, fill: "#141414" }, hg); el("circle", { cx: 11.4, cy: sy * 8 - 1, r: 0.9, fill: "#fff" }, hg); el("circle", { cx: 21, cy: sy * 3, r: 1.2, fill: col.d }, hg); }
}
/** One ladder: two bevelled wooden rails, evenly spaced rungs that follow the angle, small feet, from the foot square to the top square. */
function ladder(S: Element, f: number, t: number): void {
  const a = cx(f), z = cx(t), dx = z[0] - a[0], dy = z[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy * 10, ny = ux * 10, g = el("g", { filter: "url(#zbsh)" }, S);
  for (const s of [-1, 1]) {
    const x1 = a[0] + nx * s, y1 = a[1] + ny * s, x2 = z[0] + nx * s, y2 = z[1] + ny * s;
    el("line", { x1, y1, x2, y2, stroke: "#4a2a0e", "stroke-width": 8, "stroke-linecap": "round" }, g);
    el("line", { x1, y1, x2, y2, stroke: "#b87333", "stroke-width": 5.4, "stroke-linecap": "round" }, g);
    el("line", { x1: x1 - ny * 0.07, y1: y1 + nx * 0.07, x2: x2 - ny * 0.07, y2: y2 + nx * 0.07, stroke: "#e0a566", "stroke-width": 1.6, "stroke-linecap": "round" }, g);
  }
  const k = Math.max(3, Math.round(L / 18));
  for (let i = 1; i < k; i++) { const u = i / k, x = a[0] + dx * u, y = a[1] + dy * u; for (const [c, w] of [["#4a2a0e", 6.6], ["#dba466", 3.8], ["#f3cc98", 1.2]] as const) el("line", { x1: x - nx, y1: y - ny, x2: x + nx, y2: y + ny, stroke: c, "stroke-width": w, "stroke-linecap": "round" }, g); }
  for (const s of [-1, 1]) { const x = a[0] + nx * s, y = a[1] + ny * s, ang = Math.atan2(uy, ux) * 180 / Math.PI; el("rect", { x: -6.5, y: -3.5, width: 13, height: 7, rx: 3, transform: `translate(${x} ${y}) rotate(${ang + 90})`, fill: "#2f1a08" }, g); }
}
function trophy(S: Element, x: number, y: number): void {
  const g = el("g", { transform: `translate(${x} ${y})`, filter: "url(#zbsh)" }, S);
  el("path", { d: "M-12 -14h24v8c0 9-5 14-12 14S-12 3-12 -6z", fill: "#ffc300", stroke: "#8a5a00", "stroke-width": 2, "stroke-linejoin": "round" }, g);
  el("path", { d: "M-12 -10h-6c0 7 3 10 8 10M12 -10h6c0 7-3 10-8 10", fill: "none", stroke: "#8a5a00", "stroke-width": 2.4, "stroke-linecap": "round" }, g);
  el("rect", { x: -4, y: 8, width: 8, height: 6, fill: "#d99a00", stroke: "#8a5a00", "stroke-width": 1.6 }, g); el("rect", { x: -10, y: 14, width: 20, height: 5, rx: 2, fill: "#8a5a00" }, g);
  el("path", { d: "M-7 -10v8", stroke: "#fff3a8", "stroke-width": 2.4, "stroke-linecap": "round" }, g);
}
const oct = (x: number, y: number, r: number): string => { const p: string[] = []; for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; p.push((x + r * Math.cos(a)).toFixed(1) + "," + (y + r * Math.sin(a)).toFixed(1)); } return p.join(" "); };

/** Draw (or redraw) the shared board with every pawn count inside its square. `me` is the viewer's player id. (`look` is kept for callers; there is one look now.) */
export function renderBoard(root: HTMLElement, b: Board, st: SnakesState, me: string | null, look: Look): void {
  root.className = `zb ${look}`; root.replaceChildren();
  const S = document.createElementNS(NS, "svg") as SVGSVGElement; S.setAttribute("viewBox", "0 0 680 680"); S.setAttribute("role", "img"); S.setAttribute("aria-label", "Snakes and ladders board, 100 squares"); root.appendChild(S);
  const on = playersOn(st), mine = me ? st.pawns[me]?.at : undefined;
  frame(S);
  for (let n = 1; n <= 100; n++) {
    const { col, row } = squareXY(n), x = O + col * C + 2, y = O + (9 - row) * C + 2, w = C - 4;
    el("rect", { x, y, width: w, height: w, rx: 9, fill: n % 13 === 0 ? PALE : PAL[(n - 1) % 7]! }, S);
    el("rect", { x, y, width: w, height: w, rx: 9, fill: "url(#zbhl)" }, S);
    el("rect", { x: x + 0.75, y: y + 0.75, width: w - 1.5, height: w - 1.5, rx: 8.4, fill: "none", stroke: "#fff", "stroke-opacity": 0.45, "stroke-width": 1.5 }, S);
  }
  for (const [f, t] of Object.entries(b.ladders)) ladder(S, +f, t);
  Object.entries(b.snakes).forEach(([h, t], i) => snake(S, +h, t, i));
  for (let n = 1; n <= 100; n++) {
    const k = squareKind(b, n), { col, row } = squareXY(n), x = O + col * C + C / 2, y = O + (9 - row) * C + C / 2;
    if (k === "penalty") { const g = el("g", { filter: "url(#zbsh)" }, S); el("polygon", { points: oct(x + 4, y + 10, 19), fill: "#d62828", stroke: "#fff", "stroke-width": 2.6, "stroke-linejoin": "round" }, g); txt(g, { x: x + 4, y: y + 15, "font-size": 13, fill: "#fff", "text-anchor": "middle" }, "STOP"); }
    if (k === "reward") { const g = el("g", { filter: "url(#zbsh)" }, S); el("circle", { cx: x + 4, cy: y + 10, r: 17, fill: "url(#zbbl)", stroke: "#fff", "stroke-width": 2.6 }, g); txt(g, { x: x + 4, y: y + 16, "font-size": 17, fill: "#fff", "text-anchor": "middle" }, "+2"); }
    if (k === "finish") trophy(S, x + 6, y + 8);
    if (k === "start") { const g = el("g", { filter: "url(#zbsh)" }, S); el("rect", { x: x - 24, y: y + 4, width: 50, height: 22, rx: 11, fill: "#1f9d4a", stroke: "#fff", "stroke-width": 2.4 }, g); txt(g, { x: x + 1, y: y + 19.5, "font-size": 12.5, fill: "#fff", "text-anchor": "middle" }, "START"); }
  }
  for (let n = 1; n <= 100; n++) {
    const { col, row } = squareXY(n), x = O + col * C + 5, y = O + (9 - row) * C + 5, w = n < 10 ? 24 : n < 100 ? 32 : 40, k = squareKind(b, n);
    const g = el("g", {}, S); const ti = document.createElementNS(NS, "title"); ti.textContent = `Square ${n}${WORDS[k] ? ", " + WORDS[k] : ""}${on[n] ? `, ${on[n]} here` : ""}`; g.appendChild(ti);
    el("rect", { x, y, width: w, height: 23, rx: 8, fill: "#fff", "fill-opacity": 0.9, stroke: "#000", "stroke-opacity": 0.12, "stroke-width": 1 }, g);
    txt(g, { x: x + w / 2, y: y + 18, "text-anchor": "middle", "font-size": 19, fill: "#111" }, String(n));
  }
  /** Players: a blue ring marks the viewer's square; each square with people shows the count in a badge at its bottom-right corner. */
  if (mine) { const { col, row } = squareXY(mine); el("rect", { x: O + col * C + 3, y: O + (9 - row) * C + 3, width: C - 6, height: C - 6, rx: 9, fill: "none", stroke: "#1456c2", "stroke-width": 4.5 }, S); }
  for (const [ns, c] of Object.entries(on)) { const n = +ns, { col, row } = squareXY(n), x = O + col * C + C - 6, y = O + (9 - row) * C + C - 6, w = c > 99 ? 30 : c > 9 ? 24 : 18; el("rect", { x: x - w, y: y - 17, width: w, height: 17, rx: 8.5, fill: mine === n ? "#1456c2" : "#2b2b2b", stroke: "#fff", "stroke-width": 1.6 }, S); txt(S, { x: x - w / 2, y: y - 4, "font-size": 12, fill: "#fff", "text-anchor": "middle" }, String(c)); }
}
export const standLine = (st: SnakesState, me: string): string => { const s = standing(st, me); return `${s.ahead} ahead of you, ${s.behind} behind you`; };

/** Reaction ids for what a throw did (events from the Reaction pack); the scheduler decides whether it shows. */
export function reactionEvents(r: { ladder: boolean; snake: boolean; special?: string; finished?: boolean; roll?: number; lost?: boolean; again?: boolean; big?: boolean }): string[] {
  const ev: string[] = [];
  if (r.finished) ev.push("finish"); else if (r.snake) ev.push(r.again ? "snake_bite_again" : "snake_bite"); else if (r.ladder) ev.push(r.big ? "ladder_big" : "ladder");
  else if (r.special === "reward") ev.push("reward"); else if (r.special === "punishment") ev.push("penalty"); else if (r.special === "upgrade") ev.push("upgrade"); else if (r.special === "downgrade") ev.push("downgrade");
  if (r.lost) ev.push("missed_turn");
  return ev;
}

/** The phone-side race. The site gives the game id, the players, the shared start time and a roll for (player, turn); the server relays, never computes. */
export class Race {
  readonly board: Board; st: SnakesState; readonly rx: ReactionScheduler; private bites: Record<string, number> = {};
  constructor(readonly gameId: string, readonly players: string[], readonly startsAtMs: number, private rollFor: (p: string, turn: number) => number, readonly me: string | null, minutes: 7 | 8 = 8, fate: Record<string, number> = {}) {
    this.board = ownerBoard(gameId);
    this.st = snakesRules.init({ board: this.board, fate, mode: "presence", timeLimitMinutes: String(minutes) }, players, 0);
    this.rx = createReactions(me);
  }
  /** Game time = wall time minus the start, minus the waiting room, minus paused time (pass the core clock's gameNow). */
  phase(gameNowMs: number): "waiting" | "playing" | "over" { const t = gameNowMs - this.startsAtMs; return this.st.over ? "over" : t < WAITING_ROOM_MS ? "waiting" : "playing"; }
  /** One throw window has closed: `threw` are the players who threw inside their 10 s. Settles the move and the counts, then the next window may open. */
  settle(gameNowMs: number, threw: string[]): void {
    const play = gameNowMs - this.startsAtMs - WAITING_ROOM_MS; if (play < 0 || this.st.over || this.paused) return;
    const turn = this.st.turn + 1, rolls: Record<string, number> = {};
    for (const p of this.players) rolls[p] = this.rollFor(p, turn);
    const before = this.st.pawns, r = snakesRules.step(this.st, { type: "turn", rolls, threw, gameMs: play }, gameNowMs, { phase: "running", frozenAt: null, pausedMs: 0, pauses: [] } as any);
    this.st = r.state;
    if (this.me) {
      const w = this.st.pawns[this.me]!, was = before[this.me]!, lost = !threw.includes(this.me), roll = rolls[this.me]!;
      const res = lost ? { to: was.at, ladder: false, snake: false } : move(this.board, was.at, roll, this.st.pass);
      const bit = res.snake ? (this.bites[this.me] = (this.bites[this.me] ?? 0) + 1) : 0;
      for (const ev of reactionEvents({ ...res, finished: !!w.finishedTurn && !was.finishedTurn, roll, lost, again: bit > 1, big: res.ladder && res.to - was.at >= 25 })) {
        const hit = reactionsForEvent(ev)[0]; if (hit) this.rx.react(hit.id, { now: gameNowMs, game: "snakes", who: this.me || undefined, priority: ev === "finish" ? "high" : "normal" });
      }
    }
  }
  canOpenNext(lastOpenedGameMs: number, gameNowMs: number, player?: string): boolean { return !this.paused && windowOpen(this.st, lastOpenedGameMs, gameNowMs - this.startsAtMs - WAITING_ROOM_MS, player); }
  /** An extra throw (reward gives 2): the holder throws again at once, each time, with no wait and no new turn for the others. */
  extraThrow(gameNowMs: number, player: string): boolean {
    if (this.paused || this.st.over || !(this.st.pawns[player]?.extra)) return false;
    const play = gameNowMs - this.startsAtMs - WAITING_ROOM_MS; if (play < 0) return false;
    const roll = this.rollFor(player, this.st.turn * 100 + (this.st.pawns[player]!.extra ?? 0));
    this.st = snakesRules.step(this.st, { type: "turn", rolls: { [player]: roll }, threw: [player], gameMs: play, only: player }, gameNowMs, { phase: "running", frozenAt: null, pausedMs: 0, pauses: [] } as any).state;
    return true;
  }
  private paused = false; private pausedMs = 0; private pausedAt: number | null = null;
  /** Pause freezes the game clock for the race AND the reactions: nothing is shown while paused. `wallMs` is the real clock. */
  pause(wallMs: number): void { if (this.paused) return; this.paused = true; this.pausedAt = wallMs; this.rx.setPaused(true); }
  resume(wallMs: number): void { if (!this.paused) return; this.pausedMs += wallMs - (this.pausedAt ?? wallMs); this.paused = false; this.pausedAt = null; this.rx.setPaused(false); }
  isPaused(): boolean { return this.paused; }
  /** Game time from the real clock: pauses removed. Give THIS to phase, settle, canOpenNext and the reactions. */
  gameNow(wallMs: number): number { return (this.paused ? this.pausedAt! : wallMs) - this.pausedMs; }
  ranking(): string[] { return finalRanking(this.st); }
  winner(): string | undefined { return winnerOf(this.st); }
  note(p: string): string { return this.st.pawns[p]?.note ?? ""; }
}
export { WINDOW_MS, WAITING_ROOM_MS, timeLimitMsFor, noteFor };
