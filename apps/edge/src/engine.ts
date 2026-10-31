// Common-engine adapter (flag: config.engine === true, default off; the live rules never import this file's results unless the flag is set).
// Rules come from the vendored game-core (vendor/game-core, pinned in CORE_VERSION): elimination rounds, Pause/Resume by role, auto-claimed "You won".
// Boards, rolls and fate numbers stay site-side and are given in.
import { snakesRules } from "../../../vendor/game-core/packages/snakes/src";
import { newClock, pause, resume, gameNow } from "../../../vendor/game-core/packages/core/src/modes";
import { canControlClock, logChange } from "../../../vendor/game-core/packages/core/src/roles";
import type { Clock } from "../../../vendor/game-core/packages/core/src/modes";
import type { Role, Change } from "../../../vendor/game-core/packages/core/src/roles";

export type EngineCfg = { engine?: true; survivors?: number; roundTurns?: number; timeLimitMinutes?: number; turnCap?: number; pass?: boolean; presence?: boolean };
export const engineOn = (c: { engine?: unknown } | null | undefined): boolean => c?.engine === true;

/** The golden button text players see on an engine game: it claims for them, no Claim press. */
export const GOLDEN_LABEL: string = snakesRules.goldenButton;

/** Setup for snakesRules.init from a game's config plus the site-made boards and fate numbers. */
export function engineSetup(cfg: EngineCfg, boards: Record<string, unknown>, fate: Record<string, number>) {
  return { boards, fate, timeLimitMinutes: cfg.timeLimitMinutes === 7 ? "7" : "8", turnLimit: cfg.turnCap, mode: cfg.presence ? "presence" : "fate", pass: !!cfg.pass, survivors: cfg.survivors ?? 0, roundTurns: cfg.roundTurns ?? 10 };
}

export interface PauseState { clock: Clock; log: Change[] }
export const freshPause = (): PauseState => ({ clock: newClock(), log: [] });

/** Pause or resume. Organizer always; Host only when the Organizer has registered a Host key (hostKeyOk). Anyone else is refused. Every change is logged with the role. */
export function applyPause(st: PauseState, action: "pause" | "resume", role: Role, hostKeyOk: boolean, now: number): { ok: true; st: PauseState } | { ok: false; error: string } {
  if (!canControlClock(role) || (role === "host" && !hostKeyOk)) return { ok: false, error: "Only the Organizer, or a Host the Organizer has set up with a key, can pause or resume the game." };
  const clock = action === "pause" ? pause(st.clock, role, now) : resume(st.clock, role, now);
  if (clock === st.clock) return { ok: false, error: action === "pause" ? "The game is not running, so it cannot be paused." : "The game is not paused." };
  return { ok: true, st: { clock, log: logChange(st.log, role, action, now) } };
}

/** Every deadline on an engine game uses this, so a pause freezes it. */
export const engineNow = (st: PauseState, now: number): number => gameNow(st.clock, now);

export { snakesRules, finalRanking, standing, winnerOf, WINDOW_MS, nextWindowAt, windowOpen, reactionOf, WAITING_ROOM_MS, ownerBoard, checkOwnerBoard, squareXY, squareKind, playersOn, placeSpecials, noteFor, hasExtra } from "../../../vendor/game-core/packages/snakes/src";
