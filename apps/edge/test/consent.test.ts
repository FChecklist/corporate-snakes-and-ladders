// The agreement (no tick-boxes since 1 Nov 2026): the server must refuse every request that comes without the CURRENT version and every point of the step, store every
// acceptance (consent_log: version, sha256 of the one notice line shown, time), ask again when the version changes, and keep the pages and the Terms page on the same version.
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import { TERMS_VERSION } from "../src/brand";
import { boxesFor, checkConsent, consentInfo, hasConsent, recordConsent, CONSENT_KINDS, textHash, NOTICE_TEXT, STALE_PAGE_MESSAGE } from "../src/consent";
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"];
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const rd = (f: string) => readFileSync(new URL("../../web/public/" + f, import.meta.url), "utf8");
const FIX = JSON.parse(readFileSync(new URL("./fixtures/CONSENT_TEXT.json", import.meta.url), "utf8")) as Record<string, any>;
type Row = { id: string; subject: string; kind: string; ref: string | null; version: string; boxes: string; text_hash: string; at_ms: number };
const rows = (kind?: string): Row[] => (kind ? raw.prepare("SELECT * FROM consent_log WHERE kind=? ORDER BY at_ms, id").all(kind) : raw.prepare("SELECT * FROM consent_log ORDER BY at_ms, id").all()) as Row[];
const START = Math.floor((T / 1000 - 1692803367) / 3) + 1200;
const OLD = "2026-01-01";
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: "https://snakes.test", DATA_KEY: "k", TEST_MODE: "1", JOIN_PER_IP_DAY: "100000", JOIN_PER_IP_MINUTE: "100000" } as any; });
async function organizerWithDraft(id = "CONS-1") {
  const o = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }));
  await call("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 100 }, { "x-organizer": o.token }, T + 10);
  return o.token as string;
}
const pubBody = { email: "boss@acme.com", phone: "98765 43210" };
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const NOTICE = "By continuing, you agree to the Terms and Conditions, Privacy and Data, and Game rules."; // the one line, written out here on purpose: the stored proof must not move by accident
const expectedHash = (_kind: string) => sha(NOTICE);
const REFUSED = (kind: string) => ({ error: "This page is out of date. Please reload it and try again. Sorry for the trouble.", code: "consent-required", kind, version: TERMS_VERSION });

