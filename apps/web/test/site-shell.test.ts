// The look and feel of the public pages (owner order 2026-10-29: every page of the game looks and feels like housie.corporatetambola.com): one shared page shell
// (tools/make-site-shell.mjs) on every page, the header menu with exactly six items in one order, the brand name with a small CORPORATE line, the games bar, the payee words,
// the search and share tags, every internal link, no old word, cache headers, and the service worker. Each rule here was shown to fail when its subject was broken (docs/SITE-SNAKES-2026-10-29.md).
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
// @ts-ignore the tool is a plain .mjs file next to a .d.mts
import { MENU, ORIGIN, PAGES, PAY_LINE, V, run } from "../../../tools/make-site-shell.mjs";

const ROOT = join(import.meta.dir, "../../..");
const PUB = join(ROOT, "apps/web/public");
const rd = (f: string) => readFileSync(join(PUB, f), "utf8");
const LABELS = ["How it works", "Free demo game", "Guide", "Brochure", "Refer & earn", "Log in"];
const MENU_LINK = ["/how-it-works.html", "/demo.html", "/organizer-guide.html", "/brochure.html", "/partner.html", "/zc.html"];
const WEBSITE = PAGES.filter((p: any) => p.kind !== "console"); // the organizer console has the kit's console top bar (a logo, "All games"), not the website menu
const HTML = readdirSync(PUB).filter((f) => f.endsWith(".html"));
const plain = (html: string) => html.replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&rsquo;|&#39;|&apos;/g, "'").replace(/&ldquo;|&rdquo;|&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const tryRd = (f: string) => { try { return rd(f); } catch { return ""; } };
const hrefs = (html: string) => [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]!);

describe("the shared page shell", () => {
  test("every page's head, header and footer are exactly what tools/make-site-shell.mjs writes (run: bun tools/make-site-shell.mjs)", () => {
    expect(run(true)).toEqual([]);
  });
  test("every page of the list exists, and every public page of the site is in the list", () => {
    for (const p of PAGES) expect([p.f, existsSync(join(PUB, p.f))]).toEqual([p.f, true]);
    const left = HTML.filter((f) => !PAGES.some((p: any) => p.f === f));
    expect(left.sort()).toEqual(["big.html", "demo.html", "owner-versions.html", "owner-visits.html", "preview.html", "z.html"]); // the game screens (phone, big screen, practice game, test of a brand moment) and the owner's pages keep their own look
  });
});

describe("the header menu: exactly six items, in this order, on every page of the website", () => {
  for (const p of WEBSITE) test(`${p.f}: How it works | Free demo game | Guide | Brochure | Refer & earn | Log in`, () => {
    const h = rd(p.f), nav = /<nav class="ck-nav" id="ck-nav" aria-label="Main">([\s\S]*?)<\/nav>/.exec(h);
    expect(nav).not.toBeNull(); expect(h.match(/<nav class="ck-nav"/g)!.length).toBe(1); expect(h.match(/<header class="ck-top"/g)!.length).toBe(1);
    const inner = nav![1]!.replace(/<span class="ck-dots"[\s\S]*?<\/span>/, ""), links = [...inner.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    expect(links.map((m) => m[2]!.replace(/&amp;/g, "&").trim())).toEqual(LABELS);
    expect(links.map((m) => /href="([^"]+)"/.exec(m[1]!)![1])).toEqual(MENU_LINK);
    expect(links[1]![1]).toContain('class="demo"'); expect(links[5]![1]).toContain('class="login"');
    expect(inner.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, "").trim()).toBe(""); // nothing else is in the menu: no AI-assistant pill, no Video, no Pricing, no WhatsApp
    expect(h).toContain('class="ck-dots" role="group" aria-label="Colour theme"'); expect(h).toContain('id="ck-menu"'); // the phone menu button and the three colour dots
  });
  test("the menu words and addresses in the shell tool are the same six (so a page cannot drift from the tool)", () => {
    expect(MENU.map((m: any) => m[0].replace(/&amp;/g, "&"))).toEqual(LABELS); expect(MENU.map((m: any) => m[1])).toEqual(MENU_LINK);
  });
  test("the header's own page is marked, and the Log in word does not change when someone is signed in", () => {
    expect(rd("organizer-guide.html")).toContain('<a href="/organizer-guide.html" aria-current="page">Guide</a>'); expect(rd("brochure.html")).toContain('aria-current="page">Brochure</a>');
    expect(rd("how-it-works.html")).toContain('aria-current="page">How it works</a>'); expect(rd("partner.html")).toContain('aria-current="page">Refer &amp; earn</a>');
    const js = rd("site.js"); expect(js).not.toMatch(/a\.textContent\s*=/); expect(js).toContain('a.setAttribute("aria-label"'); // only the tooltip and the screen-reader name say "Signed in as ..."
  });
  test("no page header links to the console site that does not exist yet", () => {
    for (const f of readdirSync(PUB).filter((x) => /\.(html|js|css|txt|xml|json|webmanifest)$/.test(x))) expect([f, rd(f).includes("console.corporatetambola.com")]).toEqual([f, false]);
    expect(readFileSync(join(ROOT, "tools/make-site-shell.mjs"), "utf8")).not.toContain("console.corporatetambola.com");
  });
});

