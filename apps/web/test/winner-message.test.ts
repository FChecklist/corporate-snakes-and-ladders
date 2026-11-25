// The organizer's three optional messages on the pages, and what a winner is told they won.
// The REAL phone page (z.js with the real PhoneRuntime), the REAL big screen (big.js) and the REAL console (zc.js) run in a DOM against the REAL Worker and an in-memory database.
// Only the public randomness and the clock are the test's own. One shared game of 60 players: its true winners are worked out with the same game code the pages use, and a page is opened for the
// player who won the milestone, the player who came 2nd, and a player who won nothing.
import { afterEach, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";
import { createHash } from "node:crypto";
import { newWorld, openPage, roundAt, roundMs, T, type Page } from "./harness";
import { GRACE_ROUNDS, MESSAGE_MAX, validateCfg } from "../../../packages/beacon/src/config";
import { playGame, settleGame } from "../../../packages/beacon/src/game";
import { betaOffset, turnRounds } from "../../../packages/beacon/src/schedule";
import type { Fetcher, Round } from "../../../packages/beacon/src";

setDefaultTimeout(240_000);
const START = roundAt(T) + 1200; // one hour after T
const rnd = (r: number) => createHash("sha256").update("fake" + r).digest("hex");
const WORDS = /\b(my|mine|your|yours|host|hosts|co-host|guest|guests|participant|participants|nickname|ticket|tickets)\b/i; // the owner's word rules for anything a person reads
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

const MSG = { preGameMessage: "Welcome, team! The first turn comes soon. Good luck to everyone.", winnerMessage: "Well done! Please collect the gift from the front desk after the game.", closingMessage: "Thank you for playing. See you at the next event." };
const SETTINGS = {
  board: { size: 100, snakes: 6, ladders: 12, finish: "pass" }, milestones: [2], turnCap: 14, endPrizes: 2, // the game ends as soon as two players are home
  rewards: [{ pattern: "milestone", ordinal: 1, text: "Coffee mug" }, { pattern: "finish", ordinal: 1, text: "Gift card: 1000" }, { pattern: "finish", ordinal: 2, text: "" }], // 2nd place: no words from the organizer
};
const PLAYERS = 60;

/** The true game, worked out the way every phone works it out (the same code, the test's public randomness): who won the milestone, 1st and 2nd place, how many turns it took, and when it is over. */
function truth(id: string) {
  const v = validateCfg({ ...SETTINGS } as any, undefined, {}); if (!v.ok) throw new Error(v.error);
  const first = START + GRACE_ROUNDS, stride = turnRounds(10), off = betaOffset(10);
  const betas = Array.from({ length: SETTINGS.turnCap }, (_, t) => rnd(first + t * stride + off));
  const g = playGame(id, v.cfg, PLAYERS, { b0: rnd(START + 1), betas, thrown: () => true });
  const settled = settleGame(g, v.cfg, Array.from({ length: PLAYERS }, (_, i) => String(i + 1)), 1);
  const seat = (p: string, o: number) => { const s = settled.find((x) => x.pattern === p && x.ordinal === o); return s ? Number(s.pids[0]) : 0; };
  const turns = (g.st as any).turnsPlayed as number;
  return { milestone: seat("milestone", 1), first: seat("finish", 1), second: seat("finish", 2), turns,
    afterTurn1Ms: roundMs(first + off) + 20_000, // the first turn's dice are public: the milestone is decided
    overMs: roundMs(first + (turns - 1) * stride + off) + 20_000 }; // the last turn's dice are public: the game is over
}
/** A game id (the same on every run) whose three prizes go to three different players and which is over in at most 12 turns; the search only runs if the game rules ever change. */
function pickGame() {
  for (const k of [7, 0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]) {
    const id = "MSGWIN-" + k, t = truth(id);
    if (t.milestone && t.first && t.second && new Set([t.milestone, t.first, t.second]).size === 3 && t.turns <= 12) return { id, t };
  }
  throw new Error("no game id gives the three prizes to three different players: add more candidates to pickGame()");
}

const fakeBeacon = (nowMs: () => number) => { const fetcher: Fetcher = async (url) => { const last = url.split("/").pop()!, nowR = roundAt(nowMs()), r = last === "latest" ? nowR : Number(last); if (r > nowR) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ round: r, randomness: rnd(r), signature: "aa" } as Round) }; }; return { fetcher, mirrors: ["https://a.test", "https://b.test", "https://c.test"], timeoutMs: 500 }; };
const rtFake = (win: any, nowMs: () => number) => { const Orig = win.ZG.PhoneRuntime; win.ZG.PhoneRuntime = class extends Orig { constructor(eid: string, deps: any) { super(eid, { ...deps, beacon: fakeBeacon(nowMs), verify: (x: any) => x.signature === "aa", mono: () => deps.mono() }); } }; };

