// Test stand-in for Cloudflare D1, backed by bun:sqlite. Same prepare/bind/run/all/first/batch shape.
import { Database } from "bun:sqlite";
import { SCHEMA, type D1, type D1Stmt } from "../src/worker";

/**
 * `strictHosts: true` is the real rule (a new Host must confirm an e-mail and add a mobile number before the console works; apps/edge/test/host-setup.test.ts).
 * By default a trigger finishes that setup the moment a Host is created, so the older tests (roles, people, cancel...) can use a Host key straight away.
 */
export function makeD1(opts: { strictHosts?: boolean } = {}): { db: D1; raw: Database } {
  const raw = new Database(":memory:");
  for (const s of SCHEMA) raw.run(s);
  if (!opts.strictHosts) raw.run("CREATE TRIGGER IF NOT EXISTS test_hosts_ready AFTER INSERT ON host_state BEGIN UPDATE host_state SET verified_ms=1, mobile_ok=1 WHERE host_id=NEW.host_id; END");
  const runNow = (sql: string, vals: unknown[]) => { const r = raw.query(sql).run(...(vals as any[])); return { meta: { changes: r.changes } }; };
  const stmt = (sql: string, vals: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    run: async () => runNow(sql, vals),
    sync: () => runNow(sql, vals),
    all: async () => ({ results: raw.query(sql).all(...(vals as any[])) as any[] }),
    first: async () => (raw.query(sql).get(...(vals as any[])) as any) ?? null,
  }) as D1Stmt;
  return { db: { prepare: (s) => stmt(s), batch: async (xs) => { // like D1: the statements run in order as ONE transaction, and if one fails none of them stays
      raw.run("BEGIN");
      try { const out = xs.map((x) => (x as any).sync()); raw.run("COMMIT"); return out; } catch (e) { raw.run("ROLLBACK"); throw e; }
    } }, raw };
}
