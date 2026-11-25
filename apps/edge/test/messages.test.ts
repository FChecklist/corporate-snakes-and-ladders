// The three optional messages an organizer may write (preGameMessage, winnerMessage, closingMessage): plain text, up to 300 characters each.
// Real Worker code, in-memory D1. Same rules as every other setting: the organizer, the co-organizer (kind "host") and the organizer's AI set them before the game starts; a Co-host cannot;
// players read them from the public info; nothing private travels with them.
import { beforeEach, describe, expect, test } from "bun:test";
import { withDevice } from "./device";
import { type Env } from "../src/worker";
import { handle } from "./cohost-accepted"; // a Co-host key has accepted the role, so a refusal below is about the role and nothing else
import { makeD1 } from "./d1-sqlite";
import { MESSAGE_FIELDS, MESSAGE_MAX } from "../../../packages/beacon/src/config";

const T = Date.UTC(2026, 9, 1, 10, 0, 0);
const DAY = 86_400_000;
const roundOf = (ms: number) => Math.floor((ms / 1000 - 1692803367) / 3) + 1;
const START = roundOf(T + 2 * DAY);
const AFTER_START = T + 2 * DAY + 60_000;
let env: Env; let raw: ReturnType<typeof makeD1>["raw"];
let ip = 0;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}, now = T) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env, now);
const j = async (r: Response) => (await r.json()) as any;
const as = (key: string, extra: Record<string, string> = {}) => ({ "x-organizer": key, ...extra });
const pubBody = { email: "boss@acme.com", phone: "98765 43210" };
const WORDS = /\b(my|mine|your|yours|host|hosts|co-host|guest|guests|participant|participants|nickname|ticket|tickets|engagement)\b/i; // the owner's word rules for anything a person reads

type Team = { master: string; ai: string; host: string; cohost: string };
let team: Team;
beforeEach(async () => {
  const d = makeD1(); raw = d.raw;
  env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "1000000", JOIN_PER_IP_DAY: "1000000", JOIN_PER_IP_MINUTE: "1000000", DATA_KEY: "k", PUBLIC_ORIGIN: "https://bingo.test" } as any;
  const o = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": `9.9.9.${++ip}` }));
  expect(o.token).toMatch(/^cbk_/); expect(o.aiKey).toMatch(/^cba_/);
  const host = await j(await call("POST", "/api/org/host", { mobile: "9876500009", label: "Priya", email: "priya@acme.com" }, as(o.token)));
  expect(host.hostKey).toMatch(/^cbh_/);
  const created = await call("POST", "/api/z", { id: "MSG-0", startRound: START, callSeconds: 10, cap: 100 }, as(o.token)); expect(created.status).toBe(200);
  const cohost = await j(await call("POST", "/api/org/cohost", { label: "Ravi", phone: "9876500001", e: "MSG-0" }, as(o.token)));
  expect(cohost.cohostKey).toMatch(/^cbc_/);
  team = { master: o.token, ai: o.aiKey, host: host.hostKey, cohost: cohost.cohostKey };
});

const make = (id: string, over: Record<string, unknown> = {}, key = () => team.master) => call("POST", "/api/z", { id, startRound: START, callSeconds: 10, cap: 100, ...over }, as(key()));
const publish = async (id: string) => { expect((await call("POST", `/api/z/${id}/publish`, pubBody, as(team.master))).status).toBe(200); };
const patch = (id: string, body: unknown, key = team.master, now = T, extra: Record<string, string> = {}) => call("PATCH", `/api/z/${id}/settings`, body, as(key, extra), now);
const summary = async (id: string, key = team.master) => j(await call("GET", `/api/z/${id}/summary`, undefined, as(key)));
const info = async (id: string) => j(await call("GET", `/api/z/${id}/info`)); // no key at all: what a player sees
const ALL = { preGameMessage: "Welcome! The game starts at 4 pm sharp.", winnerMessage: "Congratulations. Please collect the gift from the front desk.", closingMessage: "Thank you for playing. See you at the next one." };

