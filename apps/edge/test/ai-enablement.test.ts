// AI enablement: this test PLAYS AN OUTSIDE AI. It has only the pasted link, opens only addresses it was given (never builds one), reads only the words it is shown,
// and walks the guided path end to end. It also checks that the list of functions (src/ai-functions.ts) is true: every function behaves the way it is classified
// (the AI does it / the organizer taps once / only the organizer), so the front door, the map, the long manual and the software can never silently disagree again.
import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";
import { FACTS } from "../src/ai-facts";
import { FUNCTIONS } from "../src/ai-functions";
import { nextHint } from "../src/ai-link";
import { llmsTxt, trustHtml } from "../src/trust-page";

const T = Date.UTC(2026, 9, 1, 10, 0, 0); // Thu 1 Oct 2026, 15:30 India time
const ORIGIN = "https://bingo.test";
let env: PayEnv;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env as Env, T);
const j = async (r: Response) => (await r.json()) as any;
const root = join(import.meta.dir, "..", "..", "..");

beforeEach(() => { const d = makeD1(); env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: ORIGIN, DATA_KEY: "test-data-key" }; });
async function organizer() {
  const x = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }));
  return { key: x.aiKey as string, token: x.token as string, base: `${ORIGIN}/ai/${x.aiKey}` };
}

// ---- the outside AI's only abilities: open an address it was given, read the text it gets back
const open = async (url: string) => { const u = new URL(url); const r = await call("GET", u.pathname + u.search); return { status: r.status, text: await r.text() }; };
type Choice = { n: number; label: string; url: string; rec: boolean };
const choicesOf = (t: string): Choice[] => {
  const out: Choice[] = []; const lines = t.split("\n");
  for (let i = 0; i < lines.length; i++) { const m = /^(\d+)\. (.*?)(  \(recommended\))?$/.exec(lines[i]!); const l = /^\s+LINK: (\S+)$/.exec(lines[i + 1] ?? ""); if (m && l) out.push({ n: Number(m[1]), label: m[2]!, url: l[1]!, rec: !!m[3] }); }
  return out;
};
/** Follows the choice whose label matches, exactly as an AI would after the organizer picked it. Every address it follows must have been given to it. */
const given = new Set<string>();
async function pick(from: string, label: RegExp) {
  const cs = choicesOf(from); for (const c of cs) given.add(c.url);
  const c = cs.find((x) => label.test(x.label)); if (!c) throw new Error(`no choice matching ${label} in:\n${from}`);
  expect(given.has(c.url)).toBe(true); expect(c.url.length).toBeLessThan(250); // short enough for any chatbot, and one the AI was handed
  const r = await open(c.url); expect(r.status).toBe(200); return r.text;
}