describe("the brand and the games bar", () => {
  for (const p of WEBSITE) test(`${p.f}: the brand reads Corporate (small line) above Snakes and Ladders, the skip link is the first thing, and the games bar is ${p.bar ? "loaded" : "not loaded"}`, () => {
    const h = rd(p.f), body = h.slice(h.indexOf("<body"));
    expect(h).toContain('<span class="ck-name"><i>Corporate</i><b>Snakes and Ladders</b></span>'); expect(h).toContain('aria-label="Corporate Snakes and Ladders, home"'); expect(h).toContain('<use href="#i-snakes"/>');
    const firstEl = /<(?!!--)(svg|a|div)\b[^>]*>/.exec(body.slice(body.indexOf(">") + 1))![0]; // the sprite may come first on a website page; the skip link is before the header and before the bar mounts
    expect(body.indexOf('<a class="ck-skip" href="#')).toBeLessThan(body.indexOf('<header class="')); expect(firstEl.startsWith("<svg") || firstEl.startsWith("<a class=\"ck-skip\"") || firstEl.startsWith("<div")).toBe(true);
    expect(h.includes('<script src="/gamesbar.js?v=2" data-game="snakes" defer></script>')).toBe(!!p.bar); expect(h.includes('href="/gamesbar.css?v=2"')).toBe(!!p.bar);
    expect(h).toContain('<script src="/theme-init.js?v=1"></script>'); // without defer, before the page is drawn
    const skipTarget = /<a class="ck-skip" href="#([^"]+)"/.exec(h)![1]!; expect(h).toContain(`id="${skipTarget}"`);
  });
  test("the games bar is on every public page and on no play, console, pay, sign-in or owner page", () => {
    for (const f of ["index.html", "how-it-works.html", "organizer-guide.html", "brochure.html", "partner.html", "helpdesk.html", "pricing.html", "about.html", "contact.html", "terms.html", "privacy.html", "refund-policy.html", "dpa.html", "subprocessors.html", "legal.html", "legal-position.html", "partner-terms.html", "trust.html", "404.html"]) expect([f, rd(f).includes("/gamesbar.js")]).toEqual([f, true]);
    for (const f of ["z.html", "zc.html", "big.html", "preview.html", "pay.html", "paylink.html", "paytest.html", "report.html", "signin.html", "demo.html", "owner-visits.html", "owner-versions.html", "ai-link.html", "offline.html"]) expect([f, rd(f).includes("gamesbar")]).toEqual([f, false]);
    const b = readFileSync(join(ROOT, "pages/build.mjs"), "utf8"); expect(b).toContain('"gamesbar.js"'); expect(b).toContain('"gamesbar.css"');
  });
  test("every page that names the game says it in the proper words: no old 'Snakes & Ladders' name in the text people read", () => {
    for (const f of HTML) expect([f, /Snakes\s*(&amp;|&)\s*Ladders/.test(plain(rd(f)))]).toEqual([f, false]);
  });
});