describe("the three messages are optional settings", () => {
  test("the contract: exactly these three names, 300 characters", () => {
    expect([...MESSAGE_FIELDS]).toEqual(["preGameMessage", "winnerMessage", "closingMessage"]);
    expect(MESSAGE_MAX).toBe(300);
  });
  test("a game made without them has none: the keys are simply absent from info and summary", async () => {
    await make("MSG-1"); await publish("MSG-1");
    const i = await info("MSG-1"), s = await summary("MSG-1");
    for (const k of MESSAGE_FIELDS) { expect([k, k in i]).toEqual([k, false]); expect([k, k in s]).toEqual([k, false]); }
  });
  test("they are set when the game is made (POST /api/z) and come back in info, in the summary and in the answer to a change", async () => {
    expect((await make("MSG-2", ALL)).status).toBe(200);
    await publish("MSG-2");
    expect(await info("MSG-2")).toMatchObject(ALL);
    expect(await summary("MSG-2")).toMatchObject(ALL);
    const r = await patch("MSG-2", { name: "Spring party" });
    expect(r.status).toBe(200); expect(await j(r)).toMatchObject(ALL); // the answer to a change reads everything back
  });
  test("they are set and changed later (PATCH settings); a change to one leaves the other two and every other setting as they were", async () => {
    await make("MSG-3", { turnCap: 40 }); await publish("MSG-3");
    expect((await patch("MSG-3", { preGameMessage: "First words" })).status).toBe(200);
    expect((await patch("MSG-3", { winnerMessage: "Second words" })).status).toBe(200);
    expect((await patch("MSG-3", { closingMessage: "Third words" })).status).toBe(200);
    expect(await info("MSG-3")).toMatchObject({ preGameMessage: "First words", winnerMessage: "Second words", closingMessage: "Third words", turnCap: 40 });
    expect((await patch("MSG-3", { winnerMessage: "Better second words" })).status).toBe(200);
    expect(await info("MSG-3")).toMatchObject({ preGameMessage: "First words", winnerMessage: "Better second words", closingMessage: "Third words", turnCap: 40 });
    expect((await patch("MSG-3", { turnCap: 50 })).status).toBe(200); // another setting changes: the messages stay
    expect(await info("MSG-3")).toMatchObject({ preGameMessage: "First words", winnerMessage: "Better second words", closingMessage: "Third words", turnCap: 50 });
  });
  test("an empty string clears a message (so does null); the others stay; a cleared message is absent, not empty", async () => {
    await make("MSG-4", ALL); await publish("MSG-4");
    expect((await patch("MSG-4", { winnerMessage: "" })).status).toBe(200);
    let i = await info("MSG-4"); expect("winnerMessage" in i).toBe(false); expect(i.preGameMessage).toBe(ALL.preGameMessage); expect(i.closingMessage).toBe(ALL.closingMessage);
    expect("winnerMessage" in (await summary("MSG-4"))).toBe(false);
    expect((await patch("MSG-4", { preGameMessage: null })).status).toBe(200);
    i = await info("MSG-4"); expect("preGameMessage" in i).toBe(false); expect(i.closingMessage).toBe(ALL.closingMessage);
    expect((await patch("MSG-4", { closingMessage: "   \n\t  " })).status).toBe(200); // only spaces counts as empty
    i = await info("MSG-4"); for (const k of MESSAGE_FIELDS) expect([k, k in i]).toEqual([k, false]);
  });
  test("saving the same text again changes nothing; a message made only of spaces never reaches players", async () => {
    await make("MSG-5", { winnerMessage: "  Well   played  " }); await publish("MSG-5");
    expect((await info("MSG-5")).winnerMessage).toBe("Well played");
    expect((await patch("MSG-5", { winnerMessage: "Well played" })).status).toBe(200);
    expect((await info("MSG-5")).winnerMessage).toBe("Well played");
  });
});

