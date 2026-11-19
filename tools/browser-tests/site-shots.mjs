// Screenshots of the public pages at 360, 390, 768, 1280 and 1920 wide, light and dark, plus the checks a person would make by eye: no sideways scroll, one header with the six
// menu labels, no console error from our own files (a blocked outside address is a failure). Also tabs through the menu with the keyboard.
// Serves apps/web/public itself (no server, no network). Run:  bun tools/browser-tests/site-shots.mjs [outDir] [page.html ...]
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PUB = new URL("../../apps/web/public/", import.meta.url).pathname;
const OUT = process.argv[2] && !process.argv[2].endsWith(".html") ? process.argv[2] : "site-shots";
const ONLY = process.argv.slice(2).filter((a) => a.endsWith(".html"));
const PAGES = ONLY.length ? ONLY : ["index.html", "how-it-works.html", "organizer-guide.html", "brochure.html", "partner.html", "pricing.html", "terms.html", "privacy.html", "trust.html", "404.html", "offline.html", "signin.html", "pay.html", "zc.html"];
const WIDTHS = [360, 390, 768, 1280, 1920], LABELS = ["How it works", "Free demo game", "Guide", "Brochure", "Refer & earn", "Log in"];
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json", ".webmanifest": "application/manifest+json", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain" };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p === "/") p = "/index.html"; if (!extname(p) && existsSync(PUB + p.slice(1) + ".html")) p += ".html";
  const f = join(PUB, p); if (!f.startsWith(PUB) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404, { "content-type": "application/json" }); return res.end("{}"); }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
await new Promise((r) => srv.on("listening", r));
const BASE = "http://127.0.0.1:" + srv.address().port;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });
let bad = 0; const say = (ok, m) => { if (!ok) bad++; console.log(ok ? "ok  " : "FAIL", m); };
for (const mode of ["light", "dark"]) {
  const ctx = await browser.newContext({ colorScheme: mode, viewport: { width: 1280, height: 900 } });
  for (const pg of PAGES) {
    const page = await ctx.newPage(); const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 160)); });
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(BASE + "/" + pg, { waitUntil: "load" }); await page.waitForTimeout(250);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      say(over <= 1, `${pg} ${mode} ${w}: no sideways scroll (${over}px)`);
      await page.screenshot({ path: join(OUT, `${pg.replace(".html", "")}-${mode}-${w}.png`), fullPage: w === 1280 || w === 390 });
    }
    await page.setViewportSize({ width: 1280, height: 900 }); await page.goto(BASE + "/" + pg, { waitUntil: "load" });
    if (pg !== "zc.html") { const labels = await page.$$eval("header.ck-top nav.ck-nav > a", (a) => a.map((x) => x.textContent.trim()));
    say(JSON.stringify(labels) === JSON.stringify(LABELS), `${pg} ${mode}: menu is ${labels.join(" | ")}`); }
    say(errs.length === 0, `${pg} ${mode}: console clean ${errs.join(" ; ")}`);
    await page.close();
  }
  await ctx.close();
}
// keyboard: Tab from the top of the page walks the skip link, the games bar, the brand and then the six menu items in order
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), page = await ctx.newPage();
  await page.goto(BASE + "/index.html", { waitUntil: "load" }); await page.waitForTimeout(300);
  const seen = [];
  for (let i = 0; i < 40 && seen.filter((s) => LABELS.includes(s)).length < 6; i++) { await page.keyboard.press("Tab"); seen.push(await page.evaluate(() => (document.activeElement.textContent || document.activeElement.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 40))); }
  const order = seen.filter((s) => LABELS.includes(s));
  say(JSON.stringify(order) === JSON.stringify(LABELS), "keyboard Tab reaches the six menu items in order: " + order.join(" > "));
  say(seen[0] === "Skip to the content", "the first Tab stop is the skip link: " + seen[0]);
  console.log("Tab order:", seen.join(" > "));
  await page.screenshot({ path: join(OUT, "tab-focus-menu.png") });
  await ctx.close();
}
await browser.close(); srv.close();
console.log(bad ? bad + " check(s) failed" : "all checks passed"); process.exit(bad ? 1 : 0);