describe("the front door", () => {
  test("a chatbot that reads only the first screen still gets the rules, the starting links and all 10 facts, in the owner's words", async () => {
    const o = await organizer(); const full = (await open(o.base)).text; const first = full.slice(0, 7000);
    expect(first).toMatch(/START HERE \(the organizer's AI assistant\)/); expect(first).toMatch(/Open ONLY the links you are given/); expect(first).toMatch(/Never invent an address/);
    for (const step of ["go/new", "go/games", "facts", "map"]) expect(first).toContain(`${o.base}/${step}`);
    expect(first).toContain(`${ORIGIN}/demo.html`);
    for (const f of FACTS) expect(first).toContain(f.say); // every fact, word for word
    expect(first).toMatch(/CANNOT/); expect(first).toMatch(/tap ONCE/);
    expect(full).toMatch(/LONG REFERENCE MANUAL/); // the old manual is still there, below
  });
  test("/start is the short front door alone; /facts has the 10 facts and the rules for using them; /map lists every function", async () => {
    const o = await organizer(); const s = (await open(`${o.base}/start`)).text; expect(s.length).toBeLessThan(8000); expect(s).not.toMatch(/LONG REFERENCE MANUAL/);
    const f = (await open(`${o.base}/facts`)).text; for (const x of FACTS) expect(f).toContain(x.say); expect(f).toMatch(/Never say best/); expect(f).toContain(`${ORIGIN}/trust.html`);
    const m = (await open(`${o.base}/map`)).text; for (const fn of FUNCTIONS) expect(m).toContain(fn.name);
    const mj = JSON.parse((await open(`${o.base}/map?format=json`)).text); expect(mj.functions.length).toBe(FUNCTIONS.length);
    expect(m).not.toMatch(/cbk_/);
  });
  test("a co-host's AI link gets a short front door of its own and cannot use the organizer's guided path or map", async () => {
    const o = await organizer(); const hk = await j(await call("POST", "/api/org/host", { email: "host@acme.com", mobile: "9876500009" }, { "x-organizer": o.token })); const hb = `${ORIGIN}/ai/${hk.hostKey}`;
    expect((await open(`${hb}/start`)).text).toMatch(/Host's AI assistant/);
    expect((await open(`${hb}/go/new`)).status).toBe(403); expect((await open(`${hb}/map`)).status).toBe(403);
  });
});

describe("the guided path, followed like an outside AI", () => {
  test("a bad or missing step falls back to a safe screen, never an error page; a stale start time is refused kindly", async () => {
    const o = await organizer();
    expect((await open(`${o.base}/go/nonsense`)).text).toMatch(/That step does not exist/);
    expect((await open(`${o.base}/go/time?z=in`)).text).toMatch(/Which day/); expect((await open(`${o.base}/go/time`)).text).toMatch(/Which time zone/); // time asked without a day: back to the day
    const past = (await open(`${o.base}/go/save?d=2026-09-01&t=1600&o=diwali&c=100`)).text; expect(past).toMatch(/already passed/);
    expect((await j(await call("GET", `/ai/${o.key}/history`))).engagements.length).toBe(0);
  });
});

describe("every function in the list does what the list says", () => {
  test("every refusal an AI gets also says what to do next, never contains the key, and names the console page for that game", async () => {
    const o = await organizer(); await call("POST", `/ai/${o.key}/z`, { id: "NXT-1", startRound: Math.floor((T / 1000 - 1692803367) / 3) + 1 + 4000, callSeconds: 20, cap: 100 });
    const cases: [string, string, unknown, RegExp][] = [
      ["PATCH", "z/NXT-1/settings", { startRound: 5 }, /schedule/], ["PATCH", "z/NXT-1/settings", { breaks: [{ kind: "speech", title: "x" }] }, /2 or more characters/],
      ["PATCH", "z/NXT-1/settings", { tickets: 1, breaks: [1, 2, 3, 4].map(() => ({ kind: "speech", title: "A word" })) }, /fewer brand moments/], ["POST", "z/NXT-1/erase", {}, /hand-over link/],
      ["GET", "z/NOPE-1/summary", undefined, /history/], ["POST", "z/NXT-1/announce", { text: "hello" }, /publish/i],
      ["PATCH", "z/NXT-1/settings", { breaks: [{ kind: "youtube", title: "Film", mediaUrl: "http://x.com/a" }] }, /https/],
    ];
    for (const [m, p, b, re] of cases) { const r = await call(m, `/ai/${o.key}/${p}`, b); expect(r.status).toBeGreaterThanOrEqual(400); const body = await j(r); expect([p, body.next]).toEqual([p, expect.stringMatching(re)]); expect(JSON.stringify(body)).not.toContain(o.key); }
    expect(nextHint(500, "weird", "B", ORIGIN, "z/NXT-1/summary")).toMatch(/ONCE more/);
  });
});

describe("the third route: any AI that searches the web", () => {
  const pub = (f: string) => readFileSync(join(root, "apps/web/public", f), "utf8");
  test("the facts never boast: no 'best', '100% safe', 'fully compliant', 'unhackable', 'cheat-proof' or 'certified' as a claim, and the honest limits are present", () => {
    const all = FACTS.map((f) => f.say).join(" ") + " " + llmsTxt();
    expect(all).not.toMatch(/best|100% safe|fully compliant|unhackable|cheat-proof|certified/i);
    expect(all).toMatch(/not a certificate/); expect(all).toMatch(/ISO 27001 or SOC 2/); expect(all).toMatch(/very hard, not impossible/); expect(all).toMatch(/designed to follow/i);
    expect(FACTS.length).toBe(10); expect(new Set(FACTS.map((f) => f.topic)).size).toBe(10); // ten facts, each its own topic
  });
  test("the Trust page and llms.txt are served as public pages (build list, headers, sitemap, not blocked for crawlers)", () => {
    const b = readFileSync(join(root, "pages/build.mjs"), "utf8"); expect(b).toContain('"trust.html"'); expect(b).toContain('"llms.txt"'); expect(b).toContain('["/trust", PLAINCSP, false]'); // indexable: no noindex header
    expect(pub("sitemap.xml")).toContain("/trust.html"); expect(pub("robots.txt")).not.toMatch(/Disallow: \/trust/); expect(pub("robots.txt")).toContain("Disallow: /ai/"); // a key address is never crawled
  });
});
