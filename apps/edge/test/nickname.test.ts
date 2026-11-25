import { beforeEach, describe, expect, test } from "bun:test";
import { type Env } from "../src/worker";
import { cleanNickname } from "../src/people";
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
  await call("POST", "/api/z", { id: "NICK-1", startRound: START, callSeconds: 10, cap: 10 }, h);
  await call("POST", "/api/z/NICK-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, h);
});
const join = (i: number, body: object) => call("POST", "/api/z/NICK-1/join", { device: dev(i), ...body }, { "cf-connecting-ip": `10.1.0.${i}` });
const shown = async (pid: string) => (await j(await call("GET", `/api/z/NICK-1/names?pids=${pid}`, undefined, h))).names[pid];

describe("nickname when joining", () => {
  test("a valid nickname is the name shown", async () => {
    const r = await join(1, { name: "Sky Walker 7" }); expect(r.status).toBe(200);
    expect(await shown((await j(r)).pid)).toBe("Sky Walker 7");
  });
  test("an invalid nickname is refused with a plain message", async () => {
    for (const name of ["A", "x".repeat(21), "Hi!!", "no_underscore"]) {
      const r = await join(2, { name }); expect(r.status).toBe(400);
      expect((await j(r)).error).toMatch(/nickname/i);
    }
  });
  test("a blank nickname keeps today's behaviour", async () => {
    expect(cleanNickname("   ")).toEqual({ ok: true, name: "" });
    expect(cleanNickname(undefined)).toEqual({ ok: true, name: "" });
    const r = await join(3, { name: "" }); expect(r.status).toBe(400); expect((await j(r)).error).toBe("Please type your name."); // same as before the change
  });
  test("markup is removed", async () => {
    expect(cleanNickname("<b>Ann</b>")).toEqual({ ok: true, name: "Ann" });
    const r = await join(4, { name: "<i>Zed</i> Q" }); expect(r.status).toBe(200);
    expect(await shown((await j(r)).pid)).toBe("Zed Q");
  });
});
