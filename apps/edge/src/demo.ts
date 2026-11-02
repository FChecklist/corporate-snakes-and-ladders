// Free demo game (owner order 1 Nov 2026): up to 10 people, no payment, the same rules and engine as a real game, labelled "Demo" on every screen.
// A demo never uses a bought pack, never makes a payment row, and has an abuse limit: at most 3 demo games per organizer (one account = one e-mail or employee ID) and per network address per day.
// FLAG: DEMO_GAME must be exactly "on". It is OFF until the owner has audited it. A guest's data is deleted like in any game (lifecycle.ts, 23 hours after the game ends).
import type { D1, Env } from "./worker";

export const DEMO_CAP = 10;
export const DEMO_PER_DAY = 3;
export const DEMO_PREFIX = "Demo: ";
export const demoOn = (env: { DEMO_GAME?: string }): boolean => env.DEMO_GAME === "on";
export const demoName = (name: unknown): string => {
  const n = typeof name === "string" ? name.trim() : "";
  const rest = n.replace(/^demo\s*[:\-]\s*/i, "");
  return (DEMO_PREFIX + (rest || "Snakes and Ladders")).slice(0, 80);
};

const TABLE = `CREATE TABLE IF NOT EXISTS demo_game (eid TEXT PRIMARY KEY, org TEXT NOT NULL, ipk TEXT NOT NULL, day TEXT NOT NULL, at_ms INTEGER NOT NULL)`;
const ready = new WeakSet<object>();
async function ensure(db: D1): Promise<void> { if (ready.has(db)) return; await db.prepare(TABLE).run(); await db.prepare("CREATE INDEX IF NOT EXISTS demo_org_day ON demo_game(org, day)").run(); await db.prepare("CREATE INDEX IF NOT EXISTS demo_ip_day ON demo_game(ipk, day)").run(); ready.add(db); }
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface DemoCheck { ok: boolean; status?: number; error?: string; code?: string }
/** May this organizer make another demo game right now? Counts today's demo games by the organizer account and by the network address. */
export async function demoAllowed(env: { DB: D1; DEMO_GAME?: string }, org: string | null, ipk: string, now: number): Promise<DemoCheck> {
  if (!demoOn(env)) return { ok: false, status: 404, error: "Not found" };
  if (!org) return { ok: false, status: 403, error: "Sign in with your e-mail to try a demo.", code: "demo-sign-in" };
  await ensure(env.DB);
  const d = dayOf(now);
  const byOrg = (await env.DB.prepare("SELECT COUNT(*) AS c FROM demo_game WHERE org=? AND day=?").bind(org, d).first<{ c: number }>())?.c ?? 0;
  const byIp = (await env.DB.prepare("SELECT COUNT(*) AS c FROM demo_game WHERE ipk=? AND day=?").bind(ipk, d).first<{ c: number }>())?.c ?? 0;
  if (byOrg >= DEMO_PER_DAY || byIp >= DEMO_PER_DAY) return { ok: false, status: 429, error: `You can make ${DEMO_PER_DAY} demo games a day. Please try again tomorrow.`, code: "demo-limit" };
  return { ok: true };
}
export async function demoRecord(env: { DB: D1 }, eid: string, org: string | null, ipk: string, now: number): Promise<void> {
  await ensure(env.DB);
  await env.DB.prepare("INSERT OR IGNORE INTO demo_game(eid,org,ipk,day,at_ms) VALUES(?,?,?,?,?)").bind(eid, org ?? "", ipk, dayOf(now), now).run();
}
/** Is this game a demo? (A table that does not exist yet means no demo has ever been made.) */
export async function isDemo(env: { DB: D1 }, eid: string): Promise<boolean> {
  try { return !!(await env.DB.prepare("SELECT 1 AS x FROM demo_game WHERE eid=?").bind(eid).first()); } catch { return false; }
}
/** How many demo games exist, and how many were made today (for the master console later). */
export async function demoCounts(env: { DB: D1 }, now: number): Promise<{ total: number; today: number }> {
  try { await ensure(env.DB); const t = (await env.DB.prepare("SELECT COUNT(*) AS c FROM demo_game").first<{ c: number }>())?.c ?? 0, d = (await env.DB.prepare("SELECT COUNT(*) AS c FROM demo_game WHERE day=?").bind(dayOf(now)).first<{ c: number }>())?.c ?? 0; return { total: t, today: d }; } catch { return { total: 0, today: 0 }; }
}
export type { Env };
