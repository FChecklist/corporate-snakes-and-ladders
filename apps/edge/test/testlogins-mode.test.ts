// The owner's demo sign-ins (demo1@xyz.in, demo2@xyz.in, demo3@xyz.in with the code 123456) and the free test pack of demo1 exist ONLY while the site is in TEST mode.
// The addresses and the code are written in a public repository, so on the live site (LIVE mode) they must be ordinary addresses: no sign-in with the fixed code, no free game.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { setMode } from "../src/mode";
import { T, W, call, create, j, one, organizer, reset, restore, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);
const IP = { "cf-connecting-ip": "5.5.5.5" };
const signIn = (email: string) => call("POST", "/api/auth/verify", { email, code: "123456" }, IP);

describe("owner test sign-ins work only in TEST mode", () => {
  test("LIVE mode: demo1, demo2 and demo3 with the fixed code are refused like any wrong code", async () => {
    for (const mail of ["demo1@xyz.in", "demo2@xyz.in", "demo3@xyz.in"]) {
      const r = await signIn(mail); expect(r.status).toBe(400); expect((await j(r)).token).toBeUndefined();
    }
    expect(one("SELECT COUNT(*) c FROM organizer_email").c).toBe(0); // nothing was created by the attempt
  });
  test("TEST mode: the three addresses sign in with the fixed code", async () => {
    await setMode(W.env as any, "TEST", "walk-through", T);
    for (const mail of ["demo1@xyz.in", "demo2@xyz.in", "demo3@xyz.in"]) {
      const r = await signIn(mail); expect(r.status).toBe(200); expect((await j(r)).token).toMatch(/^cbk_/);
    }
  });
  test("going back to LIVE closes the door again, for an account that already exists", async () => {
    await setMode(W.env as any, "TEST", "walk-through", T);
    expect((await signIn("demo2@xyz.in")).status).toBe(200);
    await setMode(W.env as any, "LIVE", "back", T);
    expect((await signIn("demo2@xyz.in")).status).toBe(400);
  });
  test("LIVE mode: nobody can open an account with one of the three addresses (a stranger could otherwise claim them before the owner)", async () => {
    for (const mail of ["demo1@xyz.in", "demo2@xyz.in", "demo3@xyz.in"]) {
      const r = await call("POST", "/api/start", { email: mail }, IP); expect(r.status).toBe(400); expect((await j(r)).token).toBeUndefined();
    }
    expect(one("SELECT COUNT(*) c FROM organizer_email").c).toBe(0);
  });
  test("an account made in TEST mode gets no free game once the site is LIVE", async () => {
    await setMode(W.env as any, "TEST", "walk-through", T);
    const o = await organizer("demo1@xyz.in");
    expect((await j(await create(o.key, uid("OT"), { cap: 250 }))).draft).toBe(false); // TEST mode: free
    await setMode(W.env as any, "LIVE", "back", T);
    const r = await j(await create(o.key, uid("OT"), { cap: 250 })); expect(r.draft).toBe(true); // LIVE mode: an ordinary game that needs payment
    expect(one("SELECT COUNT(*) c FROM entitlement WHERE payment_id='owner-test'").c).toBe(1); // only the one made in TEST mode
  });
  test("TEST mode: demo1 still gets its free test game, demo2 and an ordinary address do not", async () => {
    await setMode(W.env as any, "TEST", "walk-through", T);
    const a = await organizer("demo1@xyz.in"), b = await organizer("demo2@xyz.in"), c = await organizer();
    expect((await j(await create(a.key, uid("OT"), { cap: 250 }))).draft).toBe(false);
    expect((await j(await create(b.key, uid("OT"), { cap: 250 }))).draft).toBe(true);
    expect((await j(await create(c.key, uid("OT"), { cap: 250 }))).draft).toBe(true);
  });
});
