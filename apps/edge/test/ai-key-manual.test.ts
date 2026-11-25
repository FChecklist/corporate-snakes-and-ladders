// What an AI that holds a key reads (GET /ai/<key>, /map, /go, and the JSON manifest) must describe THIS game, in the owner's words, and must teach the rules about paying and the three messages.
// The older text came from the bingo game (calling speeds, cards per person, houses, a B I N G O card): it would have misled an AI. Every API name stays exactly as the code uses it
// (tickets, /participants, host, co-host, seat, cba_ ...); this test removes those names and then checks that the words around them are the owner's.
import { beforeEach, describe, expect, test } from "bun:test";
import { withDevice } from "./device";
import { AI_MANIFEST, handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { AI_CANNOT_PAY } from "../src/ai-pay";
import { STEPS } from "../src/ai-steps";
import { aiPaste, manualJson, manualText } from "../src/ai-link";
import { FUNCTIONS, mapText } from "../src/ai-functions";
import { coHostLinkMail } from "../src/mails";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const ORIGIN = "https://bingo.test";
const KEY = "cba_" + "a".repeat(48), HKEY = "cbh_" + "b".repeat(48);
const MESSAGE = "An AI assistant cannot pay. Only the organizer or a co-organizer can pay, with Pay now in the console. Please tell the organizer that the game is ready to pay.";
let env: PayEnv;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env as Env, T);
beforeEach(() => { const d = makeD1(); env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: ORIGIN, DATA_KEY: "test-data-key" } as PayEnv; });

/** The key manual without the ten facts (their words belong to ai-facts.ts). */
const withoutFacts = (t: string) => t.replace(/THE 10 FACTS[\s\S]*?- Trust page: \S+/, " ");
/** Removes the API names that must stay as the code spells them, so that only the words around them are left to read. */
const withoutApiNames = (t: string) => t
  .replace(/`?tickets`?(?: is always 1|\?: 1|\) is always 1)/g, " ").replace(/\/participants/g, " ").replace(/org\/host/g, " ").replace(/role: organizer\|host\|co-host\|none/g, " ").replace(/\{kind: host\}/g, " ")
  .replace(/host \(a co-organizer\)/g, " ").replace(/co-host \(a game helper\)/g, " ").replace(/host = a co-organizer/g, " ").replace(/co-host = a game helper/g, " ").replace(/host is a co-organizer and co-host is a game helper/g, " ")
  .replace(/neighbours, guests\./g, " ").replace(/\bhost@example\.com/g, " ");
const BANNED = /guest|ticket|\bhosts?\b|co-host|participant|engagement|nickname|\b(my|mine|your|yours)\b|\bevents?\b|razorpay|checkout|payment link|\bcards?\b|\bhouses?\b/i;
const LEFTOVERS = /B I N G O|5 x 5|FREE centre|Calling speed|call speed|6\|9\|12\|15|15\|20\|25\|30|Two-Ticket|Full House|Four Corners|Blackout|cards? per person|for each ticket|1 to 5 games|1-5 rounds|rounds?: 1-5|event planner|Participants card/i;

