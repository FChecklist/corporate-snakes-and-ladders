// Writes brochure.pdf and organizer-guide.pdf from the two web pages (their print styles, A4, the kit's colours and badge), so the PDF a person downloads is the page they read.
// Needs Chrome or Chromium (playwright-core is already a dev dependency). Run: bun tools/make-pdfs.mjs   (CHROME=<path to chrome> if it is not at the usual place), commit the two files.
// Pages: apps/web/public/brochure.html and organizer-guide.html. test/brand-kit.test.ts opens both PDFs and checks the brand and the payee line.
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const PUB = new URL("../apps/web/public/", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".json": "application/json" };
const srv = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname); const f = join(PUB, p === "/" ? "index.html" : p);
  if (!f.startsWith(PUB) || !existsSync(f) || !statSync(f).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
await new Promise((r) => srv.on("listening", r));
const exe = process.env.CHROME || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/usr/bin/google-chrome", "/usr/bin/chromium", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find((f) => existsSync(f));
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
for (const [page, out, title] of [["brochure.html", "brochure.pdf", "Corporate Snakes and Ladders: brochure"], ["organizer-guide.html", "organizer-guide.pdf", "Corporate Snakes and Ladders: organizer guide"]]) {
  const ctx = await browser.newContext({ colorScheme: "light", viewport: { width: 1000, height: 1400 } }), p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${srv.address().port}/${page}`, { waitUntil: "load" }); await p.emulateMedia({ media: "print" });
  await p.evaluate(() => document.fonts.ready);
  const pdf = await p.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: false });
  writeFileSync(join(PUB, out), pdf); console.log(out, pdf.length, "bytes");
  await ctx.close();
}
await browser.close(); srv.close();
