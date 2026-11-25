// The name check when a player joins by the common link (Games gap 1, owner rules of 25 Nov 2026).
// A player gives a NAME (never "nickname"): 2 to 20 letters, numbers or spaces; HTML is removed first. The messages are plain and kind and have no my, mine, your or yours.
import { beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { NAME_BAD_CHARS, NAME_NEEDED, NAME_RULE, NAME_TOO_LONG, NAME_TOO_SHORT, cleanPlayerName } from "../src/people";
import { handle } from "./with-terms";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0), GEN = 1692803367;
const START = Math.floor((T / 1000 - GEN) / 3) + 1 + 1200;
let env: Env;
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: body === undefined ? undefined : JSON.stringify(body) }), env, T);
const j = async (r: Response) => (await r.json()) as any;
const dev = (i: number) => String(i).padStart(2, "0").repeat(16);
let h: Record<string, string>;
beforeEach(async () => {
  env = { DB: makeD1().db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://snakesladders.test", PHONE_SALT: "salt", DATA_KEY: "k" } as any;
  const s = await j(await call("POST", "/api/start", { email: "demo1@xyz.in" }, { "cf-connecting-ip": "10.0.0.9" }));
  h = { "x-organizer": s.token as string };
  await call("POST", "/api/z", { id: "NAME-1", startRound: START, callSeconds: 10, cap: 10 }, h);
  await call("POST", "/api/z/NAME-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, h);
});
const join = (i: number, body: object) => call("POST", "/api/z/NAME-1/join", { device: dev(i), ...body }, { "cf-connecting-ip": `10.1.0.${i}` });
const shown = async (pid: string) => (await j(await call("GET", `/api/z/NAME-1/names?pids=${pid}`, undefined, h))).names[pid];
const FORBIDDEN = /nickname|\b(my|mine|your|yours)\b/i;

describe("the name a player gives when joining", () => {
  test("a valid name is accepted and kept as it was typed (letters, numbers and single spaces)", async () => {
    const r = await join(1, { name: "Sky Walker 7" }); expect(r.status).toBe(200);
    expect(await shown((await j(r)).pid)).toBe("Sky Walker 7");
    expect(cleanPlayerName("Asha")).toEqual({ ok: true, name: "Asha" }); expect(cleanPlayerName("Zoë  Ng")).toEqual({ ok: true, name: "Zoë Ng" }); expect(cleanPlayerName("12")).toEqual({ ok: true, name: "12" });
    expect(cleanPlayerName("x".repeat(20))).toEqual({ ok: true, name: "x".repeat(20) });
  });
  test("a name that is too short, too long or has other characters is refused with a plain, kind message and the code bad-name", async () => {
    const cases: [string, string][] = [["A", NAME_TOO_SHORT], ["x".repeat(21), NAME_TOO_LONG], ["Hi!!", NAME_BAD_CHARS], ["no_underscore", NAME_BAD_CHARS], ["<b></b>", NAME_TOO_SHORT]];
    for (const [name, msg] of cases) { const r = await join(2, { name }); expect(r.status).toBe(400); const b = await j(r); expect(b.error).toBe(msg); expect(b.code).toBe("bad-name"); }
    const r = await join(2, { name: 42 as any }); expect(r.status).toBe(400); expect((await j(r)).error).toBe(NAME_RULE);
    expect(NAME_RULE).toBe("Please type a name with 2 to 20 letters, numbers or spaces.");
  });
  test("every message of the check is kind: it asks with Please or says what to do, and it never says nickname, my, mine, your or yours", () => {
    for (const m of [NAME_RULE, NAME_TOO_SHORT, NAME_TOO_LONG, NAME_BAD_CHARS, NAME_NEEDED]) { expect(m).not.toMatch(FORBIDDEN); expect(m).toMatch(/^(Please|That name)/); expect(m.length).toBeLessThan(80); }
  });
  test("no name at all keeps today's behaviour: the join asks for a name, kindly, with the code need-name", async () => {
    expect(cleanPlayerName("   ")).toEqual({ ok: true, name: "" });
    expect(cleanPlayerName(undefined)).toEqual({ ok: true, name: "" });
    expect(cleanPlayerName(null)).toEqual({ ok: true, name: "" });
    for (const body of [{ name: "" }, { name: "   " }, {}]) { const r = await join(3, body); expect(r.status).toBe(400); const b = await j(r); expect(b.error).toBe(NAME_NEEDED); expect(b.code).toBe("need-name"); expect(b.error).not.toMatch(FORBIDDEN); }
  });
  test("markup is removed before the check", async () => {
    expect(cleanPlayerName("<b>Ann</b>")).toEqual({ ok: true, name: "Ann" });
    expect(cleanPlayerName("Ann <script>alert(1)</script>")).toEqual({ ok: false, error: NAME_BAD_CHARS }); // the script text stays after the tags go, and it has signs
    const r = await join(4, { name: "<i>Zed</i> Q" }); expect(r.status).toBe(200);
    expect(await shown((await j(r)).pid)).toBe("Zed Q");
  });
  test("the same phone joining again keeps its place; a refused name does not use up a place", async () => {
    await join(5, { name: "Bad!!" });
    const a = await j(await join(5, { name: "Good Name" })); expect(a.pid).toBeTruthy();
    const again = await j(await join(5, { name: "Good Name" })); expect(again.pid).toBe(a.pid);
  });
});
