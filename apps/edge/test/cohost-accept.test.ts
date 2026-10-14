// K5 for a Co-host: the role box is ticked once, on the Co-host's first open, and the SERVER enforces it. Until it is ticked, the Co-host's key opens the small game header and nothing else;
// a missing, partial or out-of-date tick is refused and nothing is recorded; the acceptance is recorded under the key (hashed), with the Terms version and a hash of the wording; the AI link cannot tick it.
// These tests use the REAL handle (cohost-accepted.ts is the wrapper the older tests use so they do not repeat the tick).
import { beforeEach, describe, expect, test } from "bun:test";
import { handle, type Env } from "../src/worker";
import { TERMS_VERSION } from "../src/brand";
import { TICKS, withDevice } from "./device";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const FAR_START = Math.floor(((T + 2 * 86_400_000) / 1000 - 1692803367) / 3) + 1;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"]; let ip = 0;
const call = (method: string, path: string, body?: unknown, key?: string, extra: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...(key ? { "x-organizer": key } : {}), ...extra }, body: withDevice(method, path, body) }), env, T);
const j = async (r: Response) => (await r.json()) as any;
const sql = (q: string, ...a: unknown[]) => raw.query(q).all(...(a as any[])) as any[];
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: "https://snl.test", DATA_KEY: "k", PHONE_SALT: "s" } as unknown as Env; ip = 0; });

async function team() {
  const master = (await j(await handle(new Request("http://x/api/start", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `9.9.9.${++ip}` }, body: JSON.stringify({ consent: TICKS, email: "boss@acme.com" }) }), env, T))).token as string;
  expect((await call("POST", "/api/z", { id: "CO-1", startRound: FAR_START, callSeconds: 20, cap: 300 }, master)).status).toBe(200);
  const cohost = (await j(await call("POST", "/api/org/cohost", { label: "Ravi", phone: "9876500001", e: "CO-1" }, master))).cohostKey as string;
  const cohost2 = (await j(await call("POST", "/api/org/cohost", { label: "Meera", phone: "9876500002", e: "CO-1" }, master))).cohostKey as string;
  return { master, cohost, cohost2 };
}
const tick = (v = TERMS_VERSION, boxes = ["A"]) => ({ consent: { v, boxes } });