describe("what is kept and what is refused", () => {
  test("300 characters is fine; 301 is refused with a plain, kind sentence that names the message and the count; nothing is saved", async () => {
    await make("MSG-6"); await publish("MSG-6");
    for (const k of MESSAGE_FIELDS) {
      expect((await patch("MSG-6", { [k]: "a".repeat(MESSAGE_MAX) })).status).toBe(200);
      expect((await info("MSG-6"))[k]).toBe("a".repeat(MESSAGE_MAX));
      const r = await patch("MSG-6", { [k]: "b".repeat(MESSAGE_MAX + 1) });
      expect([k, r.status]).toEqual([k, 400]);
      const err = (await j(r)).error as string;
      expect(err).toContain("300 characters"); expect(err).toContain("301"); expect(err.length).toBeLessThan(200);
      expect(err).toMatch(/shorter/i); expect(err).not.toMatch(WORDS); // kind and plain: no my / your, no jargon, no role names
      expect((await info("MSG-6"))[k]).toBe("a".repeat(MESSAGE_MAX)); // the saved one is untouched
    }
  });
  test("the same limit holds when the game is made; a refused game is not created", async () => {
    for (const k of MESSAGE_FIELDS) {
      const r = await make("MSG-L-" + k.slice(0, 3), { [k]: "c".repeat(301) });
      expect(r.status).toBe(400); expect((await j(r)).error).toContain("300 characters");
    }
    expect(raw.prepare("SELECT COUNT(*) AS c FROM engagement WHERE id LIKE 'MSG-L-%'").get()).toEqual({ c: 0 });
    expect((await make("MSG-L-ok", { winnerMessage: "d".repeat(300) })).status).toBe(200);
  });
  test("characters are counted, not code units: 300 emoji are fine, 301 are not", async () => {
    await make("MSG-7"); await publish("MSG-7");
    const e = String.fromCodePoint(0x1f600);
    expect((await patch("MSG-7", { closingMessage: e.repeat(300) })).status).toBe(200);
    expect((await patch("MSG-7", { closingMessage: e.repeat(301) })).status).toBe(400);
  });
  test("HTML is removed: tags, a script with what it holds, and any left-over < or >", async () => {
    await make("MSG-8"); await publish("MSG-8");
    const dirty = { preGameMessage: "Hello <b>team</b>, <i>welcome</i>!", winnerMessage: "<script>alert(1)</script>Well done <img src=x onerror=alert(2)>", closingMessage: "Great game <3 see you > soon <" };
    expect((await patch("MSG-8", dirty)).status).toBe(200);
    const i = await info("MSG-8");
    expect(i.preGameMessage).toBe("Hello team, welcome!");
    expect(i.winnerMessage).toBe("Well done");
    for (const k of MESSAGE_FIELDS) { expect(i[k]).not.toMatch(/[<>]/); expect(i[k]).not.toMatch(/script|onerror|alert/i); }
    expect(i.closingMessage).toBe("Great game 3 see you soon");
  });
  test("control characters and hidden characters are removed; new lines and tabs become one space; spaces are collapsed and trimmed", async () => {
    await make("MSG-9"); await publish("MSG-9");
    const c = String.fromCharCode;
    const messy = "  Line one" + c(10) + c(10) + "line" + c(9) + "two" + c(0) + c(7) + c(27) + c(127) + " ok" + c(0x200b) + c(0x202e) + "!   ";
    expect((await patch("MSG-9", { winnerMessage: messy })).status).toBe(200);
    const w = (await info("MSG-9")).winnerMessage as string;
    expect(w).toBe("Line one line two ok!");
    expect([...w].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)).toBe(false);
    expect(w).not.toMatch(/ {2}/);
  });
  test("ordinary words, punctuation, other languages and emoji are kept as typed", async () => {
    await make("MSG-10"); await publish("MSG-10");
    const text = "Welcome, team! Prizes: 1st, 2nd & 3rd (\"quoted\") - it's 4 pm. " + String.fromCodePoint(0x1f389) + " Dhanyavaad";
    expect((await patch("MSG-10", { closingMessage: text })).status).toBe(200);
    expect((await info("MSG-10")).closingMessage).toBe(text);
  });
  test("a message that is not text is refused kindly: a number, a true/false, a list or an object; nothing is saved, nothing else in the same request is changed", async () => {
    await make("MSG-11", { turnCap: 40 }); await publish("MSG-11");
    expect((await patch("MSG-11", { winnerMessage: "Saved first" })).status).toBe(200);
    for (const bad of [5, true, ["a", "b"], { text: "x" }]) {
      for (const k of MESSAGE_FIELDS) {
        const r = await patch("MSG-11", { turnCap: 99, [k]: bad });
        expect([k, JSON.stringify(bad), r.status]).toEqual([k, JSON.stringify(bad), 400]);
        const err = (await j(r)).error as string;
        expect(err).toMatch(/plain text/i); expect(err).not.toMatch(WORDS); expect(err).toMatch(/words|type/i);
      }
    }
    const i = await info("MSG-11");
    expect(i.turnCap).toBe(40); expect(i.winnerMessage).toBe("Saved first"); // the refused requests changed nothing at all
    const r = await make("MSG-11b", { preGameMessage: 12345 }); expect(r.status).toBe(400); // and a game is not made with one
  });
  test("a game already stored with a message that is too long still opens: the message is cut to 300, every other setting is intact", async () => {
    await make("MSG-12", { turnCap: 40, name: "Cut test", winnerMessage: "ok" }); await publish("MSG-12");
    const row = raw.prepare("SELECT config FROM engagement WHERE id='MSG-12'").get() as { config: string };
    const cfg = JSON.parse(row.config); cfg.closingMessage = "x".repeat(500);
    raw.prepare("UPDATE engagement SET config=? WHERE id='MSG-12'").run(JSON.stringify(cfg));
    const i = await info("MSG-12");
    expect(i.closingMessage).toBe("x".repeat(300)); expect(i).toMatchObject({ turnCap: 40, name: "Cut test", winnerMessage: "ok" });
  });
});

