// K5 for a Co-host, on the console page (zc.js): a Co-host whose key has not accepted the role sees ONE box, unticked, with a button that stays disabled until it is ticked; ticking and pressing sends
// the tick with the Terms version and then the Co-host's own page opens. The real console script and consent.js run in a DOM with a stand-in for the server's answers (the server side is tested in
// apps/edge/test/cohost-accept.test.ts).
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import TEXT from "../../edge/src/consent-text.json";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const VER: string = (TEXT as any).version, K5A: string = (TEXT as any).K5.A;

async function consolePage(accepted = false) {
  const w: any = new Window({ url: "https://game.test/zc.html?e=CO-1", width: 1000, height: 900 });
  const sent: { method: string; url: string; body: any; key: string }[] = [];
  const state = { accepted };
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url), method = init.method ?? "GET", body = init.body ? JSON.parse(init.body) : undefined;
    sent.push({ method, url: u, body, key: init.headers?.["x-organizer"] ?? "" });
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (u.endsWith("/api/consent/K5")) return ok({ kind: "K5", version: VER, boxes: [{ id: "A", text: K5A }], termsUrl: "/terms.html" });
    if (u.endsWith("/api/whoami")) return ok({ kind: "cohost", eid: "CO-1" });
    if (u.endsWith("/api/org/role/accept")) { if (body?.consent?.v !== VER || !(body.consent.boxes || []).includes("A")) return ok({ error: "Please tick the box to continue.", code: "consent-required" }, 400); state.accepted = true; return ok({ ok: true, version: VER }); }
    if (u.endsWith("/api/z/CO-1/cohost")) return ok({ roleAccepted: state.accepted, name: "Diwali game", startMs: Date.now() + 86_400_000, cap: 100, joined: 0, brought: 0, price: 1000, payment: "unpaid", waitingFor: null, didNotStart: false, erasureMs: Date.now() + 5 * 86_400_000, inviteLink: "https://game.test/z.html?e=CO-1&from=1" });
    if (u.includes("/api/notices")) return ok({ notices: [] });
    return ok({}, 404);
  };
  w.sessionStorage.setItem("cbz-org", "cbc_" + "a".repeat(48));
  w.document.body.innerHTML = '<main id="app"></main>';
  const names = ["window", "document", "location", "sessionStorage", "localStorage", "fetch", "history", "navigator", "setTimeout", "clearTimeout", "setInterval", "clearInterval", "BroadcastChannel", "Node", "URLSearchParams", "Date", "Math", "JSON", "Object", "Array", "Promise", "Number", "String", "Set", "Map", "Error", "RegExp", "Intl", "encodeURIComponent", "parseInt", "parseFloat", "Uint8Array", "crypto", "TextEncoder", "console", "confirm", "alert", "URL", "Blob"];
  const g: any = globalThis;
  const vals = names.map((n) => (n in w && w[n] !== undefined ? w[n] : g[n]));
  vals[names.indexOf("window")] = w; vals[names.indexOf("fetch")] = w.fetch; vals[names.indexOf("setTimeout")] = setTimeout; vals[names.indexOf("clearTimeout")] = clearTimeout; vals[names.indexOf("setInterval")] = () => 0; vals[names.indexOf("clearInterval")] = () => {};
  vals[names.indexOf("Date")] = Date; vals[names.indexOf("BroadcastChannel")] = undefined;
  for (const f of ["zgame.js", "consent.js", "zc.js"]) { try { new Function(...names, pub(f))(...vals); } catch (e: any) { throw new Error(f + ": " + e.message); } }
  await tick(80);
  return { w, d: w.document, sent, state };
}
/** A person ticking a box: the box becomes checked and the page's change handlers run (the page sets `onchange` as a property and adds a listener; the DOM stand-in needs both called). */
const tickIt = (box: any, w: any) => { box.checked = true; if (typeof box.onchange === "function") box.onchange(new w.Event("change")); box.dispatchEvent(new w.Event("change", { bubbles: true })); };
const text = (d: any) => String(d.body.textContent).replace(/\s+/g, " ").trim();

describe("the Co-host role box on the console", () => {
  test("a Co-host who has not accepted sees the box with the exact wording, unticked, and a disabled button; nothing of the game page is shown", async () => {
    const { d } = await consolePage(false);
    expect(text(d)).toMatch(/Before you start/); expect(d.getElementById("roleaccept")).toBeTruthy();
    const boxes = [...d.querySelectorAll('#roleaccept input[type="checkbox"]')] as any[]; expect(boxes.length).toBe(1); expect(boxes[0].checked).toBe(false);
    expect(text(d)).toContain(K5A); // string for string with the wording the server holds
    const btn = d.getElementById("roleacceptgo") as any; expect(btn.disabled).toBe(true); expect(btn.getAttribute("aria-disabled")).toBe("true");
    expect(text(d)).not.toMatch(/Your game at a glance/);
  });
  test("ticking enables the button; pressing it sends the tick with the Terms version, and the Co-host's own page opens", async () => {
    const { d, sent, w } = await consolePage(false);
    const box = d.querySelector('#roleaccept input[type="checkbox"]') as any; tickIt(box, w); await tick();
    const btn = d.getElementById("roleacceptgo") as any; expect(btn.disabled).toBe(false);
    btn.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); await tick(120);
    const post = sent.find((s) => s.url.endsWith("/api/org/role/accept"))!; expect(post.method).toBe("POST"); expect(post.key).toMatch(/^cbc_/);
    expect(post.body.consent).toEqual({ v: VER, boxes: ["A"] });
    expect(d.getElementById("roleaccept")).toBeNull(); expect(text(d)).toMatch(/Your game at a glance|Diwali game/);
  });
  test("a Co-host who accepted before goes straight to the page; a Host or the Organizer never sees this box", async () => {
    const { d } = await consolePage(true);
    expect(d.getElementById("roleaccept")).toBeNull(); expect(text(d)).toMatch(/Diwali game|Your game at a glance/);
  });
});
