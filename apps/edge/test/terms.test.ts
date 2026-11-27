// Terms, data-processing terms, sub-processors, partner terms, organizer guide: short pages in the site style; organizer acceptance without a tick box, stored with the organizer.
import { beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import { TERMS_VERSION } from "../src/brand";
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"];
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env as Env, now);
const j = async (r: Response) => (await r.json()) as any;
const rd = (f: string) => readFileSync(new URL("../../web/public/" + f, import.meta.url), "utf8");
const rows = () => raw.prepare("SELECT org, version, via, at_ms FROM organizer_terms ORDER BY at_ms, via").all() as { org: string; version: string; via: string; at_ms: number }[];
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: "https://bingo.test", DATA_KEY: "k", TEST_MODE: "1" }; });
const LINKS = ["/terms.html", "/dpa.html", "/organizer-guide.html"]; // the uniform footer (games-ops/footer/ufooter.py) links these three documents

describe("the document pages", () => {
  const DOCS: Record<string, string[]> = {
    "terms.html": ["Terms, Policies and Game Rules", "Version 2026-11-01", "IT Services by Rajat Agarwal", "Players pay nothing", "deleted within 24 hours after the game", "Credit instead of a refund", "Grievance Officer", "Digital Personal Data Protection Act, 2023"],
    "dpa.html": ["Companies that help run the service", 'href="/terms.html#processors"'], // only points to the one document
    "subprocessors.html": ["Companies that help run the service", 'href="/terms.html#processors"'],
    "partner-terms.html": ["independent partner", "No spam", "Tax may be deducted at source", "You are responsible for your own taxes", "No payment from the buyer, no commission"],
    "organizer-guide.html": ["Never ask for a fee", "Players are 18 or older", "INR 10,000", "tax deducted at source", "Check your state", "The game does not begin until it is paid for"],
  };
  for (const [f, needles] of Object.entries(DOCS)) test(`${f}: brand header and footer, title pattern, the right statements, no draft mark, no tick box, short lines`, () => {
    const h = rd(f);
    expect(h).toMatch(/<title>[^<]+ \| Corporate Snakes and Ladders<\/title>/); expect(h).toContain('class="legaltop"'); expect(h).toContain('<footer class="uf"'); expect(h).toContain('rel="icon"');
    for (const n of needles) expect(h).toContain(n);
    expect(h).not.toMatch(/DRAFT|lawyer review|type="checkbox"/i);
    expect(h).not.toMatch(/\bcompliant\b|certified by/i);
    for (const l of f === "terms.html" ? [] : h.match(/<li>[\s\S]*?<\/li>/g) ?? []) expect(l.replace(/<[^>]+>/g, "").split(/\s+/).length).toBeLessThanOrEqual(36); // 36: the owner's credit sentence ("A paid game cancelled before it starts stays with the organizer as credit ... lapses at the end of day 365.") is well under that
    for (const l of LINKS) expect(h).toContain(`href="${l}"`);
  });
  test("the home page and the legal page link the documents (footer; the older legal page points to the one document); the build ships them with headers; the sitemap lists them", () => {
    for (const f of ["index.html", "legal.html"]) for (const l of LINKS) expect(rd(f)).toContain(`href="${l}"`);
    expect(rd("legal.html")).toContain('href="/terms.html#terms"'); // the older legal page only points to the one document
    const b = readFileSync(new URL("../../../pages/build.mjs", import.meta.url), "utf8");
    for (const n of ["terms", "dpa", "subprocessors", "partner-terms", "organizer-guide"]) { expect(b).toContain(`"${n}.html"`); expect(b).toContain(`["/${n}", PLAINCSP`); if (!["dpa", "subprocessors"].includes(n)) expect(rd("sitemap.xml")).toContain(`/${n}.html`); } // the pages that only point to the one document are not in the sitemap
  });
});

describe("acceptance by continuing, no tick box", () => {
  test("signing up stores the terms version with the organizer; the version equals the date on the Terms page", async () => {
    expect(rd("terms.html")).toContain(`Version ${TERMS_VERSION}`);
    const o = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }));
    const r = rows(); expect(r.length).toBe(1); expect(r[0]).toMatchObject({ version: TERMS_VERSION, via: "start", at_ms: T });
    const org = (raw.prepare("SELECT org FROM organizer_key WHERE kind='master'").get() as any).org; expect(r[0]!.org).toBe(org);
    const start = Math.floor((T / 1000 - 1692803367) / 3) + 1200;
    await call("POST", "/api/z", { id: "TERMS-1", startRound: start, callSeconds: 10, cap: 100 }, { "x-organizer": o.token }, T + 5000);
    expect(rows().map((x) => x.via).sort()).toEqual(["start"]); // same organizer, same version: one row, kept from the first time
    await call("POST", "/api/z", { id: "TERMS-2", startRound: start, callSeconds: 10, cap: 100 }, { "x-organizer": o.token }, T + 9000);
    expect(rows().length).toBe(1);
  });
  test("a platform-made organizer has no acceptance until they continue (create engagement records it)", async () => {
    const mk = await j(await call("POST", "/api/org", {}, { "x-organizer": "plat" })); expect(rows().length).toBe(0);
    await call("POST", "/api/z", { id: "TERMS-3", startRound: Math.floor((T / 1000 - 1692803367) / 3) + 1200, callSeconds: 10, cap: 100 }, { "x-organizer": mk.organizerKey }, T + 100);
    expect(rows().map((x) => [x.via, x.at_ms])).toEqual([["engagement", T + 100]]);
  });
  test("signing in by code or by the e-mailed link asks for nothing and records no new acceptance (the version is recorded when the account is made and when a game is created)", async () => {
    await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" });
    const before = rows().length;
    const a = await j(await call("POST", "/api/auth/email", { email: "boss@acme.com" }, {}, T + 1000));
    expect((await call("POST", "/api/auth/verify", { email: "boss@acme.com", code: a.devCode }, {}, T + 2000)).status).toBe(200);
    const b = await j(await call("POST", "/api/auth/email", { email: "boss@acme.com" }, {}, T + 3000));
    expect((await call("POST", "/api/auth/link", { token: b.devToken }, {}, T + 4000)).status).toBe(200);
    expect(rows().length).toBe(before);
  });
});
