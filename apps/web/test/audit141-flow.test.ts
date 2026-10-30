// Snakes 1.4.1 audit, items 3 (Email ID tables), 5 (Which ID? / Employee ID preview), 7 (dice-game words, no feed). The NEW organizer flow (pack/zc-flow.js + zc-flow-game.js) runs in a DOM
// against the REAL Worker. Breaks: the same check on a copy of the page folder with one line changed (harness `pub`).
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";
import { withDevice } from "../../edge/test/device";
import { handle } from "../../edge/test/cohost-accepted";

setDefaultTimeout(60_000);
const PUB = join(import.meta.dir, "../public");
let open: Page[] = [], temps: string[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; for (const t of temps) rmSync(t, { recursive: true, force: true }); temps = []; });
function mutated(file: string, from: string, to: string): string {
  const src = readFileSync(join(PUB, file), "utf8"); const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`break check: "${from.slice(0, 60)}" occurs ${n} times in ${file}, expected exactly 1`);
  const dir = mkdtempSync(join(tmpdir(), "pub141f-")); temps.push(dir); cpSync(PUB, dir, { recursive: true }); writeFileSync(join(dir, file), src.replace(from, () => to)); return dir;
}
const CLEAN_MS = 4102444800001;
const SCRIPTS = ["zc-modelink.js", "zgame.js", "consent.js", "zc.js", "zc-flow-game.js", "pack/zc-flow.js"];

/** A free (8 people) published game and the new flow open on it. `waiter` is what an unlisted person typed in the ID box, so the dashboard has a waiting row. */
async function flow(o: { settings?: Record<string, unknown>; clean?: boolean; waiter?: string; pub?: string; keys?: string[]; publish?: boolean } = {}) {
  const w = newWorld(); w.world.now = T; const id = "FLOW-141";
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  expect((await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 20, cap: 8 }, s.aiKey)).status).toBe(200);
  if (o.settings) expect((await w.api("PATCH", `/api/z/${id}/settings`, o.settings, s.token)).status).toBe(200);
  if (o.publish !== false) expect((await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
  if (o.clean) w.world.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(CLEAN_MS, id);
  if (o.waiter !== undefined) { const r = await handle(new Request(`http://localhost/api/z/${id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: withDevice("POST", `/api/z/${id}/join`, { name: "Asha", empId: o.waiter, device: "aa".repeat(16) }) }), w.world.env, w.world.now); expect(r.status).toBe(403); }
  const urls: string[] = [];
  const session: Record<string, string> = {}; for (const k of o.keys ?? ["cbz-org", "ctz-org"]) session[k] = s.token;
  const p = await openPage(w.world, { url: `http://localhost/zc.html?e=${id}&flow=new`, html: "zc.html", scripts: SCRIPTS, session, pub: o.pub,
    afterLoad: (win, f) => { if (f === "consent.js") { const f0 = win.fetch; win.fetch = async (u: any, i: any) => { urls.push((i?.method ?? "GET") + " " + String(u)); return f0(u, i); }; } } });
  open.push(p); return { p, w, s, id, urls };
}
const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));
const dash = async (o: Parameters<typeof flow>[0] = {}) => { const f = await flow(o); await f.p.waitFor((x) => /Share this game link/.test(x), 20000); await settle(); return f; };
const cells = (p: Page) => ({ th: [...p.win.document.querySelectorAll("th")].map((e: any) => e.textContent as string), td: [...p.win.document.querySelectorAll("td")].map((e: any) => e.textContent as string) });
const goStep2 = async (o: Parameters<typeof flow>[0] = {}) => { const f = await flow({ publish: false, ...o }); await settle(500); const z = f.p.win.ZFLOW; z.state.done[1] = true; z.state.open = 2; z.draw(); await settle(300); return f; };

describe("item 5: 'Which ID?' and the 'Your Employee ID' preview exist only where verify makes them effective", () => {
  test("Snakes' step 2 ('Who is this game for') has no 'Which ID?' radio, no preview line, no 'Employee ID' words, and no read-as sentence", async () => {
    const { p } = await goStep2();
    const t = p.text();
    expect(t).toContain("Who is this game for");
    expect(!!p.$("#zf-idkind")).toBe(false); expect(!!p.$("#zf-idhint")).toBe(false);
    for (const w of ["Which ID", "Your Employee ID", "Email ID", "The system will read this as", "becomes 1B678", "1b-678"]) expect([w, t.includes(w)]).toEqual([w, false]);
  });
  test("the descriptor says so (idKind false) and the saved settings of this step carry no idKind", async () => {
    const g = readFileSync(join(PUB, "zc-flow-game.js"), "utf8");
    expect(g).toMatch(/idKind: false/);
    const f = await goStep2(); const body: string[] = [];
    const f0 = f.p.win.fetch; f.p.win.fetch = async (u: any, i: any) => { if (i?.method === "PATCH") body.push(String(i.body)); return f0(u, i); };
    const sel = f.p.$("#zf-size"); if (sel) { sel.value = sel.options[1]?.value ?? sel.value; sel.dispatchEvent(new f.p.win.Event("change", { bubbles: true })); }
    const go = [...f.p.win.document.querySelectorAll("button")].find((b: any) => /Save and continue/.test(b.textContent) && f.p.$("#zf-size") && b.closest("section")?.contains(f.p.$("#zf-size")));
    if (go) { (go as any).click(); await settle(1500); }
    for (const b of body) expect(b).not.toContain("idKind");
  });
  test("DELIBERATE BREAK: a descriptor with idKind true brings back the radio and the 'becomes 1B678' preview", async () => {
    const pub = mutated("zc-flow-game.js", "idKind: false", "idKind: true");
    const { p } = await goStep2({ pub });
    expect(!!p.$("#zf-idkind")).toBe(true);
    expect(p.text()).toContain("becomes 1B678");
  });
});

