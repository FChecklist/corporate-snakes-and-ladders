// A 10-player Rs 0 demo game played ONLY by clicking and typing in real Chrome pages (no API call sets anything up): the Organizer signs in, builds the game through the console,
// 10 players open the link on phone-sized pages, tick the boxes, type a name and join; the 11th is told the game is full; the big screen is opened and, when the network is cut, shows
// the red "Connection lost" bar. Everything is read back from what the pages show.   SITE=https://snakes.corporatetambola.com node tools/browser-tests/ui-snakes.mjs --login demo1@xyz.in --players 10
import { launch, signIn, sleep } from "file:///C:/ct/test-sites/tambola/tools/browser-tests/ui-lib.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const args = process.argv.slice(2); const opt = (k, d) => { const i = args.indexOf("--" + k); return i >= 0 ? args[i + 1] : d; };
const SITE = process.env.SITE || "https://snakes.corporatetambola.com", LOGIN = opt("login", "demo1@xyz.in"), PLAYERS = Number(opt("players", 10)), B = process.env.BROWSER || "chrome";
const R = { site: SITE, players: PLAYERS, checks: [], errors: [] };
const check = (n, ok, d = "") => { R.checks.push({ n, ok: !!ok, d: String(d).slice(0, 300) }); console.log(ok ? "PASS" : "FAIL", n, ok ? "" : "| " + String(d).slice(0, 300)); };
const body = async (p) => (await p.innerText("body")).replace(/\s+/g, " ");
const chip = (p, v) => p.locator(`button.zc-chip[data-v="${v}"], button.zc-chip:has-text("${v}")`).first();
const browser = await launch(B); let eid = null;
try {
  const octx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await octx.newPage();
  p.on("pageerror", (e) => R.errors.push("organizer: " + String(e).slice(0, 200)));
  await signIn(p, SITE, LOGIN); check("signed in as Organizer", /Signed in as Organizer/.test(await body(p)));
  const before = new Set(await p.$$eval("button.zc-mini", () => [])); void before;
  await p.click("#mk"); await p.waitForFunction(() => /[?&]e=/.test(location.search), null, { timeout: 60000 }).catch(() => {}); await sleep(1500);
  eid = new URL(p.url()).searchParams.get("e"); R.eid = eid; check("a game exists after pressing Start a new game", !!eid, p.url());
  await p.goto(`${SITE}/zc?e=${eid}`, { waitUntil: "load" }); await p.waitForSelector(".zc-dot", { timeout: 60000 }); await sleep(2500);
  // step 1: an occasion, a day four days ahead (a demo never counts as a game starting soon) and a time
  await p.click('.zc-dot[data-open="1"]'); await sleep(1200);
  await p.locator("button.zc-chip", { hasText: "Team event" }).first().click();
  const days = await p.$$("button.zc-chip[data-v^='2026-']"); await days[Math.min(4, days.length - 1)].click();
  await p.locator("button.zc-chip", { hasText: /^10 am$/ }).first().click();
  check("step 1: choices are chips with one chosen in each group", (await p.$$("button.zc-chip.on")).length >= 3);
  await p.locator("button.zc-btn", { hasText: "Save and continue" }).first().click(); await sleep(2500);
  // step 2: 10 players, anyone with the link
  await p.click('.zc-dot[data-open="2"]'); await sleep(1500);
  await p.fill("#f-cap", "10"); await sleep(300); await p.locator("button.zc-chip", { hasText: "Anyone with the link" }).first().click(); await sleep(300);
  const t2 = await body(p);
  check("step 2: the rarely used 'Turn limit' choice is hidden", !(await p.getByText("Turn limit", { exact: false }).first().isVisible().catch(() => false)));
  check("step 2: the choice 'The game ends when this many players are home' is still visible", /this many players are home/.test(t2));
  await p.locator("button.zc-btn", { hasText: "Save and continue" }).first().click(); await sleep(2500);
  const t = await body(p); check("the game shows as paid (Rs 0) and published, nothing to pay", /Paid/.test(t) && /Published/.test(t), t.slice(0, 160));
  // the players: ten phone-sized pages, each in its own browser profile
  let joined = 0; R.pages = [];
  for (let i = 1; i <= PLAYERS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } }); const pg = await ctx.newPage(); pg.on("pageerror", (e) => R.errors.push("player " + i + ": " + String(e).slice(0, 200)));
    await pg.goto(`${SITE}/z.html?e=${eid}`, { waitUntil: "domcontentloaded", timeout: 60000 }); await pg.waitForSelector("#nm", { timeout: 40000 }); await pg.waitForSelector("input[type=checkbox]", { timeout: 40000 });
    for (const bx of await pg.$$("input[type=checkbox]")) await bx.check({ force: true }).catch(() => {});
    await pg.fill("#nm", "Player " + i); await pg.click("#go");
    try { await pg.waitForFunction(() => !document.getElementById("go") && !/Join the game/.test(document.body.innerText), null, { timeout: 60000 }); joined++; } catch { R.errors.push("player " + i + " did not get in: " + (await body(pg)).slice(0, 160)); }
    R.pages.push(pg);
  }
  check(`${PLAYERS} players joined by clicking`, joined === PLAYERS, "joined " + joined);
  { const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } }); const pg = await ctx.newPage(); await pg.goto(`${SITE}/z.html?e=${eid}`, { waitUntil: "domcontentloaded", timeout: 60000 }); await pg.waitForSelector("#nm", { timeout: 40000 }); await pg.waitForSelector("input[type=checkbox]", { timeout: 40000 });
    for (const bx of await pg.$$("input[type=checkbox]")) await bx.check({ force: true }).catch(() => {}); await pg.fill("#nm", "Player 11"); await pg.click("#go"); await sleep(4000);
    check("the 11th is told the game is full", /full/i.test(await body(pg)), (await body(pg)).slice(0, 160)); }
  const seen = []; for (const pg of R.pages) seen.push(/Starting in|Getting ready|Your board|board|What you can win/i.test(await body(pg))); 
  check("every player sees the waiting/board page after joining", seen.every(Boolean), seen.filter((x) => !x).length + " did not");
  // the console counts the players
  await p.goto(`${SITE}/zc?e=${eid}`, { waitUntil: "load" }); await p.waitForSelector(".zc-dot", { timeout: 60000 }); await sleep(3500);
  check("the Organizer's page counts 10 people", /10 people|10 of 10|\b10 joined/.test(await body(p)), (await body(p)).slice(0, 200));
  // the big screen, and the red bar when the connection is cut
  const bctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); const bp = await bctx.newPage(); bp.on("pageerror", (e) => R.errors.push("big: " + String(e).slice(0, 200)));
  await bp.goto(`${SITE}/big.html?e=${eid}`, { waitUntil: "load" }); await bp.waitForFunction(() => /starts in|setting up/.test(document.body.innerText), null, { timeout: 60000 }).catch(() => {}); await sleep(500);
  check("the big screen shows the game (no lost bar while online)", (await bp.locator(".lostbar").count()) === 0 && /Snakes and Ladders|starts in|setting up/i.test(await body(bp)), (await body(bp)).slice(0, 160));
  await bctx.setOffline(true); await sleep(26000);
  check("the big screen shows the red 'Connection lost' bar when the network is cut", /Connection lost/.test(await bp.locator(".lostbar").first().innerText().catch(() => "")), (await body(bp)).slice(0, 160));
  check("no page error anywhere", R.errors.length === 0, R.errors.join(" | "));
} catch (e) { check("the run finished without a crash", false, String(e).slice(0, 300)); }
finally { mkdirSync("C:/ct/test-sites/data/ui", { recursive: true }); writeFileSync(`C:/ct/test-sites/data/ui/ui-snakes-${Date.now()}.json`, JSON.stringify(R, null, 1)); await browser.close().catch(() => {}); }
console.log("RESULT", R.checks.filter((c) => c.ok).length, "pass", R.checks.filter((c) => !c.ok).length, "fail");
