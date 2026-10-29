// The free demo in the organizer's console (zc.html), run as the browser runs it against the real Worker: the size list starts with "Free demo: 10 people, Rs 0",
// choosing it saves a demo of 10 people, choosing another size ends the demo, and a published demo shows no payment.
import { afterEach, describe, expect, test } from "bun:test";
import { T, newWorld, openPage, roundAt } from "./harness";

const open: Awaited<ReturnType<typeof openPage>>[] = [];
afterEach(async () => { while (open.length) await open.pop()!.close(); });
const START = roundAt(T + 3 * 3_600_000);

async function setup(cap: number, demo: boolean, publish = false) {
  const w = newWorld();
  const key = (await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }))).token as string;
  const r = await w.api("POST", "/api/z", { id: "DEMO-CON", startRound: START, callSeconds: 20, cap, ...(demo ? { demo: true } : {}) }, key);
  expect(r.status).toBe(200);
  if (publish) expect((await w.api("POST", "/api/z/DEMO-CON/publish", { email: "boss@acme.com", phone: "98765 43210" }, key)).status).toBe(200);
  const p = await openPage(w.world, { url: "http://localhost/zc.html?e=DEMO-CON", html: "zc.html", scripts: ["zgame.js", "control.js", "consent.js", "zc.js"], session: { "cbz-org": key } });
  open.push(p);
  await p.waitFor((t) => /Number of participants|Date and time|When does it start/i.test(t) || /Save and continue/.test(t));
  p.click('[data-open="2"]');
  await p.waitFor((t) => /How many people at most/.test(t));
  return { w, p, key, row: () => w.world.raw.prepare("SELECT cap, pack, config FROM engagement WHERE id=?").get("DEMO-CON") as any };
}

describe("the console offers the free demo", () => {
  test("an ordinary draft: the size list starts with the free demo, and choosing it saves a 10-person demo", async () => {
    const s = await setup(250, false);
    expect(s.p.text()).toMatch(/Free demo: 10 people, Rs 0/);
    expect(s.p.text().indexOf("Free demo: 10 people")).toBeLessThan(s.p.text().indexOf("Up to 100 people"));
    s.p.click("[data-demo]");
    await s.p.waitFor((t) => /A free demo is a real game for up to 10 people/.test(t));
    s.p.click('[data-save="2"]');
    await s.p.waitFor(() => !!JSON.parse(s.row().config).demo, 8000);
    expect(s.row().cap).toBe(10);
    expect(s.p.errors).toEqual([]);
  });
  test("choosing a normal size after the demo ends the demo", async () => {
    const s = await setup(10, true);
    expect(s.p.$("[data-demo].on")).toBeTruthy();
    s.p.click('[data-ck="cap"][data-v="250"]');
    expect(s.p.$("[data-demo].on")).toBeFalsy();
    s.p.click('[data-save="2"]');
    await s.p.waitFor(() => s.row().cap === 250, 8000);
    expect(JSON.parse(s.row().config).demo).toBeUndefined();
  });
  test("a published demo shows a free, nothing-to-pay Pay step and no other size to choose", async () => {
    const s = await setup(10, true, true);
    expect(s.p.text()).not.toMatch(/Up to 100 people/);
    expect(s.p.text()).toMatch(/Create a new game like this one and choose a bigger size/);
    s.p.click('[data-open="8"]');
    const t = await s.p.waitFor((x) => /Free demo game/.test(x));
    expect(t).toMatch(/Rs 0/); expect(t).toMatch(/Nothing to pay/); expect(t).not.toMatch(/Pay before the start|Waiting for the payment/);
  });
});

// ---- the phone page and the big screen say DEMO GAME on every screen ----
type Fetcher = (url: string) => Promise<any>;
const fakeBeacon = (nowMs: () => number) => { const fetcher: Fetcher = async (url) => { const last = url.split("/").pop()!, nowR = roundAt(nowMs()), r = last === "latest" ? nowR : Number(last); if (r > nowR) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => ({ round: r, randomness: "00".repeat(32), signature: "aa" }) }; }; return { fetcher }; };
const rtFake = (win: any, nowMs: () => number) => { const Orig = win.ZG.PhoneRuntime; win.ZG.PhoneRuntime = class extends Orig { constructor(eid: string, deps: any) { super(eid, { ...deps, beacon: { fetcher: fakeBeacon(nowMs).fetcher }, verify: (x: any) => x.signature === "aa", mono: () => deps.mono() }); } }; };

describe("the free demo says DEMO GAME to the people playing it", () => {
  async function phone(demo: boolean) {
    const w = newWorld(); w.world.now = T;
    const key = (await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }))).token as string;
    await w.api("POST", "/api/z", { id: "DEMO-PH", startRound: START, callSeconds: 20, cap: demo ? 10 : 100, ...(demo ? { demo: true } : {}) }, key);
    // an ordinary game must be paid before it can be joined; the platform key stands in for the payment here
    if (!demo) await w.api("POST", "/api/z/DEMO-PH/publish", { email: "boss@acme.com", phone: "98765 43210" }, key); else await w.api("POST", "/api/z/DEMO-PH/publish", { email: "boss@acme.com", phone: "98765 43210" }, key);
    const p = await openPage(w.world, { url: "http://localhost/z?e=DEMO-PH", html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"], afterLoad: (win, f) => { if (f === "zgame.js") rtFake(win, () => w.world.now); } });
    open.push(p);
    await p.waitFor((x) => /Join the game/.test(x));
    (p.$("#nm") as any).value = "Asha Rao"; p.click("#go");
    await p.waitFor((x) => /Your card|What you can win|Starting in|Getting ready|Your board/.test(x), 20000);
    return { p, w };
  }
  test("a demo game: the phone page shows DEMO GAME, free, up to 10 people", async () => {
    const { p } = await phone(true);
    expect(p.text()).toMatch(/DEMO GAME · free · up to 10 people/);
  });
  test("an ordinary game does not", async () => {
    const { p } = await phone(false);
    expect(p.text()).not.toMatch(/DEMO GAME/);
  });
});
