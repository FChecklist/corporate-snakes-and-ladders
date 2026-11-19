// TEST_HANDOFF Milestone 3 in a real Chromium: no horizontal scroll at 360, 768 and 1280 wide, light and dark; no Content-Security-Policy error in the console; the kit header is shown and the old one is not;
// the Menu button shows only on a phone width; the Version line is at the bottom of the page. The page's own files are served from apps/web/public by a small static server; /api answers 404 (nothing else is reachable).
import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-ignore playwright-core is a dev dependency of the repo
import { chromium } from "playwright-core";

setDefaultTimeout(120_000);
const PUB = join(import.meta.dir, "../public");
const MIME: Record<string, string> = { html: "text/html", js: "text/javascript", css: "text/css", json: "application/json", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2", webmanifest: "application/manifest+json", ico: "image/x-icon" };
/** The rules of apps/web/public/_headers (Cloudflare Pages), applied the way the host applies them. Today the landing page "/" has no Content-Security-Policy rule there (only z.html, zc.html and pay.html have), so the CSP check below only bites if one is added. */
function headerRules(): { pattern: RegExp; headers: Record<string, string> }[] {
  const out: { pattern: RegExp; headers: Record<string, string> }[] = []; let cur: { pattern: RegExp; headers: Record<string, string> } | null = null;
  for (const line of readFileSync(join(PUB, "_headers"), "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) { cur = { pattern: new RegExp("^" + line.trim().replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$"), headers: {} }; out.push(cur); }
    else if (cur) { const i = line.indexOf(":"); cur.headers[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
  }
  return out;
}
let server: ReturnType<typeof Bun.serve>, browser: any, base = "";
const CHROME = ["/opt/pw-browsers/chromium", process.env.CHROME_PATH ?? ""].find((p) => p && existsSync(p));

beforeAll(async () => {
  const rules = headerRules();
  server = Bun.serve({ port: 0, fetch(req) {
    const u = new URL(req.url); let p = u.pathname === "/" ? "/index.html" : u.pathname;
    if (p.startsWith("/api/")) return new Response("{}", { status: 404, headers: { "content-type": "application/json" } });
    const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f)) return new Response("not found", { status: 404 });
    const h: Record<string, string> = { "content-type": MIME[p.split(".").pop()!] ?? "application/octet-stream" };
    for (const r of rules) if (r.pattern.test(p) || (p === "/index.html" && r.pattern.test("/"))) Object.assign(h, r.headers);
    return new Response(readFileSync(f), { headers: h });
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

describe("landing page in real Chromium", () => {
  for (const width of [360, 768, 1280]) for (const scheme of ["light", "dark"] as const) {
    test(`${width}px wide, ${scheme}: no horizontal scroll, no CSP error (under the _headers file), kit header visible, old header absent, Version line at the bottom`, async () => {
      const { ctx, page, errors, csp } = await open(width, scheme);
      const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, bodySw: document.body.scrollWidth, kit: !!document.querySelector(".ck-top"), old: !!document.querySelector(".snav"), ver: (document.getElementById("relline")?.textContent ?? "").trim(), verBottom: (document.getElementById("relline")?.getBoundingClientRect().bottom ?? 0) + window.scrollY, docH: document.documentElement.scrollHeight }));
      expect([width, scheme, "horizontal scroll", m.sw <= m.iw && m.bodySw <= m.iw]).toEqual([width, scheme, "horizontal scroll", true]);
      expect(csp).toEqual([]); expect(m.kit).toBe(true); expect(m.old).toBe(false);
      expect(m.ver).toMatch(/^Version \d+\.\d+\.\d+/); expect(m.docH - m.verBottom).toBeLessThan(200); // the Version line is the last thing on the page
      void errors;
      await ctx.close();
    });
  }
  test("the Menu button is visible on a 360px phone and hidden on a 1280px laptop; on the phone it opens the six links", async () => {
    const phone = await open(360, "light"); const vis = await phone.page.evaluate(() => { const b = document.getElementById("ck-menu")!; const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(b).display !== "none"; });
    expect(vis).toBe(true); await phone.page.click("#ck-menu"); const shown = await phone.page.evaluate(() => [...document.querySelectorAll("#ck-nav > a")].filter((a) => (a as HTMLElement).getBoundingClientRect().height > 0).length); expect(shown).toBe(6); await phone.ctx.close();
    const lap = await open(1280, "light"); const hid = await lap.page.evaluate(() => getComputedStyle(document.getElementById("ck-menu")!).display === "none"); expect(hid).toBe(true); await lap.ctx.close();
  });
  test("a theme dot changes the colours of the page (the header bar colour --bar-a is blue, then maroon, then emerald)", async () => {
    const { ctx, page } = await open(1280, "light"); const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--bar-a").trim().toLowerCase());
    const blue = await bg(); await page.click('.ck-dots button[data-t="maroon"]'); await page.waitForTimeout(200); const maroon = await bg(); await page.click('.ck-dots button[data-t="emerald"]'); await page.waitForTimeout(200); const emerald = await bg(); expect([blue, maroon, emerald]).toEqual(["#1553b8", "#7a1c33", "#0f6e64"]); await ctx.close();
  });
});