describe("who may set them, and when (the same rules as every other setting)", () => {
  test("the organizer, the co-organizer in the console and the organizer's AI may set them, before the game starts", async () => {
    await make("MSG-13"); await publish("MSG-13");
    expect((await patch("MSG-13", { preGameMessage: "From the organizer" }, team.master)).status).toBe(200);
    expect((await patch("MSG-13", { winnerMessage: "From the co-organizer" }, team.host)).status).toBe(200);
    expect((await patch("MSG-13", { closingMessage: "From the AI" }, team.ai)).status).toBe(200);
    expect(await info("MSG-13")).toMatchObject({ preGameMessage: "From the organizer", winnerMessage: "From the co-organizer", closingMessage: "From the AI" });
  });
  test("an AI makes a draft with the messages in it, changes them in the draft, and the organizer reads them back", async () => {
    const r = await make("MSG-14", ALL, () => team.ai);
    expect(r.status).toBe(200); expect((await j(r)).draft).toBe(true);
    expect((await patch("MSG-14", { winnerMessage: "A better one, from the AI" }, team.ai)).status).toBe(200);
    const s = await summary("MSG-14", team.master);
    expect(s.status).toBe("draft"); expect(s).toMatchObject({ preGameMessage: ALL.preGameMessage, winnerMessage: "A better one, from the AI", closingMessage: ALL.closingMessage });
    expect(await summary("MSG-14", team.ai)).toMatchObject({ winnerMessage: "A better one, from the AI" }); // the AI reads them too
    expect((await call("GET", `/ai/${team.ai}/z/MSG-14/summary`)).status).toBe(200);
    expect(await j(await call("GET", `/ai/${team.ai}/z/MSG-14/summary`))).toMatchObject({ closingMessage: ALL.closingMessage }); // and through its own link
  });
  test("the co-organizer's AI work link keeps its narrow rights: it may read but not change settings, so it cannot set a message", async () => {
    await make("MSG-15", { winnerMessage: "Kept" }); await publish("MSG-15");
    const r = await patch("MSG-15", { winnerMessage: "Changed through a link" }, team.host, T, { "x-cb-link": "1" });
    expect(r.status).toBe(403);
    expect((await info("MSG-15")).winnerMessage).toBe("Kept");
  });
  test("a co-organizer cannot make a game (the same as for every setting), the organizer and the AI can", async () => {
    expect((await make("MSG-16h", ALL, () => team.host)).status).toBe(403);
    expect((await make("MSG-16m", ALL, () => team.master)).status).toBe(200);
    expect((await make("MSG-16a", ALL, () => team.ai)).status).toBe(200);
  });
  test("a Co-host key is refused, a stranger is refused, and neither changes anything", async () => {
    await make("MSG-17", { closingMessage: "Kept" }); await publish("MSG-17");
    expect((await patch("MSG-17", { closingMessage: "By a Co-host" }, team.cohost)).status).toBe(403);
    expect((await call("PATCH", "/api/z/MSG-17/settings", { closingMessage: "By nobody" })).status).toBe(403);
    expect((await patch("MSG-17", { closingMessage: "By a stranger" }, "cbk_" + "0".repeat(48))).status).toBe(403);
    expect((await summary("MSG-17", team.cohost)).error).toBeTruthy(); // a Co-host may not even read the summary
    expect((await info("MSG-17")).closingMessage).toBe("Kept");
  });
  test("another organizer's key cannot change them either", async () => {
    await make("MSG-18", { closingMessage: "Kept" }); await publish("MSG-18");
    const other = await j(await call("POST", "/api/start", { email: "rival@other.com" }, { "cf-connecting-ip": `9.9.9.${++ip}` }));
    expect((await patch("MSG-18", { closingMessage: "Taken over" }, other.token)).status).toBe(403);
    expect((await patch("MSG-18", { closingMessage: "Taken over" }, other.aiKey)).status).toBe(403);
    expect((await info("MSG-18")).closingMessage).toBe("Kept");
  });
  test("once a paid game has started nobody can change them: organizer, co-organizer and AI are all told so, and the saved messages stay", async () => {
    await make("MSG-19", ALL); await publish("MSG-19");
    raw.prepare("UPDATE engagement SET pack=100 WHERE id='MSG-19'").run(); // paid
    for (const key of [team.master, team.host, team.ai]) {
      const r = await patch("MSG-19", { winnerMessage: "Too late" }, key, AFTER_START);
      expect(r.status).toBe(409); expect((await j(r)).error).toMatch(/already started/i);
    }
    expect(await info("MSG-19")).toMatchObject(ALL);
    expect((await patch("MSG-19", { winnerMessage: "In time" }, team.master, T + 3600_000)).status).toBe(200); // but before the start it still works
  });
});