describe("test 5: the box wording is the agreed wording, and the version is one value", () => {
  test("every box, word for word, from the committed copy of the wording file", () => {
    expect(FIX.version).toBe(TERMS_VERSION);
    for (const k of Object.keys(FIX).filter((x) => /^K\d$/.test(x))) {
      if (!CONSENT_KINDS.includes(k as any)) continue;
      expect(boxesFor(k as any).map((b) => [b.id, b.text])).toEqual(Object.entries(FIX[k]));
    }
    for (const k of ["K1", "K2", "K3", "K4", "K5", "K6", "K9"]) expect(CONSENT_KINDS.map(String)).toContain(k);
    expect(JSON.parse(readFileSync(new URL("../src/consent-text.json", import.meta.url), "utf8"))).toEqual(FIX);
  });
  test("a page reads the wording and version from the server (GET /api/consent/<point>) and they are the same", async () => {
    for (const k of CONSENT_KINDS) { const r = await j(await call("GET", `/api/consent/${k}`)); expect(r.version).toBe(TERMS_VERSION); expect(r.boxes.map((b: any) => [b.id, b.text])).toEqual(Object.entries(FIX[k])); }
    expect((await call("GET", "/api/consent/K8")).status).not.toBe(200);
  });
  test("the Terms page shows the same version and carries the one common document (it names every game, by design)", () => {
    const t = rd("terms.html");
    expect(t).toContain(`Version ${TERMS_VERSION}`);
    for (const must of ["Terms, Policies and Game Rules", "Players pay nothing", "IT Services does not collect, hold or give any money or prize", "How these terms are agreed", "Grievance Officer", "Law and disputes"]) expect(t).toContain(must);
  });
  test("the notice line and the stale-page message are the agreed words, and the proof stored is the hash of that one line", async () => {
    expect(NOTICE_TEXT).toBe(NOTICE);
    expect(STALE_PAGE_MESSAGE).toBe(REFUSED("K1").error);
    for (const k of CONSENT_KINDS) expect(await textHash(k)).toBe(sha(NOTICE));
  });
  test("the page code draws one small line with three links (new tab), nothing to tick, never pre-ticked, and holds no button back for it", () => {
    const c = rd("consent.js");
    expect(c).not.toContain('type="checkbox"'); expect(c).not.toContain("<label"); expect(c).not.toContain("<input"); expect(c).not.toMatch(/\bchecked="checked"|checked>/);
    for (const anchor of ["#terms", "#privacy", "#game-rules"]) expect(c).toContain(anchor);
    expect(c).toContain('target="_blank" rel="noopener"'); expect(c).toContain(NOTICE);
    expect(c).toContain('C.version = "' + TERMS_VERSION + '"');
  });
  test("running consent.js: both ways of calling it give the same line and the same request body; the points of every kind match the server", () => {
    const nodes: Record<string, any> = {}; const doc: any = { getElementById: (id: string) => nodes[id] || null, createElement: () => ({}), head: { appendChild: (n: any) => { if (n.id) nodes[n.id] = n; } } };
    const win: any = {}; new Function("window", "document", rd("consent.js"))(win, doc);
    const C = win.CBConsent;
    expect(C.version).toBe(TERMS_VERSION); expect(C.notice).toBe(NOTICE);
    for (const k of CONSENT_KINDS) expect(Object.keys(C.text[k]), k).toEqual(boxesFor(k).map((b) => b.id));
    const info = consentInfo("K4");
    for (const h of [C.html("K4"), C.html(info, {})]) {
      expect(h).toContain("By continuing, you agree to the"); expect(h).toContain("#terms"); expect(h).toContain("#privacy"); expect(h).toContain("#game-rules"); expect(h).not.toContain("<input");
    }
    expect(C.payload(info, {})).toEqual({ v: TERMS_VERSION, boxes: ["A", "B"], notice: true });
    expect(C.payload({}, "K4")).toEqual({ v: TERMS_VERSION, boxes: ["A", "B"], notice: true });
    expect(C.payload({}, "K3")).toEqual({ v: TERMS_VERSION, boxes: ["A"], notice: true });
    expect(C.payload(null, {})).toBeNull();                       // the wording has not loaded yet: nothing to send
    expect(C.ready(info, {})).toBe(true); expect(C.all({}, "K2")).toBe(true);
    const btn: any = { disabled: true, dataset: {}, setAttribute() {} };
    C.bind({}, info, {}, btn); expect(btn.disabled).toBe(false);   // no box holds the button
    const held: any = { disabled: false, dataset: { hold: "1" }, setAttribute() {} };
    C.bind({}, info, {}, held); expect(held.disabled).toBe(true);  // a button held for another reason stays held
    for (const k of ["K1", "K2", "K3", "K4", "K5", "K6"] as const) expect(checkConsent(k, C.payload({}, k)), k).toEqual({ ok: true }); // the server takes exactly what the page sends
  });
});

describe("tests 1-4 at K1: publish a game (two boxes)", () => {
  test("1+2 refused without a tick, with one box, with an old version; accepted with both", async () => {
    const tok = await organizerWithDraft(); const h = { "x-organizer": tok };
    for (const consent of [undefined, null, { v: TERMS_VERSION, boxes: ["A"] }, { v: TERMS_VERSION, boxes: ["B"] }, { v: OLD, boxes: ["A", "B"] }, { boxes: ["A", "B"] }, { v: TERMS_VERSION }]) {
      const r = await call("POST", "/api/z/CONS-1/publish", { ...pubBody, consent }, h, T + 100);
      expect(r.status).toBe(400);
      expect(await j(r)).toMatchObject(REFUSED("K1"));
    }
    expect(raw.prepare("SELECT 1 FROM kv WHERE k='pub/CONS-1'").get()).toBeFalsy();
    expect(rows("K1").length).toBe(0);
    const ok = await call("POST", "/api/z/CONS-1/publish", { ...pubBody, consent: { v: TERMS_VERSION, boxes: ["A", "B"] } }, h, T + 200);
    expect(ok.status).toBe(200); expect((await j(ok)).published).toBe(true);
    expect(raw.prepare("SELECT 1 FROM kv WHERE k='pub/CONS-1'").get()).toBeTruthy();
  });
  test("3 the row is re-read from the database: kind, ref, version, boxes, text hash, time", async () => {
    const tok = await organizerWithDraft(); const org = (raw.prepare("SELECT org FROM organizer_key WHERE kind='master'").get() as any).org;
    await call("POST", "/api/z/CONS-1/publish", pubBody, { "x-organizer": tok }, T + 777);
    const r = rows("K1");
    expect(r.length).toBe(1);
    expect(r[0]).toMatchObject({ kind: "K1", subject: org, ref: "CONS-1", version: TERMS_VERSION, boxes: '["A","B"]', text_hash: expectedHash("K1"), at_ms: T + 777 });
    expect(r[0]!.text_hash).toBe(await textHash("K1"));
  });
  test("4 when the version changes the next publish asks again (an acceptance of an older version does not count)", async () => {
    const tok = await organizerWithDraft(); const h = { "x-organizer": tok };
    await recordConsent(env.DB as any, "K1", "someone", "CONS-1", T);
    raw.prepare("UPDATE consent_log SET version=?").run(OLD);
    expect(await hasConsent(env.DB as any, "K1", "someone", "CONS-1")).toBe(false);
    const r = await call("POST", "/api/z/CONS-1/publish", { ...pubBody, consent: { v: OLD, boxes: ["A", "B"] } }, h, T + 5);
    expect(r.status).toBe(400); expect((await j(r)).code).toBe("consent-required");
    expect((await call("POST", "/api/z/CONS-1/publish", pubBody, h, T + 6)).status).toBe(200);
  });
});

