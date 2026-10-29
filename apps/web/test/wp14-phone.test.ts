// WP-14 phone page items (gap plan 2026-10-29): SL-11 (screen stays on, sound off by default, Do-not-disturb tip) and SL-21 (rules in five lines during the game).
// The real phone page (z.js with the real PhoneRuntime) runs in a DOM against the REAL Worker; only the public randomness and the clock are the test's own.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { newWorld, openPage, roundAt, roundMs, T, type Page } from "./harness";
import type { Fetcher } from "../../../packages/beacon/src";

setDefaultTimeout(120_000);
const START = roundAt(T) + 1200; // one hour after T
const rnd = (r: number) => createHash("sha256").update("fake" + r).digest("hex");
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; skew.ms = 0; });

async function organizer() {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  return { ...w, token: s.token as string, aiKey: s.aiKey as string };
}
type O = Awaited<ReturnType<typeof organizer>>;
const fakeBeacon = (nowMs: () => number) => { const fetcher: Fetcher = async (url) => { const last = url.split("/").pop()!, nowR = roundAt(nowMs()), r = last === "latest" ? nowR : Number(last); if (r > nowR) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ round: r, randomness: rnd(r), signature: "aa" }) }; }; return { fetcher, mirrors: ["https://a.t", "https://b.t", "https://c.t"], timeoutMs: 400 }; };
const skew = { ms: 0 }; // the test moves the phone's clock forward by this much
const rtFake = (win: any, nowMs: () => number) => { const Orig = win.ZG.PhoneRuntime; win.ZG.PhoneRuntime = class extends Orig { constructor(eid: string, deps: any) { super(eid, { ...deps, beacon: fakeBeacon(nowMs), verify: (x: any) => x.signature === "aa", mono: () => deps.mono() + skew.ms }); } }; };
async function publishedGame(o: O, id: string) {
  expect((await o.api("POST", "/api/z", { id, startRound: START, callSeconds: 20, cap: 100 }, o.aiKey)).status).toBe(200);
  expect((await o.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.token)).status).toBe(200);
  (o.world as any).raw.prepare("UPDATE engagement SET pack=100 WHERE id=?").run(id); // paid
}
const phone = async (o: O, id: string, pre?: (win: any) => void) => {
  const p = await openPage(o.world, { url: `http://localhost/z?e=${id}`, html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"], afterLoad: (win, f) => { if (f === "audio.js") pre?.(win); if (f === "zgame.js") rtFake(win, () => o.world.now); } });
  open.push(p); return p;
};
const join = async (p: Page) => { await p.waitFor((x) => /Join the game/.test(x), 20000); (p.$("#nm") as any).value = "Asha"; const ph = p.$("#ph") as any; if (ph) ph.value = "9812345678"; p.click("#go"); await p.waitFor((x) => /You are in|Starting in|Your game is setting up/.test(x), 60000); };

describe("SL-11: the phone keeps its screen on, is quiet by default and tells the person to use Do not disturb", () => {
  test("the page asks for a screen wake lock; sound is off until turned on; the waiting room carries the Do-not-disturb tip", async () => {
    const o = await organizer(); await publishedGame(o, "WAKE-1");
    let asked = 0;
    const p = await phone(o, "WAKE-1", (win) => { Object.defineProperty(win.navigator, "wakeLock", { value: { request: async (kind: string) => { if (kind === "screen") asked++; return { addEventListener() {} }; } }, configurable: true }); });
    await join(p);
    expect(asked).toBeGreaterThanOrEqual(1);
    expect(p.text()).toContain("Sound off");
    expect(p.text()).toContain("switch your phone to Do not disturb");
  });
});

describe("SL-21: the rules stay in reach after the game has started", () => {
  test("once the first turn is open, the phone shows a 'Rules in five lines' fold with the five rules", async () => {
    const o = await organizer(); await publishedGame(o, "RULES-1");
    const p = await phone(o, "RULES-1");
    await join(p);
    expect(!!p.$("#rulesfold")).toBe(false); // the waiting room already shows the full rules
    o.world.now = roundMs(START) + 5 * 60_000; skew.ms = o.world.now - T; // five minutes after the start: the clock of the page and the public values move together
    await p.waitFor(() => !!p.$("#rulesfold"), 60000);
    const t = String(p.$("#rulesfold").textContent).replace(/\s+/g, " ");
    expect(t).toContain("Rules in five lines");
    for (const n of ["1.", "2.", "3.", "4.", "5."]) expect(t).toContain(n);
  });
});
