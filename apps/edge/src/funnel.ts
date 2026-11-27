// First-party sales FUNNEL (owner order 1 Nov 2026). Our own Worker and D1 only: no third-party script, no cookie, nothing stored on the device.
// An event is a name, a day, an anonymous key and at most four safe fields (game family, size, mode, reason) cleaned by the shared core (vendor core funnel.ts).
// Never a name, a mobile number, an e-mail, an employee ID, an address or a device id. A browser that sends Global Privacy Control or Do Not Track is not counted at all.
// FLAG: FUNNEL_EVENTS must be exactly "on" for anything to be stored. It is OFF until the owner has audited this (no value, or any other value, = off).
// Page steps (viewed, size_chosen, signup_started, payment_page_reached, payment_page_opened, payment_link_copied) come from the pages (public/funnel.js) and are counted once per page visit.
// Game steps (game_created, game_published, payment_started, payment_succeeded, payment_failed, game_started, game_completed) are written by the server and counted once per game.
import { FUNNEL_EVENTS, cleanProps, type FunnelEvent } from "../../../vendor/game-core/packages/core/src/funnel";
import { orgIsTest } from "./mode";
import { rateLimited } from "./visits";
import type { D1, Env } from "./worker";

export const FUNNEL_ENDPOINT = "/api/funnel/e";
export const FUNNEL_LABELS: Record<FunnelEvent, string> = {
  viewed: "Page viewed", size_chosen: "Size or price chosen", signup_started: "Sign-up started", game_created: "Game created", game_published: "Game published",
  payment_page_reached: "Payment page reached", payment_page_opened: "Payment page opened", payment_link_copied: "Payment share link copied", payment_started: "Payment started",
  payment_succeeded: "Payment succeeded", payment_failed: "Payment failed", game_started: "Game started", game_completed: "Game completed",
};
/** What a browser may report. The server steps cannot be sent from a page, so the numbers cannot be pushed up from outside. */
export const PAGE_EVENTS = new Set<string>(["viewed", "size_chosen", "signup_started", "payment_page_reached", "payment_page_opened", "payment_link_copied"]);
export const SERVER_EVENTS = new Set<string>(["game_created", "game_published", "payment_started", "payment_succeeded", "payment_failed", "game_started", "game_completed"]);
/** `payment_failed` is a side branch of the payment, not a step on the way to the next one. */
const MAIN_LINE = FUNNEL_EVENTS.filter((e) => e !== "payment_failed");

export const funnelOn = (env: { FUNNEL_EVENTS?: string }): boolean => env.FUNNEL_EVENTS === "on";
/** Do Not Track and Global Privacy Control, as the browser sends them to the server. */
export const optedOut = (req: Request): boolean => req.headers.get("sec-gpc") === "1" || req.headers.get("dnt") === "1";

const TABLE = `CREATE TABLE IF NOT EXISTS funnel_event (ev TEXT NOT NULL, ukey TEXT NOT NULL, day TEXT NOT NULL, at_ms INTEGER NOT NULL, game TEXT, size INTEGER, mode TEXT, reason TEXT, PRIMARY KEY (ev, ukey))`;
const INDEX = `CREATE INDEX IF NOT EXISTS funnel_day ON funnel_event(day, ev)`;
const ready = new WeakSet<object>();
async function ensure(db: D1): Promise<void> { if (ready.has(db)) return; await db.prepare(TABLE).run(); await db.prepare(INDEX).run(); ready.add(db); }
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

async function store(db: D1, ev: FunnelEvent, ukey: string, props: Record<string, unknown>, now: number): Promise<void> {
  await ensure(db);
  const c = cleanProps(props);
  await db.prepare("INSERT OR IGNORE INTO funnel_event(ev,ukey,day,at_ms,game,size,mode,reason) VALUES(?,?,?,?,?,?,?,?)").bind(ev, ukey, dayOf(now), now, c.game ?? null, c.size ?? null, c.mode ?? null, c.reason ?? null).run();
}

/** POST /api/funnel/e from the page (makeReporter in the browser). Always answers 204 and never says whether anything was kept. */
export async function funnelRoute(req: Request, env: Env & { FUNNEL_EVENTS?: string }, now: number): Promise<Response> {
  const none = () => new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
  try {
    if (!funnelOn(env) || optedOut(req)) return none();
    if (rateLimited("fn:" + (req.headers.get("cf-connecting-ip") ?? "local"), now, 120)) return none();
    const text = await req.text(); if (text.length > 400) return none();
    const b = JSON.parse(text) as Record<string, unknown>;
    if (typeof b.event !== "string" || !PAGE_EVENTS.has(b.event) || !(FUNNEL_EVENTS as readonly string[]).includes(b.event)) return none();
    if (typeof b.visit !== "string" || !/^[a-z0-9]{12}$/.test(b.visit)) return none();
    await store(env.DB, b.event as FunnelEvent, "v:" + b.visit, b, now);
  } catch { /* a bad or lost event is simply not counted */ }
  return none();
}

