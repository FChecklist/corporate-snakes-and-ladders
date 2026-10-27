// Owner order 2026-10-27: hide, never disable, the rarely used choices; and a demo link (zc.html?pass=...) is redeemed by the console.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

describe("simpler console", () => {
  test("the turn limit choice is hidden (not disabled): wrapped in zc-hide with data-hidden, still in the page, and the css hides it", () => {
    const js = pub("zc.js");
    expect(js).toMatch(/<div class="zc-hide" data-hidden="1">\$\{lbl\("f-tc", "Turn limit/);
    const block = js.slice(js.indexOf('<div class="zc-hide" data-hidden="1">'), js.indexOf("grp(\"ep\""));
    expect(block).not.toMatch(/disabled/); expect(block).toContain('inp("tc"');
    expect(pub("zc.css")).toMatch(/\.zc-hide\{display:none !important\}/);
  });
  test("a demo link kept in this browser is used once the organizer is signed in", async () => {
    const w: any = new Window({ url: "https://game.test/zc.html?pass=0123456789abcdef0123456789abcdef", width: 1000, height: 900 });
    const posts: any[] = [];
    w.fetch = async (url: string, init: any = {}) => {
      const u = String(url), method = init.method ?? "GET";
      if (method === "POST" && u.endsWith("/api/pass")) { posts.push(JSON.parse(init.body)); return new Response(JSON.stringify({ ok: true, cap: 10 }), { status: 200 }); }
      if (u.endsWith("/api/history")) return new Response(JSON.stringify({ engagements: [] }), { status: 200 });
      if (u.endsWith("/api/whoami")) return new Response(JSON.stringify({ kind: "master" }), { status: 200 });
      return new Response("{}", { status: 200 });
    };
    w.sessionStorage.setItem("cbz-org", "cbo_" + "a".repeat(48));
    w.document.body.innerHTML = '<main id="app"></main>';
    const names = ["window", "document", "location", "sessionStorage", "localStorage", "fetch", "history", "navigator", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "BroadcastChannel", "URLSearchParams", "Date", "Math", "JSON"];
    const g: any = globalThis; const vals = names.map((n) => (n in w && w[n] !== undefined ? w[n] : g[n]));
    vals[names.indexOf("window")] = w; vals[names.indexOf("fetch")] = w.fetch; vals[names.indexOf("setTimeout")] = setTimeout; vals[names.indexOf("clearTimeout")] = clearTimeout; vals[names.indexOf("setInterval")] = () => 0; vals[names.indexOf("clearInterval")] = () => {}; vals[names.indexOf("BroadcastChannel")] = undefined; vals[names.indexOf("Date")] = Date;
    for (const f of ["zgame.js", "consent.js", "zc.js"]) new Function(...names, pub(f))(...vals);
    await tick(300);
    expect(posts).toEqual([{ token: "0123456789abcdef0123456789abcdef" }]);
  });
});
