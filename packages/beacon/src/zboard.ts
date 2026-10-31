// Engine-flag board for Snakes and Ladders: one shared board, original drawings (no faces) in a Retro and a Modern look, square occupancy counts,
// live "ahead / behind", the phone-side race clock (120 s waiting room, 8 min game, 10 s window per throw, 10 s gap) and the Reaction hooks.
// PHONES compute: nothing here talks to the server; the server only stores and relays (it does no game work).
import { snakesRules, ownerBoard, squareXY, squareKind, playersOn, standing, WINDOW_MS, WAITING_ROOM_MS, timeLimitMsFor, windowOpen, finalRanking, winnerOf, noteFor, move } from "../../../vendor/game-core/packages/snakes/src";
import type { Board, SnakesState } from "../../../vendor/game-core/packages/snakes/src";
import { createReactions, reactionsForEvent } from "../../../vendor/game-core/packages/ui/src/reactions";
import type { ReactionScheduler } from "../../../vendor/game-core/packages/ui/src/reactions";

export type Look = "retro" | "modern";
const NS = "http://www.w3.org/2000/svg";

/** One drawing per kind of square, 24x24 viewBox, colours come from CSS variables so Retro and Modern differ. No faces. */
const ICON: Record<string, string> = {
  plain: "",
  start: '<path class="zb-i-a" d="M5 20V4l12 5-12 5"/><path class="zb-i-b" d="M5 4v16"/>',
  finish: '<path class="zb-i-a" d="M4 4h16v16H4z"/><path class="zb-i-b" d="M4 4h5v5H4zM14 4h5v5h-5zM9 9h5v5H9zM4 14h5v5H4zM14 14h5v5h-5z"/>',
  "snake-head": '<path class="zb-i-a" d="M4 18c0-6 6-3 8-7s-4-5-1-8c3-2 6 0 6 3 0 4-5 4-3 9"/><circle class="zb-i-b" cx="15" cy="6" r="1.2"/><path class="zb-i-b" d="M18 8l3 1-3 1"/>',
  "ladder-foot": '<path class="zb-i-a" d="M7 3v18M17 3v18"/><path class="zb-i-b" d="M7 7h10M7 12h10M7 17h10"/>',
  reward: '<path class="zb-i-a" d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/><path class="zb-i-b" d="M12 8v5"/>',
  penalty: '<path class="zb-i-a" d="M6 16a4 4 0 0 1 1-7.8A5 5 0 0 1 17 8a3.5 3.5 0 0 1 1 8z"/><path class="zb-i-b" d="M10 18l-1 3M14 18l-1 3"/>',
};
export const WORDS: Record<string, string> = { plain: "", start: "Start", finish: "Finish", "snake-head": "Snake", "ladder-foot": "Ladder", reward: "Reward", penalty: "Penalty" };
const icon = (k: string): string => `<svg class="zb-ic" viewBox="0 0 24 24" aria-hidden="true">${ICON[k] ?? ""}</svg>`;

/** CSS for both looks; 10 columns that shrink to 32 px cells at 360 px wide. Pair with vendor reactions.css. */
export const BOARD_CSS = `
.zb{--zb-bg:#fff7e0;--zb-a:#2b7a3d;--zb-b:#b8321f;--zb-line:#3b2a14;--zb-sq1:#ffe9a8;--zb-sq2:#ffd37a;--zb-me:#1456c2;display:grid;grid-template-columns:repeat(10,1fr);gap:0;width:100%;max-width:560px;margin:0 auto;border:3px solid var(--zb-line);background:var(--zb-bg);position:relative;font:600 11px/1.1 system-ui,sans-serif}
.zb.modern{--zb-bg:#f4f7fb;--zb-a:#1e6fff;--zb-b:#ff5a5f;--zb-line:#c9d3e0;--zb-sq1:#ffffff;--zb-sq2:#e8eef7;border-radius:14px;border-width:1px;overflow:hidden}
.zb.retro{border-radius:0}
.zb-sq{aspect-ratio:1;min-width:32px;position:relative;background:var(--zb-sq1);border:1px solid var(--zb-line);overflow:hidden}
.zb-sq.alt{background:var(--zb-sq2)}
.zb-n{position:absolute;top:1px;left:2px;font-size:9px;opacity:.7}
.zb-ic{position:absolute;inset:18% 18% 8% 18%;width:64%;height:64%;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.zb.retro .zb-ic{stroke-width:2.6}
.zb-i-a{stroke:var(--zb-a);fill:color-mix(in srgb,var(--zb-a) 20%,transparent)}
.zb-i-b{stroke:var(--zb-b);fill:none}
.zb-sq.snake-head .zb-i-a{stroke:var(--zb-b)}
.zb-cnt{position:absolute;right:2px;bottom:1px;min-width:14px;padding:0 3px;border-radius:8px;background:var(--zb-line);color:#fff;font-size:10px;text-align:center}
.zb-sq.me{outline:3px solid var(--zb-me);outline-offset:-3px}
.zb-sq.me .zb-cnt{background:var(--zb-me)}
.zb-link{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.zb-link .sn{stroke:var(--zb-b);fill:none;stroke-width:.45;stroke-linecap:round;opacity:.38}
.zb-link .ld{stroke:var(--zb-a);fill:none;stroke-width:.3;stroke-linecap:round;opacity:.45}
.zb-link .rg{stroke:var(--zb-a);stroke-width:.25;opacity:.4}
.zb-stand{margin:6px auto;max-width:560px;display:flex;gap:8px;flex-wrap:wrap;font:600 14px system-ui,sans-serif}
.zb-stand span{padding:6px 10px;border-radius:999px;background:#0001}
.zb-note{min-height:22px;margin:4px auto;max-width:560px;font:700 15px system-ui,sans-serif}
@media (prefers-color-scheme:dark){.zb.modern{--zb-bg:#10151d;--zb-sq1:#171d28;--zb-sq2:#1d2533;--zb-line:#33405a;--zb-a:#6aa3ff;--zb-b:#ff8a8e;color:#e8eef7}}
`;