describe("the hero question, the trust list and the game-day drawings on the landing page", () => {
  const h = rd("index.html");
  test("the hero asks 'This week, which teams ...', the trust list is 'What you can count on' and the strip is 'How a game day feels'", () => {
    expect(h).toContain("<h1>This week, which teams will you engage with <span class=\"ck-hl\">Corporate Snakes and Ladders?</span></h1>");
    expect(h).toContain("<h2>What you can count on</h2>"); expect(h).toContain("How a game day feels"); expect(h).toContain("Easy for you. Fun for your people.");
    expect(h.match(/<svg class="ck-art"/g)!.length).toBe(3); expect(h).toContain("You share one link"); expect(h).toContain("Winners are cheered");
    expect((/<ul class="ck-facts">([\s\S]*?)<\/ul>/.exec(h)![1]!.match(/<li>/g) ?? []).length).toBe(8);
  });
  test("the free demo is the 70-second practice game (a real page); the page never claims a 10-person demo that the code cannot give", () => {
    expect(h).toContain('href="/demo.html">Try the free 70-second demo'); expect(existsSync(join(PUB, "demo.html"))).toBe(true);
    const claim = /free (?:game|demo)[^.<]{0,30}\b10\b|10[- ](?:people|players|person)[^.<]{0,30}(?:free|demo)|demo for 10/i, backed = /demo=1/.test(rd("zc.js")) && /DEMO_CAP/.test(readFileSync(join(ROOT, "apps/edge/src/worker.ts"), "utf8"));
    if (!backed) for (const f of HTML) expect([f, claim.test(plain(rd(f)))]).toEqual([f, false]);
    expect(readFileSync(join(ROOT, "tools/make-site-shell.mjs"), "utf8")).toContain("export const DEMO = { href:"); // the one place that changes when the 10-person demo exists
  });
  test("the hero's two buttons and the Create your game block keep the ids the page script needs", () => {
    for (const id of ["pack", "payBtn", "packs", "priceNote", "whoL", "loginLink"]) expect([id, h.includes(`id="${id}"`)]).toEqual([id, true]);
    expect(h).toContain("data-cur"); expect(h).toContain('id="pricing"'); expect(h).toContain('id="how"');
  });
});

describe("words: close group, English, short", () => {
  test("no page says the banned word (it starts with p-r-i and ends with v-a-t-e), in what a person reads or in what the page scripts write for a person", () => {
    const bad = new RegExp("pri" + "vate", "i");
    for (const f of HTML) expect([f, bad.test(plain(rd(f)))]).toEqual([f, false]);
    for (const f of ["site.js", "zc.js", "common.js", "partner.js", "helpdesk.js", "pay.js", "paylink.js", "paytest.js", "signin.js", "ai-link.js", "report.js", "z.js", "demo.js", "big.js", "preview.js", "consent.js", "guide.js"]) {
      const strings = [...rd(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1").matchAll(/"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)].map((m) => m[1] ?? m[2] ?? "");
      expect([f, strings.filter((s) => bad.test(s)).slice(0, 3)]).toEqual([f, []]);
    }
    for (const f of ["llms.txt", "robots.txt", "manifest.webmanifest"]) expect([f, bad.test(rd(f))]).toEqual([f, false]);
  });
  test("the words 'close group' are used (a game for the people you invite), and every page is English", () => {
    expect(plain(rd("index.html"))).toMatch(/close group/i); expect(plain(rd("how-it-works.html"))).toMatch(/close group/i);
    for (const p of WEBSITE) expect([p.f, /<html lang="en"/.test(rd(p.f))]).toEqual([p.f, true]);
  });
});

describe("payments: only IT Services by Rajat Agarwal, only through Razorpay", () => {
  test("every website page carries the payee sentence in its footer, and no page or script names another payee or gateway", () => {
    for (const p of WEBSITE.filter((x: any) => x.kind !== "console")) expect([p.f, rd(p.f).includes(PAY_LINE)]).toEqual([p.f, true]);
    expect(PAY_LINE).toBe("All payments are taken only by IT Services by Rajat Agarwal, through Razorpay.");
    for (const f of readdirSync(PUB).filter((x) => /\.(html|js|txt)$/.test(x) && !/^(zgame|control|reportgen)\.js$/.test(x))) expect([f, /\b(Stripe|PayPal|Paytm|PayU|Cashfree|Instamojo|PhonePe|CCAvenue|Braintree)\b/i.test(rd(f))]).toEqual([f, false]);
  });
  test("a page that names the payee names Razorpay too (pricing, brochure, guide, FAQ, the payment pages)", () => {
    for (const f of HTML) { const t = plain(rd(f)); if (/IT Services by Rajat Agarwal/.test(t)) expect([f, /Razorpay/.test(t) || /Razorpay/.test(tryRd(f.replace(".html", ".js")))]).toEqual([f, true]); }
    for (const f of ["pay.js", "paylink.js", "paytest.js"]) expect(rd(f)).toMatch(/Razorpay[\s\S]{0,200}IT Services by Rajat Agarwal|IT Services by Rajat Agarwal[\s\S]{0,200}Razorpay/);
  });
});

