// WP-17 / MC-25 (gap plan 2026-10-29): the owner's test sign-ins (demo1/2/3@xyz.in, code 123456) work ONLY while the service is in TEST mode. In LIVE mode the fixed code must be refused.
import { beforeEach, describe, expect, test } from "bun:test";
import { handle, type Env } from "../src/worker";
import { type PayEnv } from "../src/pay";
import { setMode } from "../src/mode";
import { resetRate } from "../src/visits";
import { TEST_LOGINS, TEST_LOGIN_CODE } from "../src/testlogins";
import { makeD1 } from "./d1-sqlite";
import { withDevice } from "./device";

const T = Date.UTC(2026, 9, 6, 10, 0, 0);
let env: PayEnv;
const call = (method: string, path: string, body?: unknown) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9" }, body: withDevice(method, path, body) }), env as Env, T);
beforeEach(() => { const d = makeD1(); resetRate(); env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://snakes.test", DATA_KEY: "dk", PHONE_SALT: "salt" } as unknown as PayEnv; });

describe("test sign-ins exist only in TEST mode", () => {
  test("LIVE mode: every test address with the fixed code is refused and no key is made", async () => {
    await setMode(env, "LIVE", "test", T);
    for (const email of TEST_LOGINS) {
      const r = await call("POST", "/api/auth/verify", { email, code: TEST_LOGIN_CODE });
      const b = (await r.json()) as any;
      expect(r.status).toBe(400);
      expect(b.token).toBeUndefined();
    }
  });
  test("TEST mode: the same address and code sign in and give a key (proves the LIVE refusal above is the mode and not a broken request)", async () => {
    await setMode(env, "TEST", "test", T);
    const r = await call("POST", "/api/auth/verify", { email: "demo1@xyz.in", code: TEST_LOGIN_CODE });
    const b = (await r.json()) as any;
    expect(r.status).toBe(200);
    expect(typeof b.token).toBe("string");
  });
  test("switching back to LIVE closes the door again", async () => {
    await setMode(env, "TEST", "test", T);
    expect((await call("POST", "/api/auth/verify", { email: "demo2@xyz.in", code: TEST_LOGIN_CODE })).status).toBe(200);
    await setMode(env, "LIVE", "back", T);
    expect((await call("POST", "/api/auth/verify", { email: "demo2@xyz.in", code: TEST_LOGIN_CODE })).status).toBe(400);
  });
});