describe("K5: a Co-host has to accept the role", () => {
  test("before accepting, the header says so (roleAccepted:false) and every other address answers consent-required with the box to show; nothing else works", async () => {
    const t = await team();
    const head = await j(await call("GET", "/api/z/CO-1/cohost", undefined, t.cohost)); expect(head.roleAccepted).toBe(false); expect(head.name).toBeTruthy();
    expect((await call("GET", "/api/whoami", undefined, t.cohost)).status).toBe(200);
    for (const [m, p, b] of [["GET", "/api/z/CO-1/people"], ["POST", "/api/z/CO-1/people", { people: [{ name: "Asha", phone: "9811122233" }] }], ["GET", "/api/z/CO-1/waiting"], ["POST", "/api/z/CO-1/paylink", {}], ["GET", "/api/z/CO-1/summary"], ["POST", "/api/checkout", { eid: "CO-1" }]] as const) {
      const r = await call(m, p, b, t.cohost); const body = await j(r);
      expect([m, p, r.status, body.code, body.kind]).toEqual([m, p, 400, "consent-required", "K5"]);
      expect(body.consent.boxes.map((x: any) => x.id)).toEqual(["A"]); expect(body.consent.boxes[0].text).toMatch(/I follow the Terms/);
    }
  });
  test("a missing, empty, partial or out-of-date tick is refused and records nothing; a proper tick is accepted once and the key then works", async () => {
    const t = await team();
    for (const b of [{}, { consent: null }, { consent: { v: TERMS_VERSION, boxes: [] } }, { consent: { v: "2020-01-01", boxes: ["A"] } }, { consent: { boxes: ["A"] } }]) {
      const r = await handle(new Request("http://x/api/org/role/accept", { method: "POST", headers: { "content-type": "application/json", "x-organizer": t.cohost }, body: JSON.stringify(b) }), env, T);
      expect([JSON.stringify(b), r.status, (await j(r)).code]).toEqual([JSON.stringify(b), 400, "consent-required"]);
    }
    expect(sql("SELECT COUNT(*) c FROM consent_log WHERE kind='K5'")[0].c).toBe(0);
    const ok = await call("POST", "/api/org/role/accept", tick(), t.cohost); expect(ok.status).toBe(200); expect(await j(ok)).toEqual({ ok: true, version: TERMS_VERSION });
    const rows = sql("SELECT subject, kind, ref, version, boxes, text_hash FROM consent_log WHERE kind='K5'");
    expect(rows.length).toBe(1); expect(rows[0].subject).toMatch(/^c:[0-9a-f]{16}$/); expect(rows[0].subject).not.toContain(t.cohost); expect(rows[0].version).toBe(TERMS_VERSION); expect(rows[0].boxes).toBe('["A"]'); expect(rows[0].ref).toBe("CO-1"); expect(rows[0].text_hash).toMatch(/^[0-9a-f]{64}$/);
    expect((await j(await call("GET", "/api/z/CO-1/cohost", undefined, t.cohost))).roleAccepted).toBe(true);
    expect((await call("GET", "/api/z/CO-1/people", undefined, t.cohost)).status).toBe(200); // the Co-host's own list now opens
    expect((await call("POST", "/api/z/CO-1/paylink", {}, t.cohost)).status).not.toBe(400);
    expect((await call("GET", "/api/z/CO-1/summary", undefined, t.cohost)).status).toBe(403); // and it is still only a Co-host: no settings, no summary
    expect((await call("POST", "/api/org/role/accept", tick(), t.cohost)).status).toBe(200); expect(sql("SELECT COUNT(*) c FROM consent_log WHERE kind='K5'")[0].c).toBe(1); // twice is stored once
  });
  test("each Co-host key accepts for itself: one key's tick does not open another's", async () => {
    const t = await team();
    expect((await call("POST", "/api/org/role/accept", tick(), t.cohost)).status).toBe(200);
    expect((await call("GET", "/api/z/CO-1/people", undefined, t.cohost)).status).toBe(200);
    const r = await call("GET", "/api/z/CO-1/people", undefined, t.cohost2); expect(r.status).toBe(400); expect((await j(r)).code).toBe("consent-required");
    expect((await j(await call("GET", "/api/z/CO-1/cohost", undefined, t.cohost2))).roleAccepted).toBe(false);
  });
  test("a changed Terms version asks again: an acceptance of an old version does not count", async () => {
    const t = await team();
    expect((await call("POST", "/api/org/role/accept", tick(), t.cohost)).status).toBe(200);
    raw.run("UPDATE consent_log SET version='2020-01-01' WHERE kind='K5'");
    const r = await call("GET", "/api/z/CO-1/people", undefined, t.cohost); expect(r.status).toBe(400); expect((await j(r)).code).toBe("consent-required");
    expect((await j(await call("GET", "/api/z/CO-1/cohost", undefined, t.cohost))).roleAccepted).toBe(false);
  });
  test("the Organizer, a Host and the AI key are not asked for this box and cannot tick it for a Co-host", async () => {
    const t = await team();
    expect((await call("GET", "/api/z/CO-1/summary", undefined, t.master)).status).toBe(200);
    const ai = (await j(await call("POST", "/api/org/ai", {}, t.master))).aiKey as string; const asAi = await call("POST", "/api/org/role/accept", tick(), ai); expect(asAi.status).not.toBe(200);
    const asMaster = await call("POST", "/api/org/role/accept", tick(), t.master); expect(asMaster.status).not.toBe(200);
    expect(sql("SELECT COUNT(*) c FROM consent_log WHERE kind='K5'")[0].c).toBe(0);
    const stranger = await call("POST", "/api/org/role/accept", tick()); expect(stranger.status).not.toBe(200);
  });
});
