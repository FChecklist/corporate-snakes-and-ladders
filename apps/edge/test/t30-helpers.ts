// Test author helpers (tests/snakes-2026-10-30). Test-only: nothing here is imported by product code.
// A small world: the real Worker (handle), an in-memory SQLite stand-in for D1, one organizer, one published game.
import { expect } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./cohost-accepted";
import { withDevice, TICKS } from "./device";
export { TICKS };
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";

export const T = Date.UTC(2026, 9, 1, 10, 0, 0);
export const GEN = 1692803367;
export const roundAt = (ms: number) => Math.floor((ms / 1000 - GEN) / 3) + 1;
export const roundMs = (r: number) => (GEN + (r - 1) * 3) * 1000;
export const START = roundAt(T) + 1200; // one hour after T
/** The instant the employee ID cleaner switches on in product code is year 2100; a game row whose created_ms is at or after it reads IDs the new way. */
export const NEW_ERA_MS = 4102444800000 + 1;
export const OLD_ERA_MS = T;

export const mob = (i: number) => "9" + String(100000000 + i);
export const dev = (i: number) => (String(i).padStart(2, "0") + "b".repeat(32)).slice(0, 32);

export interface World { env: PayEnv; raw: ReturnType<typeof makeD1>["raw"]; ip: number; realFetch: typeof fetch }
export function newWorld(): World {
  const d = makeD1();
  const w: World = { env: { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "10000000", PUBLIC_ORIGIN: "https://snakes.test", PHONE_SALT: "salt", DATA_KEY: "dk" } as unknown as PayEnv, raw: d.raw, ip: 0, realFetch: globalThis.fetch };
  (globalThis as any).fetch = async () => new Response("{}", { status: 404 });
  return w;
}
export function closeWorld(w: World) { globalThis.fetch = w.realFetch; try { w.raw.close(); } catch { /* already closed */ } }

export const api = (w: World, method: string, path: string, body?: unknown, key?: string, now = T, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...(key ? { "x-organizer": key } : {}), ...headers }, body: withDevice(method, path, body) }), w.env as Env, now);
export const json = async (r: Response) => (await r.json().catch(() => ({}))) as any;
export const rows = (w: World, sql: string, ...v: unknown[]) => w.raw.prepare(sql).all(...(v as any[])) as any[];
export const one = (w: World, sql: string, ...v: unknown[]) => w.raw.prepare(sql).get(...(v as any[])) as any;

export async function startOrganizer(w: World, email?: string) {
  const n = ++w.ip, mail = email ?? `demo${n}@demo-test.invalid`;
  const r = await handle(new Request("http://x/api/start", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `7.7.${Math.floor(n / 250)}.${(n % 250) + 1}` }, body: JSON.stringify({ consent: TICKS, email: mail }) }), w.env as Env, T);
  const b = await json(r); expect(r.status).toBe(200);
  return { key: b.token as string, ai: b.aiKey as string, email: mail };
}

/** A published game (free: cap 100 is fine for the people routes) with the chosen verification mode. `era` = "new" gives the game row a created_ms after the cleaner's switch-on instant. */
export async function setupGame(w: World, opts: { id?: string; verify?: string; employeesOnly?: boolean; era?: "old" | "new"; paid?: boolean; closed?: boolean; cap?: number; callSeconds?: number } = {}) {
  const o = await startOrganizer(w), id = opts.id ?? "T30-1";
  expect((await api(w, "POST", "/api/z", { id, startRound: START, callSeconds: opts.callSeconds ?? 20, cap: opts.cap ?? 100, ...(opts.closed ? { whoCanJoin: "list" } : {}) }, o.key)).status).toBe(200);
  expect((await api(w, "POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.key)).status).toBe(200);
  const body = { ...(opts.verify ? { verify: opts.verify } : {}), ...(opts.employeesOnly !== undefined ? { employeesOnly: opts.employeesOnly } : {}) };
  if (Object.keys(body).length) expect((await api(w, "PATCH", `/api/z/${id}/settings`, body, o.key)).status).toBe(200);
  w.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(opts.era === "new" ? NEW_ERA_MS : OLD_ERA_MS, id);
  if (opts.paid) w.raw.prepare("UPDATE engagement SET pack=? WHERE id=?").run(opts.cap ?? 100, id); // paid (the same stand-in the other tests use)
  return { ...o, id };
}
export const addPeople = (w: World, key: string, id: string, people: unknown[]) => api(w, "POST", `/api/z/${id}/people`, { people }, key);
export const joinGame = (w: World, id: string, body: Record<string, unknown>, now = T) => api(w, "POST", `/api/z/${id}/join`, body, undefined, now);
export const who = (w: World, id: string, empId: string) => api(w, "POST", `/api/z/${id}/who`, { empId, consent: TICKS }, undefined, T);
