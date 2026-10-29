// SL-03 (gap plan WP-14, 2026-10-29): "Everyone got 'wait for organizer to approve'". A game made with the console's normal "New game" button used to be saved as
// "only people on a list", so every employee who clicked the invite link landed in the waiting room. The default must be: whoever has the link comes straight in.
// The real console (zc.js) and the real phone page (z.js) run in a DOM against the REAL Worker code and an in-memory database.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";
import { withDevice } from "../../edge/test/device";
import { handle } from "../../edge/test/cohost-accepted";

setDefaultTimeout(60_000);
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

describe("SL-03: the default of a new game is 'anyone with the link'", () => {
  test("New game from the console, publish, then an employee joins with only a name: straight in, no waiting room", async () => {
    const w = newWorld(); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    const p = await openPage(w.world, { url: "http://localhost/zc.html", html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
    open.push(p);
    await p.waitFor((x) => /New game|Start a new game|Your games/i.test(x) && !!p.$("#mk"), 20000);
    p.click("#mk");
    await p.waitFor((x) => /Your draft is saved/i.test(x), 20000);
    const list = await w.json(await w.api("GET", "/api/history", undefined, s.token));
    const id = list.engagements[0].id as string;
    // the setting the console saved
    const sum = await w.json(await w.api("GET", `/api/z/${id}/summary`, undefined, s.token));
    expect(sum.whoCanJoin).toBe("anyone");
    // a start time far enough ahead, prizes etc. come from the console's own defaults; publish it as the organizer would
    expect((await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
    // an employee opens the invite link and types only a name (the default 'Just their name' join)
    const r = await handle(new Request("http://localhost" + `/api/z/${id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: withDevice("POST", `/api/z/${id}/join`, { name: "Asha" }) }), w.world.env, w.world.now);
    const j = await r.json() as any;
    expect(j.waiting).toBeUndefined();
    expect(r.status).toBe(200);
    expect(j.pid).toBeTruthy();
  });
});

describe("SL-03: a game set to 'only people on a list' with an empty list is flagged before publishing", () => {
  test("the publish step says the list is empty and how to let everyone in; with 'anyone' it says nothing", async () => {
    const w = newWorld(); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    const start = roundAt(T) + 1200;
    await w.api("POST", "/api/z", { id: "LISTMODE", startRound: start, callSeconds: 20, cap: 100, whoCanJoin: "list" }, s.aiKey);
    await w.api("POST", "/api/z", { id: "OPENMODE", startRound: start, callSeconds: 20, cap: 100, whoCanJoin: "anyone" }, s.aiKey);
    const see = async (id: string) => {
      const p = await openPage(w.world, { url: `http://localhost/zc.html?e=${id}`, html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
      open.push(p); await p.waitFor((x) => /Check and publish/.test(x), 20000);
      p.click('.zc-sech[data-open="7"]'); await p.waitFor((x) => /Publish my game, free/.test(x), 20000);
      return p.html().includes("your list is empty"); // true or false only: never dump the page into a failure message
    };
    expect(await see("LISTMODE")).toBe(true);
    expect(await see("OPENMODE")).toBe(false);
  });
});
