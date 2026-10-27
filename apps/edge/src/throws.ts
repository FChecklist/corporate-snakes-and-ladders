// Presence play ("Players throw"): a player taps Throw and the phone reports it here. A throw counts only if the server receives it before the turn window ends:
// the SERVER clock decides (never the phone's). After that the answer is code "late-move" and nothing is recorded. The record is read back by every phone (GET .../throws)
// to know who threw in each finished turn, and goes with the other personal rows when the game is erased (lifecycle.ts).
import { seatOfPid } from "../../../packages/beacon/src/seat";
import { turnWindowMs, cfgOfRow } from "./lifecycle";
import { deviceMatches, prefixEnd } from "./checkin";
import type { Env } from "./worker";

type Json = (o: unknown, s?: number) => Response;
type Spend = (env: Env, now: number, n?: number) => Promise<boolean>;
export const LATE_MOVE_MSG = "Ohooo! 😊 Sorry, you moved after your turn ended. This move cannot be made.";
const key = (eid: string, turn: number, seat: number) => `thr/${eid}/${String(turn).padStart(4, "0")}/${seat}`;

export async function acceptThrow(env: Env, e: any, eid: string, b: any, now: number, json: Json, spend: Spend): Promise<Response> {
  const seat = typeof b?.pid === "string" ? seatOfPid(b.pid) : null;
  if (!b || seat === null || !Number.isInteger(b.turn) || b.turn < 0 || b.turn > 1000) return json({ error: "Bad request." }, 400);
  if (!(await env.DB.prepare("SELECT 1 AS x FROM participant WHERE eid=? AND pid=?").bind(eid, b.pid).first())) return json({ error: "Not a participant of this game." }, 403);
  if (!(await deviceMatches(env, eid, b.pid, b.device))) return json({ error: "This board belongs to another phone.", code: "other-phone" }, 403);
  if (cfgOfRow(e).play !== "presence") return json({ error: "In this game every throw happens by itself. There is nothing to send.", code: "automatic" }, 409);
  const w = await turnWindowMs(env, e, b.turn);
  if (!w) return json({ error: "The game was stopped before this turn.", code: "stopped" }, 409);
  if (now < w.openMs) return json({ error: "This turn has not opened yet. Please wait for the dice button.", code: "not-open" }, 409);
  if (now >= w.closeMs) return json({ error: LATE_MOVE_MSG, code: "late-move" }, 409); // the rule: the window is over, the move cannot be made
  if (!(await spend(env, now, 1))) return json({ error: "It is very busy right now. Please try again in a moment.", code: "busy" }, 503);
  await env.DB.prepare("INSERT OR IGNORE INTO kv(k,v) VALUES(?,?)").bind(key(eid, b.turn, seat), String(now)).run();
  return json({ ok: true });
}

/** Who threw in turns `from` to `to` (the collector's record that presence play is decided on): pairs of [seat, turn]. */
export async function listThrows(env: Env, eid: string, url: URL, json: Json): Promise<Response> {
  const from = Math.max(0, Math.min(1000, Number(url.searchParams.get("from")) || 0)), to = Math.max(from, Math.min(1000, Number(url.searchParams.get("to")) || 0));
  const rows = (await env.DB.prepare("SELECT k FROM kv WHERE k >= ? AND k < ? LIMIT 20000").bind(`thr/${eid}/`, prefixEnd(`thr/${eid}/`)).all<{ k: string }>()).results ?? [];
  const out: [number, number][] = [];
  for (const r of rows) { const p = r.k.split("/"); const turn = Number(p[2]), seat = Number(p[3]); if (turn >= from && turn <= to) out.push([seat, turn]); }
  return json({ throws: out });
}
