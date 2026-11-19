// Wording of the free demo (found by the wording review of 2026-10-29): every sentence must point at things that exist on the screen, and a free demo never says Paid or pay.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { T, newWorld, openPage, roundAt } from "./harness";

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const open: Awaited<ReturnType<typeof openPage>>[] = [];
afterEach(async () => { while (open.length) await open.pop()!.close(); });
const START = roundAt(T + 3 * 3_600_000);

describe("the demo sentences point at buttons that exist", () => {
  test("no sentence tells the organizer to press 'Make a copy': the button is 'Create a new game like this one'", () => {
    for (const f of ["../public/zc.js", "../../edge/src/worker.ts", "../../edge/src/pay.ts", "../../edge/src/clone.ts", "../../edge/src/cancel.ts"]) expect(src(f), f).not.toMatch(/make a copy/i);
    expect(src("../public/zc.js")).toContain("Create a new game like this one");
  });
  test("the demo-link message names the chip that exists", () => { expect(src("../public/zc.js")).not.toMatch(/choose "Up to \$\{r\.cap\} people"\.`; \}/); });
});

describe("a free demo never says Paid or pay on the organizer's screens", () => {
  async function demoPage(demo: boolean, publish: boolean) {
    const w = newWorld();
    const key = (await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }))).token as string;
    await w.api("POST", "/api/z", { id: "DEMO-WD", startRound: START, callSeconds: 20, cap: demo ? 10 : 100, ...(demo ? { demo: true } : {}) }, key);
    if (publish) await w.api("POST", "/api/z/DEMO-WD/publish", { email: "boss@acme.com", phone: "98765 43210" }, key);
    const p = await openPage(w.world, { url: "http://localhost/zc.html?e=DEMO-WD", html: "zc.html", scripts: ["zgame.js", "control.js", "consent.js", "zc.js"], session: { "cbz-org": key } });
    open.push(p); await p.waitFor((t) => /Save and continue|Your progress/.test(t));
    return { p, w, key };
  }
  test("a published demo: the step list and the publish step say free, not 'Paid. The game is on' or 'Next: pay in step 8'", async () => {
    const { p } = await demoPage(true, true);
    const t = p.text();
    expect(t).not.toMatch(/Paid\. The game is on/); expect(t).toMatch(/Free demo/);
    p.click('[data-open="7"]'); const t7 = await p.waitFor((x) => /Check your game/.test(x));
    expect(t7).not.toMatch(/Next: pay in step 8/); expect(t7).toMatch(/Nothing to pay/);
  });
  test("a draft demo: the publish step does not say 'You pay before the start time'", async () => {
    const { p } = await demoPage(true, false);
    p.click('[data-open="7"]'); const t7 = await p.waitFor((x) => /Publish \(free\)/.test(x));
    expect(t7).toMatch(/free demo game: it starts without any payment/); expect(t7).not.toMatch(/You pay before the start time/);
  });
  test("an ordinary game still says what it said before", async () => {
    const { p } = await demoPage(false, true);
    expect(p.text()).toMatch(/Payment pending/);
  });
});

describe("the late-move sentence is shown alone", () => {
  test("the guide does not put the approved sentence inside a longer pop-up on the player's page", async () => {
    const win: any = new Window({ url: "http://localhost/z.html?e=X", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } });
    win.document.write('<html><head></head><body><main id="app"><p>Game page</p></main></body></html>');
    new Function("window", `with (window) { ${src("../public/guide.js")}\n}`).call(win, win);
    await new Promise((r) => setTimeout(r, 100));
    const app = win.document.getElementById("app");
    // exactly what z.js draws for a refused throw (see the banner in apps/web/public/z.js)
    const z = src("../public/z.js"); const banner = /THROW\.note \? `([^`]*)\$\{esc\(THROW\.note\)\}<\/div>`/.exec(z);
    expect(banner, "the banner of a refused throw is in z.js").not.toBeNull();
    app.innerHTML = '<p>Game page</p>' + banner![1] + "Ohooo! \u{1F60A} Sorry, you moved after your turn ended. This move cannot be made.</div>";
    await new Promise((r) => setTimeout(r, 400));
    expect(win.document.getElementById("ctg-dialog")).toBeNull(); // no pop-up on top of the sentence
    expect(app.textContent).toContain("Ohooo! \u{1F60A} Sorry, you moved after your turn ended. This move cannot be made.");
  });
});
