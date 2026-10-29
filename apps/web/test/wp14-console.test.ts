// WP-14 console items (gap plan 2026-10-29): SL-06 fewer choices in step 2. The real console (zc.js) runs in a DOM against the REAL Worker and an in-memory database.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { newWorld, openPage, roundAt, roundMs, T, type Page } from "./harness";

setDefaultTimeout(60_000);
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

async function consoleFor(id: string, over: Record<string, unknown> = {}) {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  expect((await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 20, cap: 100, ...over }, s.aiKey)).status).toBe(200);
  const p = await openPage(w.world, { url: `http://localhost/zc.html?e=${id}`, html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
  open.push(p);
  await p.waitFor((x) => /Check and publish/.test(x), 20000);
  return { p, w, s };
}
const openStep = async (p: Page, n: number, until: RegExp) => { p.click(`.zc-sech[data-open="${n}"]`); await p.waitFor((x) => until.test(x), 20000); };

describe("SL-06: step 2 shows the few choices most organizers need; the rest sit in one fold-away block", () => {
  test("a normal game: throws and milestone are in view, board size / snakes / ladders / finish rule / team race are inside a closed fold-away block", async () => {
    const { p } = await consoleFor("SIX-1");
    await openStep(p, 2, /How many players/);
    const more = p.$("#more-game");
    expect(!!more).toBe(true);
    expect(more.hasAttribute("open")).toBe(false);
    for (const k of ["gm", "bs", "sn", "ld", "fin"]) expect([k, !!more.querySelector(`[data-ck="${k}"]`)]).toEqual([k, true]); // still in the page (hidden, never removed)
    for (const k of ["pl", "spd"]) expect([k, !!p.$(`[data-ck="${k}"]`) && !more.querySelector(`[data-ck="${k}"]`)]).toEqual([k, true]); // the everyday choices stay outside
    expect(!!p.$("#f-ms") && !more.querySelector("#f-ms")).toBe(true);
  });
  test("a game saved with a team race has the fold-away block open, so nothing the organizer chose is hidden from them", async () => {
    const { p } = await consoleFor("SIX-2", { mode: "team", teams: 3 });
    await openStep(p, 2, /How many players/);
    expect(p.$("#more-game").hasAttribute("open")).toBe(true);
  });
});

describe("SL-07: the organizer is told how long a game can last", () => {
  test("step 2 says the longest possible time from the real settings (60 turns of 20 seconds = 20 minutes) and that it ends sooner when 5 players are home", async () => {
    const { p } = await consoleFor("SEVEN-1");
    await openStep(p, 2, /How many players/);
    const t = p.text();
    expect(t).toContain("A game lasts at most 20 minutes (60 turns of 20 seconds)");
    expect(t).toContain("as soon as 5 players are home");
    expect(t).toContain("The first turn comes 2 minutes after the start time");
  });
});

describe("SL-13: the publish step names the prizes that have no gift written", () => {
  test("a new game has blank prizes: step 7 lists them by name; once every prize has a gift the note is gone", async () => {
    const { p, w, s } = await consoleFor("THIRTEEN-1");
    await openStep(p, 7, /Publish my game, free/);
    const note = p.$("#no-gift-note");
    expect(!!note).toBe(true);
    expect(note.textContent).toContain("These prizes have no gift written yet:");
    expect(note.textContent).toMatch(/Milestone/);
    expect(note.textContent).toMatch(/Reach the end 1st/);
    // fill every prize through the Worker, then look again
    const cur = await w.json(await w.api("GET", "/api/z/THIRTEEN-1/participants", undefined, s.token));
    const rewards = cur.rewards.map((r: any) => ({ ...r, text: "Gift " + r.pattern + r.ordinal }));
    expect((await w.api("PATCH", "/api/z/THIRTEEN-1/settings", { rewards }, s.token)).status).toBe(200);
    const q = await openPage(w.world, { url: "http://localhost/zc.html?e=THIRTEEN-1", html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
    open.push(q); await q.waitFor((x) => /Check and publish/.test(x), 20000);
    await openStep(q, 7, /Publish my game, free/);
    expect(!!q.$("#no-gift-note")).toBe(false);
  });
});

describe("SL-29: 'Create a new game like this one' does not wait for the report", () => {
  test("not offered before the game starts; offered as soon as it has started (no report yet)", async () => {
    const before = await consoleFor("CLONE-1");
    await openStep(before.p, 10, /After the game|Delete all participant data/);
    expect(!!before.p.$("[data-clonebtn]")).toBe(false);
    const w = newWorld(); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    const start = roundAt(T) + 1200;
    expect((await w.api("POST", "/api/z", { id: "CLONE-2", startRound: start, callSeconds: 20, cap: 100 }, s.aiKey)).status).toBe(200);
    w.world.now = roundMs(start) + 10 * 60_000; // ten minutes after the start; the report has not been sent
    const p = await openPage(w.world, { url: "http://localhost/zc.html?e=CLONE-2", html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
    open.push(p); await p.waitFor((x) => /Check and publish/.test(x), 20000);
    await openStep(p, 10, /After the game|Delete all participant data/);
    expect(!!p.$("[data-clonebtn]")).toBe(true);
  });
});

describe("SL-34: the console says which e-mail is signed in", () => {
  test("the role pill names the Organizer's e-mail address", async () => {
    const { p } = await consoleFor("EMAIL-1");
    expect(String(p.$("#rolepill").textContent)).toBe("Signed in as Organizer (boss@acme.com)");
  });
});
