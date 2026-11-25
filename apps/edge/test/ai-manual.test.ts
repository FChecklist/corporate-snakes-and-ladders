// The public AI manual page, GET /ai-manual (owner order of 25 Nov 2026: "AI help: llms.txt and a full AI manual page"). It is for an AI assistant that an organizer has asked to help.
// Public: no sign-in, no key, no script. It must be complete and true of the code, say who pays and who is the payee (read from the payee record, never typed in), say the AI may prepare
// the three messages but may not pay, carry the three rules lines word for word, and use the owner's words (game, player, co-organizer, Pay now, credits).
import { beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { aiManualHtml, COPY_LINK_SENTENCE } from "../src/ai-manual";
import { AI_CANNOT_PAY } from "../src/ai-pay";
import { STEPS } from "../src/ai-steps";
import { PACKS, price } from "../../../packages/shared/src/pricing";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 10, 25, 5, 0, 0);
const root = join(import.meta.dir, "..", "..", "..");
const rd = (rel: string) => readFileSync(join(root, rel), "utf8");
/** The three rules lines, exactly as the owner wrote them. */
const RULES = [
  "If two players reach a milestone on the same turn, the one who landed further on that turn wins it; if they are still level, the public random numbers decide.",
  "To finish, a player must land exactly on the last square; a throw that is too big is not used and the player stays where they are.",
  "No gift is ever shared: if players are level, the earlier finish wins, then the higher square, then more ladders climbed, then fewer missed turns, and then the public random numbers decide.",
];
let env: PayEnv;
const get = (path: string, method = "GET") => handle(new Request("https://snakes.test" + path, { method }), env as Env, T);
const text = (html: string) => html.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<\/?(?:strong|code|em|b|i|a)(?:\s[^>]*)?>/gi, "").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ");
/** The words a person reads on the page, with the one approved sentence taken out. */
const words = (html: string) => text(html).replaceAll(COPY_LINK_SENTENCE, " ");

beforeEach(() => { const d = makeD1(); env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: "https://snakes.test", DATA_KEY: "test-data-key", COMPANY_JSON: JSON.stringify({ legalName: "Test Payee Pty", email: "help@payee.test" }) } as PayEnv; });

describe("GET /ai-manual is a public page", () => {
  test("200 HTML with no sign-in and no key; the same page at /ai-manual.html; HEAD has no body; other methods get 405", async () => {
    const r = await get("/ai-manual"); expect(r.status).toBe(200); expect(r.headers.get("content-type")).toMatch(/^text\/html/);
    const html = await r.text(); expect(html).toMatch(/^<!doctype html>/i); expect(html).toContain('<html lang="en">'); expect(html).toContain("<h1>"); expect(html).toContain('name="viewport"');
    const r2 = await get("/ai-manual.html"); expect(r2.status).toBe(200); expect(await r2.text()).toBe(html);
    const h = await get("/ai-manual", "HEAD"); expect(h.status).toBe(200); expect(await h.text()).toBe("");
    const post = await get("/ai-manual", "POST"); expect(post.status).toBe(405); expect(post.headers.get("allow")).toBe("GET, HEAD");
  });
  test("no script, no form, no key; a strict content policy; not listed by search engines but not marked 'noai'", async () => {
    const r = await get("/ai-manual"); const html = await r.text();
    expect(html).not.toMatch(/<script|<form|<input|<iframe|onclick=|javascript:/i);
    expect(html).not.toMatch(/cb[kahc]_[0-9a-f]{8,}/); // a prefix is named, a key never is
    const csp = r.headers.get("content-security-policy") ?? ""; expect(csp).toContain("default-src 'none'"); expect(csp).not.toMatch(/script-src/); expect(csp).toContain("frame-ancestors 'none'");
    expect(r.headers.get("x-robots-tag")).toMatch(/noindex/); expect(r.headers.get("x-robots-tag")).not.toMatch(/noai/); expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
    expect(html).toContain('<link rel="canonical" href="https://snakes.test/ai-manual">');
  });
  test("it is built for readers that cannot click: headings, landmarks, labelled tables, a contents list, links written out in full", async () => {
    const html = await (await get("/ai-manual")).text();
    expect(html).toContain('<main id="main">'); expect(html).toContain('<nav aria-label="Contents">'); expect(html.match(/<h2 /g)!.length).toBeGreaterThanOrEqual(10);
    expect(html.match(/<table>/g)!.length).toBeGreaterThanOrEqual(5); expect(html.match(/<caption>/g)!.length).toBe(html.match(/<table>/g)!.length); expect(html).toContain('<th scope="col">');
    for (const p of ["/trust.html", "/llms.txt", "/terms.html", "/organizer-guide.html", "/pricing.html", "/demo.html"]) expect(html).toContain(`<a href="https://snakes.test${p}">https://snakes.test${p}</a>`);
  });
});