/** A game step, written by the server. Once per game (or per payment where no game is known). Test-mode accounts and every error are ignored: counting must never break a game or a payment. */
export async function recordFunnel(env: { DB: D1; FUNNEL_EVENTS?: string }, ev: FunnelEvent, key: string | null | undefined, now: number, o: { org?: string | null; props?: Record<string, unknown> } = {}): Promise<void> {
  try {
    if (!funnelOn(env) || !key || !SERVER_EVENTS.has(ev)) return;
    if (o.org && (await orgIsTest(env as unknown as { DB: D1 }, o.org))) return;
    await store(env.DB, ev, "g:" + key, { game: "snakes", ...o.props }, now);
  } catch { /* never throws */ }
}

export interface FunnelRow { event: FunnelEvent; label: string; count: number; ofPrevious: number | null; ofFirst: number | null }
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const weekOf = (day: string) => { const d = new Date(day + "T00:00:00Z"), k = (d.getUTCDay() + 6) % 7; return dayOf(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - k)); };
function rowsOf(counts: Map<string, number>): FunnelRow[] {
  const n = (e: string) => counts.get(e) ?? 0, first = n(MAIN_LINE[0]!);
  return FUNNEL_EVENTS.map((event) => {
    const i = (MAIN_LINE as readonly string[]).indexOf(event), prev = i > 0 ? n(MAIN_LINE[i - 1]!) : null;
    return { event, label: FUNNEL_LABELS[event], count: n(event), ofPrevious: i > 0 && prev != null ? pct(n(event), prev) : null, ofFirst: i > 0 ? pct(n(event), first) : null };
  });
}
/** Owner report: total, by week and by day, with the drop-off from the step before and from the first step. `from` and `to` are UTC days (YYYY-MM-DD). */
export async function funnelReport(env: { DB: D1; FUNNEL_EVENTS?: string }, from: string, to: string) {
  await ensure(env.DB);
  const r = (await env.DB.prepare("SELECT day, ev, COUNT(*) AS c FROM funnel_event WHERE day>=? AND day<=? GROUP BY day, ev ORDER BY day").bind(from, to).all<{ day: string; ev: string; c: number }>()).results ?? [];
  const total = new Map<string, number>(), days = new Map<string, Map<string, number>>(), weeks = new Map<string, Map<string, number>>();
  const add = (m: Map<string, Map<string, number>>, k: string, ev: string, c: number) => { const x = m.get(k) ?? new Map<string, number>(); x.set(ev, (x.get(ev) ?? 0) + c); m.set(k, x); };
  for (const x of r) { total.set(x.ev, (total.get(x.ev) ?? 0) + x.c); add(days, x.day, x.ev, x.c); add(weeks, weekOf(x.day), x.ev, x.c); }
  const list = (m: Map<string, Map<string, number>>) => [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([period, c]) => ({ period, rows: rowsOf(c) }));
  return {
    enabled: funnelOn(env), from, to, total: rowsOf(total), weeks: list(weeks), days: list(days),
    note: "Page steps count page visits; game steps count games. Each step is counted once per visit or once per game. Nothing in this report names a person. " + (funnelOn(env) ? "" : "Counting is switched off: this shows what was kept earlier."),
  };
}
export function funnelCsv(rep: Awaited<ReturnType<typeof funnelReport>>): string {
  const lines = ["period,period_start,step,count,percent_of_previous,percent_of_first"];
  const add = (kind: string, period: string, rows: FunnelRow[]) => { for (const x of rows) lines.push([kind, period, x.event, x.count, x.ofPrevious ?? "", x.ofFirst ?? ""].join(",")); };
  add("total", rep.from + ".." + rep.to, rep.total); for (const w of rep.weeks) add("week", w.period, w.rows); for (const d of rep.days) add("day", d.period, d.rows);
  return lines.join("\n") + "\n";
}
/** `from`/`to` query values, default the last 30 days. */
export function funnelRange(sp: URLSearchParams, now: number): { from: string; to: string } {
  const ok = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null);
  return { from: ok(sp.get("from")) ?? dayOf(now - 29 * 86_400_000), to: ok(sp.get("to")) ?? dayOf(now) };
}