type World = ReturnType<typeof newWorld>;
type Who = { pid: string; device: string };
let W: World; let token = ""; let GAME: { id: string; t: ReturnType<typeof truth> }; let players: Who[] = [];
const dev = (i: number) => i.toString(16).padStart(32, "0");
const seatWho = (seat: number): Who => players[seat - 1]!;

beforeAll(async () => {
  GAME = pickGame();
  W = newWorld({ JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000" }); W.world.now = T;
  const s = await W.json(await W.api("POST", "/api/start", { email: "boss@acme.com" })); token = s.token;
  expect((await W.api("POST", "/api/z", { id: GAME.id, startRound: START, callSeconds: 10, cap: 100, ...SETTINGS, ...MSG }, token)).status).toBe(200);
  expect((await W.api("POST", `/api/z/${GAME.id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, token)).status).toBe(200);
  (W.world as any).raw.prepare("UPDATE engagement SET pack=100 WHERE id=?").run(GAME.id); // paid
  for (let i = 1; i <= PLAYERS; i++) {
    const r = await W.api("POST", `/api/z/${GAME.id}/join`, { name: "Player" + i, device: dev(i) }, undefined, T + 1000 + i);
    const j = await W.json(r); if (r.status !== 200) throw new Error("join " + i + ": " + JSON.stringify(j));
    expect(j.pid).toMatch(new RegExp("^" + i + "x")); players.push({ pid: j.pid, device: dev(i) });
  }
});

/** The phone page of one player of the shared game (the page already holds the player's own pid and device, as it does after joining), with the public clock at `now`. */
async function phonePage(who: Who, now: number) {
  W.world.now = now;
  const p = await openPage(W.world, { url: `http://localhost/z?e=${GAME.id}`, html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"], afterLoad: (win, f) => {
    if (f === "audio.js") { win.localStorage.setItem("cbz:device", who.device); win.localStorage.setItem(`cbz:${GAME.id}:pid`, who.pid); }
    if (f === "zgame.js") rtFake(win, () => W.world.now);
  } });
  open.push(p); return p;
}
async function bigPage(now: number) {
  W.world.now = now;
  const p = await openPage(W.world, { url: `http://localhost/big.html?e=${GAME.id}`, html: "big.html", scripts: ["zgame.js", "big.js"], afterLoad: (win, f) => { if (f === "zgame.js") rtFake(win, () => W.world.now); } });
  open.push(p); return p;
}
const text = (el: any) => String(el?.textContent ?? "").replace(/\s+/g, " ").trim();
const other = () => [2, 3, 4, 5, 6].find((s) => ![GAME.t.milestone, GAME.t.first, GAME.t.second].includes(s))!; // a player who wins nothing

describe("before the game starts: the pre-game message", () => {
  test("the waiting screen of the phone page shows the organizer's pre-game message under the countdown; the other two messages are not shown yet", async () => {
    const p = await phonePage(seatWho(other()), T);
    await p.waitFor(() => !!p.$("#premsg"), 60000);
    const box = p.$("#premsg");
    expect(text(p.$("#premsg b"))).toBe("A message from the organizer"); expect(text(p.$("#premsg p"))).toBe(MSG.preGameMessage);
    expect(p.text()).toMatch(/Starting in|setting up/);
    expect(p.text()).not.toContain(MSG.winnerMessage); expect(p.text()).not.toContain(MSG.closingMessage);
    expect(text(box)).not.toMatch(WORDS);
    expect(p.errors).toEqual([]);
  });
  test("the big screen shows it too, under its countdown, and nothing else of the three", async () => {
    const p = await bigPage(T);
    await p.waitFor(() => !!p.$("#premsg"), 60000);
    expect(text(p.$("#premsg"))).toBe(MSG.preGameMessage);
    expect(p.text()).not.toContain(MSG.winnerMessage); expect(p.text()).not.toContain(MSG.closingMessage);
    expect(p.errors).toEqual([]);
  });
  test("the message is plain text: a message the organizer wrote with tags is shown as words, never as markup", async () => {
    const w = newWorld(); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    expect((await w.api("POST", "/api/z", { id: "TAGS-1", startRound: START, callSeconds: 10, cap: 100, preGameMessage: "Hello <b>team</b><script>alert(1)</script> & welcome" }, s.token)).status).toBe(200);
    expect((await w.api("POST", "/api/z/TAGS-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
    (w.world as any).raw.prepare("UPDATE engagement SET pack=100 WHERE id='TAGS-1'").run();
    const p = await openPage(w.world, { url: "http://localhost/z?e=TAGS-1", html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"], afterLoad: (win, f) => { if (f === "zgame.js") rtFake(win, () => w.world.now); } });
    open.push(p);
    await p.waitFor((x) => /Join the game/.test(x), 30000);
    (p.$("#nm") as any).value = "Asha"; const ph = p.$("#ph") as any; if (ph) ph.value = "9812345678"; p.click("#go");
    await p.waitFor(() => !!p.$("#premsg"), 60000);
    expect(text(p.$("#premsg p"))).toBe("Hello team & welcome"); // the tags are gone, the & is shown as a plain &
    expect(p.$("#premsg script")).toBeNull(); expect(p.html()).not.toContain("<script");
  });
});

describe("while the game is running: a winner is told what was won, with the winner message", () => {
  test("the milestone winner sees the organizer's words for the prize, the plain sentence under them and the winner message, in the pop-up and on the page; nobody sees the closing message yet", async () => {
    const p = await phonePage(seatWho(GAME.t.milestone), GAME.t.afterTurn1Ms);
    await p.waitFor(() => !!p.$(".zwon"), 90000);
    const card = text(p.$(".zwon"));
    expect(card).toContain("Congratulations! You won:");
    expect(card).toContain("Coffee mug");
    expect(card).toContain("You reached square 2 first and won the milestone gift.");
    expect(text(p.$("#winmsg"))).toBe(MSG.winnerMessage);
    const hurray = p.win.document.getElementById("hurray"); expect(!!hurray).toBe(true);
    expect(text(hurray)).toContain("Congratulations, you won"); expect(text(hurray)).toContain("Coffee mug"); expect(text(hurray)).toContain("You reached square 2 first and won the milestone gift.");
    expect(text(p.win.document.getElementById("hurmsg"))).toBe(MSG.winnerMessage);
    expect(p.$("#closemsg")).toBeNull(); expect(p.$("#premsg")).toBeNull(); expect(p.text()).not.toContain(MSG.closingMessage);
    for (const t of [card, text(hurray)]) expect(t.replace(MSG.winnerMessage, "").replace("Coffee mug", "")).not.toMatch(WORDS);
    expect(p.errors).toEqual([]);
  });
  test("a player who has won nothing sees no winner message, no 'you won' card and no pop-up", async () => {
    const p = await phonePage(seatWho(other()), GAME.t.afterTurn1Ms);
    await p.waitFor((x) => /Turn \d+ of/.test(x), 90000);
    await new Promise((r) => setTimeout(r, 2500)); // give the page time to settle its results
    expect(p.$(".zwon")).toBeNull(); expect(p.$("#winmsg")).toBeNull(); expect(p.win.document.getElementById("hurray")).toBeNull();
    expect(p.text()).not.toContain(MSG.winnerMessage); expect(p.text()).not.toContain(MSG.closingMessage);
  });
});

describe("when the game is over", () => {
  test("the player who won the milestone, the player who came 2nd and a player who won nothing each see the right things on the final screen", async () => {
    const t = GAME.t;
    const [m, s2, x] = await Promise.all([phonePage(seatWho(t.milestone), t.overMs), phonePage(seatWho(t.second), t.overMs), phonePage(seatWho(other()), t.overMs)]);
    await Promise.all([m, s2, x].map((p) => p.waitFor((v) => /Game complete/.test(v) && !!p.$("#closemsg"), 150000)));

    // every player: the closing message, under the final card, in the organizer's words
    for (const p of [m, s2, x]) {
      expect(text(p.$("#closemsg h2"))).toBe("A message from the organizer"); expect(text(p.$("#closemsg p"))).toBe(MSG.closingMessage);
      expect(p.text()).not.toContain(MSG.preGameMessage);
    }
    // the milestone winner: the reward text, the plain sentence, the winner message, once
    const mp = text(m.$(".zprizes"));
    expect(mp).toContain("Coffee mug"); expect(mp).toContain("You reached square 2 first and won the milestone gift."); expect(mp).not.toContain("You came");
    expect(text(m.$("#winmsg"))).toBe(MSG.winnerMessage); expect(m.html().split('id="winmsg"').length - 1).toBe(1);
    expect(text(m.$(".zfinal"))).toContain("You won 1 prize!");
    // 2nd place: no words from the organizer for that prize, so the plain sentence stands alone
    const sp = text(s2.$(".zprizes"));
    expect(sp).toContain("You came 2nd. You were the 2nd player to get home."); expect(sp).not.toContain("Coffee mug"); expect(sp).not.toContain("Gift card"); expect(sp).not.toContain("reached square");
    expect(text(s2.$("#winmsg"))).toBe(MSG.winnerMessage);
    expect(text(s2.$(".zfinal"))).toContain("You won 1 prize!");
    // a player who won nothing: the closing message and nothing about winning
    expect(x.$(".zprizes")).toBeNull(); expect(x.$("#winmsg")).toBeNull(); expect(x.$(".zwon")).toBeNull();
    expect(x.text()).not.toContain(MSG.winnerMessage); expect(x.text()).not.toContain("You came"); expect(x.text()).not.toContain("won the milestone gift");
    // the words the product itself added are plain: no my / your / mine / yours, nickname, ticket, host, guest, participant
    for (const p of [m, s2, x]) for (const el of [p.$("#closemsg h2"), p.$(".zprizes .zwonsub")]) if (el) expect(text(el)).not.toMatch(WORDS);
    expect(text(s2.$(".zprizes .zwonwhat"))).not.toMatch(WORDS); // 2nd place has no words from the organizer, so this line is the product's own sentence
    expect(m.$(".zwon")).toBeNull(); expect(s2.$(".zwon")).toBeNull(); // once the game is over the prizes card tells it, not the card at the top (so nothing is said twice)
    for (const p of [m, s2, x]) expect(p.errors).toEqual([]);
  });
  test("the big screen says Game over and shows the closing message; the pre-game message is gone", async () => {
    const p = await bigPage(GAME.t.overMs);
    await p.waitFor((v) => /Game over/.test(v) && !!p.$("#closemsg"), 150000);
    expect(text(p.$("#closemsg"))).toBe(MSG.closingMessage);
    expect(p.$("#premsg")).toBeNull(); expect(p.text()).not.toContain(MSG.winnerMessage);
    expect(p.errors).toEqual([]);
  });
  test("a game whose organizer wrote no messages shows none: the winner is still told what they won, and nothing extra appears", async () => {
    const raw = (W.world as any).raw;
    const row = raw.prepare("SELECT config FROM engagement WHERE id=?").get(GAME.id) as { config: string };
    const cfg = JSON.parse(row.config); const keep = { ...cfg };
    for (const k of Object.keys(MSG)) delete cfg[k];
    raw.prepare("UPDATE engagement SET config=? WHERE id=?").run(JSON.stringify(cfg), GAME.id); // the organizer's messages are taken away (the test's own way: the game has started, so the console would refuse)
    try {
      const p = await phonePage(seatWho(GAME.t.second), GAME.t.overMs);
      await p.waitFor((v) => /Game complete/.test(v), 150000);
      expect(text(p.$(".zprizes"))).toContain("You came 2nd.");
      expect(p.$("#winmsg")).toBeNull(); expect(p.$("#closemsg")).toBeNull(); expect(p.$("#premsg")).toBeNull();
    } finally { raw.prepare("UPDATE engagement SET config=? WHERE id=?").run(JSON.stringify(keep), GAME.id); }
  });
});

describe("the organizer's console: the Messages card in step 4", () => {
  async function consoleFor(id: string, over: Record<string, unknown> = {}) {
    const w = newWorld(); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    expect((await w.api("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 100, ...over }, s.aiKey)).status).toBe(200);
    const p = await openPage(w.world, { url: `http://localhost/zc.html?e=${id}`, html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
    open.push(p);
    await p.waitFor((x) => /Check and publish/.test(x), 30000);
    return { p, w, s };
  }
  const openStep4 = async (p: Page) => { p.click('.zc-sech[data-open="4"]'); await p.waitFor(() => !!p.$("#messagesbox"), 30000); };
  const typeIn = (p: Page, id: string, v: string) => { const el = p.$(id) as any; el.value = v; el.dispatchEvent(new p.win.Event("input", { bubbles: true })); };
  const until = async (fn: () => Promise<boolean>, ms = 20000) => { const t0 = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t0 > ms) throw new Error("timed out"); await new Promise((r) => setTimeout(r, 60)); } };

  test("step 4 shows three labelled text boxes with a character counter and a note that an AI can write them; the words are plain", async () => {
    const { p } = await consoleFor("CON-1");
    await openStep4(p);
    const box = p.$("#messagesbox"), t = text(box);
    expect(t).toContain("Messages"); expect(t).toContain("Message before the game starts"); expect(t).toContain("Message for a winner"); expect(t).toContain("Message when the game is over");
    expect(t).toContain(`up to ${MESSAGE_MAX} characters each`); expect(t).toContain("An AI assistant can write these for you"); expect(t).toContain("Nothing is shown to players until you save");
    for (const [id, label] of [["#f-msg-pre", "Message before the game starts"], ["#f-msg-win", "Message for a winner"], ["#f-msg-cl", "Message when the game is over"]] as const) {
      const ta = p.$(id) as any; expect(ta?.tagName).toBe("TEXTAREA"); expect(ta.getAttribute("maxlength")).toBe(String(MESSAGE_MAX));
      expect(text(p.win.document.querySelector(`label[for="${id.slice(1)}"]`))).toBe(label); // really labelled
    }
    expect(text(p.$("#cnt-pre"))).toBe("0");
    expect(t).not.toMatch(WORDS);
    expect(p.errors).toEqual([]);
  });
  test("typing counts the characters; Save and continue saves all three; the Worker keeps them and the read-back says 3 of 3 written", async () => {
    const { p, w, s } = await consoleFor("CON-2");
    await openStep4(p);
    typeIn(p, "#f-msg-pre", "Hello players, welcome!"); expect(text(p.$("#cnt-pre"))).toBe(String("Hello players, welcome!".length));
    typeIn(p, "#f-msg-win", "You did it. Collect the gift at the desk."); typeIn(p, "#f-msg-cl", "Thanks for playing.");
    p.click('[data-save="4"]');
    await until(async () => (await w.json(await w.api("GET", "/api/z/CON-2/summary", undefined, s.token))).closingMessage === "Thanks for playing.");
    const sum = await w.json(await w.api("GET", "/api/z/CON-2/summary", undefined, s.token));
    expect(sum).toMatchObject({ preGameMessage: "Hello players, welcome!", winnerMessage: "You did it. Collect the gift at the desk.", closingMessage: "Thanks for playing." });
    expect(await w.json(await w.api("GET", "/api/z/CON-2/info", undefined, s.token))).toMatchObject({ winnerMessage: "You did it. Collect the gift at the desk." });
    // opening the game again shows what was saved, and the Check step reads back how many are written
    const q = await openPage(w.world, { url: "http://localhost/zc.html?e=CON-2", html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
    open.push(q); await q.waitFor((x) => /Check and publish/.test(x), 30000);
    await openStep4(q);
    expect((q.$("#f-msg-pre") as any).value).toBe("Hello players, welcome!"); expect((q.$("#f-msg-win") as any).value).toBe("You did it. Collect the gift at the desk."); expect((q.$("#f-msg-cl") as any).value).toBe("Thanks for playing.");
    expect(text(q.$("#cnt-cl"))).toBe(String("Thanks for playing.".length));
    q.click('.zc-sech[data-open="7"]'); await q.waitFor((x) => /3 of 3 written/.test(x), 20000);
  });
  test("clearing one box and saving removes only that message; saving without a change sends nothing", async () => {
    const { p, w, s } = await consoleFor("CON-3", { preGameMessage: "Keep me", winnerMessage: "Remove me", closingMessage: "Keep me too" });
    await openStep4(p);
    expect((p.$("#f-msg-win") as any).value).toBe("Remove me"); expect(text(p.$("#cnt-win"))).toBe(String("Remove me".length));
    typeIn(p, "#f-msg-win", "");
    p.click('[data-save="4"]');
    await until(async () => !("winnerMessage" in (await w.json(await w.api("GET", "/api/z/CON-3/summary", undefined, s.token)))));
    expect(await w.json(await w.api("GET", "/api/z/CON-3/summary", undefined, s.token))).toMatchObject({ preGameMessage: "Keep me", closingMessage: "Keep me too" });
    // an AI changes a message while the console is open and the person saves without touching the boxes: the AI's text is not overwritten by an old copy
    expect((await w.api("PATCH", "/api/z/CON-3/settings", { preGameMessage: "Written by the AI" }, s.aiKey)).status).toBe(200);
    await openStep4(p); p.click('[data-save="4"]');
    await new Promise((r) => setTimeout(r, 600));
    expect((await w.json(await w.api("GET", "/api/z/CON-3/summary", undefined, s.token))).preGameMessage).toBe("Written by the AI");
  });
  test("a message the server refuses is explained in plain words next to the card, and nothing is saved", async () => {
    const { p, w, s } = await consoleFor("CON-4", { winnerMessage: "Saved before" });
    await openStep4(p);
    const ta = p.$("#f-msg-win") as any; ta.removeAttribute("maxlength"); // the box itself stops at 300; this proves the server's refusal reaches the person too
    typeIn(p, "#f-msg-win", "z".repeat(MESSAGE_MAX + 5));
    p.click('[data-save="4"]');
    await p.waitFor((x) => /can be at most 300 characters/.test(x), 20000);
    expect((await w.json(await w.api("GET", "/api/z/CON-4/summary", undefined, s.token))).winnerMessage).toBe("Saved before");
  });
});

describe("the guide: a refused message is explained", () => {
  test("every refusal of a message (too long, not text) is matched by the guide entry for step 4, in all three messages", async () => {
    const w = newWorld({ DATA_KEY: "k" });
    const p = await openPage(w.world, { url: "http://localhost/pricing.html", html: "pricing.html", scripts: ["guide.js"] });
    open.push(p); const CTG = p.win.CTG;
    const seen: string[] = [];
    for (const f of ["preGameMessage", "winnerMessage", "closingMessage"]) for (const bad of ["x".repeat(MESSAGE_MAX + 1), 42]) {
      const r = validateCfg({ [f]: bad } as any); expect(r.ok).toBe(false);
      const msg = (r as any).error as string; seen.push(msg);
      const g = CTG.find({ status: 400, message: msg });
      expect([msg, g.matched]).toEqual([msg, true]);
      expect(g.entry.t).toBe("Please check the game message"); expect(g.entry.g.step).toBe(4); expect(g.entry.k).toBe("field");
      const e = CTG.explain({ status: 400, message: msg });
      expect(e.steps.length).toBeGreaterThan(1); expect(e.title.length).toBeGreaterThan(8);
      expect([e.title, ...e.steps, e.what].join(" ")).not.toMatch(WORDS);
    }
    expect(new Set(seen).size).toBe(6); // six different sentences, each one matched
  });
});
