// Carried over from Corporate Tambola (owner rule 2026-10-28: every fix real users forced on Tambola is solved in every game): before publishing, the organizer is WARNED about prizes still on
// "decide later" (a yellow note on the Check and publish step) but is never blocked. The note existed in this console but nothing tested it.
import { afterEach, describe, expect, test } from "bun:test";
import { T, newWorld, openPage, roundAt } from "./harness";

const open: Awaited<ReturnType<typeof openPage>>[] = [];
afterEach(async () => { while (open.length) await open.pop()!.close(); });
const START = roundAt(T + 3 * 3_600_000);

async function checkStep(rewards?: unknown[]) {
  const w = newWorld();
  const key = (await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }))).token as string;
  expect((await w.api("POST", "/api/z", { id: "BLANK-1", startRound: START, callSeconds: 20, cap: 100, ...(rewards ? { rewards } : {}) }, key)).status).toBe(200);
  const p = await openPage(w.world, { url: "http://localhost/zc.html?e=BLANK-1", html: "zc.html", scripts: ["zgame.js", "control.js", "consent.js", "zc.js"], session: { "cbz-org": key } });
  open.push(p); await p.waitFor((t) => /Your progress/.test(t));
  p.click('[data-open="7"]'); const t = await p.waitFor((x) => /Check your game/.test(x));
  return { w, key, t };
}

describe("publish warning for blank prizes", () => {
  test("prizes left on 'decide later' are listed in a note on the Check and publish step", async () => {
    const { t } = await checkStep();
    expect(t).toMatch(/6 to decide/); expect(t).toMatch(/6 prizes say "decide later"\. You can still publish\./);
  });
  test("one blank prize reads in the singular", async () => {
    const { t } = await checkStep([{ pattern: "milestone", ordinal: 1, text: "Gift card" }, { pattern: "finish", ordinal: 1, text: "" }]);
    expect(t).toMatch(/1 prize says "decide later"\. You can still publish\./);
  });
  test("no note when every prize has its words; and the server never blocks publishing with blank prizes", async () => {
    const full = await checkStep([{ pattern: "milestone", ordinal: 1, text: "Gift card" }, { pattern: "finish", ordinal: 1, text: "Hamper" }]);
    expect(full.t).not.toMatch(/decide later/);
    const blank = await checkStep();
    const r = await blank.w.api("POST", "/api/z/BLANK-1/publish", { email: "boss@acme.com", phone: "98765 43210" }, blank.key);
    expect(r.status).toBe(200); expect((await blank.w.json(r)).published).toBe(true);
  });
});
