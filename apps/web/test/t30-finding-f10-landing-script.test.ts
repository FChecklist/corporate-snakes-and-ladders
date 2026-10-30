// FINDING F-10 (docs/TEST_FINDINGS.md), real Chromium. RED on release/snakes-1.4.0: site.js stops at line 45 because the element #loginLink was removed with the old header, so the pack list and the pricing section stay empty.
// The tests state the correct behaviour (TEST_HANDOFF Milestone 3 item 3: "the old buy box, hero and games bar still work"). The page's own files are served from apps/web/public by a small static server; /api answers 404 (nothing else is reachable).
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-ignore playwright-core is a dev dependency of the repo
import { chromium } from "playwright-core";

setDefaultTimeout(120_000);
const PUB = join(import.meta.dir, "../public");
const MIME: Record<string, string> = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2", webmanifest: "application/manifest+json", ico: "image/x-icon" };
let server: ReturnType<typeof Bun.serve>, browser: any, base = "";
const CHROME = ["/opt/pw-browsers/chromium", process.env.CHROME_PATH ?? ""].find((p) => p && existsSync(p));

beforeAll(async () => {
  server = Bun.serve({ port: 0, fetch(req) {
    const u = new URL(req.url); let p = u.pathname === "/" ? "/index.html" : u.pathname;
    if (p.startsWith("/api/")) return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
    const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f)) return new Response("not found", { status: 404 });
    return new Response(readFileSync(f), { headers: { "content-type": MIME[p.split(".").pop()!] ?? "application/octet-stream" } });
  } });
  base = `http://localhost:${server.port}`;
  browser = await chromium.launch({ ...(CHROME ? { executablePath: CHROME } : {}), headless: true, args: ["--no-sandbox", "--disable-gpu"] });
});
afterAll(async () => { try { await browser?.close(); } catch { /* closed */ } try { server?.stop(true); } catch { /* stopped */ } });

async function open(width: number, scheme: "light" | "dark") {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: scheme, locale: "en-IN" });
  await ctx.route((u: URL) => !["localhost", "127.0.0.1"].includes(u.hostname), (r: any) => r.abort("blockedbyclient"));
  const page = await ctx.newPage(); const errors: string[] = [], csp: string[] = [];
  page.on("console", (m: any) => { const t = m.text(); if (/Content Security Policy|Refused to (load|execute|apply)/i.test(t)) csp.push(t); else if (m.type() === "error" && !/Failed to load resource/.test(t)) errors.push(t); });
  page.on("pageerror", (e: any) => errors.push(String(e?.message ?? e)));
  await page.goto(base + "/", { waitUntil: "load" }); await page.waitForTimeout(600);
  return { ctx, page, errors, csp };
}

describe("FINDING F-10: the old buy box and the pricing section on the landing page (RED on release/snakes-1.4.0, see docs/TEST_FINDINGS.md)", () => {
  test("no script error when the page loads", async () => {
    const { ctx, errors } = await open(1280, "light"); expect(errors).toEqual([]); await ctx.close();
  });
  test("the 'Number of players' list has packs in it and the pricing section shows a price card", async () => {
    const { ctx, page } = await open(1280, "light");
    const n = await page.evaluate(() => ({ options: document.querySelectorAll("#pack option").length, cards: document.querySelectorAll("#packs > *").length, price: (document.querySelector("#packs")?.textContent ?? "").trim().length }));
    expect(n.options).toBeGreaterThanOrEqual(4); expect(n.cards).toBeGreaterThanOrEqual(1); expect(n.price).toBeGreaterThan(20); await ctx.close();
  });
  test("'Create your Corporate Snakes and Ladders' opens the checkout sheet without a script error", async () => {
    const { ctx, page, errors } = await open(1280, "light"); await page.click("#payBtn"); await page.waitForTimeout(500);
    const sheet = await page.evaluate(() => !!document.querySelector(".sheet, .modal, [role=dialog], #sheet") && (document.querySelector(".sheet, .modal, [role=dialog], #sheet") as HTMLElement).getBoundingClientRect().height > 50);
    expect(errors).toEqual([]); expect(sheet).toBe(true); await ctx.close();
  });
});

