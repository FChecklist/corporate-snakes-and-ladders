// The free DEMO GAME (owner order 2026-10-29, same pattern as Corporate Tambola's DEMO_CAP): any organizer can make a real game for up to 10 people at Rs 0.
// It publishes without payment, is never held for payment at its start time, and the 11th person is told the game is full.
// A demo cannot be made bigger: "Make a copy" and choosing a bigger size is the way to more people. An ordinary game, even of 10 people, still needs payment.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { lazyTickReset } from "../src/worker";
import { DEMO_CAP } from "../../../packages/beacon/src/config";
import { HOUR, T, W, call, checkout, contact, create, dev, j, mails, one, organizer, publish, q, reset, restore, roundMs, startIn, uid } from "./param-harness";

beforeEach(() => { reset(); lazyTickReset(); });
afterEach(restore);
const START = startIn(2 * HOUR);
const startMs = roundMs(START);
const joinAs = (id: string, i: number, now = T) => call("POST", `/api/z/${id}/join`, { name: "Player " + i, device: dev(i) }, { "cf-connecting-ip": `10.1.0.${i}` }, now);

describe("the free 10-person demo game", () => {
  test("DEMO_CAP is 10", () => { expect(DEMO_CAP).toBe(10); });

  test("an ordinary organizer makes a demo, publishes with no payment, 10 join by name, the 11th is refused, the same phone gets the same card", async () => {
    const o = await organizer(); const id = uid("DEMO");
    const c = await j(await create(o.key, id, { cap: 10, demo: true })); expect(c.ok).toBe(true); expect(c.draft).toBe(true); expect(c.demo).toBe(true);
    expect((await call("POST", `/api/z/${id}/join`, { name: "Too early", device: dev(99) })).status).toBe(403); // a draft takes nobody
    const pub = await publish(o.key, id); expect(pub.status).toBe(200);
    const pb = await j(pub); expect(pb.published).toBe(true); expect(pb.paid).toBe(true); expect(pb.demo).toBe(true); expect(pb.free).toBe(true);
    expect(one("SELECT pack FROM engagement WHERE id=?", id).pack).toBe(10); // "paid" with its own size: no pack was bought
    expect(q("SELECT * FROM entitlement WHERE eid=?", id).length).toBe(0);
    expect(q("SELECT * FROM payment").length).toBe(0); // Rs 0: no order, no payment, no invoice
    const pids = new Set<string>();
    for (let i = 1; i <= 10; i++) { const r = await joinAs(id, i); expect(r.status).toBe(200); pids.add((await j(r)).pid); }
    expect(pids.size).toBe(10);
    const eleventh = await joinAs(id, 11); expect(eleventh.status).toBe(409); expect((await j(eleventh)).error).toBe("This game is full.");
    const again = await j(await joinAs(id, 3)); expect(pids.has(again.pid)).toBe(true);
    expect(q("SELECT seq FROM seat WHERE eid=? ORDER BY seq", id).map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("a demo is not held for payment when its start time comes", async () => {
    const o = await organizer(); const id = uid("DEMO");
    await create(o.key, id, { cap: 10, demo: true }); await publish(o.key, id);
    const at = startMs + 5 * 60_000;
    const info = await j(await call("GET", `/api/z/${id}/info`, undefined, {}, at)); expect(info.locked).toBeFalsy(); expect(info.demo).toBe(true);
    expect((await joinAs(id, 1, at - 10 * 60_000)).status).toBe(200);
    expect(mails("boss@acme.com").some((m: any) => /payment is due|could not begin/i.test(m.subject + m.body))).toBe(false);
    const sum = await j(await call("GET", `/api/z/${id}/summary`, undefined, o.h, at)); expect(sum.paid).toBe(true); expect(sum.demo).toBe(true);
  });

  test("the publish mail says it is a free demo for up to 10 people", async () => {
    const o = await organizer(); const id = uid("DEMO"); await create(o.key, id, { cap: 10, demo: true }); await publish(o.key, id);
    const m = mails(contact.email).find((x: any) => /DEMO GAME/.test(x.subject)); expect(m).toBeTruthy(); expect(m.body).toMatch(/free/i); expect(m.body).toMatch(/up to 10 people/);
  });

  test("a demo is for 10 people at most, when it is made and when it is changed", async () => {
    const o = await organizer(); const id = uid("DEMO");
    const big = await create(o.key, uid("DEMO"), { cap: 11, demo: true }); expect(big.status).toBe(400); expect((await j(big)).code).toBe("demo-cap");
    expect((await create(o.key, id, { cap: 10, demo: true })).status).toBe(200);
    const raise = await call("PATCH", `/api/z/${id}/settings`, { cap: 50 }, o.h); expect(raise.status).toBe(400); expect((await j(raise)).code).toBe("demo-cap");
    await publish(o.key, id);
    const raise2 = await call("PATCH", `/api/z/${id}/settings`, { cap: 50 }, o.h); expect(raise2.status).toBe(400); expect((await j(raise2)).code).toBe("demo-cap");
    expect((await call("PATCH", `/api/z/${id}/settings`, { cap: 8, name: "Small group" }, o.h)).status).toBe(200); // smaller is fine
  });

  test("an ordinary game of 10 people (or fewer) is not free: only the demo is", async () => {
    const o = await organizer(); const id = uid("ORD"); await create(o.key, id, { cap: 10 });
    const pb = await j(await publish(o.key, id)); expect(pb.published).toBe(true); expect(pb.paid).toBe(false); expect(pb.demo).toBeUndefined();
    const info = await j(await call("GET", `/api/z/${id}/info`, undefined, {}, startMs + 5 * 60_000)); expect(info.locked).toBe(true);
  });

  test("a published demo cannot be turned into a real game by switching the mark off; a draft demo can still be changed into an ordinary game", async () => {
    const o = await organizer(); const draft = uid("DEMO"), live = uid("DEMO");
    await create(o.key, draft, { cap: 10, demo: true }); await create(o.key, live, { cap: 10, demo: true }); await publish(o.key, live);
    const off = await call("PATCH", `/api/z/${live}/settings`, { demo: false }, o.h); expect(off.status).toBe(409); expect((await j(off)).error).toMatch(/create a new game like this one/i);
    expect((await call("PATCH", `/api/z/${draft}/settings`, { demo: false, cap: 250 }, o.h)).status).toBe(200); // a draft is not a demo any more: an ordinary draft of 250 people
    expect(one("SELECT pack FROM engagement WHERE id=?", draft).pack).toBe(0);
  });

  test("nobody pays for a demo: checkout is refused for a draft demo and for a published one", async () => {
    const o = await organizer(); const a = uid("DEMO"), b = uid("DEMO");
    await create(o.key, a, { cap: 10, demo: true }); await create(o.key, b, { cap: 10, demo: true }); await publish(o.key, b);
    for (const id of [a, b]) { const r = await checkout(o.key, { eid: id, email: o.email }); expect(r.status).toBe(409); expect(r.body.error).toMatch(/free demo/i); }
    expect(q("SELECT * FROM payment").length).toBe(0);
  });

  test("Make a copy of a demo gives an ordinary draft: pick a bigger size and pay like any game", async () => {
    const o = await organizer(); const id = uid("DEMO"); await create(o.key, id, { cap: 10, demo: true }); await publish(o.key, id);
    const cl = await j(await call("POST", `/api/z/${id}/clone`, {}, o.h)); expect(cl.ok).toBe(true);
    const info = await j(await call("GET", `/api/z/${cl.id}/info`, undefined, o.h)); expect(info.demo).toBeUndefined();
    expect((await call("PATCH", `/api/z/${cl.id}/settings`, { cap: 250, startRound: START }, o.h)).status).toBe(200);
    const co = await checkout(o.key, { eid: cl.id, email: o.email }); expect(co.status).toBe(200);
  });

  test("the organizer's other screens work for a demo: the Co-host header shows no price, and cancelling says no money is involved", async () => {
    const o = await organizer(); const id = uid("DEMO"); await create(o.key, id, { cap: 10, demo: true }); await publish(o.key, id);
    const head = await call("GET", `/api/z/${id}/cohost`, undefined, o.h); expect(head.status).toBe(200); expect((await j(head)).price).toBeNull();
    const cx = await j(await call("POST", `/api/z/${id}/cancel`, { confirmations: 3 }, o.h)); expect(cx.cancelled).toBe(true);
    expect(mails(o.email).some((m: any) => /free DEMO GAME, so no money is involved/.test(m.body))).toBe(true);
  });
});
