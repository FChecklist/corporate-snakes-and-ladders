// Group 14: the free 10-person demo, by tapping, in real Chrome: on a laptop (1280) and on a phone (390). Added in the QA of 2026-10-29.
import { H, openConsole, openStep, chip, saveStep, uiPublish, guestJoinUi, guestText, joinApi, nextPhone } from "./kit.mjs";

const eidOf = (page) => new URL(page.url()).searchParams.get("e");
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function demoGameUi(t, device) {
  const org = await t.org("d");
  const x = await openConsole(t, org, null, { device });
  await x.page.click("#mk"); await x.page.waitForSelector(".zc-sech", { timeout: 15000 });
  await x.page.waitForFunction(() => /[?&]e=/.test(location.search), null, { timeout: 8000 });
  const eid = eidOf(x.page);
  await openStep(x.page, 1); await chip(x.page, "occ", "Team event"); await chip(x.page, "time", "19:00"); await saveStep(x.page, 1);
  await openStep(x.page, 2);
  return { org, x, eid };
}

export default [
  {
    id: "S14-01", name: "The free demo on a laptop (1280 px): the size list starts with 'Free demo: 10 people, Rs 0', it is saved as a demo, published with nothing to pay, and the console says so",
    async run(t) {
      const { org, x, eid } = await demoGameUi(t, "laptop");
      const sizes = await t.text(x.page, "#sec2");
      t.check("the first size is the free demo", /Free demo: 10 people, Rs 0/.test(sizes) && sizes.indexOf("Free demo: 10 people") < sizes.indexOf("Up to 100 people"), sizes.slice(0, 200));
      await x.page.click("[data-demo]"); await x.page.waitForTimeout(300);
      t.check("choosing it says what a demo is", /A free demo is a real game for up to 10 people/.test(await t.text(x.page, "#sec2")));
      await t.shot(x.page, "demo-step2-1280");
      await saveStep(x.page, 2);
      const info = (await org.info(eid)).body;
      t.check("the server holds a demo of 10 people", info.demo === true && info.cap === 10, JSON.stringify({ demo: info.demo, cap: info.cap }));
      t.check("no sideways scrolling at 1280 px", await noSideScroll(x.page));
      await openStep(x.page, 3); await chip(x.page, "bundle", "Simple"); await saveStep(x.page, 3);
      await openStep(x.page, 5); await x.page.click('#sec5 [data-save="5"]'); await x.page.waitForTimeout(400);
      await openStep(x.page, 6); await x.page.click('#sec6 [data-save="6"]'); await x.page.waitForTimeout(400);
      await openStep(x.page, 7);
      t.check("before publishing, the publish step says it is free and starts without payment", /free demo game: it starts without any payment/.test(await t.text(x.page, "#sec7")) && !/You pay before the start time/.test(await t.text(x.page, "#sec7")), (await t.text(x.page, "#sec7")).slice(0, 300));
      await uiPublish(x.page, t.mail("dp"), "9811122233");
      const sum = (await org.summary(eid)).body;
      t.check("published and paid with no payment", sum.paid === true && sum.demo === true && sum.payment?.status !== "confirming", JSON.stringify({ paid: sum.paid, status: sum.status }));
      await openStep(x.page, 8);
      const pay = await t.text(x.page, "#sec8");
      t.check("the Pay step says free demo and Rs 0, with the way to more people", /Free demo game/.test(pay) && /Rs 0/.test(pay) && /Create a new game like this one and choose a bigger size/.test(pay) && !/Pay before the start|Waiting for the payment/.test(pay), pay.slice(0, 300));
      t.check("the top bar says free demo", /Free demo/.test(await t.text(x.page)));
      await t.shot(x.page, "demo-pay-1280");
    },
  },
  {
    id: "S14-02", name: "The free demo for the people playing it, on a phone (390 px): DEMO GAME on the phone, ten join, the 11th is told the game is full in plain words",
    async run(t) {
      const org = await t.org("d");
      const g = await org.createGame({ leadMs: 3 * H.HOUR, cfg: { cap: 10, demo: true } }); await org.settings(g.id, { whoCanJoin: "anyone" });
      const pub = await org.publish(g.id); t.check("published with no payment", pub.ok && pub.body.paid === true && pub.body.demo === true, JSON.stringify(pub.body).slice(0, 200));
      for (let i = 0; i < 8; i++) { const r = await joinApi(g.id, nextPhone(), "Player " + i); if (!r.ok) t.note("api join " + i + " " + r.status); }
      const a = await t.open({ device: "mobile" }); await guestJoinUi(a.page, g.id, "", "Asha Rao"); await a.page.waitForTimeout(2500);
      const ta = await guestText(a.page);
      t.check("the ninth player is in and the phone says DEMO GAME", /You are in/i.test(ta) && /DEMO GAME/.test(ta), ta.slice(0, 220));
      t.check("no sideways scrolling at 390 px", await noSideScroll(a.page));
      await t.shot(a.page, "demo-phone-390");
      const b = await t.open({ device: "mobile" }); await guestJoinUi(b.page, g.id, "", "Ben Joseph"); await b.page.waitForTimeout(2500);
      t.check("the tenth player is in", /You are in/i.test(await guestText(b.page)), (await guestText(b.page)).slice(0, 200));
      t.check("ten people hold seats", (await org.participants(g.id)).body.total === 10);
      const c = await t.open({ device: "mobile" }); await guestJoinUi(c.page, g.id, "", "Late Larry"); await c.page.waitForTimeout(2500);
      const tc = await guestText(c.page);
      t.check("the eleventh is told the game is full, in plain words, and gets no seat", /full|no more|places/i.test(tc) && !/YOU ARE IN/i.test(tc) && (await org.participants(g.id)).body.total === 10, tc.slice(0, 240));
      await t.shot(c.page, "demo-full-390");
      const big = await t.open({ device: "laptop", label: "bigscreen" }); await big.page.goto(`${H.SIM}/big?e=${g.id}`); await big.page.waitForTimeout(2500);
      t.check("the big screen (1280 px) says DEMO GAME too", /DEMO GAME/.test(await guestText(big.page)), (await guestText(big.page)).slice(0, 200));
      t.check("no sideways scrolling on the big screen", await noSideScroll(big.page));
      await t.shot(big.page, "demo-big-1280");
    },
  },
  {
    id: "S14-03", name: "The demo console on a phone (390 px): the free demo chip is tappable (as easy as the other size chips) and nothing overflows",
    async run(t) {
      const { x } = await demoGameUi(t, "mobile");
      const box = await x.page.locator("[data-demo]").boundingBox(), other = await x.page.locator('[data-ck="cap"]').first().boundingBox();
      t.check("the free demo chip is as easy to tap as the other size chips (same height, fits the screen)", !!box && !!other && box.height >= other.height - 1 && box.x >= 0 && box.x + box.width <= 390, JSON.stringify({ box, other }));
      await x.page.click("[data-demo]"); await x.page.waitForTimeout(300);
      t.check("no sideways scrolling at 390 px", await noSideScroll(x.page));
      await t.shot(x.page, "demo-step2-390");
    },
  },
];