describe("search and share tags: canonical, share card, robots, sitemap", () => {
  test("every indexable page has its own canonical address, the share card og-card.png, and is in the sitemap; every other page says noindex and is not", () => {
    const sm = rd("sitemap.xml"), robots = rd("robots.txt");
    for (const p of PAGES) {
      const h = rd(p.f), url = ORIGIN + p.path;
      if (p.index) { expect([p.f, h.includes(`<link rel="canonical" href="${url}">`), h.includes(`<meta property="og:url" content="${url}">`), h.includes(`<meta property="og:image" content="${ORIGIN}/og-card.png">`), h.includes(`<meta name="twitter:image" content="${ORIGIN}/og-card.png">`), sm.includes(`<loc>${url}</loc>`)]).toEqual([p.f, true, true, true, true, true]); }
      else { expect([p.f, /<meta name="robots" content="noindex/.test(h), h.includes('rel="canonical"'), sm.includes(`<loc>${url}</loc>`)]).toEqual([p.f, true, false, false]); }
    }
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`); expect(robots).toContain("Allow: /how-it-works.html"); expect(robots).toContain("Disallow: /signin.html");
    expect(rd("llms.txt")).toContain(`${ORIGIN}/how-it-works.html`);
  });
  test("the web manifest takes the kit's colours and icons and keeps the player page as its start", () => {
    const m = JSON.parse(rd("manifest.webmanifest")); expect([m.background_color, m.theme_color]).toEqual(["#FFFAF2", "#0B3D91"]);
    expect(m.icons.map((i: any) => i.src.split("?")[0])).toEqual(["/icon-192.png", "/icon-512.png", "/icon-maskable-192.png", "/icon-maskable-512.png"]); expect(m.start_url).toBe("/z.html");
    for (const p of PAGES) expect([p.f, rd(p.f).includes('<meta name="theme-color" content="#0B3D91">')]).toEqual([p.f, true]);
  });
});

describe("every link on every page leads somewhere", () => {
  const known = new Set([...readdirSync(PUB)]);
  const resolves = (u: string) => {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(u)) return true;
    let p = u.split("#")[0]!.split("?")[0]!; if (!p || p === "/") return true; if (!p.startsWith("/")) return false; p = p.slice(1);
    if (p.startsWith("api/") || p.startsWith("ai/") || p.startsWith("j/")) return true; // the worker answers these
    return existsSync(join(PUB, p)) || known.has(p + ".html");
  };
  for (const f of HTML) test(`${f}: every internal link and file resolves`, () => {
    const bad = hrefs(rd(f)).filter((u) => !resolves(u)); expect([f, bad]).toEqual([f, []]);
  });
  test("the links that open other sites go only to our own games, home and legal addresses", () => {
    const ok = /^https:\/\/(housie|bingo|tictactoe|snakes|luck|home)\.corporatetambola\.com\/|^https:\/\/itservices-rajat-agarwal\.pages\.dev\/|^https:\/\/snakes\.corporatetambola\.com|^https:\/\/(www\.)?w3\.org\/|^https:\/\/schema\.org/;
    for (const f of HTML) for (const u of hrefs(rd(f)).filter((x) => /^https?:/.test(x))) expect([f, u, ok.test(u)]).toEqual([f, u, true]);
  });
});

describe("cache: new files reach every phone and browser", () => {
  const sw = rd("zsw.js"), files: string[] = JSON.parse(sw.match(/const FILES = (\[[\s\S]*?\]);/)![1]!);
  test("the service worker's version was raised (cb-game-v29 was the live one) and it saves the kit files the console and the offline page need", () => {
    const v = Number(/const CACHE = "cb-game-v(\d+)"/.exec(sw)![1]); expect(v).toBeGreaterThan(29);
    for (const f of ["/tokens.css", "/components.css", "/console.css", "/site.css", "/fonts.css", "/fonts-game.css", "/theme-init.js", "/light-only.js", "/brandkit.js", "/offline.html", "/offline.js"]) expect([f, files.includes(f)]).toEqual([f, true]);
    for (const page of ["zc.html", "offline.html"]) for (const m of rd(page).matchAll(/(?:src|href)="(\/[^"?]+\.(?:js|css))(?:\?v=\d+)?"/g)) if (m[1] !== "/rum.js" && m[1] !== "/v.js" && m[1] !== "/gamesbar.js" && m[1] !== "/gamesbar.css") expect([page, m[1], files.includes(m[1]!)]).toEqual([page, m[1], true]);
  });
  test("every link to a kit or site file carries ?v=N, the same N on every page, and N is the number the shell tool holds", () => {
    const want: Record<string, number> = { "fonts.css": V.kit, "tokens.css": V.kit, "components.css": V.kit, "console.css": V.kit, "theme-init.js": V.kit, "brandkit.js": V.kit, "site.css": V.site, "light-only.js": V.site, "fonts-game.css": V.game, "gamesbar.css": V.bar, "gamesbar.js": V.bar };
    for (const p of PAGES) for (const m of rd(p.f).matchAll(/(?:src|href)="\/([a-z-]+\.(?:js|css))(?:\?v=(\d+))?"/g)) if (want[m[1]!]) expect([p.f, m[1], Number(m[2])]).toEqual([p.f, m[1], want[m[1]!]]);
    for (const n of Object.values(V)) expect(n).toBeGreaterThanOrEqual(1);
    for (const p of PAGES) for (const m of rd(p.f).matchAll(/(apple-touch-icon\.png|favicon-32\.png)\?v=(\d+)/g)) expect([p.f, m[1], Number(m[2])]).toEqual([p.f, m[1], V.icons]);
  });
  test("the Pages build ships every new file, serves css, js and the manifest with no-cache, keeps fonts for a year, and the older headers file says the same", () => {
    const b = readFileSync(join(ROOT, "pages/build.mjs"), "utf8");
    for (const f of ["tokens.css", "components.css", "console.css", "fonts.css", "fonts-game.css", "brandkit.js", "theme-init.js", "light-only.js", "favicon.svg", "favicon.ico", "og-card.png", "how-it-works.html", "brochure.pdf", "organizer-guide.pdf"]) expect([f, b.includes(`"${f}"`)]).toEqual([f, true]);
    expect(b).not.toContain('"theme.js"'); expect(b).toContain('"/how-it-works", PLAINCSP, false');
    expect(b).toMatch(/\/\*\.js\\n  Cache-Control: no-cache/); expect(b).toMatch(/\/\*\.css\\n  Cache-Control: no-cache/); expect(b).toMatch(/\/manifest\.webmanifest\\n  Cache-Control: no-cache/); expect(b).toMatch(/\/fonts\/\*\\n  Cache-Control: public, max-age=31536000, immutable/);
    const hd = rd("_headers"); expect(hd).toMatch(/\/\*\.js\n  Cache-Control: no-cache/); expect(hd).toMatch(/\/\*\.css\n  Cache-Control: no-cache/); expect(hd).not.toMatch(/max-age=3600/);
    for (const f of readdirSync(join(PUB, "fonts"))) expect(existsSync(join(PUB, "fonts", f))).toBe(true);
  });
});

describe("the organizer console takes only the visual shell", () => {
  test("zc.html loads the kit's tokens, fonts and console look and the kit's top bar, and still loads the same console scripts in the same order", () => {
    const h = rd("zc.html");
    for (const f of ["tokens.css", "components.css", "console.css", "fonts.css"]) expect(h).toContain(`href="/${f}?v=1"`);
    expect(h).toContain('<header class="cs-top">'); expect(h).toContain('<span class="ck-name"><i>Corporate</i><b>Snakes and Ladders</b></span>'); expect(h).toContain('<main id="app" class="zapp zc" aria-live="polite">');
    expect([...h.matchAll(/<script src="\/(zgame|control|consent|zc)\.js"><\/script>/g)].map((m) => m[1])).toEqual(["zgame", "control", "consent", "zc"]);
    expect(h).not.toContain("gamesbar"); expect(h).toContain('data-mode="light"'); expect(h).toContain("noindex");
  });
});

describe("the pages follow the kit's CSP-safe rules: no inline style, no style tag, no event handler, no inline script except the search data", () => {
  for (const p of PAGES) test(`${p.f}`, () => {
    const h = rd(p.f).replace(/<svg\b[\s\S]*?<\/svg>/g, "");
    expect([p.f, /\sstyle="/.test(h), /<style\b/.test(h), /\son[a-z]+="/.test(h)]).toEqual([p.f, false, false, false]);
    for (const m of h.matchAll(/<script\b([^>]*)>/g)) expect([p.f, m[1]!.includes("src=") || m[1]!.includes("application/ld+json")]).toEqual([p.f, true]);
  });
});
