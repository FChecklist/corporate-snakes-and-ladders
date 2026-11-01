// The free demo game (owner order 1 Nov 2026): behind DEMO_GAME, 10 people, no payment row, no bought pack, labelled Demo, 3 a day per organizer and per network address.
import { beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 10, 1, 10, 0, 0), GEN = 1692803367;
const START = Math.floor((T / 1000 - GEN) / 3) + 1 + 1200;
let env: Env; let raw: any;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, T);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => String(i).padStart(2, "0").repeat(16);
const mk = (extra: Record<string, unknown> = {}) => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://snakesladders.test", PHONE_SALT: "salt", DATA_KEY: "k", ...extra } as any; };
async function organizer(email: string, ip: string) { const s = await j(await call("POST", "/api/start", { email }, { "cf-connecting-ip": ip })); return { "x-organizer": s.token as string, "cf-connecting-ip": ip }; }
const demoBody = (id: string, extra: Record<string, unknown> = {}) => ({ id, startRound: START, callSeconds: 10, cap: 500, demo: true, ...extra });
const count = (sql: string) => (raw.query(sql).get() as any).c as number;

describe("free demo game", () => {
  beforeEach(() => mk({ DEMO_GAME: "on" }));

  test("status is yes only while the flag is on", async () => {
    expect((await j(await call("GET", "/api/demo/status"))).enabled).toBe(true);
    mk(); expect((await j(await call("GET", "/api/demo/status"))).enabled).toBe(false);
  });
  test("flag off: a demo cannot be made", async () => {
    mk(); const h = await organizer("a1@acme.com", "10.0.0.1");
    expect((await call("POST", "/api/z", demoBody("DEMO-OFF"), h)).status).toBe(404);
  });
  test("made at 10 people whatever was asked, named Demo, never a payment or a bought pack", async () => {
    const h = await organizer("a2@acme.com", "10.0.0.2");
    const r = await call("POST", "/api/z", demoBody("DEMO-ONE", { name: "Quarterly kickoff" }), h); expect(r.status).toBe(200); const b = await j(r);
    expect(b.demo).toBe(true); expect(b.draft).toBe(false);
    const info = await j(await call("GET", "/api/z/DEMO-ONE/info", undefined, h));
    expect(info.cap).toBe(10); expect(info.demo).toBe(true); expect(info.name).toBe("Demo: Quarterly kickoff");
    expect(count("SELECT COUNT(*) AS c FROM payment")).toBe(0); expect(count("SELECT COUNT(*) AS c FROM entitlement")).toBe(0);
    expect((await call("POST", "/api/z/DEMO-ONE/publish", { email: "a2@acme.com", phone: "98765 43210" }, h)).status).toBe(200);
    expect(count("SELECT COUNT(*) AS c FROM payment")).toBe(0);
  });
  test("ten join, the eleventh is told the game is full", async () => {
    const h = await organizer("a3@acme.com", "10.0.0.3");
    await call("POST", "/api/z", demoBody("DEMO-TEN"), h); await call("POST", "/api/z/DEMO-TEN/publish", { email: "a3@acme.com", phone: "98765 43210" }, h);
    for (let i = 1; i <= 10; i++) expect((await call("POST", "/api/z/DEMO-TEN/join", { name: "P" + i, device: dev(i) }, { "cf-connecting-ip": `10.2.0.${i}` })).status).toBe(200);
    expect((await call("POST", "/api/z/DEMO-TEN/join", { name: "Late", device: dev(11) }, { "cf-connecting-ip": "10.2.0.11" })).status).not.toBe(200);
  });
  test("a real game made the usual way is not a demo", async () => {
    const h = await organizer("a4@acme.com", "10.0.0.4");
    await call("POST", "/api/z", { id: "REAL-ONE", startRound: START, callSeconds: 10, cap: 50 }, h);
    const info = await j(await call("GET", "/api/z/REAL-ONE/info", undefined, h)); expect(info.demo).toBeUndefined(); expect(info.draft).toBe(true);
  });
  test("at most 3 a day per organizer; the 4th is refused with a plain message", async () => {
    const h = await organizer("a5@acme.com", "10.0.0.5");
    for (let i = 1; i <= 3; i++) expect((await call("POST", "/api/z", demoBody("DEMO-O" + i), h)).status).toBe(200);
    const r = await call("POST", "/api/z", demoBody("DEMO-O4"), h); expect(r.status).toBe(429); const b = await j(r); expect(b.code).toBe("demo-limit"); expect(b.error).toMatch(/3 demo games a day/);
  });
  test("at most 3 a day per network address, even from different accounts", async () => {
    const same = "10.0.9.9";
    for (let i = 1; i <= 3; i++) { const h = await organizer(`ip${i}@acme.com`, same); expect((await call("POST", "/api/z", demoBody("DEMO-I" + i), h)).status).toBe(200); }
    const h4 = await organizer("ip4@acme.com", same); expect((await call("POST", "/api/z", demoBody("DEMO-I4"), h4)).status).toBe(429);
  });
  test("no sign-in, no demo", async () => {
    expect([401, 403]).toContain((await call("POST", "/api/z", demoBody("DEMO-NOPE"))).status);
  });
});
