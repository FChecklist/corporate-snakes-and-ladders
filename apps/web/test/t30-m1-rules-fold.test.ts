// TEST_HANDOFF Milestone 1, items 1 and 2: the "Rules in five lines" fold shows during play, never in the waiting room, never after the game ends; z.html loads screenrules.js before z.js and release-line.js;
// if screenrules.js is missing the page still hides the fold after the game. The real phone page (z.js) runs in a DOM against the real Worker; only the public randomness and the clock are the test's own.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { newWorld, openPage, roundAt, roundMs, T, type Page } from "./harness";
import type { Fetcher } from "../../../packages/beacon/src";
// @ts-ignore plain UMD file served to phones
import SLR from "../public/screenrules.js";

setDefaultTimeout(180_000);
const PUB = join(import.meta.dir, "../public");
const START = roundAt(T) + 1200; // one hour after T
const rnd = (r: number) => createHash("sha256").update("fake" + r).digest("hex");
let open: Page[] = [];
const skew = { ms: 0 };
afterEach(async () => { for (const p of open) await p.close(); open = []; skew.ms = 0; });

const fakeBeacon = (nowMs: () => number) => { const fetcher: Fetcher = async (url) => { const last = url.split("/").pop()!, nowR = roundAt(nowMs()), r = last === "latest" ? nowR : Number(last); if (r > nowR) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ round: r, randomness: rnd(r), signature: "aa" }) }; }; return { fetcher, mirrors: ["https://a.t", "https://b.t", "https://c.t"], timeoutMs: 400 }; };
const rtFake = (win: any, nowMs: () => number) => { const Orig = win.ZG.PhoneRuntime; win.ZG.PhoneRuntime = class extends Orig { constructor(eid: string, deps: any) { super(eid, { ...deps, beacon: fakeBeacon(nowMs), verify: (x: any) => x.signature === "aa", mono: () => deps.mono() + skew.ms }); } }; };

async function game(id: string) {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "demo1@demo-test.invalid" }));
  expect((await w.api("POST", "/api/z", { id, startRound: START, callSeconds: 20, cap: 100, turnCap: 10 }, s.aiKey)).status).toBe(200);
  expect((await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
  (w.world as any).raw.prepare("UPDATE engagement SET pack=100 WHERE id=?").run(id);
  // a game needs two or more players to be played (a lone player has no game state): a second person joins by the test API
  expect((await w.api("POST", `/api/z/${id}/join`, { phone: "9811111111", name: "Ravi" })).status).toBe(200);
  return w;
}
async function phone(w: Awaited<ReturnType<typeof game>>, id: string, scripts: string[]) {
  const p = await openPage(w.world, { url: `http://localhost/z?e=${id}`, html: "z.html", scripts, afterLoad: (win, f) => { if (f === "zgame.js") rtFake(win, () => w.world.now); } });
  open.push(p);
  await p.waitFor((x) => /Join the game/.test(x), 20000);
  (p.$("#nm") as any).value = "Asha"; const ph = p.$("#ph") as any; if (ph) ph.value = "9812345678"; p.click("#go");
  await p.waitFor((x) => /You are in|Starting in|Your game is setting up/.test(x), 60000);
  return p;
}
const goTo = (w: Awaited<ReturnType<typeof game>>, ms: number) => { w.world.now = ms; skew.ms = ms - T; };
const foldText = (p: Page) => String(p.$("#rulesfold")?.textContent ?? "").replace(/\s+/g, " ");

describe("Rules in five lines: shown in the game only", () => {
  test("waiting room: no fold; during play: the fold with five numbered rules; after the game: no fold and the end card is there", async () => {
    const w = await game("T30-FOLD"); const p = await phone(w, "T30-FOLD", ["audio.js", "zgame.js", "screenrules.js", "z.js"]);
    expect(!!p.$("#rulesfold")).toBe(false);
    goTo(w, roundMs(START) + 3 * 60_000); // three turns in
    await p.waitFor(() => !!p.$("#rulesfold"), 90000);
    const t = foldText(p); expect(t).toContain("Rules in five lines"); for (const n of ["1.", "2.", "3.", "4.", "5."]) expect(t).toContain(n);
    goTo(w, roundMs(START) + 3 * 3_600_000); // hours after the turn limit of 10 turns
    await p.waitFor((x) => /The game is over|All the end prizes have been awarded/.test(x), 120000);
    expect(!!p.$("#rulesfold")).toBe(false);
    expect(p.text()).toContain("Thank you for taking part");
  });
  test("screenrules.js missing from the page: during play the fold still shows, after the game it is still hidden", async () => {
    const w = await game("T30-NOSR"); const p = await phone(w, "T30-NOSR", ["audio.js", "zgame.js", "z.js"]);
    expect(p.win.SLRules).toBeUndefined();
    goTo(w, roundMs(START) + 3 * 60_000);
    await p.waitFor(() => !!p.$("#rulesfold"), 90000);
    goTo(w, roundMs(START) + 3 * 3_600_000);
    await p.waitFor((x) => /The game is over|All the end prizes have been awarded/.test(x), 120000);
    expect(!!p.$("#rulesfold")).toBe(false);
  });
});

describe("z.html and screenrules.js", () => {
  const html = readFileSync(join(PUB, "z.html"), "utf8");
  const at = (f: string) => html.indexOf(f);
  test("z.html loads screenrules.js, then z.js, and release-line.js; screenrules.js comes before z.js", () => {
    expect(at("/screenrules.js")).toBeGreaterThan(-1); expect(at("/z.js")).toBeGreaterThan(-1); expect(at("/release-line.js")).toBeGreaterThan(-1);
    expect(at("/screenrules.js")).toBeLessThan(at("/z.js"));
  });
  test("z.html loads release-line.js after the page scripts, so the footer line is written once the page exists", () => { expect(at("/release-line.js")).toBeGreaterThan(at("/z.js")); });
  test("screenrules answers for every state: rules only while playing, strip only after the end, board is the only rich element, unknown theme falls back to retro", () => {
    expect(SLR.STATES).toEqual(["invite", "waiting", "notlisted", "playing", "ended"]);
    for (const s of SLR.STATES) { expect([s, SLR.showRules(s)]).toEqual([s, s === "playing"]); expect([s, SLR.showThanksStrip(s)]).toEqual([s, s === "ended"]); expect([s, SLR.richElement(s)]).toEqual([s, s === "playing" ? "board" : "none"]); }
    expect(SLR.look("modern")).toBe("modern"); expect(SLR.look("retro")).toBe("retro"); for (const t of ["", "Modern", "x", undefined, null]) expect(SLR.look(t)).toBe("retro");
    expect(SLR.showRules("ENDED")).toBe(false); expect(SLR.showRules(undefined)).toBe(false);
  });
  test("z.js consults the rules file AND the live phase: the fold needs phase to be not 'ended' (so a stale 'playing' answer cannot show it after the game)", () => {
    const z = readFileSync(join(PUB, "z.js"), "utf8"); const line = z.split("\n").find((l) => l.includes("rulesFold(v)") && l.includes("waiting"))!;
    expect(line).toContain("SLRules.showRules"); expect(line).toContain('v.phase !== "ended"'); expect(line).toContain("waiting");
  });
});