describe("the page is well formed", () => {
  test("every tag is closed in order, every id is used once, and every link inside the page goes to a section that exists", async () => {
    const html = (await (await get("/ai-manual")).text()).replace(/<style[\s\S]*?<\/style>/g, ""); const VOID = new Set(["meta", "link", "br", "img", "input", "hr"]); const stack: string[] = [];
    for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)) { const n = m[2]!.toLowerCase(); if (VOID.has(n)) continue; if (!m[1]) stack.push(n); else expect([m.index, stack.pop()]).toEqual([m.index, n]); }
    expect(stack).toEqual([]);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]!); expect(new Set(ids).size).toBe(ids.length);
    for (const h of [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]!)) expect([h, ids.includes(h)]).toEqual([h, true]);
    expect(html.match(/<h1>/g)!.length).toBe(1); expect(html.length).toBeLessThan(60_000); // one title, and a page a chat AI can read whole
  });
});

describe("what the page says", () => {
  test("it names each kind of key by its prefix, and says the AI key starts with cba_ and the AI link is <site>/ai/<key>", async () => {
    const t = text(await (await get("/ai-manual")).text());
    for (const k of ["cbk_", "cba_", "cbh_", "cbc_"]) expect(t).toContain(k);
    expect(t).toContain("https://snakes.test/ai/<key>"); expect(t).toMatch(/the key inside starts with cba_/);
    expect(t).toMatch(/Organizer\s+cbk_/); expect(t).toMatch(/AI assistant\s+cba_/); expect(t).toMatch(/Co-organizer\s+cbh_/);
    expect(t).toMatch(/organizer key \(cbk_\) is never accepted in an AI link/);
  });
  test("paying: Pay now, credits, Moneypenny, who may pay, and the exact sentence an AI key is given", async () => {
    const t = text(await (await get("/ai-manual")).text());
    for (const w of ["Pay now", "credits", "Moneypenny"]) expect(t).toContain(w);
    expect(t).toContain("Only the organizer or a co-organizer can pay"); expect(t).toContain(AI_CANNOT_PAY);
    expect(t).toMatch(/cannot pay, cannot make a link for paying and cannot use credits/); expect(t).toMatch(/Building a draft and publishing are free/);
  });
  test("the three messages: the field names, who sees each and when, 300 characters, plain text, and the way to set them", async () => {
    const t = text(await (await get("/ai-manual")).text());
    for (const f of ["preGameMessage", "winnerMessage", "closingMessage"]) expect(t).toContain(f);
    expect(t).toMatch(/preGameMessage\s+Every player, before the game starts\s+Plain text, up to 300 characters/);
    expect(t).toMatch(/winnerMessage\s+A winner, together with what they won\s+Plain text, up to 300 characters/);
    expect(t).toMatch(/closingMessage\s+Every player, when the game is over\s+Plain text, up to 300 characters/);
    expect(t).toContain("PATCH https://snakes.test/api/z/<id>/settings"); expect(t).toContain("POST https://snakes.test/api/z"); expect(t).toMatch(/before the first throw/); expect(t).toMatch(/clear yes/);
    expect(t).toMatch(/Prepare the pre-game message, the winner message and the closing message/);
  });
  test("when the messages are in the settings code, the number on the page is that code's limit", async () => {
    const cfg: any = await import("../../../packages/beacon/src/config"); // MESSAGE_MAX arrives with the messages work; until then the owner's 300 is the number
    const max = typeof cfg.MESSAGE_MAX === "number" ? cfg.MESSAGE_MAX : 300; expect(max).toBe(300);
    if (Array.isArray(cfg.MESSAGE_FIELDS)) { const t = text(await (await get("/ai-manual")).text()); for (const f of cfg.MESSAGE_FIELDS) expect(t).toContain(f); }
  });
  test("the three rules lines are on the page word for word, and so are the exact turn window and the sizes of the code", async () => {
    const html = await (await get("/ai-manual")).text(), t = text(html);
    for (const line of RULES) { expect(t).toContain(line); expect(html).toContain(`<li>${line}</li>`); }
    expect(t).toContain("Every turn has a 10 second window."); expect(t).not.toMatch(/\b(20|6|9|12|15)[- ]second/);
    for (const [n] of PACKS) expect(t).toContain(`${n} players`); expect(t).toContain("₹" + String(price(100, "INR").total).replace(/\B(?=(\d{3})+(?!\d))/g, ","));
  });
  test("the numbered conversation is the one list the key manual uses: every step is on the page, in order, and there are twelve", async () => {
    const html = await (await get("/ai-manual")).text(); expect(STEPS.length).toBe(12);
    const ol = /<section id="conversation"[\s\S]*?<ol>([\s\S]*?)<\/ol>/.exec(html)![1]!; const items = [...ol.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]!).trim());
    expect(items.length).toBe(12); items.forEach((it, i) => expect(it).toBe(text(STEPS[i]!.say).trim()));
    expect(items[7]).toMatch(/Three optional messages/); expect(items[10]).toMatch(/^When they say it is ready/); expect(items[11]).toMatch(/^Afterwards/);
  });
  test("what the AI may do, may not do, and what to tell the organizer instead", async () => {
    const t = text(await (await get("/ai-manual")).text());
    for (const w of ["Build a draft", "Announce", "up to 160 characters", "Tick a gift as handed over", "Pay, make a link for paying, or use or see credits", "Publish", "Delete data", "Pause, resume or stop a running game", "Choose, change or remove a winner", "See names, mobile numbers or the list of IDs"]) expect(t).toContain(w);
    expect(t).toContain("The game is ready to pay. Please press Pay now in the console."); expect(t).toContain("do not look for another way round");
  });
  test("honest limits and the links: designed to follow, not a certificate, very hard not impossible, the Trust page, llms.txt, the terms", async () => {
    const t = text(await (await get("/ai-manual")).text());
    expect(t).toMatch(/designed to follow/); expect(t).toMatch(/not a certificate/); expect(t).toMatch(/very hard, not impossible/); expect(t).toContain("I do not know that");
    expect(t).not.toMatch(/\b(certified|fully compliant)\b/i);
  });
});