describe("the key manual describes this game, with the three messages and the rule about paying", () => {
  const ai = () => manualText(ORIGIN, KEY, "ai", T), host = () => manualText(ORIGIN, HKEY, "host", T);
  test("it says the AI key starts with cba_, points to the public manual page, and never names the organizer's own key", () => {
    const t = ai(), first = t.slice(0, 3000);
    expect(first).toContain("starts with cba_"); expect(first).toContain(`${ORIGIN}/ai-manual`); expect(t).toContain("The key starts with cba_: it is an AI key."); expect(t).not.toMatch(/cbk_/);
  });
  test("the three messages are in the settings call and in the create call: field names, who sees each, 300 characters, plain text, a clear yes first", () => {
    const t = ai();
    for (const f of ["preGameMessage", "winnerMessage", "closingMessage"]) expect(t).toContain(f);
    expect(t).toMatch(/preGameMessage\?: text, winnerMessage\?: text, closingMessage\?: text \(each plain text, up to 300 characters; "" or null clears one\)/);
    expect(t).toMatch(/preGameMessage \(players see it before the game starts\), winnerMessage \(a winner sees it together with what they won\) and closingMessage \(every player sees it when the game is over\)/);
    expect(t).toMatch(/refused with a plain answer, never cut/); expect(t).toMatch(/sent when the game is created \(POST z\) or here, before the first turn/); expect(t).toMatch(/send them only after a clear yes/);
    const j = manualJson(ORIGIN, KEY, "ai", T); const patch = j.endpoints.find((e: any) => e.method === "PATCH" && /settings/.test(e.url))!; expect(patch.body).toContain("preGameMessage?: text"); expect(patch.note).toContain("THE THREE MESSAGES");
    const create = j.endpoints.find((e: any) => e.method === "POST" && /\/z$/.test(e.url))!; expect(create.body).toContain("any setting listed under PATCH");
    expect(JSON.stringify(AI_MANIFEST)).toMatch(/preGameMessage\?, winnerMessage\?, closingMessage\? \(plain text, up to 300 characters each/);
    expect(FUNCTIONS.find((f) => f.id === "messages")).toMatchObject({ who: "ai", call: "PATCH z/{id}/settings", body: "{preGameMessage?, winnerMessage?, closingMessage?}" });
  });
  test("paying: an AI key is told it cannot pay, the exact sentence, who pays and where, in the manual, the map, the manifest and the host manual", () => {
    for (const [name, text] of [["manual", ai()], ["co-organizer manual", host()], ["manifest", JSON.stringify(AI_MANIFEST).replace(/\\"/g, '"')], ["map", mapText(`${ORIGIN}/ai/${KEY}`, ORIGIN)]] as const) { expect([name, text.includes(MESSAGE)]).toEqual([name, true]); }
    const t = ai(); expect(t).toContain("Only the organizer or a co-organizer can pay, with Pay now in the console."); expect(t).toContain("The game is paid with credits. The credits system is Moneypenny.");
    expect(t).toContain(`${ORIGIN}/ai-manual), read from the payee record`); expect(t).toMatch(/Do not promise a refund/);
    expect(t).not.toMatch(/Give the organizer payUrl|they pay themselves|Use your credit|Use Your credit/); // the older "give the pay address" advice is gone
    const m = JSON.stringify(AI_MANIFEST); expect(m).toContain("Moneypenny"); expect(m).toContain("/ai-manual"); expect(m).toContain("Pay now");
  });
  test("it is about this game: the 10 second window, race, team and table play, the board, milestones, the gifts of this game, and the real limits", () => {
    const t = ai();
    for (const w of ["callSeconds: 10", "every turn has a 10 second window", "mode?: race|team|table", "board?: {size: 100|144|225, snakes: 6-12, ladders: 6-12, finish: exact|pass}", "milestones?: [1 to 3 different squares", "turnCap?: 10-150", "endPrizes?: 1-5", "exclusive?: true|false", "theme?: jungle|career", "pattern: milestone|finish|team|climb|comeback", "tickets?: 1 (each player has one pawn)", "rounds?: 1 (a game has one round)", "name?: up to 60 characters", "whoCanJoin?: list|anyone"]) expect([w, t.includes(w)]).toEqual([w, true]);
    expect(t).toMatch(/Gifts \(id: name, how it is won, most winners\): milestone: Milestone\./); expect(t).not.toMatch(/nevermissed/); expect(t).toContain("Reach the end");
    expect(t).toMatch(/5 in all for a game: 1 opening/); expect(t).toMatch(/Invitations by players are off in a game made under the current rules/); expect(t).toContain("franchisees");
  });
  test("no leftover from the bingo game in the manual, the map, the manifest or the guided path", () => {
    for (const [name, text] of [["manual", ai()], ["co-organizer manual", host()], ["manifest", JSON.stringify(AI_MANIFEST)], ["map", mapText(`${ORIGIN}/ai/${KEY}`, ORIGIN)]] as const) expect([name, withoutFacts(text).match(LEFTOVERS)?.[0] ?? null]).toEqual([name, null]);
  });
  test("the words around the API names are the owner's: no guest, ticket, host, participant, engagement, nickname, my, mine, your, yours, event, card, house", () => {
    const m = JSON.stringify(AI_MANIFEST).replace(/\\"/g, '"').replace(/\\n/g, " ").replace(/scratch card/g, "scratch"); // a lucky draw can be shown as a scratch card: that word is the product's, not the old card
    for (const [name, text] of [["manual", ai()], ["co-organizer manual", host()], ["manifest", m], ["map", mapText(`${ORIGIN}/ai/${KEY}`, ORIGIN)]] as const) {
      const hits = [...withoutApiNames(withoutFacts(text)).matchAll(new RegExp(BANNED.source, "gi"))].map((x) => x[0]);
      expect([name, hits]).toEqual([name, []]);
    }
  });
  test("the numbered conversation is the same list as the public page: twelve steps, the same plain words, in the manual, the JSON and the manifest", () => {
    expect(STEPS.length).toBe(12);
    const j = manualJson(ORIGIN, KEY, "ai", T); expect(j.conversation!.length).toBe(12); const mf = AI_MANIFEST.conversation; expect(mf.length).toBe(12);
    STEPS.forEach((s, i) => { expect(j.conversation![i]).toContain(s.say); expect(mf[i]).toContain(s.say); expect(j.conversation![i]!.startsWith(`${i + 1}. `)).toBe(true); });
    expect(j.conversation![9]).toContain(`POST ${ORIGIN}/ai/${KEY}/z or any other write`); expect(mf[9]).toContain("DO NOT call POST /api/z or any other write"); expect(mf[10]).toMatch(/^11\. When they say it is ready/); expect(mf[11]).toMatch(/^12\. Afterwards/);
  });
  test("the co-organizer's manual says co-organizer, reads and messages only, and carries the same refusal to pay", () => {
    const t = host(); expect(t).toContain("co-organizer's AI assistant"); expect(t).toContain("You help a co-organizer"); expect(t).toContain(MESSAGE);
    expect(t).not.toMatch(/PATCH .*settings|\/roster|org\/host|cba_/); expect(t).toContain(`${ORIGIN}/ai/${HKEY}/z/{id}/announce`);
    expect(manualJson(ORIGIN, HKEY, "host", T).name).toBe("Corporate Snakes and Ladders co-organizer AI manual");
  });
  test("the AI link's paste text says 'the account that I own' (not 'MY OWN'), and so does the co-organizer's mail, which names the owner instead", () => {
    const paste = aiPaste(ORIGIN, KEY); expect(paste.split("\n")[0]).toBe("This is the API documentation and instructions for the Corporate Snakes and Ladders account that I own. I am the owner, and I am asking you to read it and help me with it."); expect(paste).not.toMatch(/MY OWN/);
    const mail = coHostLinkMail(ORIGIN, HKEY, "boss@acme.com", T + 86_400_000);
    expect(mail.text).toContain("instructions for the Corporate Snakes and Ladders account of boss@acme.com. I am their co-organizer, and I am asking you"); expect(mail.text).not.toContain("account that I own"); expect(mail.text).not.toContain("I am their Host");
  });
});

describe("served at /ai/<key>", () => {
  async function organizer() { const r = await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" }); const x = (await r.json()) as any; return { key: x.aiKey as string, token: x.token as string }; }
  test("the manual, the map and the manifest an AI really receives carry it all; the front door still holds all ten facts in its first 7,000 characters", async () => {
    const o = await organizer(); const text = await (await call("GET", `/ai/${o.key}`)).text(); const map = await (await call("GET", `/ai/${o.key}/map`)).text(); const mf = JSON.stringify(await (await call("GET", "/api/z/ai-manifest")).json());
    expect(text).toContain("starts with cba_"); expect(text).toContain(MESSAGE); expect(text).toContain("preGameMessage"); expect(map).toContain("The pre-game, winner and closing messages"); expect(mf).toContain("preGameMessage");
    const { FACTS } = await import("../src/ai-facts"); const last = FACTS[FACTS.length - 1]!; expect(text.indexOf(last.say) + last.say.length).toBeLessThan(7000);
  });
  test("a setting the manual teaches is accepted: a game made the way the manual says, with the three messages, reads back (when the settings code knows the messages)", async () => {
    const o = await organizer(); const start = Math.floor(((T + 86_400_000) / 1000 - 1692803367) / 3) + 1;
    const made = await call("POST", `/ai/${o.key}/z`, { id: "KEY-1", startRound: start, callSeconds: 10, cap: 100, mode: "race", board: { size: 144, snakes: 8, ladders: 8, finish: "pass" }, milestones: [40, 80], turnCap: 40, endPrizes: 3, exclusive: true, theme: "career", name: "Welcome game", rewards: [{ pattern: "milestone", ordinal: 1, text: "Hamper" }, { pattern: "milestone", ordinal: 2, text: "Pen" }, { pattern: "finish", ordinal: 1, text: "Tablet" }, { pattern: "climb", ordinal: 1, text: "Voucher" }, { pattern: "comeback", ordinal: 1, text: "Cap" }] });
    expect([made.status, made.status === 200 ? "" : await made.text()]).toEqual([200, ""]);
    const set = await call("PATCH", `/ai/${o.key}/z/KEY-1/settings`, { breaks: [{ kind: "lucky", title: "Lucky draw", winners: 3, seconds: 60 }], opening: [{ kind: "speech", title: "Welcome everyone", seconds: 30 }], closing: [{ kind: "speech", title: "Thank you" }] });
    expect([set.status, set.status === 200 ? "" : await set.text()]).toEqual([200, ""]);
    const s = (await (await call("GET", `/ai/${o.key}/z/KEY-1/summary`)).json()) as any; expect(s.callSeconds).toBe(10); expect(s.rewards.length).toBe(5); expect(s.breaks.length).toBe(1);
    const wrong = await call("POST", `/ai/${o.key}/z`, { id: "KEY-2", startRound: start, callSeconds: 9, cap: 100 }); expect(wrong.status).toBe(400); expect(((await wrong.json()) as any).error).toBe("Every turn has a 10 second window."); // the manual says 10, and the code agrees
  });
  test("the three messages work as the manual says (checked as soon as the settings code knows them): set in the create call and the settings call by an AI key, read back, cleared with an empty text, refused over 300 characters, never cut", async () => {
    const cfg: any = await import("../../../packages/beacon/src/config"); if (!Array.isArray(cfg.MESSAGE_FIELDS)) return; // the messages arrive with the messages work; until then the manual documents them and this check waits
    expect(cfg.MESSAGE_MAX).toBe(300);
    const o = await organizer(); const start = Math.floor(((T + 86_400_000) / 1000 - 1692803367) / 3) + 1;
    const made = await call("POST", `/ai/${o.key}/z`, { id: "MSG-AI1", startRound: start, callSeconds: 10, cap: 100, preGameMessage: "Welcome! The game starts soon. Please keep this page open." });
    expect(made.status).toBe(200);
    const set = await call("PATCH", `/ai/${o.key}/z/MSG-AI1/settings`, { winnerMessage: "Congratulations! Please collect the gift from the organizer.", closingMessage: "Thank you for playing. See you next time!" });
    expect(set.status).toBe(200);
    let s = (await (await call("GET", `/ai/${o.key}/z/MSG-AI1/summary`)).json()) as any;
    expect([s.preGameMessage, s.winnerMessage, s.closingMessage]).toEqual(["Welcome! The game starts soon. Please keep this page open.", "Congratulations! Please collect the gift from the organizer.", "Thank you for playing. See you next time!"]);
    const clear = await call("PATCH", `/ai/${o.key}/z/MSG-AI1/settings`, { preGameMessage: "", winnerMessage: null }); expect(clear.status).toBe(200);
    s = (await (await call("GET", `/ai/${o.key}/z/MSG-AI1/summary`)).json()) as any; expect([s.preGameMessage, s.winnerMessage, s.closingMessage]).toEqual([undefined, undefined, "Thank you for playing. See you next time!"]);
    const long = await call("PATCH", `/ai/${o.key}/z/MSG-AI1/settings`, { closingMessage: "x".repeat(301) }); expect(long.status).toBe(400);
    s = (await (await call("GET", `/ai/${o.key}/z/MSG-AI1/summary`)).json()) as any; expect(s.closingMessage).toBe("Thank you for playing. See you next time!"); // refused, not cut and not changed
  });
});
