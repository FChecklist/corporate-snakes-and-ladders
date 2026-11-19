// Shows that the site tests have teeth: for each plant below, one file is broken on purpose, the named test file is run, and the run must go RED with the named test failing;
// then the file is put back exactly (checked by its SHA-256) and the tests must be green again. Nothing is committed or left changed.
// Run: bun tools/falsify-site.mjs            (about two minutes; runs bun test in apps/web and apps/edge)   Output is also written to docs/SITE-SNAKES-FALSIFY.txt when --write is given.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, truncateSync, appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;
const P = (f) => join(ROOT, f), PUB = "apps/web/public/";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const rep = (a, b) => (s) => { if (!s.includes(a)) throw new Error("plant does not apply: " + a.slice(0, 60)); return s.replace(a, b); };
const KIT = "apps/web/test/brand-kit.test.ts", SHELL = "apps/web/test/site-shell.test.ts", BAR = "apps/web/test/gamesbar.test.ts", SEO = "apps/web/test/seo.test.ts", STORE = "apps/web/test/storage-notice.test.ts", BRAND = "apps/edge/test/branding.test.ts";
// [name, file, change (text in, text out; binary files are read as latin1 so every byte survives), test file, text the failing test's name must contain]
const PLANTS = [
  ["a menu word is changed (Guide -> Guides)", PUB + "how-it-works.html", rep('aria-label="Main"><a href="/how-it-works.html" aria-current="page">How it works</a><a href="/demo.html" class="demo">Free demo game</a><a href="/organizer-guide.html">Guide</a>', 'aria-label="Main"><a href="/how-it-works.html" aria-current="page">How it works</a><a href="/demo.html" class="demo">Free demo game</a><a href="/organizer-guide.html">Guides</a>'), SHELL, "how-it-works.html: How it works | Free demo game"],
  ["a seventh item (Pricing) is added to the menu", PUB + "about.html", rep('<a href="/zc.html" class="login" id="loginLink">Log in</a>', '<a href="/pricing.html">Pricing</a><a href="/zc.html" class="login" id="loginLink">Log in</a>'), SHELL, "about.html: How it works | Free demo game"],
  ["two menu items change places", PUB + "terms.html", rep('<a href="/organizer-guide.html">Guide</a><a href="/brochure.html">Brochure</a>', '<a href="/brochure.html">Brochure</a><a href="/organizer-guide.html">Guide</a>'), SHELL, "terms.html: How it works | Free demo game"],
  ["a menu address stops resolving", PUB + "privacy.html", rep('<a href="/brochure.html">Brochure</a>', '<a href="/brochure-old.html">Brochure</a>'), SHELL, "privacy.html: every internal link"],
  ["a kit stylesheet is edited by one character", PUB + "tokens.css", rep("--bg:#FFFAF2;", "--bg:#FFFAF3;"), KIT, "css and js are identical"],
  ["the kit's menu script is edited", PUB + "brandkit.js", rep('"Menu"', '"Menu "'), KIT, "css and js are identical"],
  ["the console stylesheet is edited", PUB + "console.css", rep(".cs-chip{", ".cs-chip {"), KIT, "css and js are identical"],
  ["a font file is changed by one byte", PUB + "fonts/Inter-normal-400.woff2", (s) => s.slice(0, 200) + String.fromCharCode((s.charCodeAt(200) + 1) & 255) + s.slice(201), KIT, "the two fonts are identical"],
  ["the home-screen icon is replaced", PUB + "icon-192.png", (s) => s.slice(0, 300) + String.fromCharCode((s.charCodeAt(300) + 1) & 255) + s.slice(301), KIT, "the logo, the icons"],
  ["the logo mark is redrawn", PUB + "logo-mark.svg", rep("#9C3D1E", "#9C3D1F"), KIT, "the logo, the icons"],
  ["the share card is replaced", PUB + "og-card.png", (s) => s.slice(0, 400) + String.fromCharCode((s.charCodeAt(400) + 1) & 255) + s.slice(401), KIT, "the logo, the icons"],
  ["the games bar script is edited", PUB + "gamesbar.js", rep('"Tambola"', '"Tambola "'), KIT, "gamesbar.js and gamesbar.css are identical"],
  ["the games bar styles are edited", PUB + "gamesbar.css", rep("#1B1442", "#1B1443"), KIT, "gamesbar.js and gamesbar.css are identical"],
  ["the games bar's list of games loses one", PUB + "gamesbar.js", rep('"https://luck.corporatetambola.com/"', '"https://luck2.corporatetambola.com/"'), BAR, "the bar has the home mark and the six games"],
  ["the badge sprite is edited", "tools/site-shell/sprite.html", rep("#9C3D1E", "#9C3D1F"), KIT, "the page-shell snippets"],
  ["a PDF is cut short", PUB + "brochure.pdf", (s) => s.slice(0, Math.floor(s.length / 2)), KIT, "brochure.pdf: a real PDF"],
  ["the guide PDF loses the payee line", PUB + "organizer-guide.pdf", (s) => s.slice(0, 5) + "garbage", KIT, "organizer-guide.pdf: a real PDF"],
  ["the banned word appears in a page", PUB + "about.html", rep("Building and publishing a game is free.", "Building and publishing a game is free, in a priv" + "ate way."), SHELL, "no page says the banned word"],
  ["the banned word appears in a page script's text", PUB + "site.js", rep("A close group Snakes and Ladders game for your company", "A priv" + "ate Snakes and Ladders game for your company"), SHELL, "no page says the banned word"],
  ["a link to the console site that does not exist yet", PUB + "contact.html", rep("<h1>Contact us</h1>", '<h1>Contact us</h1><p><a href="https://console.corporatetambola.com/">Console</a></p>'), SHELL, "no page header links to the console site"],
  ["a page loses its canonical address", PUB + "how-it-works.html", rep('<link rel="canonical" href="https://snakes.corporatetambola.com/how-it-works.html">\n', ""), SEO, "how-it-works.html: unique title"],
  ["a page loses its share card", PUB + "how-it-works.html", rep('<meta property="og:image" content="https://snakes.corporatetambola.com/og-card.png">', ""), SHELL, "search and share tags"],
  ["a page is dropped from the sitemap", PUB + "sitemap.xml", (s) => s.replace(/<url><loc>https:\/\/snakes\.corporatetambola\.com\/how-it-works\.html<\/loc>.*?<\/url>\n?/, ""), SHELL, "search and share tags"],
  ["the service worker version goes back to the live one", PUB + "zsw.js", rep('"cb-game-v30"', '"cb-game-v29"'), SHELL, "the service worker's version was raised"],
  ["the service worker forgets a kit file", PUB + "zsw.js", rep('"/tokens.css", ', ""), SHELL, "the service worker's version was raised"],
  ["a ?v= number is left off a kit link", PUB + "legal.html", rep('<link rel="stylesheet" href="/components.css?v=1">', '<link rel="stylesheet" href="/components.css">'), SHELL, "every link to a kit or site file carries ?v=N"],
  ["css loses its no-cache line in the build", "pages/build.mjs", rep("/*.css\\n  Cache-Control: no-cache", "/*.css\\n  Cache-Control: public, max-age=3600"), SHELL, "the Pages build ships every new file"],
  ["a page says another payment gateway", PUB + "pricing.html", rep("Payment is online by Razorpay", "Payment is online by Stripe"), SHELL, "no page or script names another payee or gateway"],
  ["the payee sentence is changed in the footer tool", "tools/make-site-shell.mjs", rep("All payments are taken only by ${PAYEE}, through Razorpay.", "Payments are collected by ${PAYEE}."), SHELL, "every website page carries the payee sentence"],
  ["the brand name loses its small CORPORATE line", PUB + "pay.html", rep('<span class="ck-name"><i>Corporate</i><b>Snakes and Ladders</b></span>', '<span class="ck-name"><b>Corporate Snakes and Ladders</b></span>'), SHELL, "the brand reads Corporate (small line) above Snakes and Ladders"],
  ["the skip link goes", PUB + "signin.html", rep('<a class="ck-skip" href="#app">Skip to the content</a>\n', ""), SHELL, "signin.html"],
  ["the games bar is loaded on the play page", PUB + "z.html", rep("<head>", '<head><script src="/gamesbar.js?v=2" defer></script>'), SHELL, "the games bar is on every public page"],
  ["the games bar is not told which game it is", PUB + "index.html", rep(' data-game="snakes" defer></script>', " defer></script>"), SHELL, "index.html: the brand reads"],
  ["the landing page claims a 10-person demo the code cannot give", PUB + "index.html", rep("Try the free 70-second demo</a><a class=\"ck-btn\" href=\"/zc.html\">Log in", "Try a free game with 10 people</a><a class=\"ck-btn\" href=\"/zc.html\">Log in"), SHELL, "the free demo is the 70-second practice game"],
  ["the Log in word changes when someone is signed in", PUB + "site.js", rep('a.title = said;', 'a.textContent = said; a.title = said;'), SHELL, "the Log in word does not change"],
  ["the console loses the kit's top bar", PUB + "zc.html", rep('<header class="cs-top">', '<header class="top">'), SHELL, "the organizer console takes only the visual shell"],
  ["the console scripts change order", PUB + "zc.html", rep('<script src="/control.js"></script><script src="/consent.js"></script>', '<script src="/consent.js"></script><script src="/control.js"></script>'), SHELL, "the organizer console takes only the visual shell"],
  ["a device-storage key of the kit is not registered", "apps/web/storage-registry.json", rep('"ct-theme",', ""), STORE, "every key the scripts keep on a device is listed"],
  ["a page is out of step with the shell tool", PUB + "dpa.html", rep('<footer class="ck-foot">', '<footer class="ck-foot" id="x">'), SHELL, "exactly what tools/make-site-shell.mjs writes"],
  ["the e-mail footer forgets who takes payments", "apps/edge/src/brand.ts", rep("<br>${PAY_LINE}<br>", "<br>"), BRAND, "every built e-mail carries the payee sentence"],
  ["the e-mail header loses the CORPORATE line", "apps/edge/src/brand.ts", rep(">Corporate</div>", "></div>"), BRAND, "the e-mail header is the kit's badge"],
  ["the report PDF loses the badge", "apps/edge/src/report-layout.ts", rep("pdf.badge(pdf.M, pdf.H - 14, 56);", ""), BRAND, "the report PDF's title band draws the badge"],
];

