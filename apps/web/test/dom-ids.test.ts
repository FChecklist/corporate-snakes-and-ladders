// Every page loads in a DOM with its own scripts, in the order the page lists them, and nothing throws. This catches a page and a script that drifted apart
// (the 1.4.1 landing page lost #loginLink while site.js still did $("loginLink").addEventListener, so the price list never drew).
// Plus: on the landing page the price list is filled.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { newWorld, openPage, type Page } from "./harness";

setDefaultTimeout(30_000);
const PUB = join(import.meta.dir, "../public");
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

/** the local scripts a page loads, in order (query strings dropped; outside addresses and files that are not shipped are left out) */
const scriptsOf = (html: string): string[] =>
  [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!.split("?")[0]!.replace(/^\//, "")).filter((f) => !/^https?:/.test(f) && f.endsWith(".js") && existsSync(join(PUB, f)));

const PAGES = readdirSync(PUB).filter((f) => f.endsWith(".html") && !/^(pack|.*-test)/.test(f));

describe("every page and its scripts agree on the elements they need", () => {
  for (const f of PAGES) {
    const html = readFileSync(join(PUB, f), "utf8");
    const scripts = scriptsOf(html);
    if (!scripts.length) continue;
    test(f + ": loads with " + scripts.length + " script(s) and nothing throws", async () => {
      const w = newWorld({ DATA_KEY: "k" });
      const p = await openPage(w.world, { url: "http://localhost/" + f + (f === "zc.html" ? "?demo=1" : ""), html: f, scripts });
      open.push(p);
      await new Promise((r) => setTimeout(r, 150));
      expect((p as any).errors ?? []).toEqual([]);
    });
  }
});

describe("the landing page", () => {
  test("the price list is filled and the Log in link is there", async () => {
    const html = readFileSync(join(PUB, "index.html"), "utf8");
    const w = newWorld({ DATA_KEY: "k" });
    const p = await openPage(w.world, { url: "http://localhost/", html: "index.html", scripts: scriptsOf(html) });
    open.push(p);
    await new Promise((r) => setTimeout(r, 150));
    expect((p as any).errors ?? []).toEqual([]);
    expect(p.$("#pack").options.length).toBeGreaterThan(3);
    expect(String(p.win.document.body.textContent)).toMatch(/Up to [\d,]+ players/);
    expect(p.$("a.login")).toBeTruthy();
  });
});
