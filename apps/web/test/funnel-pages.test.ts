// The page side of the sales funnel: the real pages and the real funnel.js (built from core's makeReporter) in a DOM, talking to the real Worker.
// Each page step is fired by the page's own code; the server stores it only while FUNNEL_EVENTS is "on".
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newWorld, openPage, type Page } from "./harness";

setDefaultTimeout(30_000);
const PUB = join(import.meta.dir, "../public");
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const scriptsOf = (html: string): string[] => [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]!.split("?")[0]!.replace(/^\//, "")).filter((f) => !/^https?:/.test(f) && f.endsWith(".js"));

/** Opens a page with the browser's own settings (Do Not Track / GPC) and a sendBeacon that goes to the Worker like a real one. */
async function load(w: ReturnType<typeof newWorld>, file: string, query = "", nav: Record<string, unknown> = {}, scripts?: string[]) {
  const html = readFileSync(join(PUB, file), "utf8");
  const p = await openPage(w.world, {
    url: "http://localhost/" + file + query, html: file, scripts: [...(scripts ?? scriptsOf(html)).filter((f) => f !== "funnel.js"), "funnel.js"], // funnel.js is deferred in the page: it runs after the others
    afterLoad: (win: any) => {
      if (win.__fnSet) return; win.__fnSet = true;
      win.navigator.sendBeacon = (u: string, d: string) => { void win.fetch(u, { method: "POST", body: d }); return true; };
      for (const [k, v] of Object.entries(nav)) Object.defineProperty(win.navigator, k, { value: v, configurable: true });
    },
  });
  open.push(p); await wait();
  return p;
}
const rows = (w: ReturnType<typeof newWorld>) => { try { return w.world.raw.query("SELECT ev, ukey, game, size FROM funnel_event ORDER BY ev").all() as { ev: string; ukey: string; game: string | null; size: number | null }[]; } catch { return []; } };
const on = () => newWorld({ DATA_KEY: "k", FUNNEL_EVENTS: "on" });

describe("page steps from the real pages", () => {
  test("landing page: viewed on load, size_chosen when a size is picked", async () => {
    const w = on(); const p = await load(w, "index.html");
    expect(rows(w).map((r) => r.ev)).toEqual(["viewed"]);
    const sel = p.$("#pack"), chosen = Number(sel.options[3].value); sel.value = String(chosen); sel.dispatchEvent(new p.win.Event("change", { bubbles: true })); await wait();
    expect(rows(w).map((r) => r.ev)).toEqual(["size_chosen", "viewed"]);
    expect(rows(w).find((r) => r.ev === "size_chosen")!.size).toBe(chosen);
    expect(rows(w).every((r) => r.game === null || r.game === "snakes")).toBe(true);
  });
  test("landing page: signup_started when the create-your-game sheet opens", async () => {
    const w = on(); const p = await load(w, "index.html");
    const buy = p.win.document.querySelector("[data-buy]"); expect(buy).toBeTruthy(); buy.click(); await wait();
    expect(rows(w).map((r) => r.ev)).toEqual(["signup_started", "size_chosen", "viewed"]);
  });
  test("pricing page: viewed", async () => {
    const w = on(); await load(w, "pricing.html"); expect(rows(w).map((r) => r.ev)).toEqual(["viewed"]);
  });
  test("the payment page: payment_page_reached", async () => {
    const w = on(); await load(w, "pay.html", "?e=ABC-1"); expect(rows(w).map((r) => r.ev)).toEqual(["payment_page_reached"]);
  });
  test("the payment share page: payment_page_opened", async () => {
    const w = on(); await load(w, "paylink.html", "?t=" + "a".repeat(48)); expect(rows(w).map((r) => r.ev)).toEqual(["payment_page_opened"]);
  });
  test("payment_link_copied: the console reports it when the share link was copied (zc.js)", async () => {
    const w = on(); const p = await load(w, "pricing.html");
    const src = readFileSync(join(PUB, "zc.js"), "utf8");
    const at = src.indexOf('$("copypaylink").onclick'); expect(at).toBeGreaterThan(0);
    const handler = src.slice(at, src.indexOf("redraw();", at));
    expect(handler).toMatch(/if \(S\.payCopied && window\.CBFunnel\) CBFunnel\.report\("payment_link_copied"\)/); // fires only when the copy worked
    p.win.CBFunnel.report("payment_link_copied"); await wait(); // the call that handler makes, through the real reporter and route
    expect(rows(w).map((r) => r.ev)).toContain("payment_link_copied");
  });
  test("the console loads funnel.js and the private screens do not report a 'viewed'", async () => {
    for (const f of ["zc.html", "pay.html", "paylink.html", "index.html", "pricing.html"]) expect(readFileSync(join(PUB, f), "utf8")).toContain('src="/funnel.js"');
    const w = on(); await load(w, "zc.html", "?demo=1"); expect(rows(w).map((r) => r.ev)).not.toContain("viewed");
  });
});

describe("privacy", () => {
  test("Do Not Track: the page sends nothing", async () => {
    const w = on(); const p = await load(w, "index.html", "", { doNotTrack: "1" });
    expect(p.win.CBFunnel).toBeTruthy(); expect(p.win.CBFunnel.report("size_chosen", { size: 100 })).toBe(false);
    expect(rows(w)).toEqual([]);
  });
  test("Global Privacy Control: the page sends nothing", async () => {
    const w = on(); await load(w, "index.html", "", { globalPrivacyControl: true }); expect(rows(w)).toEqual([]);
  });
  test("first-party only: funnel.js names no other host, sets no cookie and uses no storage", () => {
    const js = readFileSync(join(PUB, "funnel.js"), "utf8");
    expect(js).not.toMatch(/https?:\/\//); expect(js).not.toMatch(/document\.cookie|localStorage|sessionStorage|indexedDB/); expect(js).toContain("/api/funnel/e");
  });
  test("with the flag off the pages work and nothing is stored", async () => {
    const w = newWorld({ DATA_KEY: "k" }); const p = await load(w, "index.html");
    expect((p as any).errors).toEqual([]); expect(rows(w)).toEqual([]);
  });
  test("an event payload built by the page has only the allowed fields", async () => {
    const w = on(); const p = await load(w, "index.html", "", {}, ["consent.js", "funnel.js"]);
    const seen: string[] = []; p.win.navigator.sendBeacon = (_u: string, d: string) => { seen.push(d); return true; };
    p.win.CBFunnel.report("size_chosen", { size: 200, email: "a@b.com", name: "Asha", mobile: "9876543210" });
    const o = JSON.parse(seen[0]!); expect(Object.keys(o).sort()).toEqual(["at", "event", "game", "size", "visit"]);
    expect(seen[0]).not.toMatch(/@|Asha|9876543210/);
  });
});
