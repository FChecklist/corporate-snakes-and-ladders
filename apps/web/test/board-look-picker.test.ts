// The board look picker (owner order, 25 Nov 2026; the mechanism is the one the public Corporate Tambola repo uses for its ticket look): a player picks Retro (the default) or Modern for the board,
// the whole page follows at once, and the choice is remembered on that player's own phone only (localStorage "snk-look"): nothing is sent to the server, nothing is shared with other players.
// Static checks read the shipped files; the page checks run the real z.js, looks.js and PhoneRuntime in a DOM against the REAL Worker (as wp14-phone.test.ts does). Only the public randomness and the clock are the test's own.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { newWorld, openPage, roundAt, roundMs, T, type Page } from "./harness";
import type { Fetcher } from "../../../packages/beacon/src";
import { scan } from "./storage-scan";

setDefaultTimeout(180_000);
const PUB = join(import.meta.dir, "../public");
const ROOT = join(import.meta.dir, "../../..");
const pub = (f: string) => readFileSync(join(PUB, f), "utf8").replace(/\r\n/g, "\n");
const START = roundAt(T) + 1200; // one hour after T
const rnd = (r: number) => createHash("sha256").update("fake" + r).digest("hex");
const KEY = "snk-look";
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; skew.ms = 0; });

// ---------- the page scaffold (copied from wp14-phone.test.ts) ----------
const skew = { ms: 0 }; // the test moves the phone's clock forward by this much
const fakeBeacon = (nowMs: () => number) => { const fetcher: Fetcher = async (url) => { const last = url.split("/").pop()!, nowR = roundAt(nowMs()), r = last === "latest" ? nowR : Number(last); if (r > nowR) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ round: r, randomness: rnd(r), signature: "aa" }) }; }; return { fetcher, mirrors: ["https://a.t", "https://b.t", "https://c.t"], timeoutMs: 400 }; };
const rtFake = (win: any, nowMs: () => number) => { const Orig = win.ZG.PhoneRuntime; win.ZG.PhoneRuntime = class extends Orig { constructor(eid: string, deps: any) { super(eid, { ...deps, beacon: fakeBeacon(nowMs), verify: (x: any) => x.signature === "aa", mono: () => deps.mono() + skew.ms }); } }; };
async function organizer() {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  return { ...w, token: s.token as string, aiKey: s.aiKey as string };
}
type O = Awaited<ReturnType<typeof organizer>>;
async function publishedGame(o: O, id: string) {
  expect((await o.api("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 100 }, o.aiKey)).status).toBe(200);
  expect((await o.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.token)).status).toBe(200);
  (o.world as any).raw.prepare("UPDATE engagement SET pack=100 WHERE id=?").run(id); // paid
}
type Hooks = { first?: (win: any) => void; afterLooks?: (win: any) => void; beforePage?: (win: any) => void };
/** The page scripts in the order z.html loads them (looks.js is the first one, in the head). `first` runs before looks.js (preset or block the storage); `beforePage` runs before z.js (wrap fetch). */
const phone = async (o: O, id: string, h: Hooks = {}) => {
  const p = await openPage(o.world, { url: `http://localhost/z?e=${id}`, html: "z.html", scripts: ["looks.js", "audio.js", "zgame.js", "z.js"], afterLoad: (win, f) => {
    if (f === "consent.js") h.first?.(win);
    if (f === "looks.js") h.afterLooks?.(win);
    if (f === "audio.js") h.beforePage?.(win);
    if (f === "zgame.js") rtFake(win, () => o.world.now);
  } });
  open.push(p); return p;
};
const joinGame = async (p: Page, name = "Asha") => { await p.waitFor((x) => /Join the game/.test(x), 20000); (p.$("#nm") as any).value = name; const ph = p.$("#ph") as any; if (ph) ph.value = "9812345678"; p.click("#go"); await p.waitFor((x) => /You are in|Starting in|Your game is setting up/.test(x), 60000); };
/** joins, then moves the clocks five minutes past the start: the game is being played and the board is on the screen */
const joinAndPlay = async (o: O, p: Page) => { await joinGame(p); o.world.now = roundMs(START) + 5 * 60_000; skew.ms = o.world.now - T; await p.waitFor(() => !!p.$(".zlook"), 60000); };
const doc = (p: Page) => p.win.document;
const radios = (p: Page) => Array.from(doc(p).querySelectorAll("input[name=zlook]")) as any[];
const checked = (p: Page) => radios(p).filter((r) => r.checked).map((r) => r.value);
const attr = (p: Page) => doc(p).documentElement.getAttribute("data-look");
const mark = (p: Page) => (doc(p).querySelector(".sqwrap") as any)?.getAttribute("data-look");
/** what a person does: the radio becomes checked and the browser says "change" */
const choose = (p: Page, value: "retro" | "modern") => { const r = radios(p).find((x) => x.value === value)!; r.checked = true; r.dispatchEvent(new p.win.Event("change", { bubbles: true })); };
const pawnAt = (p: Page) => Array.from(doc(p).querySelectorAll(".sqov .so")).findIndex((el: any) => !!el.querySelector(".pawn.me"));
const dump = (win: any) => { const out: Record<string, string> = {}; for (let i = 0; i < win.localStorage.length; i++) { const k = win.localStorage.key(i); out[k] = win.localStorage.getItem(k); } return out; };

describe("the player picks the board look: Retro (the default) or Modern", () => {
  test("a joined player sees Board look with two radio buttons, Retro is checked; Modern changes the page and the board at once and is kept; Retro changes it back; the board position stays; nothing is sent to the server; the keyboard focus survives a redraw", async () => {
    const o = await organizer(); await publishedGame(o, "PICK-1");
    const calls: { url: string; method: string; body: string }[] = [];
    const p = await phone(o, "PICK-1", { beforePage: (win) => { const real = win.fetch.bind(win); win.fetch = (u: any, init?: any) => { calls.push({ url: String(u), method: init?.method ?? "GET", body: typeof init?.body === "string" ? init.body : "" }); return real(u, init); }; } });
    await joinAndPlay(o, p);
    // what the player sees
    const group = doc(p).querySelector(".zlook") as any;
    expect(group.getAttribute("role")).toBe("radiogroup"); expect(group.getAttribute("aria-label")).toBe("Board look");
    expect(radios(p).map((r) => r.value)).toEqual(["retro", "modern"]); expect(radios(p).every((r) => r.type === "radio")).toBe(true);
    expect(checked(p)).toEqual(["retro"]); // exactly one, Retro by default
    expect(group.querySelector("input[type=checkbox]")).toBeNull(); // radio buttons for a visual choice, no tick boxes
    expect(p.text()).toContain("Board look"); expect(/Retro/.test(group.textContent) && /Modern/.test(group.textContent)).toBe(true);
    expect(attr(p)).toBe("retro"); expect(mark(p)).toBe("retro");
    expect(group.compareDocumentPosition(doc(p).querySelector(".sqwrap")) & 4).toBeTruthy(); // the picker is above the board (the board follows it in the page)
    expect(group.closest(".zboardcard")).not.toBeNull();
    expect(doc(p).querySelectorAll(".sq").length).toBe(100);
    expect(p.win.localStorage.getItem(KEY)).toBeNull(); // nothing is stored until the player chooses
    // Modern: at once, in the same breath as the choice (no reload, no wait)
    const square = () => String(doc(p).querySelector(".zpos")?.textContent ?? "").replace(/\s+/g, " "), pawn0 = pawnAt(p), where0 = square(); expect(pawn0).toBeGreaterThanOrEqual(0);
    choose(p, "modern");
    expect(attr(p)).toBe("modern"); expect(mark(p)).toBe("modern"); expect(checked(p)).toEqual(["modern"]);
    expect(p.win.localStorage.getItem(KEY)).toBe("modern");
    expect(pawnAt(p)).toBe(pawn0); expect(square()).toBe(where0); expect(doc(p).querySelectorAll(".sq").length).toBe(100); // the board and the pawn are where they were
    expect(doc(p).querySelector(".sqwrap")).not.toBeNull();
    // Retro again
    const pawn1 = pawnAt(p), where1 = square();
    choose(p, "retro");
    expect(attr(p)).toBe("retro"); expect(mark(p)).toBe("retro"); expect(checked(p)).toEqual(["retro"]);
    expect(p.win.localStorage.getItem(KEY)).toBe("retro");
    expect(pawnAt(p)).toBe(pawn1); expect(square()).toBe(where1);
    // nothing about the look went to the server: not in an address, not in a body (the game id and every other word of the calls are free of it)
    choose(p, "modern"); await new Promise((r) => setTimeout(r, 1500)); // a few redraws and polls go by
    expect(calls.length).toBeGreaterThan(0);
    expect(calls.filter((c) => /look|modern|retro|snk/i.test(c.url + " " + c.body))).toEqual([]);
    expect(attr(p)).toBe("modern");
    // the page redraws itself every second: a radio button that has the keyboard focus gets it back on the new button
    const r0 = radios(p).find((r) => r.value === "modern")!; r0.focus(); expect(doc(p).activeElement).toBe(r0);
    await p.waitFor(() => radios(p).find((r) => r.value === "modern") !== r0, 10000);
    await Promise.resolve(); await Promise.resolve();
    const r1 = radios(p).find((r) => r.value === "modern")!; expect(r1).not.toBe(r0);
    expect(doc(p).activeElement).toBe(r1);
    expect(p.errors).toEqual([]);
  });

  test("a NEW page load on the same phone starts in the chosen look before anything is drawn; another player's phone is not touched; a player who has not chosen gets Retro", async () => {
    const o = await organizer(); await publishedGame(o, "PICK-2");
    const first = await phone(o, "PICK-2"), other = await phone(o, "PICK-2"); // two players on two phones; both join while sign-up is open
    expect(attr(first)).toBe("retro"); expect(attr(other)).toBe("retro");
    await joinGame(first); await joinGame(other, "Ravi");
    o.world.now = roundMs(START) + 5 * 60_000; skew.ms = o.world.now - T; // the game starts
    await first.waitFor(() => !!first.$(".zlook"), 60000); await other.waitFor(() => !!other.$(".zlook"), 60000);
    choose(first, "modern");
    expect(first.win.localStorage.getItem(KEY)).toBe("modern"); expect(attr(first)).toBe("modern");
    // another player, another phone, nothing chosen there: Retro, nothing stored, and the first phone's choice is not shared
    expect(checked(other)).toEqual(["retro"]); expect(attr(other)).toBe("retro"); expect(mark(other)).toBe("retro"); expect(other.win.localStorage.getItem(KEY)).toBeNull();
    // the first phone opens the page again: looks.js runs in the head, before the body scripts draw anything
    const saved = dump(first.win); // that phone's storage
    const seen: { attr: string | null; app: string }[] = [];
    const again = await phone(o, "PICK-2", { first: (win) => { for (const [k, v] of Object.entries(saved)) win.localStorage.setItem(k, v); }, afterLooks: (win) => { seen.push({ attr: win.document.documentElement.getAttribute("data-look"), app: String(win.document.getElementById("app")?.textContent ?? "") }); } });
    expect(seen).toEqual([{ attr: "modern", app: "Loading…" }]); // Modern is on the page while the page still only says Loading
    await again.waitFor(() => !!again.$(".zlook"), 60000);
    expect(attr(again)).toBe("modern"); expect(checked(again)).toEqual(["modern"]); expect(mark(again)).toBe("modern");
    // choosing on the second phone changes that phone only
    choose(other, "modern"); expect(attr(other)).toBe("modern"); expect(other.win.localStorage.getItem(KEY)).toBe("modern");
    choose(other, "retro"); expect(attr(other)).toBe("retro"); expect(other.win.localStorage.getItem(KEY)).toBe("retro");
    expect(attr(again)).toBe("modern"); expect(attr(first)).toBe("modern"); expect(first.win.localStorage.getItem(KEY)).toBe("modern");
  });

  test("with the phone's storage blocked (the browser throws on every access) the page still draws, starts in Retro, and the picker works for the visit", async () => {
    const o = await organizer(); await publishedGame(o, "PICK-3");
    const p = await phone(o, "PICK-3", { first: (win) => { Object.defineProperty(win, "localStorage", { get() { throw new Error("The operation is insecure."); }, configurable: true }); } });
    expect(() => p.win.localStorage).toThrow();
    expect(attr(p)).toBe("retro"); // looks.js did not stop on the throw
    await joinAndPlay(o, p);
    expect(checked(p)).toEqual(["retro"]); expect(attr(p)).toBe("retro"); expect(mark(p)).toBe("retro");
    choose(p, "modern"); // the save fails quietly; the look still changes for this visit
    expect(attr(p)).toBe("modern"); expect(mark(p)).toBe("modern"); expect(checked(p)).toEqual(["modern"]);
    await new Promise((r) => setTimeout(r, 1500)); // the page redraws itself: the choice made in this visit is still there
    expect(attr(p)).toBe("modern"); expect(checked(p)).toEqual(["modern"]); expect(doc(p).querySelectorAll(".sq").length).toBe(100);
    expect(p.errors.filter((e) => /look|snk|zlook|storage|insecure/i.test(e))).toEqual([]);
  });
});

describe("looks.js puts the look on the page before the first paint", () => {
  const run = (storage: Record<string, string> | "blocked") => {
    const win: any = new Window({ url: "http://localhost/z.html" });
    if (storage === "blocked") Object.defineProperty(win, "localStorage", { get() { throw new Error("blocked"); }, configurable: true });
    else for (const [k, v] of Object.entries(storage)) win.localStorage.setItem(k, v);
    new Function("window", `with (window) { ${pub("looks.js")}\n}`).call(win, win);
    const out = win.document.documentElement.getAttribute("data-look"); win.happyDOM.close(); return out;
  };
  test("Modern only when the stored value is exactly modern; anything else, nothing stored, or blocked storage gives Retro", () => {
    expect(run({ [KEY]: "modern" })).toBe("modern");
    expect(run({ [KEY]: "retro" })).toBe("retro");
    for (const v of ["", "Modern", "MODERN", "neon", "blue", "1"]) expect(run({ [KEY]: v })).toBe("retro");
    expect(run({})).toBe("retro");
    expect(run({ "ctz-look": "modern" })).toBe("retro"); // Tambola's key is not this game's key
    expect(run("blocked")).toBe("retro");
  });
  test("the script only reads: no write, no network; z.html loads it in the head without defer, so it runs before the body is drawn", () => {
    const js = pub("looks.js").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(js).toContain('localStorage.getItem("snk-look")'); expect(js).not.toMatch(/setItem|removeItem|fetch|XMLHttpRequest|sendBeacon|WebSocket|cookie/);
    expect(js).toMatch(/try \{[\s\S]*getItem[\s\S]*\} catch/); expect(js).toContain('setAttribute("data-look"');
    for (const f of ["z.html", "demo.html"]) {
      const html = pub(f), head = html.slice(0, html.indexOf("</head>")), tag = /<script src="\/looks\.js"><\/script>/.exec(head);
      expect(tag, f).not.toBeNull(); // in the head, a plain script: no defer, no async, no type=module
      expect(head.indexOf("/looks.css")).toBeGreaterThan(head.indexOf("/z.css")); // the look styles come after the page styles
      expect(/<script[^>]*(defer|async)[^>]*src="\/looks\.js"|<script[^>]*src="\/looks\.js"[^>]*(defer|async)/.test(head)).toBe(false);
    }
  });
});

describe("looks.css: two clear looks, in the scheme's colours, with nothing that moves", () => {
  const css = pub("looks.css"), bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [...bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.trim(), body: m[2]!.trim() }));
  const rule = (sel: string) => rules.filter((r) => r.sel === sel).map((r) => r.body).join(";");
  const PROMISED = new Set(["primary", "primary-2", "deep", "accent", "accent-2", "bg", "surface", "sunk", "ink", "muted", "line", ...[0, 1, 2, 3, 4].flatMap((i) => [`band-${i}`, `band-${i}-alt`])]);
  // every var(--snk-x, fallback) with its fallback, found with balanced brackets; `rest` is the text with those removed
  const vars: { name: string; fallback: string | null }[] = []; let rest = "";
  { let i = 0; while (i < bare.length) { const j = bare.indexOf("var(--snk-", i); if (j < 0) { rest += bare.slice(i); break; } rest += bare.slice(i, j); let d = 0, k = j + 4; for (; k < bare.length; k++) { if (bare[k] === "(") d++; if (bare[k] === ")") { if (d === 0) break; d--; } } const inner = bare.slice(j + 4, k), c = inner.indexOf(","); vars.push({ name: c < 0 ? inner.slice(6) : inner.slice(6, c), fallback: c < 0 ? null : inner.slice(c + 1).trim() }); i = k + 1; } }
  const rgb = (h: string): [number, number, number] => { const x = h.replace("#", ""), f = x.length === 3 ? x.split("").map((c) => c + c).join("") : x; return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)]; };

  test("both looks exist, each with its own board, squares and numbers", () => {
    for (const look of ["retro", "modern"]) for (const part of [".sqgrid", ".sq", ".sq.end", ".sq.me", ".sq.ms", ".so b"]) expect(rule(`html[data-look="${look}"] ${part}`), `${look} ${part}`).not.toBe("");
    for (const look of ["retro", "modern"]) for (const i of [0, 1, 2, 3, 4]) { expect(css).toContain(`html[data-look="${look}"] .sq.h${i}:not(.end){background:`); expect(css).toContain(`html[data-look="${look}"] .sq.a.h${i}:not(.end){background:`); }
    expect(rule('html[data-look="retro"] .sqgrid')).not.toBe(rule('html[data-look="modern"] .sqgrid'));
  });
  test("Retro is the printed board game: a thick frame in rings, bold squares, chunky serif numerals", () => {
    const grid = rule('html[data-look="retro"] .sqgrid'); expect(grid).toMatch(/box-shadow:0 0 0 3px var\(--snk-accent\),0 0 0 6px var\(--snk-deep\)/); expect(grid).toContain("border-color:var(--snk-deep)");
    expect(rule('html[data-look="retro"] .sq.h0:not(.end)')).toBe("background:var(--snk-band-0)"); // the full band colour
    expect(rule('html[data-look="retro"] .so b')).toMatch(/font-family:var\(--serif,[^)]*\)/); expect(rule('html[data-look="retro"] .so b')).toContain("font-weight:700");
    expect(rule('html[data-look="retro"] .sq.end')).toContain("linear-gradient(135deg,var(--snk-accent-2),");
  });
  test("Modern is flat and clean: thin line, tints washed with white, a light frame and a small shadow, sans numerals, calm page", () => {
    const grid = rule('html[data-look="modern"] .sqgrid'); expect(grid).toContain("box-shadow:0 0 0 1px var(--snk-line)"); expect(grid).toContain("background:var(--snk-line)"); expect(grid).toContain("border-color:var(--snk-surface)");
    expect(rule('html[data-look="modern"] .sq.h0:not(.end)')).toMatch(/^background:linear-gradient\(rgba\(255,255,255,\.6\),rgba\(255,255,255,\.6\)\),var\(--snk-band-0\)/);
    expect(rule('html[data-look="modern"] .so b')).toMatch(/font-family:var\(--sans,/); expect(rule('html[data-look="modern"] .so b')).toContain("font-weight:600"); expect(rule('html[data-look="modern"] .so b')).toContain("text-shadow:none");
    expect(rule('html[data-look="modern"] body')).toMatch(/^background:var\(--snk-bg\)/); expect(rule('html[data-look="modern"] .zcard')).toContain("box-shadow:none"); expect(rule('html[data-look="modern"] .zbtn')).toContain("box-shadow:none");
  });
  test("nothing moves when the look changes: no rule here changes size, spacing, position or the frame width of the board, the cards or the buttons", () => {
    const geometry = /(^|;)(width|height|min-width|min-height|max-width|max-height|margin[a-z-]*|padding[a-z-]*|gap|row-gap|column-gap|inset|top|left|right|bottom|display|position|aspect-ratio|border|border-width|border-top|border-left|border-right|border-bottom|line-height|grid[a-z-]*|flex[a-z-]*|transform|letter-spacing):/;
    for (const r of rules.filter((x) => /html\[data-look=/.test(x.sel))) expect(r.body.match(geometry), r.sel).toBeNull();
    expect(rules.filter((x) => /html\[data-look=/.test(x.sel) && /font-size/.test(x.body))).toEqual([]); // the numbers keep the size the page gives them: only their type, weight and colour change
  });
  test("every colour is the scheme's (--snk-*) or a plain neutral; none is from the old teal block, Tambola's wine and gold, or any cool colour", () => {
    expect(vars.length).toBeGreaterThan(40);
    for (const v of vars) { expect(PROMISED.has(v.name), "--snk-" + v.name).toBe(true); }
    const OLD = ["#0B5D5B", "#117A77", "#063B3A", "#F7FBFA", "#F3F8F7"], TAMBOLA = ["#6B1429", "#3E0A1A", "#2A0711", "#E0B872", "#B8894D", "#E8C27A", "#FBF1DC", "#F3D9A4"];
    for (const c of [...OLD, ...TAMBOLA]) expect(css.toUpperCase().includes(c), c).toBe(false);
    const loose = [...rest.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g)].map((m) => m[0]); // a colour written outside var(--snk-...)
    expect(loose.length).toBeGreaterThan(5);
    for (const c of loose) { if (c.startsWith("#")) { const [r, g, b] = rgb(c); expect(r === g && g === b, c).toBe(true); } else { const n = c.replace(/^[a-z]+\(/, "").split(",").slice(0, 3).map((x) => parseFloat(x)); expect(n[0] === n[1] && n[1] === n[2], c).toBe(true); } }
    expect(rest).not.toMatch(/\b(red|green|blue|teal|cyan|purple|pink|orange|yellow|gold|maroon|navy|aqua)\b/i);
  });
  test("focus rings stay: the radio buttons have a visible focus ring and no rule removes an outline; motion is only for people who have not asked for less", () => {
    expect(rule(".zlookopt input:focus-visible")).toMatch(/outline:3px solid var\(--snk-deep\)/);
    expect(bare).not.toMatch(/outline\s*:\s*(none|0)\b/);
    const motion = bare.replace(/@media \(prefers-reduced-motion:no-preference\)\{[^{}]*\{[^{}]*\}\}/g, ""); // what is left once the no-preference block is taken out
    expect(motion).not.toMatch(/transition|animation|@keyframes/);
    expect(bare).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{\.zlookopt\{transition:/);
    for (const r of rules.filter((x) => /^\.zlookopt\b/.test(x.sel))) expect(r.body).not.toMatch(/(^|;)(width|height):\s*(?!20px)/); // only the radio itself has a fixed size (20px); the tap target is the 44px row
    expect(rule(".zlookopt")).toContain("min-height:44px");
  });
});

describe("the picker is in the page's own code, and in the storage notice", () => {
  const js = pub("z.js");
  test("z.js: Retro unless the stored value is modern; the key is this game's own; the attribute is set at start and on every change; the picker is a radio group with the label Board look", () => {
    expect(js).toContain('store.get("snk-look") === "modern" ? "modern" : "retro"');
    expect(js).toContain('store.set("snk-look", LOOK)'); expect(js).not.toContain("ctz-look"); expect(js).not.toContain("data-pt");
    expect(js.match(/documentElement\.setAttribute\("data-look", LOOK\)/g)!.length).toBe(2); // the page: at start, and when the player chooses
    expect(js.match(/\bw\.setAttribute\("data-look", LOOK\)/g)!.length).toBe(1); // the board on the screen, in the same breath
    expect(js).toContain('class="zlook" role="radiogroup" aria-label="Board look"'); expect(js).toContain('<input type="radio" name="zlook" value="retro"'); expect(js).toContain('<input type="radio" name="zlook" value="modern"');
    expect(js).toContain("${lookPicker()}${boardHtml(v, pawns, lab)}"); expect(js).toContain('<div class="sqwrap" data-look="${LOOK}">');
    expect(js).toContain('$app.addEventListener("change", (e) => { const t = e.target; if (t && t.name === "zlook") setLook(t.value); });');
  });
  test("the code of the picker sends nothing anywhere and keeps nothing but the look", () => {
    const block = js.slice(js.indexOf("// ---------- the board look:"), js.indexOf("// ---------- the dice card:"));
    expect(block.length).toBeGreaterThan(500);
    expect(block).not.toMatch(/\bapi\(|rawApi|fetch\(|sendBeacon|XMLHttpRequest|WebSocket|document\.cookie|sessionStorage|localStorage|indexedDB/);
    expect([...block.matchAll(/store\.(get|set)\("([^"]+)"/g)].map((m) => m[2])).toEqual(["snk-look"]);
  });
  test("the words are plain: Board look, Retro, Modern; no my or your, no ticket, no tick boxes", () => {
    const words = [...js.slice(js.indexOf("const lookPicker"), js.indexOf("const setLook")).matchAll(/aria-label="([^"]*)"|>([^<>${}]+)</g)].map((m) => m[1] ?? m[2]!.trim()).filter(Boolean);
    expect(words).toEqual(["Board look", "Board look", "Retro", "Modern"]);
    for (const w of words) expect(w).not.toMatch(/\b(my|mine|your|yours|ticket|nickname|host|checkbox|tick)\b/i);
  });
  test("the storage key is registered for the notice, and both scripts that use it are seen by the scan; the shipped file lists carry looks.css and looks.js", () => {
    const reg = JSON.parse(readFileSync(join(import.meta.dir, "../storage-registry.json"), "utf8")) as { items: { id: string; store: string; say: string; keys: string[] }[] };
    const item = reg.items.find((i) => i.keys.includes(KEY))!; expect(item).toBeDefined(); expect(item.store).toBe("localStorage"); expect(item.say).not.toMatch(/\b(my|mine|your|yours)\b/i);
    expect(reg.items.flatMap((i) => i.keys)).not.toContain("ctz-look");
    const { uses } = scan(); expect(uses.filter((u) => u.key === KEY).map((u) => u.file).sort()).toEqual(["looks.js", "z.js"]);
    const terms = pub("terms.html").replace(/<[^>]+>/g, " ").replace(/\s+/g, " "); expect(terms).toContain("only first-party storage on the device, for settings such as the look"); // the one legal document already tells people that the look is kept on the device
    const build = readFileSync(join(ROOT, "pages/build.mjs"), "utf8"), sw = pub("zsw.js");
    for (const f of ["looks.css", "looks.js"]) { expect(build).toContain(`"${f}"`); expect(sw).toContain(`"/${f}"`); }
  });
});
