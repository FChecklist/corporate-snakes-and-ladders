// FINDING F-2 (docs/TEST_FINDINGS.md): a game in which only ONE person joined never reaches phase 'ended' on the phone (the race needs 2 or more players, so there is no game state). After the turn limit the page says
// 'Game over' but still shows the 'Rules in five lines' fold and never shows the ended banner. This test states the correct behaviour and is RED on release/snakes-1.4.0.
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

describe("F-2: a game with one player", () => {
  test("after the turn limit the page shows 'Game over' and must not show the Rules fold; the ended banner must appear", async () => {
    const w = await game("T30-LONE"); const p = await phone(w, "T30-LONE", ["audio.js", "zgame.js", "screenrules.js", "z.js"]);
    goTo(w, roundMs(START) + 3 * 3_600_000);
    await p.waitFor((x) => /Game over/.test(x), 120000);
    await new Promise((r) => setTimeout(r, 3000));
    expect(!!p.$("#rulesfold")).toBe(false);
    expect(p.text()).toContain("Thank you for taking part");
  });
});