// 1.4.1 round 2 (PB-6): the "Try the new screens" entry, the pack scripts and styles are gone from zc.html and zc.js no longer steps aside for ?flow=new. The tests that
// drove the new dashboard (item 7 words, item 3 waiting tables, PB-6 sign-in key) described a page nobody can reach now; they are replaced by these reachability checks.
// The words still wrong inside the unreachable pack (Ticket number, Tickets and prizes, Employee ID column for an Email ID game, stray "null") are listed in docs/TESTER_REPORT.md as latent.
describe("the new organizer flow is not reachable (round 2, PB-6)", () => {
  const page = readFileSync(join(PUB, "zc.html"), "utf8");
  test("zc.html has no 'Try the new screens' link, no flow=new link, and loads neither the pack script nor its style nor zc-flow-game.js", () => {
    for (const w of ["Try the new screens", "flow=new", "pack/zc-flow", "zc-flow-game", "zc-modelink", "trynewtop"]) expect([w, page.includes(w)]).toEqual([w, false]);
  });
  test("zc.js does not step aside for ?flow=new any more", () => {
    expect(readFileSync(join(PUB, "zc.js"), "utf8")).not.toMatch(/get\("flow"\)/);
  });
  test("opening /zc.html?e=...&flow=new on the real page folder draws the ordinary console (step list, 'Your game at a glance'), not the new dashboard", async () => {
    const w = newWorld(); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    expect((await w.api("POST", "/api/z", { id: "FLOW-REACH", startRound: roundAt(T) + 1200, callSeconds: 20, cap: 8 }, s.aiKey)).status).toBe(200);
    const p = await openPage(w.world, { url: "http://localhost/zc.html?e=FLOW-REACH&flow=new", html: "zc.html", scripts: ["zgame.js", "consent.js", "zc.js"], session: { "cbz-org": s.token } });
    open.push(p);
    const t = await p.waitFor((x) => /Your game at a glance/.test(x), 20000);
    expect(t).not.toMatch(/Share this game link|Ticket number|Tickets and prizes/);
  });
});

describe("item 11 (pack files): the dead game-log page is gone and nothing links to it", () => {
  test("pack/gamelog.* is not built into the site (not in pages/build.mjs FILES); no page, script or sitemap mentions it", () => {
    // 1.4.1 round 2 (PN-6): the pack folder is vendored byte for byte, so pack/gamelog.* is back in it (and in MANIFEST.json); what matters is that it does not SHIP and nothing links to it
    expect(readFileSync(join(import.meta.dir, "../../../pages/build.mjs"), "utf8")).not.toMatch(/gamelog/);
    const stack = [PUB]; const hits: string[] = [];
    while (stack.length) { const d = stack.pop()!; for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) { if (!/^(fonts|img|vendor)$/.test(e.name)) stack.push(f); } else if (/\.(html|js|json|xml|txt|webmanifest|css)$/.test(e.name) && !/pack\/(zc-flow\.js|gamelog\.(html|js)|MANIFEST\.json)$/.test(f) && /gamelog|live-game\.js/.test(readFileSync(f, "utf8"))) hits.push(f.slice(PUB.length)); } }
    expect(hits).toEqual([]);
    // the one place the vendored flow can ask for the log is behind the descriptor switch, which Snakes sets to false
    const flowSrc = readFileSync(join(PUB, "pack/zc-flow.js"), "utf8").split("\n").filter((l) => /gamelog/.test(l));
    expect(flowSrc.length).toBe(1); expect(flowSrc[0]).toContain("if (G.feed)");
  });
  test("every file the MANIFEST lists exists and is byte-identical to its recorded SHA-256 (the pack was not edited here)", async () => {
    const { createHash } = await import("node:crypto");
    const man = (JSON.parse(readFileSync(join(PUB, "pack/MANIFEST.json"), "utf8")) as { files: Record<string, unknown> }).files;
    const files = Object.entries(man).filter(([, v]) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v as string)) as [string, string][];
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const [name, sha] of files) { const f = join(PUB, "pack", name); expect([name, existsSync(f)]).toEqual([name, true]); expect([name, createHash("sha256").update(readFileSync(f)).digest("hex")]).toEqual([name, sha]); }
  });
});
