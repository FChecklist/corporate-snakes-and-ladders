// The owner desk on the owner page (owner-desk.js): the site switch, data requests with a Close button, mail events, error counts, organizer lookup.
// The page script runs in a DOM with a stand-in for the Worker's answers; the Worker routes are tested in apps/edge/test/admin.test.ts.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const tick = (ms = 40) => new Promise((r) => setTimeout(r, ms));

async function desk() {
  const w: any = new Window({ url: "https://game.test/owner-visits.html", width: 900, height: 800 });
  const calls: { method: string; url: string; key: string; body: any }[] = [];
  const state = { off: false, requests: [{ id: "r1", game: "OD-1", card: "1x000000000001", kind: "access", note: "hello", received: "2026-10-14T10:00:00.000Z", due: "2026-10-21T10:00:00.000Z", overdue: false, status: "open", closed: null as string | null }] };
  w.fetch = async (url: string, init: any = {}) => {
    const u = String(url), method = init.method ?? "GET", key = init.headers?.["x-organizer"] ?? "", body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, url: u, key, body });
    const ok = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status });
    if (key !== "plat") return ok({ error: "Not found" }, 404);
    if (u.endsWith("/api/owner/site")) { if (method === "POST") state.off = !!body.off; return ok(method === "POST" ? { ok: true, off: state.off } : { off: state.off, since: state.off ? "2026-10-14T10:00:00.000Z" : null, note: state.off ? "short pause" : null }); }
    if (u.includes("/api/owner/data-requests")) {
      if (method === "POST") { const r = state.requests.find((x) => x.id === body.id)!; r.status = "done"; r.closed = "2026-10-14T11:00:00.000Z"; return ok({ ok: true, id: body.id, status: "done" }); }
      const st = new URL(u, "https://x").searchParams.get("status"); return ok({ requests: state.requests.filter((r) => st === "all" || r.status === (st === "done" ? "done" : "open")) });
    }
    if (u.includes("/api/owner/mail-events")) return ok({ counts: { bounced: 1 }, events: [{ id: "e1", at: "2026-10-14T10:00:00.000Z", event: "bounced", to: "m***@acme.com", subject: "Sign-in code", kind: null, detail: "Permanent/General" }], keptDays: 90, webhook: "off (set RESEND_WEBHOOK_SECRET, see docs/OWNER_DESK.md)" });
    if (u.includes("/api/owner/errors")) return ok({ lastHour: 4, threshold: 20, hours: [{ hour: "2026-10-14T09:00Z", errors: 4 }] });
    if (u.includes("/api/owner/organizer")) return ok({ found: true, email: "boss@acme.com", mailProblems: 0, games: [{ id: "OD-2", state: "draft", start: "2026-10-20T10:00:00.000Z", paid: false, created: "2026-10-14T10:00:00.000Z", test: false }] });
    return ok({}, 404);
  };
  w.confirm = () => true;
  w.document.write(readFileSync(new URL("../public/owner-visits.html", import.meta.url), "utf8").replace(/<script[\s\S]*?<\/script>/g, ""));
  for (const f of ["owner-visits.js", "owner-desk.js"]) new Function("window", "document", "fetch", "confirm", "Node", pub(f))(w, w.document, w.fetch, w.confirm, w.Node);
  w.document.getElementById("key").value = "plat";
  return { w, d: w.document, calls, state };
}
const txt = (d: any) => String(d.body.textContent).replace(/\s+/g, " ").trim();
const click = async (d: any, id: string) => { d.getElementById(id).dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(); };

describe("the owner desk page", () => {
  test("the site switch: shows ON, switches OFF after asking, shows OFF with the note, switches ON again", async () => {
    const { d, calls } = await desk();
    await click(d, "deskSite"); expect(txt(d)).toMatch(/The site is ON/); expect(txt(d)).toMatch(/Switch the site OFF/);
    d.getElementById("deskNote").value = "short pause";
    const first = () => [...d.querySelectorAll("#deskout button")][0] as any;
    first().dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(80);
    expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/api/owner/site"))!.body).toEqual({ off: true, note: "short pause" });
    expect(txt(d)).toMatch(/The site is OFF/); expect(txt(d)).toMatch(/short pause/); expect(txt(d)).toMatch(/Switch the site ON/);
    first().dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(80);
    expect(txt(d)).toMatch(/The site is ON/);
  });
  test("a wrong key says Not found, nothing else", async () => {
    const { d } = await desk(); d.getElementById("key").value = "wrong";
    await click(d, "deskSite"); expect(txt(d)).toMatch(/Not found\. Check the key\./); expect(txt(d)).not.toMatch(/The site is/);
  });
  test("data requests: the open request is listed and the Close button closes it; it then shows under closed", async () => {
    const { d, calls } = await desk();
    await click(d, "deskReq"); expect(txt(d)).toMatch(/1 request\(s\)/); expect(txt(d)).toMatch(/OD-1/); expect(txt(d)).toMatch(/hello/);
    const close = [...d.querySelectorAll("#deskout button")].find((b: any) => b.textContent === "Close") as any; expect(close).toBeTruthy();
    close.dispatchEvent(new (d.defaultView as any).MouseEvent("click", { bubbles: true })); await tick(80);
    expect(calls.find((c) => c.method === "POST" && c.url.includes("data-requests"))!.body).toEqual({ id: "r1", action: "close" });
    expect(txt(d)).toMatch(/0 request\(s\)/);
    d.getElementById("deskStatus").value = "done"; await click(d, "deskReq"); expect(txt(d)).toMatch(/1 request\(s\)/);
  });
  test("mail events and error counts are shown; the organizer lookup lists the games", async () => {
    const { d, calls } = await desk();
    await click(d, "deskMailEv"); expect(txt(d)).toMatch(/m\*\*\*@acme\.com/); expect(txt(d)).toMatch(/Permanent\/General/); expect(txt(d)).toMatch(/Webhook off/);
    await click(d, "deskErr"); expect(txt(d)).toMatch(/4 error answer\(s\) in the last hour/);
    d.getElementById("deskMail").value = "boss@acme.com";
    d.getElementById("deskOrg").dispatchEvent(new (d.defaultView as any).Event("submit", { bubbles: true, cancelable: true })); await tick(80);
    expect(calls.some((c) => c.url.includes("/api/owner/organizer?email=boss%40acme.com"))).toBe(true);
    expect(txt(d)).toMatch(/Games of boss@acme\.com/); expect(txt(d)).toMatch(/OD-2/); expect(txt(d)).toMatch(/draft/);
  });
});
