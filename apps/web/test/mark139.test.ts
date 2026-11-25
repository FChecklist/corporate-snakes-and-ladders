// Owner order (25 Nov 2026): the small mark "१३९" sits at the very top centre of every page, exactly once, with the approved look.
// This scans every page source: the static *.html files (apps/web/public and site), and the pages built in code (the Trust page, the Back-soon page, the two share-link pages, the printable invoice).
// Not pages (so not scanned): e-mails (apps/edge/src/brand.ts pageHtml), JSON and fragments, the dev-only simulators in tools/sim2.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { trustHtml } from "../../edge/src/trust-page";
import { backSoon } from "../../edge/src/admin";
import { BRANDS, DEFAULT_COMPANY, renderInvoiceHtml, splitGst } from "../../../packages/billing/src";

const ROOT = resolve(import.meta.dir, "../../..");
const MARK = '<div class="mark139" lang="hi" aria-hidden="true"><span>१३९</span></div>';
const RULE1 = '.mark139{position:absolute;top:0;left:0;right:0;margin:0;padding:1px 0 0;text-align:center;line-height:1;pointer-events:none;user-select:none;z-index:2147483647;font-family:"Noto Sans Devanagari","Mukta","Nirmala UI","Mangal","Kohinoor Devanagari","Devanagari Sangam MN",sans-serif;font-size:6px;font-weight:700;color:#0B2A6B}';
const RULE2 = ".mark139 span{display:inline-block;border-bottom:.5px solid #7A1010;padding-bottom:.5px}";
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const count = (s: string, needle: string) => s.split(needle).length - 1;
/** Every .html page under dir, at any depth (and the built copy in pages/public when it exists). */
const htmlIn = (dir: string): string[] => !existsSync(join(ROOT, dir)) ? [] : readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? (e.name === "node_modules" ? [] : htmlIn(`${dir}/${e.name}`)) : e.name.endsWith(".html") ? [`${dir}/${e.name}`] : []);
const STATIC = [...htmlIn("apps/web/public"), ...htmlIn("site"), ...htmlIn("pages/public")];
const CODE_PAGES: [string, number][] = [["apps/edge/src/trust-page.ts", 1], ["apps/edge/src/admin.ts", 1], ["apps/edge/src/people.ts", 2], ["packages/billing/src/index.ts", 1]];

/** The page's own CSS plus every local stylesheet it links (a page may carry the rule inline or load it from the shared sheet). */
function cssOf(page: string): string {
  const dir = page.slice(0, page.lastIndexOf("/")), src = read(page);
  let css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  for (const m of src.matchAll(/<link[^>]+href="\/([^"?#]+\.css)[^"]*"/g)) { try { css += "\n" + read(`${dir}/${m[1]}`); } catch { /* not a local sheet */ } }
  return css;
}

describe("the १३९ mark on every page", () => {
  test("every static page has the approved markup exactly once, as the first thing in <body>", () => {
    expect(STATIC.length).toBeGreaterThan(40);
    for (const p of STATIC) {
      const s = read(p);
      expect([p, count(s, 'class="mark139"')]).toEqual([p, 1]);
      expect([p, count(s, MARK)]).toEqual([p, 1]);
      expect([p, /<body[^>]*>/.test(s) && s.slice(s.search(/<body[^>]*>/)).replace(/^<body[^>]*>/, "").startsWith(MARK)]).toEqual([p, true]);
    }
  });
  test("every static page gets the approved CSS (inline or from a sheet it loads)", () => {
    for (const p of STATIC) { const css = cssOf(p); expect([p, css.includes(RULE1)]).toEqual([p, true]); expect([p, css.includes(RULE2)]).toEqual([p, true]); }
  });
  test("pages built in code carry the markup, once per page, and the CSS", () => {
    for (const [p, n] of CODE_PAGES) {
      const s = read(p);
      expect([p, count(s, 'class="mark139"')]).toEqual([p, n]);
      expect([p, count(s, MARK)]).toEqual([p, n]);
      expect([p, count(s, "<!doctype html")]).toEqual([p, n]);
      if (p !== "apps/edge/src/trust-page.ts") expect([p, count(s, RULE1 + RULE2)]).toEqual([p, n === 2 ? 2 : 1]); // trust-page loads /app.css, which carries the rule
    }
    const trust = read("apps/web/public/trust.html");
    expect(trust).toContain('<link rel="stylesheet" href="/app.css">');
  });
  test("the Trust page, the Back-soon page and the printable invoice, as the code really builds them, have the mark first in the body, once, with the CSS", async () => {
    const invoice = renderInvoiceHtml({ number: "CB/2026-27/000001", issuedAt: Date.UTC(2026, 9, 1), brand: BRANDS.corporate_snakes_and_ladders, company: DEFAULT_COMPANY, draft: false, buyer: { name: "Acme" }, currency: "INR", lines: [{ description: "Game", quantity: 1, amount: 100 }], tax: splitGst(100, "INR", "27", undefined, true) });
    const built: [string, string][] = [["renderInvoiceHtml()", invoice], ["trustHtml()", trustHtml()], ["backSoon()", await backSoon(new Request("https://example.test/", { headers: { accept: "text/html" } })).text()]];
    for (const [name, html] of built) {
      expect([name, count(html, 'class="mark139"')]).toEqual([name, 1]);
      expect([name, html.replace(/^[\s\S]*?<body[^>]*>/, "").startsWith(MARK)]).toEqual([name, true]);
      // the Trust page takes its CSS from /app.css (checked above); the Back-soon page carries it inline
      if (name === "backSoon()" || name === "renderInvoiceHtml()") expect([name, html.includes(RULE1 + RULE2)]).toEqual([name, true]);
      else expect([name, html.includes('<link rel="stylesheet" href="/app.css">')]).toEqual([name, true]);
    }
  });
  test("the approved look: colours, size, weight, hairline and the three numerals", () => {
    const css = RULE1 + RULE2;
    for (const t of ["#0B2A6B", "#7A1010", "font-size:6px", "font-weight:700", ".5px solid", "padding-bottom:.5px", "position:absolute", "top:0", "pointer-events:none", "user-select:none"]) expect(css).toContain(t);
    expect(MARK).toContain("१३९"); // the three numerals in this order
    expect(Array.from("१३९").map((c) => c.codePointAt(0))).toEqual([0x0967, 0x0969, 0x096f]);
    expect(MARK).toContain('aria-hidden="true"');
    // the shared sheets hold exactly the approved rules, once
    for (const f of ["apps/web/public/app.css", "apps/web/public/site.css", "apps/web/public/big.css", "site/site.css"]) { const s = read(f); expect([f, count(s, RULE1)]).toEqual([f, 1]); expect([f, count(s, RULE2)]).toEqual([f, 1]); }
  });
});