describe("test 7: the log holds no address, device, phone number or account details", () => {
  test("consent_log has exactly these columns", () => {
    const cols = (raw.prepare("PRAGMA table_info(consent_log)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(["id", "subject", "kind", "ref", "version", "boxes", "text_hash", "at_ms"]);
    expect(cols.join(" ")).not.toMatch(/\bip\b|agent|\bua\b|phone|mobile|email|name|device/i);
  });
  test("a join stores no phone number, name or address in the log: the rows hold only an opaque player id", async () => {
    const tok = await organizerWithDraft("CONS-4"); await call("POST", "/api/z/CONS-4/publish", pubBody, { "x-organizer": tok }, T + 100);
    await call("POST", "/api/z/CONS-4/join", { phone: "98765 00011", name: "Rani" }, { "cf-connecting-ip": "9.9.9.9", "user-agent": "TestPhone/1" }, T + 250);
    expect(JSON.stringify(rows())).not.toMatch(/9\.9\.9\.9|TestPhone|9876500011|Rani/);
  });
});

describe("checkConsent (the one rule every route uses)", () => {
  test("nothing, a wrong shape, a missing box, an old version: all refused; every box and the current version: accepted", () => {
    for (const bad of [undefined, null, "yes", true, {}, { v: TERMS_VERSION }, { boxes: ["A", "B"] }, { v: TERMS_VERSION, boxes: [] }, { v: TERMS_VERSION, boxes: ["A"] }, { v: TERMS_VERSION, boxes: "AB" }, { v: OLD, boxes: ["A", "B"] }]) expect(checkConsent("K1", bad)).toMatchObject({ ok: false, status: 400, code: "consent-required", error: STALE_PAGE_MESSAGE });
    expect(checkConsent("K1", { v: TERMS_VERSION, boxes: ["A", "B"] })).toEqual({ ok: true });
    expect(checkConsent("K2", { v: TERMS_VERSION, boxes: ["A"] })).toEqual({ ok: true });
  });
});

describe("K2 first sign-in and account creation", () => {
  test("creating an account is refused without the tick, accepted with it, and stored for that organizer (the older acceptance record is kept too)", async () => {
    const no = await call("POST", "/api/start", { email: "new@acme.com", consent: undefined }, { "cf-connecting-ip": "2.2.2.2" });
    expect(no.status).toBe(400); expect(await j(no)).toMatchObject(REFUSED("K2"));
    expect(raw.prepare("SELECT COUNT(*) AS c FROM organizer_email").get()).toEqual({ c: 0 });
    expect((await call("POST", "/api/start", { email: "new@acme.com", consent: { v: OLD, boxes: ["A"] } }, { "cf-connecting-ip": "2.2.2.2" })).status).toBe(400);
    const ok = await call("POST", "/api/start", { email: "new@acme.com" }, { "cf-connecting-ip": "2.2.2.2" }, T + 50);
    expect(ok.status).toBe(200);
    const org = (raw.prepare("SELECT org FROM organizer_key WHERE kind='master'").get() as any).org;
    expect(rows("K2")).toMatchObject([{ kind: "K2", subject: org, ref: null, version: TERMS_VERSION, boxes: '["A"]', text_hash: expectedHash("K2"), at_ms: T + 50 }]);
    expect(raw.prepare("SELECT version FROM organizer_terms WHERE org=?").get(org)).toEqual({ version: TERMS_VERSION });
  });
  test("signing in by code or by the e-mailed link asks for no tick: continuing is the acceptance", async () => {
    await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" });
    const a = await j(await call("POST", "/api/auth/email", { email: "boss@acme.com" }, {}, T + 1000));
    expect((await call("POST", "/api/auth/verify", { email: "boss@acme.com", code: a.devCode, consent: undefined }, {}, T + 2000)).status).toBe(200);
    const b = await j(await call("POST", "/api/auth/email", { email: "boss@acme.com" }, {}, T + 3000));
    expect((await call("POST", "/api/auth/link", { token: b.devToken, consent: undefined }, {}, T + 4000)).status).toBe(200);
  });
});

describe("K3 before paying", () => {
  test("a checkout is refused without the Terms + Refund tick, before anything is created; accepted with it and stored", async () => {
    const tok = await organizerWithDraft();
    const body = { email: "boss@acme.com", name: "Boss", eid: "CONS-1", currency: "INR" };
    const before = (raw.prepare("SELECT COUNT(*) AS c FROM payment").get() as any).c;
    const r = await call("POST", "/api/checkout", { ...body, consent: undefined }, { "x-organizer": tok }, T + 300);
    expect(r.status).toBe(400); expect(await j(r)).toMatchObject(REFUSED("K3"));
    expect((raw.prepare("SELECT COUNT(*) AS c FROM payment").get() as any).c).toBe(before);
    expect((await call("POST", "/api/checkout", { ...body, consent: { v: OLD, boxes: ["A"] } }, { "x-organizer": tok }, T + 301)).status).toBe(400);
    const ok = await call("POST", "/api/checkout", body, { "x-organizer": tok }, T + 302);
    expect(ok.status).not.toBe(400);
    expect(rows("K3")).toMatchObject([{ kind: "K3", version: TERMS_VERSION, boxes: '["A"]', text_hash: expectedHash("K3"), at_ms: T + 302 }]);
  });
  test("the Payment Testing screen is also behind the tick", async () => {
    const r = await call("POST", "/api/payments/paytest", { email: "a@b.com", name: "Ann", consent: undefined });
    expect([400, 503]).toContain(r.status); if (r.status === 400) expect((await j(r)).code).toBe("consent-required");
  });
});

describe("K4 join a game: both boxes, before any name", () => {
  async function publishedGame() { const tok = await organizerWithDraft("CONS-4"); await call("POST", "/api/z/CONS-4/publish", pubBody, { "x-organizer": tok }, T + 100); return tok; }
  test("the server refuses a join without both ticks, with one tick or with an old version, and nothing is stored", async () => {
    await publishedGame();
    for (const consent of [undefined, { v: TERMS_VERSION, boxes: ["A"] }, { v: TERMS_VERSION, boxes: ["B"] }, { v: OLD, boxes: ["A", "B"] }]) {
      const r = await call("POST", "/api/z/CONS-4/join", { name: "Rani", device: "b".repeat(32), consent }, {}, T + 200);
      expect(r.status).toBe(400); expect(await j(r)).toMatchObject(REFUSED("K4"));
    }
    expect(raw.prepare("SELECT COUNT(*) AS c FROM participant WHERE eid='CONS-4'").get()).toEqual({ c: 0 });
    expect(rows("K4").length).toBe(0);
  });
  test("with both ticks the player joins; the acceptance is stored for that player and game and read back", async () => {
    await publishedGame();
    const r = await j(await call("POST", "/api/z/CONS-4/join", { name: "Rani", device: "b".repeat(32) }, {}, T + 250));
    expect(r.pid).toMatch(/^1x[0-9a-f]{12}$/);
    expect(rows("K4")).toMatchObject([{ kind: "K4", subject: r.pid, ref: "CONS-4", version: TERMS_VERSION, boxes: '["A","B"]', text_hash: expectedHash("K4"), at_ms: T + 250 }]);
    expect(FIX.K4.A).toContain("who invited me is recorded until then");
  });
  test("K4 adults only: box B says only that the person is 18 or older (no parent's-device alternative); box A says what is kept; the server needs both and the current version; the exact wording is hashed with the row", async () => {
    await publishedGame();
    const [a, b] = boxesFor("K4").map((x) => x.text); expect(b).toBe("I am 18 or older.");
    expect(boxesFor("K4").map((x) => x.text).join(" ")).not.toMatch(/parent|guardian|device with/i);
    for (const part of ["deleted within 24 hours", "who invited me is recorded until then", "kept for 365 days", "board numbers, without names", "We keep billing data for audit and tax reasons.", "Hindi on request"]) expect(a).toContain(part);
    expect(a).not.toMatch(/forever|for ever|permanent/i);
    const body = { name: "Maya", device: "d".repeat(32) };
    expect((await call("POST", "/api/z/CONS-4/join", { ...body, consent: { v: TERMS_VERSION, boxes: ["A"] } }, {}, T + 260)).status).toBe(400); // the age box is required by the server
    expect((await call("POST", "/api/z/CONS-4/join", { ...body, consent: { v: TERMS_VERSION, boxes: ["B"] } }, {}, T + 261)).status).toBe(400);
    expect((await call("POST", "/api/z/CONS-4/join", { ...body, consent: { v: "2026-10-14", boxes: ["A", "B"] } }, {}, T + 262)).status).toBe(400); // the old version no longer counts
    expect(TERMS_VERSION).toBe("2026-11-01");
    expect((await call("POST", "/api/z/CONS-4/join", body, {}, T + 263)).status).toBe(200); // withDevice ticks both boxes of the current version
    expect(rows("K4")[0]).toMatchObject({ boxes: '["A","B"]', version: TERMS_VERSION, text_hash: expectedHash("K4") });
  });
  test("the acceptance and the invite record are erased with the game's personal data in the 24-hour job (the organizer's stay)", async () => {
    await publishedGame();
    await call("POST", "/api/z/CONS-4/join", { name: "Rani", device: "b".repeat(32) }, {}, T + 250);
    await call("POST", "/api/z/CONS-4/join", { name: "Asha", device: "c".repeat(32) }, {}, T + 260);
    expect(rows("K4").length).toBe(2);
    const { erasePersonal } = await import("../src/lifecycle");
    await erasePersonal(env as any, "CONS-4", T + 3 * 86_400_000, "test");
    expect(rows("K4").length).toBe(0);
    expect(rows("K1").length).toBe(1);
    expect(raw.prepare("SELECT COUNT(*) AS c FROM seat WHERE eid='CONS-4'").get()).toEqual({ c: 0 });
  });
  test("the page draws the join boxes before the name field", () => {
    const z = rd("z.js"); expect(z).toMatch(/\.load\("K4"/); expect(z.indexOf('id="k4box"')).toBeGreaterThan(-1); expect(z.indexOf('id="k4box"')).toBeLessThan(z.indexOf('id="nm"')); expect(z).toContain(".bind(box, K4.info, K4.state, go)");
  });
});

describe("K5 host acceptance, K6 guest lists, K9", () => {
  test("K6 an invite list is refused without the tick, accepted with it, and stored for that game", async () => {
    const tok = await organizerWithDraft("CONS-6");
    const people = [{ name: "Asha", phone: "98765 11111" }];
    const no = await call("POST", "/api/z/CONS-6/roster", { people, consent: undefined }, { "x-organizer": tok }, T + 400);
    expect(no.status).toBe(400); expect(await j(no)).toMatchObject(REFUSED("K6"));
    expect(raw.prepare("SELECT COUNT(*) AS c FROM participant WHERE eid='CONS-6'").get()).toEqual({ c: 0 });
    expect((await call("POST", "/api/z/CONS-6/roster", { people }, { "x-organizer": tok }, T + 401)).status).toBe(200);
    expect(rows("K6")).toMatchObject([{ ref: "CONS-6", boxes: '["A"]', text_hash: expectedHash("K6"), version: TERMS_VERSION }]);
  });
  test("K5 a Host's first setup step is refused without the role box, accepted with it, and the acceptance is stored once", async () => {
    const tok = await organizerWithDraft("CONS-5");
    const add = await j(await call("POST", "/api/org/host", { mobile: "9876500009", label: "Priya", email: "priya@acme.com" }, { "x-organizer": tok }, T + 500));
    const hk = add.hostKey as string; expect(hk).toBeTruthy();
    const h = { "x-organizer": hk };
    const no = await call("POST", "/api/host/setup/accept", { consent: undefined }, h, T + 510);
    expect(no.status).toBe(400); expect(await j(no)).toMatchObject(REFUSED("K5"));
    expect((await call("POST", "/api/host/setup/accept", { consent: { v: OLD, boxes: ["A"] } }, h, T + 511)).status).toBe(400);
    expect(rows("K5").length).toBe(0);
    const ok = await call("POST", "/api/host/setup/accept", {}, h, T + 520);
    expect(ok.status).toBe(200);
    expect(rows("K5")).toMatchObject([{ kind: "K5", version: TERMS_VERSION, boxes: '["A"]', text_hash: expectedHash("K5"), at_ms: T + 520 }]);
    await call("POST", "/api/host/setup/accept", {}, h, T + 530);                                  // asking again stores nothing new
    expect(rows("K5").length).toBe(1);
  });
  test("K9: this product has no contact, grievance or data-request form that stores details (contact is a mail link); the box exists for a form if one is added", () => {
    expect(rd("contact.html")).not.toMatch(/<form/i);
    expect(consentInfo("K9").boxes.map((b) => b.text)).toEqual(["I agree that you may use my details to reply to this request."]);
  });
});

describe("no code path takes money from a participant", () => {
  test("the join code has no payment in it", () => {
    const worker = readFileSync(new URL("../src/worker.ts", import.meta.url), "utf8");
    const joinBlock = worker.slice(worker.indexOf('if (action === "join" && req.method === "POST")'), worker.indexOf('if (action === "seats" && req.method === "GET")'));
    expect(joinBlock).not.toMatch(/payment|razorpay|checkout|amount|price\(/i);
  });
  test("the pages a player sees contain no payment, card-number or checkout code", () => {
    for (const f of ["z.html", "z.js", "big.html", "big.js", "preview.html", "preview.js", "demo.html", "demo.js", "zgame.js"]) {
      let s = ""; try { s = rd(f); } catch { continue; }
      expect(s, f).not.toMatch(/razorpay|checkout\.js|\/api\/checkout|\/pay\.html|paylink|payments\//i);
    }
  });
  test("a join answer has no price, order or payment field, and the boxes say players pay nothing", async () => {
    const tok = await organizerWithDraft("CONS-1"); await call("POST", "/api/z/CONS-1/publish", pubBody, { "x-organizer": tok }, T + 100);
    const r = await j(await call("POST", "/api/z/CONS-1/join", { name: "Rani", device: "b".repeat(32) }, {}, T + 250));
    expect(Object.keys(r).filter((k) => /pay|price|amount|order|fee|cost/i.test(k))).toEqual([]);
    expect(boxesFor("K1")[1]!.text).toContain("players pay nothing to play");
    expect(rd("terms.html")).toContain("IT Services does not collect, hold or give any money or prize");
  });
});

describe("a Co-host who has not accepted the role cannot pay or use credit (found by the permissions scenario family: the payment routes ran before the K5 gate)", () => {
  test("checkout, proforma and credit are refused with consent-required until the K5 box is ticked", async () => {
    const key = await organizerWithDraft("CON-PAY"); const id = "CON-PAY";
    const co = (await j(await call("POST", "/api/org/cohost", { label: "Ravi", phone: "9876500001", e: id }, { "x-organizer": key }))).cohostKey as string;
    const coH = { "x-organizer": co };
    for (const [p, b] of [["/api/checkout", { eid: id, email: "x@acme.com", consent: { v: TERMS_VERSION, boxes: ["A", "B"] } }], ["/api/proforma", { eid: id }], ["/api/org/credit", {}], [`/api/z/${id}/pay-with-credit`, {}]] as const) {
      const r = await call("POST", p, b, coH); const x = await j(r);
      expect([p, r.status, x.code]).toEqual([p, 400, "consent-required"]);
      expect(x.kind).toBe("K5");
    }
    expect((await call("POST", "/api/org/role/accept", { consent: { v: TERMS_VERSION, boxes: ["A", "B"] } }, coH)).status).toBe(200);
    const after = await call("POST", "/api/checkout", { eid: id, email: "x@acme.com", consent: { v: TERMS_VERSION, boxes: ["A", "B"] } }, coH);
    expect((await j(after)).code).not.toBe("consent-required"); // after the tick the normal payment rules apply
  });
});
