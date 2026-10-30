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

describe("item 7: the dashboard of a dice game", () => {
  test("it is the game's dashboard (published, share card, waiting table, prizes) and shows no 'What is happening' block", async () => {
    const { p } = await dash({ waiter: "X1", settings: { verify: "id", whoCanJoin: "list" } });
    const t = p.text();
    expect(t).toContain("Game dashboard"); expect(t).toContain("Share this game link"); expect(t).toContain("Waiting for you to let them in the game"); expect(t).toContain("Big screen");
    expect(t).not.toContain("What is happening"); expect(!!p.$("#zf-feed")).toBe(false);
  });
  test("the page never asks for /gamelog (the Worker has no such route, it answers 404)", async () => {
    const { p, urls, w, id } = await dash();
    expect(urls.filter((u) => /gamelog/.test(u))).toEqual([]);
    expect(urls.length).toBeGreaterThan(3); // proves the page did call the Worker
    expect((await w.api("GET", `/api/z/${id}/gamelog`)).status).toBe(404);
    void p;
  });
  test("DELIBERATE BREAK: a descriptor with feed true shows the feed block and asks for /gamelog", async () => {
    const pub = mutated("zc-flow-game.js", "feed: false", "feed: true");
    const { p, urls } = await dash({ pub });
    expect(p.text()).toContain("What is happening");
    expect(urls.some((u) => /gamelog/.test(u))).toBe(true);
  });
  test("the dashboard has no word from the other game's special features: Housie, Tambola, Bumper, Full House, Lucky draw, Rehearsal, Claim", async () => {
    const { p } = await dash({ waiter: "X1", settings: { verify: "id", whoCanJoin: "list" } });
    const t = p.text().toLowerCase();
    for (const w of ["housie", "tambola", "bumper", "full house", "lucky draw", "rehearsal", "claim a prize", "early five", "jaldi"]) expect([w, t.includes(w)]).toEqual([w, false]);
  });
  // PRODUCT NOTE PN-1 (see TESTER_REPORT): words of the other game that are still in the vendored pack and reach the Snakes organizer. Each is its own test.failing, so each turns green when the console repo changes it.
  test.failing("the waiting table's first column is not called 'Ticket number'", async () => {
    const { p } = await dash({ waiter: "X1", settings: { verify: "id", whoCanJoin: "list" } });
    expect(cells(p).th).not.toContain("Ticket number");
  });
  test.failing("step 3 is not called 'Tickets and prizes' (a dice game has no tickets)", async () => {
    const { p } = await dash();
    expect(p.text()).not.toContain("Tickets and prizes");
  });
  test.failing("the report reminder does not say 'by ticket number only'", async () => {
    const { p } = await dash();
    expect(p.text().toLowerCase()).not.toContain("ticket number");
  });
  test.failing("the pack source has no 'Numbers are called automatically' / 'Roll Out the Next Number' control words", () => {
    const src = readFileSync(join(PUB, "pack/zc-flow.js"), "utf8");
    expect(src).not.toContain("Numbers are called automatically"); expect(src).not.toContain("Roll Out the Next Number");
  });
  // PRODUCT BUG PB-7: the Ready check prints the word 'null' next to Payment and Prizes chosen on a normal published free game.
  test.failing("the Ready check shows no stray 'null'", async () => {
    const { p } = await dash();
    expect(p.text()).not.toMatch(/null/);
  });
});

describe("item 3: stored IDs in the organizer's waiting table", () => {
  test("an Employee ID game on the new reading: column 'Employee ID', value cleaned (1B678)", async () => {
    const { p } = await dash({ settings: { verify: "id", whoCanJoin: "list" }, clean: true, waiter: "1b-678" });
    const c = cells(p); expect(c.th).toContain("Employee ID"); expect(c.td).toContain("1B678");
  });
  // PRODUCT BUG PB-8 (the coder named it in TEST_HANDOFF as not fixable here; kept as a failing test until the console repo is re-vendored)
  test.failing("an Email ID game: the column is called 'Email ID' and the address is shown as typed (lower case), not squashed into letters", async () => {
    const { p } = await dash({ settings: { verify: "id", idKind: "email", whoCanJoin: "list" }, waiter: "Asha.Rao@Acme.com" });
    const c = cells(p); expect(c.th).toContain("Email ID"); expect(c.td).toContain("asha.rao@acme.com");
  });
  test("what an Email ID game shows today (evidence, re-checkable): the column 'Employee ID' with ASHARAOACMECOM", async () => {
    const { p } = await dash({ settings: { verify: "id", idKind: "email", whoCanJoin: "list" }, waiter: "Asha.Rao@Acme.com" });
    const c = cells(p); expect(c.th).toContain("Employee ID"); expect(c.td).toContain("ASHARAOACMECOM");
  });
  test.failing("winner details of an Email ID game say 'Email ID: x@y.com', not 'Employee ID: XYCOM'", async () => {
    const { p } = await flow({ publish: false });
    expect(p.win.ZFLOW.winnerDetails({ name: "Asha", empId: "x@y.com" })).toContain("Email ID: x@y.com");
  });
});

describe("PB-6: the new flow signs in with the key the game really stores", () => {
  // The pack reads the key from storage name "ctz-org"; Snakes' sign-in stores "cbz-org" (google.js:71, keep.js KEEP list). A person who signs in and presses 'Try the new screens' has no key in the new flow.
  test.failing("with only the Snakes sign-in key (cbz-org) the new flow opens the dashboard of a published game", async () => {
    const f = await flow({ keys: ["cbz-org"], waiter: "X1", settings: { verify: "id", whoCanJoin: "list" } });
    await f.p.waitFor((x) => /Waiting for you to let them in/.test(x), 6000);
  });
  test("what happens today: with only cbz-org the page sends no key (waiting list cannot load)", async () => {
    const f = await flow({ keys: ["cbz-org"], waiter: "X1", settings: { verify: "id", whoCanJoin: "list" } });
    await settle(2500);
    expect(f.p.text()).not.toContain("Waiting for you to let them in the game");
  });
});

describe("item 11 (pack files): the dead game-log page is gone and nothing links to it", () => {
  test("no pack/gamelog.* file; not listed in MANIFEST.json; not in pages/build.mjs FILES; no page, script or sitemap mentions it", () => {
    expect(existsSync(join(PUB, "pack/gamelog.html"))).toBe(false); expect(existsSync(join(PUB, "pack/gamelog.js"))).toBe(false);
    expect(readFileSync(join(PUB, "pack/MANIFEST.json"), "utf8")).not.toMatch(/gamelog/);
    expect(readFileSync(join(import.meta.dir, "../../../pages/build.mjs"), "utf8")).not.toMatch(/gamelog/);
    const stack = [PUB]; const hits: string[] = [];
    while (stack.length) { const d = stack.pop()!; for (const e of readdirSync(d, { withFileTypes: true })) { const f = join(d, e.name); if (e.isDirectory()) { if (!/^(fonts|img|vendor)$/.test(e.name)) stack.push(f); } else if (/\.(html|js|json|xml|txt|webmanifest|css)$/.test(e.name) && !f.endsWith("pack/zc-flow.js") && /gamelog|live-game\.js/.test(readFileSync(f, "utf8"))) hits.push(f.slice(PUB.length)); } }
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
