// TEST_HANDOFF Milestone 2, Email: the places an address is read, driven through the real routes: organizer e-mail-code sign-in, Host setup ("different email" check), Refer & earn enrolment.
// Every spelling of one address (case, full-width at-sign, spaces round the ends) is ONE person; another address is another person.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";
import { withDevice, TICKS } from "./device";

const T = Date.UTC(2026, 9, 8, 10, 0, 0);
const FAR_START = Math.floor(((T + 2 * 86_400_000) / 1000 - 1692803367) / 3) + 1;
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"]; let ip = 0; const realFetch = globalThis.fetch;
const call = (method: string, path: string, body?: unknown, key?: string, now = T, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": `4.4.${Math.floor(++ip / 250)}.${(ip % 250) + 1}`, ...(key ? { "x-organizer": key } : {}), ...headers }, body: withDevice(method, path, body) }), env as Env, now);
const j = async (r: Response) => (await r.json().catch(() => ({}))) as any;
beforeEach(() => { const d = makeD1({ strictHosts: true }); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "http://x", TEST_MODE: "1" } as PayEnv; (globalThis as any).fetch = async () => new Response("{}", { status: 404 }); });
afterEach(() => { globalThis.fetch = realFetch; try { raw.close(); } catch { /* closed */ } });

const SPELLINGS = ["demo5@demo-test.invalid", "DEMO5@DEMO-TEST.INVALID", "Demo5@Demo-Test.Invalid", "demo5＠demo-test.invalid", " DEMO5＠Demo-Test.invalid  ", "dEmO5@dEmO-tEsT.iNvAlId"];

describe("organizer e-mail-code sign-in: any spelling asks for the code and any spelling confirms it", () => {
  test("one account; the code asked for with one spelling is accepted with another; a different address is refused", async () => {
    const st = await j(await call("POST", "/api/start", { email: SPELLINGS[0], consent: TICKS })); expect(st.token).toMatch(/^cbk_/);
    for (const [i, ask] of SPELLINGS.entries()) {
      const a = await j(await call("POST", "/api/auth/email", { email: ask })); expect([ask, a.ok]).toEqual([ask, true]); expect(String(a.devCode ?? "")).toMatch(/^\d{6}$/);
      const verifyWith = SPELLINGS[(i + 1) % SPELLINGS.length]!; const v = await call("POST", "/api/auth/verify", { email: verifyWith, code: a.devCode, consent: TICKS }); const b = await j(v);
      expect([ask, verifyWith, v.status, typeof b.token]).toEqual([ask, verifyWith, 200, "string"]);
    }
    expect(raw.prepare("SELECT COUNT(*) c FROM organizer_email").get()).toEqual({ c: 1 });
    const a = await j(await call("POST", "/api/auth/email", { email: SPELLINGS[0] })); const wrong = await call("POST", "/api/auth/verify", { email: "demo6@demo-test.invalid", code: a.devCode, consent: TICKS }); expect(wrong.status).toBe(400);
  });
});

describe("Host setup: the address on file and the address typed are compared as one address", () => {
  async function host() {
    const st = await j(await call("POST", "/api/start", { email: "boss@acme.com", consent: TICKS }));
    await call("POST", "/api/z", { id: "HOST-1", startRound: FAR_START, callSeconds: 20, cap: 100 }, st.token);
    const h = await j(await call("POST", "/api/org/host", { label: "Priya", email: "Priya@Acme.com" }, st.token)); expect(h.ok).toBe(true);
    return h.hostKey as string;
  }
  test("the link made for Priya@Acme.com: every spelling of that address is accepted and gets a code; another address gets 'email-mismatch' (409) and the masked address on file", async () => {
    const key = await host();
    for (const typed of ["priya@acme.com", "PRIYA@ACME.COM", "Priya＠Acme.com", "  priya@acme.com "]) { const r = await call("POST", "/api/host/setup/email", { email: typed }, key); const b = await j(r); expect([typed, r.status, String(b.devCode ?? "").length]).toEqual([typed, 200, 6]); }
    const other = await call("POST", "/api/host/setup/email", { email: "someone.else@acme.com" }, key); const ob = await j(other);
    expect([other.status, ob.code, ob.error]).toEqual([409, "email-mismatch", "This link is for p***@acme.com"]);
  });
  test("the code asked for with one spelling confirms the address (then the Host is a verified person)", async () => {
    const key = await host(); const s = await j(await call("POST", "/api/host/setup/email", { email: "PRIYA＠acme.com" }, key));
    const v = await call("POST", "/api/host/setup/email/verify", { code: s.devCode }, key); expect(v.status).toBe(200);
    expect(raw.prepare("SELECT COUNT(*) c FROM host_state WHERE verified_ms IS NOT NULL").get()).toEqual({ c: 1 });
  });
});

describe("Refer & earn enrolment: one address is one partner", () => {
  const enroll = (phone: string, email: string) => call("POST", "/api/partner/enroll", { phone, email, name: "Asha", consent: true });
  test("the same address in another spelling, with another mobile number, is told apart from a new person only by the e-mail it gets: no second partner, no code on screen", async () => {
    const a = await j(await enroll("9811122233", "asha@partner.example")); expect(String(a.devCode ?? "")).toMatch(/^\d{6}$/);
    const v = await call("POST", "/api/partner/enroll/verify", { email: "ASHA＠Partner.Example", code: a.devCode }); expect(v.status).toBe(200);
    expect(raw.prepare("SELECT COUNT(*) c FROM partner").get()).toEqual({ c: 1 });
    for (const [i, again] of ["ASHA@PARTNER.EXAMPLE", "asha＠partner.example", " Asha@Partner.example "].entries()) {
      const r = await j(await enroll("900000000" + (i + 1), again)); expect([again, r.devCode]).toEqual([again, undefined]);
    }
    expect(raw.prepare("SELECT COUNT(*) c FROM partner").get()).toEqual({ c: 1 });
    const fresh = await j(await enroll("9000000009", "rita@partner.example")); expect(String(fresh.devCode ?? "")).toMatch(/^\d{6}$/); // a different address is a new person
  });
});
