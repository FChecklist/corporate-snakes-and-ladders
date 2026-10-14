// A5: while the owner has switched the site off, the Worker answers every public address with a plain 503 {maintenance:true}, and rum.js puts a "Back soon" cover over any page that gets one.
// The page script runs in a DOM with a stand-in for the Worker's answers; the Worker side (the switch itself) is tested in apps/edge/test/admin.test.ts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

async function page(answer: (url: string) => Response) {
  const w: any = new Window({ url: "https://game.test/", width: 390, height: 780 });
  w.fetch = async (url: string) => answer(String(url));
  w.document.body.innerHTML = "<main id=\"app\"><h1>Home</h1></main>";
  try { new Function("window", "document", "location", "navigator", "fetch", "setTimeout", "addEventListener", "innerWidth", "performance", pub("rum.js"))(w, w.document, w.location, w.navigator, w.fetch, setTimeout, () => {}, 390, w.performance); } catch { /* the first part of rum.js (the cover) has run; the monitoring part needs a real browser */ }
  return w;
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

describe("the Back soon cover (rum.js)", () => {
  test("a good answer leaves the page alone; the owner's 503 covers the page with a plain Back soon (once); an ordinary 503 does not", async () => {
    let off = false;
    const w = await page((u) => (u.includes("/api/odd") ? json({ error: "busy" }, 503) : off ? json({ error: "Back soon.", code: "back-soon", maintenance: true }, 503) : json({ ok: true })));
    expect((await w.fetch("/api/notices")).status).toBe(200); await tick();
    expect(w.document.getElementById("back-soon")).toBeNull();
    expect((await w.fetch("/api/odd")).status).toBe(503); await tick(); expect(w.document.getElementById("back-soon")).toBeNull(); // busy is not the switch
    off = true;
    expect((await w.fetch("/api/notices")).status).toBe(503); await tick();
    const cover = w.document.getElementById("back-soon"); expect(cover).not.toBeNull();
    expect(cover.textContent).toMatch(/Back soon/); expect(cover.getAttribute("role")).toBe("alert"); expect(cover.textContent).not.toMatch(/owner|legal|review/i);
    await w.fetch("/api/notices"); await tick(); expect(w.document.querySelectorAll("#back-soon").length).toBe(1); // one cover, not a pile
  });
  test("the answer is untouched: the caller still gets the 503 and can read its body", async () => {
    const w = await page(() => json({ error: "Back soon.", code: "back-soon", maintenance: true }, 503));
    const r = await w.fetch("/api/anything"); expect(r.status).toBe(503); expect((await r.json()).maintenance).toBe(true);
  });
});