describe("players read them; nothing private comes with them", () => {
  test("the public info of a published game carries them for a player; so does the join answer", async () => {
    await make("MSG-20", ALL); await publish("MSG-20");
    const i = await info("MSG-20");
    expect(i).toMatchObject(ALL);
    const joined = await j(await call("POST", "/api/z/MSG-20/join", { name: "Player One", device: "b".repeat(32) }, {}, T + 1000));
    expect(joined.pid).toMatch(/^1x/); expect(joined).toMatchObject(ALL);
  });
  test("a draft is not open to the public, so its messages are not either; the organizer can read them in the draft", async () => {
    await make("MSG-21", ALL);
    const r = await call("GET", "/api/z/MSG-21/info"); expect(r.status).toBe(403);
    expect(JSON.stringify(await j(r))).not.toContain("Welcome");
    expect(await j(await call("GET", "/api/z/MSG-21/info", undefined, as(team.master)))).toMatchObject(ALL);
  });
  test("the only new keys in info are the three messages: nothing else, and nothing private, is added", async () => {
    await make("MSG-22"); await publish("MSG-22");
    const before = await info("MSG-22");
    await patch("MSG-22", ALL);
    const after = await info("MSG-22");
    expect(Object.keys(after).filter((k) => !(k in before)).sort()).toEqual(["closingMessage", "preGameMessage", "winnerMessage"]);
    for (const k of Object.keys(before)) expect([k, JSON.stringify(after[k])]).toEqual([k, JSON.stringify(before[k])]); // everything that was there is the same
    const text = JSON.stringify(after);
    for (const secret of ["boss@acme.com", "98765", "priya@acme.com", "9876500009", "cbk_", "cba_", "cbh_", "cbc_", team.master, team.ai, team.host, team.cohost]) expect([secret, text.includes(secret)]).toEqual([secret, false]);
  });
  test("a player's own name and number are not in what the organizer's AI reads, with the messages set (the AI privacy rule stands)", async () => {
    await make("MSG-23", ALL); await publish("MSG-23");
    await call("POST", "/api/z/MSG-23/join", { phone: "9123456789", name: "Plantina Zyxwvu", device: "c".repeat(32) }, {}, T + 1000);
    const bodies = [JSON.stringify(await summary("MSG-23", team.ai)), JSON.stringify(await info("MSG-23")), await (await call("GET", `/ai/${team.ai}/z/MSG-23/summary`)).text(), await (await call("GET", `/ai/${team.ai}/z/MSG-23/info`)).text()].join("\n");
    for (const needle of ["Plantina", "Zyxwvu", "9123456789", "23456789"]) expect([needle, bodies.includes(needle)]).toEqual([needle, false]);
    expect(bodies).toContain(ALL.winnerMessage);
  });
  test("a copy of the game (Play again) keeps the messages", async () => {
    await make("MSG-24", ALL); await publish("MSG-24");
    const r = await call("POST", "/api/z/MSG-24/clone", {}, as(team.master));
    expect(r.status).toBe(200);
    const body = await j(r); const id = (body.id ?? body.eid ?? body.gameId) as string;
    expect(typeof id).toBe("string");
    const row = raw.prepare("SELECT config FROM engagement WHERE id=?").get(id) as { config: string };
    expect(JSON.parse(row.config)).toMatchObject(ALL);
  });
});
