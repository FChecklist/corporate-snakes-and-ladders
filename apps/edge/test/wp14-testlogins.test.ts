// WP-17 / MC-25 (gap plan 2026-10-29): the owner's test sign-ins (demo1/2/3@xyz.in, code 123456) work ONLY with the runner key (X-Runner-Key = RUNNER_KEY), in any mode (owner order 5 Nov 2026).
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
const call = (method: string, path: string, body?: unknown, h: Record<string, string> = {}) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", "cf-connecting-ip": "9.9.9.9", ...h }, body: withDevice(method, path, body) }), env as Env, T);
beforeEach(() => { const d = makeD1(); resetRate(); env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "1000000", PUBLIC_ORIGIN: "https://snakes.test", DATA_KEY: "dk", PHONE_SALT: "salt" } as unknown as PayEnv; });

describe("test sign-ins need the runner key (RUNNER_KEY), in every mode", () => {
  const NOKEY = { "x-runner-key": "" };
  test("without the key every test address with the fixed code is refused, in LIVE and in TEST, and no key is made", async () => {
    for (const mode of ["LIVE", "TEST"] as const) {
      await setMode(env, mode, "test", T);
      for (const email of TEST_LOGINS) {
        const r = await call("POST", "/api/auth/verify", { email, code: TEST_LOGIN_CODE }, NOKEY);
        const b = (await r.json()) as any;
        expect(r.status).toBe(400);
        expect(b.token).toBeUndefined();
      }
    }
  });
  test("with the key the same address and code sign in, in LIVE too (proves the refusal above is the missing key and not a broken request)", async () => {
    await setMode(env, "LIVE", "test", T);
    const r = await call("POST", "/api/auth/verify", { email: "demo1@xyz.in", code: TEST_LOGIN_CODE });
    const b = (await r.json()) as any;
    expect(r.status).toBe(200);
    expect(typeof b.token).toBe("string");
  });
});
