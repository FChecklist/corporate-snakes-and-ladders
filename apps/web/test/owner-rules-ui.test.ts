// Owner rules 1.1 in the real console (zc.js) and the real player page (z.js), run in a DOM against the REAL Worker and an in-memory database.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";

setDefaultTimeout(60_000);
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

async function consoleFor(id: string, extra: Record<string, string>) {
  const w = newWorld(extra); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  expect((await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 10, cap: 100 }, s.aiKey)).status).toBe(200);
  const p = await openPage(w.world, { url: `http://localhost/zc.html?e=${id}`, html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token } });
  open.push(p);
  await p.waitFor((x) => /Check and publish/.test(x), 20000);
  return { p, w, s };
}
const openStep = async (p: Page, n: number, until: RegExp) => { p.click(`.zc-sech[data-open="${n}"]`); await p.waitFor((x) => until.test(x), 20000); };

describe("the console under the owner rules", () => {
  test("step 2 has no choice of mobile number, Email ID, throws or 'anyone with the link', and says the game starts and throws by itself", async () => {
    const { p } = await consoleFor("UIR-1", { OWNER_RULES: "1.1" });
    await openStep(p, 2, /How many players/);
    const t = p.text();
    for (const gone of ["What must a person give", "Mobile number and employee ID", "Which Employee or Email ID", "Anyone with the link", "lets people in at once", "Players throw", "What do guests type to join"]) expect([gone, t.includes(gone)]).toEqual([gone, false]);
    expect(t).toContain("Invite people with just an ID"); expect(t).toContain("Every throw happens by itself");
    for (const k of ["ver", "pl", "who", "gj", "idk"]) expect([k, !!p.$(`[data-ck="${k}"]`)]).toEqual([k, false]);
  });
  test("without the rules the older choices are still there", async () => {
    const { p } = await consoleFor("UIR-2", {});
    await openStep(p, 2, /How many players/);
    expect(p.text()).toContain("What must a person give"); expect(!!p.$('[data-ck="pl"]')).toBe(true);
  });
  test("the people box takes IDs only, reads A-1101, A 1101 and A/1101 as one, and sends nothing but IDs", async () => {
    const { p, w } = await consoleFor("UIR-3", { OWNER_RULES: "1.1" });
    await openStep(p, 6, /Invite people with just an ID/);
    const t = p.text();
    for (const w2 of ["No names or personal details are needed.", "The list and all IDs are deleted within 24 hours after the game ends.", "Add to your list"]) expect(t).toContain(w2);
    for (const gone of ["Add a name and number", "Upload a PDF", "Paste from Excel", "From your contacts", "Mobile number"]) expect([gone, t.includes(gone)]).toEqual([gone, false]);
    const ticks = p.win.document.querySelectorAll("#mypeople input.cbc-tick"); ticks.forEach((c: any) => { c.checked = true; c.dispatchEvent(new p.win.Event("change", { bubbles: true })); });
    p.$("#rosterTxt").value = "Employee ID\nA-1101\nA 1101\na/1101\nB-7\n"; // the heading line is skipped
    p.click("#rosterGo");
    await p.waitFor((x) => /good/.test(x), 20000);
    const sum = (p.text().match(/\d+ good, [^.]*?(look|looks) wrong/) ?? [""])[0]; expect(sum).toBe("2 good, 2 duplicates removed, 0 look wrong");
    const rows = (w.world.raw.prepare("SELECT COUNT(*) AS c FROM person WHERE eid='UIR-3'").get() as any).c; expect(rows).toBe(2);
  });
});

describe("the player page under the owner rules", () => {
  test("asks for the employee ID only: no typed name, no mobile number, and the same fairness and privacy lines", async () => {
    const w = newWorld({ OWNER_RULES: "1.1" }); w.world.now = T;
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    expect((await w.api("POST", "/api/z", { id: "UIR-4", startRound: roundAt(T) + 1200, callSeconds: 10, cap: 100 }, s.aiKey)).status).toBe(200);
    expect((await w.api("POST", "/api/z/UIR-4/publish", { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
    const p = await openPage(w.world, { url: "http://localhost/z.html?e=UIR-4", html: "z.html", scripts: ["zgame.js", "z.js"] }); open.push(p);
    await p.waitFor((x) => /Join the game/.test(x), 20000);
    expect(!!p.$("#emp")).toBe(true); expect(!!p.$("#nm")).toBe(false); expect(!!p.$("#ph")).toBe(false);
    expect(p.text()).toContain("No one knows the next roll: not the organizer, not the co-organizer, not even the software.");
    expect(p.text()).toContain("All player information, including IDs, is deleted within 24 hours after the game ends.");
  });
});