describe("the payee is read from the payee record, never typed in", () => {
  test("the page shows the name in COMPANY_JSON, and it changes when the record changes", async () => {
    const a = text(await (await get("/ai-manual")).text()); expect(a).toContain("The payee, the company that receives the payment, is Test Payee Pty."); expect(a).toContain("help@payee.test");
    (env as any).COMPANY_JSON = JSON.stringify({ legalName: "Second Payee Ltd", email: "other@payee.test" });
    const b = text(await (await get("/ai-manual")).text()); expect(b).toContain("is Second Payee Ltd."); expect(b).not.toContain("Test Payee Pty"); expect(b).toContain("other@payee.test");
  });
  test("a name with markup is shown as text, not as markup", async () => {
    (env as any).COMPANY_JSON = JSON.stringify({ legalName: "<b>Odd & Co</b>" }); const html = await (await get("/ai-manual")).text();
    expect(html).toContain("<strong>&lt;b&gt;Odd &amp; Co&lt;/b&gt;</strong>"); expect(html).not.toContain("<b>Odd");
  });
  test("the contact address cannot break out of its attribute, and only the name and the address are read from the record (never the bank details)", async () => {
    (env as any).COMPANY_JSON = JSON.stringify({ legalName: "Safe Payee", email: 'x"onmouseover="alert(1)', bank: { name: "Some Bank", accountNumber: "1234567890", ifsc: "ABCD0123456" }, pan: "ABCDE1234F" });
    const html = await (await get("/ai-manual")).text();
    expect(html).not.toMatch(/onmouseover="/); expect(html).toContain("mailto:x&quot;onmouseover=&quot;alert(1)");
    for (const secret of ["Some Bank", "1234567890", "ABCD0123456", "ABCDE1234F"]) expect(html).not.toContain(secret);
  });
  test("with no company record at all the page still says who the payee is: the record's own default name, read from the record", async () => {
    delete (env as any).COMPANY_JSON; const { company } = await import("../src/pay"); const name = company(env).legalName; expect(name.length).toBeGreaterThan(3);
    expect(text(await (await get("/ai-manual")).text())).toContain(`is ${name}.`);
  });
  test("no new source file types the payee's name: it comes from the record at request time", () => {
    const NAME = ["Ra" + "jat", "Agar" + "wal"], FULL = ["IT Services by", ...NAME].join(" "), PARTS = new RegExp(NAME.join("|")); // built from pieces so that this file does not hold the name either
    for (const f of ["apps/edge/src/ai-manual.ts", "apps/edge/src/ai-steps.ts", "apps/edge/src/ai-pay.ts", "apps/edge/src/trust-page.ts", "pages/functions/ai-manual.ts", "pages/functions/ai-manual.html.ts", "apps/edge/test/ai-manual.test.ts", "apps/edge/test/ai-cannot-pay.test.ts"]) {
      const src = rd(f); expect([f, src.includes(FULL)]).toEqual([f, false]); expect([f, PARTS.test(src)]).toEqual([f, false]);
    }
    expect(rd("apps/web/public/llms.txt")).not.toMatch(PARTS);
    expect(rd("apps/edge/src/ai-manual.ts")).toContain("company(env) in pay.ts");
    expect(rd("apps/edge/src/worker.ts")).toMatch(/aiManualHtml\(\{ origin, payee: co\.legalName/); // the Worker reads the record
  });
});

describe("the owner's words", () => {
  const BANNED: [string, RegExp][] = [["nickname", /nickname/i], ["ticket", /ticket/i], ["host", /\bhost\b/i], ["co-host", /co-host/i], ["guest", /guest/i], ["Razorpay", /razorpay/i], ["my, mine, your, yours", /\b(my|mine|your|yours)\b/i], ["engagement", /engagement/i], ["participant", /participant/i], ["event", /\bevents?\b/i], ["checkout", /checkout/i], ["payment link", /payment link/i], ["buy now", /buy now/i], ["purchase", /purchase/i], ["top up", /top[- ]?up/i], ["private", /\bprivate\b/i], ["I agree", /i agree/i]];
  test("the page has none of the words the owner took away (the one approved sentence is allowed, once)", async () => {
    const html = await (await get("/ai-manual")).text(); const w = words(html), raw = html.replace(/<style[\s\S]*?<\/style>/gi, " ").replaceAll(COPY_LINK_SENTENCE, " ");
    for (const [name, re] of BANNED) { expect([name, w.match(re)?.[0] ?? null]).toEqual([name, null]); expect([name + " (markup)", raw.match(re)?.[0] ?? null]).toEqual([name + " (markup)", null]); }
    expect(text(html).split(COPY_LINK_SENTENCE).length - 1).toBe(1); // the sentence is used once
    expect(text(html)).toMatch(/For the organizer\. The AI link is in the console\. Copy this link and paste in your AI to work\./);
  });
  test("the same holds with another payee and another site address, and for the text of the code that builds it", async () => {
    const html = aiManualHtml({ origin: "https://other.example/", payee: "Another Payee", contact: "" });
    for (const [name, re] of BANNED) expect([name, words(html).match(re)?.[0] ?? null]).toEqual([name, null]);
    expect(html).toContain("https://other.example/ai/&lt;key&gt;"); expect(html).not.toContain("example//");
    expect(text(html)).toContain("see the contact page");
  });
  test("it says game, player, board and co-organizer, and Pay now, credits and Moneypenny", async () => {
    const t = text(await (await get("/ai-manual")).text());
    for (const w of ["game", "player", "board", "co-organizer", "Pay now", "credits", "Moneypenny", "Say game, player, board and co-organizer"]) expect(t).toContain(w);
  });
});

describe("it is wired into the site the way the Trust page is", () => {
  test("the build lists it (routes, headers), the sitemap and the AI crawlers' allow list name it, and its two Pages Functions hand the request to the Worker", () => {
    const b = rd("pages/build.mjs"); expect(b).toContain('["/ai-manual", PLAINCSP, false]'); expect(b).toContain('"/ai-manual", "/ai-manual.html"'); expect(b).toMatch(/include: \[[^\]]*"\/ai-manual"/);
    expect(rd("apps/web/public/sitemap.xml")).toContain("https://snakes.corporatetambola.com/ai-manual</loc>");
    const robots = rd("apps/web/public/robots.txt"); expect(robots).toContain("Allow: /ai-manual"); expect(robots).not.toMatch(/Disallow: \/ai-manual/); expect(robots).toContain("Disallow: /ai/"); // a key address is never crawled; the public manual is not one
    for (const f of ["pages/functions/ai-manual.ts", "pages/functions/ai-manual.html.ts"]) { expect(existsSync(join(root, f))).toBe(true); expect(rd(f)).toContain("../../apps/edge/src/worker"); expect(rd(f)).toContain("export const onRequest"); }
  });
  test("a built site carries its route and its header rules (the site is built and read, not guessed)", () => {
    const b = Bun.spawnSync(["bun", "run", join(root, "pages/build.mjs")], { cwd: root, stdout: "pipe", stderr: "pipe" }); expect(b.exitCode, new TextDecoder().decode(b.stderr)).toBe(0);
    const routes = JSON.parse(readFileSync(join(root, "pages/public/_routes.json"), "utf8")); expect(routes.include).toContain("/ai-manual"); expect(routes.include).toContain("/ai-manual.html"); expect(routes.include.length).toBeLessThanOrEqual(100);
    const headers = readFileSync(join(root, "pages/public/_headers"), "utf8"); expect(headers).toMatch(/\n\/ai-manual\n/); expect(headers).toMatch(/\n\/ai-manual\.html\n/); expect(headers).toMatch(/\n\/llms\.txt\n\s+X-Robots-Tag: noindex, nofollow\n/); // llms.txt is for AIs to read: kept out of search, not marked noai
    expect(readdirSync(join(root, "pages/public")).includes("ai-manual.html")).toBe(false); // there is no file: the Worker builds the page
  });
});
