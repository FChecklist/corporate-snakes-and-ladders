// Shapes of the snakes and ladders on the board, as plain numbers (no DOM), so the drawing and the tests use the same maths.
// Board box: the 10 x 10 grid is G = 600 units wide, its top-left corner is at (O, O); the picture is 2 * O + G units square.
// Rule: every point of every snake (body, head, tongue) and every ladder (rails, rungs, feet) stays inside the grid, with a small margin for the outline.
import { squareXY, isFlat } from "../../../vendor/game-core/packages/snakes/src";
import type { Board } from "../../../vendor/game-core/packages/snakes/src";

export const C = 60, O = 14, G = 600, VB = G + 2 * O;
export const HEAD_R = 40;   // the head with its tongue always fits in a circle of this radius around its anchor point
export const SNAKE_HALF = 6.5; // half the thickest width of a snake body (about a fifth of a tile wide in all; the head is clearly wider)
const LAD = 7;              // a ladder's rails sit this far either side of its middle line

/** Centre of a square, nudged a little down and right so the number chip in the top-left corner stays clear. */
export const anchor = (n: number): [number, number] => { const { col, row } = squareXY(n); return [O + col * C + C / 2 + 4, O + (9 - row) * C + C / 2 + 7]; };
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const inside = (v: number, m: number): number => clamp(v, O + m, O + G - m);

export interface SnakeShape { pts: number[][]; head: { x: number; y: number; deg: number }; }
/** The middle line of a snake as points [x, y, half-width], thick near the head and thin at the tail, plus where the head sits and which way it faces. */
export function snakeShape(h: number, t: number, i: number): SnakeShape {
  const a0 = anchor(h), z0 = anchor(t);
  const a = [inside(a0[0], HEAD_R + 2), inside(a0[1], HEAD_R + 2)], z = [inside(z0[0], 6), inside(z0[1], 6)];
  const dx = z[0]! - a[0]!, dy = z[1]! - a[1]!, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const flip = i % 2 ? 1 : -1, amp = Math.min(12, L * 0.08) * flip, waves = L > 300 ? 2.5 : L > 170 ? 2 : 1.5, M = 60, pts: number[][] = [];
  for (let k = 0; k <= M; k++) {
    const u = k / M, s = Math.sin(u * Math.PI * waves) * amp * Math.min(1, u * 5) * Math.min(1, (1 - u) * 6 + 0.1);
    const hw = 1.4 + (SNAKE_HALF - 1.4) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.6)), 0.8);
    pts.push([inside(a[0]! + dx * u + nx * s, hw + 3), inside(a[1]! + dy * u + ny * s, hw + 3), hw]);
  }
  const p0 = pts[0]!, p1 = pts[4]!;
  return { pts, head: { x: p0[0]!, y: p0[1]!, deg: Math.atan2(p0[1]! - p1[1]!, p0[0]! - p1[0]!) * 180 / Math.PI } };
}
export interface LadderShape { a: number[]; z: number[]; nx: number; ny: number; ux: number; uy: number; L: number; }
/** A ladder is a straight line from the foot square to the top square, two rails either side of it. */
export function ladderShape(f: number, t: number): LadderShape {
  const a0 = anchor(f), z0 = anchor(t), a = [inside(a0[0], LAD + 9), inside(a0[1], LAD + 9)], z = [inside(z0[0], LAD + 9), inside(z0[1], LAD + 9)];
  const dx = z[0]! - a[0]!, dy = z[1]! - a[1]!, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  return { a, z, nx: -uy * LAD, ny: ux * LAD, ux, uy, L };
}
export const RAIL_REACH = LAD + 9; // rail offset plus half the foot and outline

/** Every problem with the drawing of this board, in plain words ([] when every snake and ladder is inside the grid and none is flat). */
export function checkDrawing(b: Board): string[] {
  const bad = new Set<string>(), lo = O, hi = O + G;
  const out = (x: number, y: number, r: number): boolean => x - r < lo || x + r > hi || y - r < lo || y + r > hi;
  Object.entries(b.snakes).forEach(([h, t], i) => {
    if (isFlat(+h, t)) bad.add("no flat snake or ladder");
    const s = snakeShape(+h, t, i);
    if (s.pts.some((p) => out(p[0]!, p[1]!, p[2]!)) || out(s.head.x, s.head.y, HEAD_R)) bad.add("all inside the board");
  });
  for (const [f, t] of Object.entries(b.ladders)) {
    if (isFlat(+f, t)) bad.add("no flat snake or ladder");
    const l = ladderShape(+f, t);
    if (out(l.a[0]!, l.a[1]!, RAIL_REACH) || out(l.z[0]!, l.z[1]!, RAIL_REACH)) bad.add("all inside the board");
  }
  return [...bad];
}