const dirOf = (t) => (t.startsWith("apps/edge") ? P("apps/edge") : P("apps/web"));
const runTests = (t) => { const r = spawnSync("bun", ["test", "--isolate", t.replace(/^apps\/(web|edge)\//, "")], { cwd: dirOf(t), encoding: "utf8", timeout: 300000 }); const out = (r.stdout || "") + (r.stderr || ""); return { red: r.status !== 0, fails: [...out.matchAll(/^\(fail\) (.*?)(?: \[[\d.]+ms\])?$/gm)].map((m) => m[1]), tail: out.split("\n").filter((l) => /^ *\d+ (pass|fail)$/.test(l)).join(" ") }; };

const log = []; const say = (s) => { console.log(s); log.push(s); };
let bad = 0;
const filesBefore = new Map();
for (const [name, file, change, test, needle] of PLANTS) {
  const path = P(file); if (!existsSync(path)) { say(`FAIL  ${name}: ${file} is missing`); bad++; continue; }
  const original = readFileSync(path), h0 = sha(original);
  if (!filesBefore.has(file)) filesBefore.set(file, h0);
  let verdict;
  try {
    writeFileSync(path, Buffer.from(change(original.toString("latin1")), "latin1")); // latin1 keeps every byte of a binary file; text pages here are ASCII-safe for the plants
    const r = runTests(test);
    const hit = r.fails.some((f) => f.includes(needle));
    verdict = r.red && hit ? `red  ok   (${r.fails.length} failing, including "${needle}")` : `NOT RED: ${r.red ? "failed, but not the expected test: " + r.fails.slice(0, 2).join(" ; ") : "all green"}`;
    if (!(r.red && hit)) bad++;
  } catch (e) { verdict = "PLANT ERROR " + e.message; bad++; }
  finally { writeFileSync(path, original); }
  if (sha(readFileSync(path)) !== h0) { verdict += "  RESTORE FAILED"; bad++; }
  say(`${verdict.startsWith("red") ? "ok  " : "FAIL"}  ${name}  [${file}] -> ${verdict}`);
}
const tests = [...new Set(PLANTS.map((p) => p[3]))];
for (const t of tests) { const r = runTests(t); say(`${r.red ? "FAIL" : "ok  "}  restored: ${t} ${r.tail}`); if (r.red) bad++; }
say(bad ? `${bad} problem(s)` : `all ${PLANTS.length} plants went red and every file was restored`);
if (process.argv.includes("--write")) writeFileSync(P("docs/SITE-SNAKES-FALSIFY.txt"), log.join("\n") + "\n");
process.exit(bad ? 1 : 0);