const cell = (n: number) => { const { col, row } = squareXY(n); return { x: col * 10 + 5, y: (9 - row) * 10 + 5 }; };
const mk = (tag: string, attrs: Record<string, string>): SVGElement => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]!); return e as SVGElement; };

/** The snakes (wavy lines) and ladders (two rails with rungs) over the grid, in a 100x100 box. Every one is drawn from the board itself. */
function links(b: Board): SVGElement {
  const svg = mk("svg", { class: "zb-link", viewBox: "0 0 100 100", preserveAspectRatio: "none", "aria-hidden": "true" });
  for (const [f, t] of Object.entries(b.snakes)) {
    const a = cell(+f), z = cell(t), mx = (a.x + z.x) / 2, my = (a.y + z.y) / 2, dx = z.y - a.y, dy = a.x - z.x, L = Math.hypot(dx, dy) || 1, w = 3.2;
    svg.appendChild(mk("path", { class: "sn", d: `M${a.x} ${a.y} Q${mx + (dx / L) * w} ${my + (dy / L) * w} ${mx} ${my} T${z.x} ${z.y}` }));
  }
  for (const [f, t] of Object.entries(b.ladders)) {
    const a = cell(+f), z = cell(t), dx = z.x - a.x, dy = z.y - a.y, L = Math.hypot(dx, dy) || 1, ox = (-dy / L) * 1.1, oy = (dx / L) * 1.1;
    svg.appendChild(mk("line", { class: "ld", x1: String(a.x + ox), y1: String(a.y + oy), x2: String(z.x + ox), y2: String(z.y + oy) }));
    svg.appendChild(mk("line", { class: "ld", x1: String(a.x - ox), y1: String(a.y - oy), x2: String(z.x - ox), y2: String(z.y - oy) }));
    for (let i = 1; i < Math.max(2, Math.floor(L / 4)); i++) { const u = i / Math.max(2, Math.floor(L / 4)); svg.appendChild(mk("line", { class: "rg", x1: String(a.x + dx * u + ox), y1: String(a.y + dy * u + oy), x2: String(a.x + dx * u - ox), y2: String(a.y + dy * u - oy) })); }
  }
  return svg;
}

/** Draw (or redraw) the shared board with every pawn count inside its square. `me` is the viewer's player id. */
export function renderBoard(root: HTMLElement, b: Board, st: SnakesState, me: string | null, look: Look): void {
  root.className = `zb ${look}`; root.replaceChildren();
  const on = playersOn(st), mine = me ? st.pawns[me]?.at : undefined;
  for (let row = 9; row >= 0; row--) for (let col = 0; col < 10; col++) {
    const n = Array.from({ length: 100 }, (_, i) => i + 1).find((q) => { const p = squareXY(q); return p.row === row && p.col === col; })!;
    const k = squareKind(b, n), d = document.createElement("div");
    d.className = `zb-sq ${k}${(row + col) % 2 ? " alt" : ""}${mine === n ? " me" : ""}`;
    d.setAttribute("aria-label", `Square ${n}${WORDS[k] ? ", " + WORDS[k] : ""}${on[n] ? `, ${on[n]} here` : ""}`);
    d.innerHTML = `<span class="zb-n">${n}</span>${icon(k)}${on[n] ? `<span class="zb-cnt">${on[n]}</span>` : ""}`;
    root.appendChild(d);
  }
  root.appendChild(links(b));
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
    const play = gameNowMs - this.startsAtMs - WAITING_ROOM_MS; if (play < 0 || this.st.over) return;
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
  canOpenNext(lastOpenedGameMs: number, gameNowMs: number): boolean { return windowOpen(this.st, lastOpenedGameMs, gameNowMs - this.startsAtMs - WAITING_ROOM_MS); }
  ranking(): string[] { return finalRanking(this.st); }
  winner(): string | undefined { return winnerOf(this.st); }
  note(p: string): string { return this.st.pawns[p]?.note ?? ""; }
}
export { WINDOW_MS, WAITING_ROOM_MS, timeLimitMsFor, noteFor };
