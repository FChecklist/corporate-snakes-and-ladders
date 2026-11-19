// Keeps the shared shell of every public page in step with the brand kit (docs/boss/brand-kit): the head (title, address, search and share tags, icons, styles), the
// header with the six-item menu, the footer and the closing scripts. The words between <main> and </main> are written by hand in each page; this tool never touches them.
// Run: bun tools/make-site-shell.mjs          rewrite the shell of every page listed below
//      bun tools/make-site-shell.mjs --check  change nothing, exit 1 if a page differs (test/site-shell.test.ts runs this check)
// A page marks its parts: <!--shell:top--> ... <!--/shell:top-->  (sprite, skip link, header), and <!--shell:foot--> up to the end of the file (footer, scripts, </body></html>).
import { readFileSync, writeFileSync } from "node:fs";

const PUB = new URL("../apps/web/public/", import.meta.url), SHELL = new URL("./site-shell/", import.meta.url);
export const ORIGIN = "https://snakes.corporatetambola.com";
export const NAME = "Corporate Snakes and Ladders";
export const STRAPLINE = "Online games for company events";
export const PAYEE = "IT Services by Rajat Agarwal"; // the only payee; every payment goes through Razorpay
export const PAY_LINE = `All payments are taken only by ${PAYEE}, through Razorpay.`;
/** The free demo. Snakes has no free 10-person demo game yet (a game of up to 10 people made from the console, like Corporate Tambola's): the button opens the 70-second practice game
 *  that works today. When the 10-person demo exists, change these two lines and run this tool. */
export const DEMO = { href: "/demo.html", label: "Try the free 70-second demo" };
/** The six menu items, in this order. The words never change; only an address may. */
export const MENU = [["How it works", "/how-it-works.html", ""], ["Free demo game", DEMO.href, "demo"], ["Guide", "/organizer-guide.html", ""], ["Brochure", "/brochure.html", ""], ["Refer &amp; earn", "/partner.html", ""], ["Log in", "/zc.html", "login"]];
/** ?v= numbers: raise one whenever its file changes (Cloudflare keeps files for hours). */
export const V = { kit: 1, site: 1, game: 1, bar: 2, icons: 3 };
export const THEME_COLOR = "#0B3D91";

const DESC_DEFAULT = `${NAME}: online snakes and ladders for company events, for the people you invite. Everyone has their own board. The software finds every winner.`;
const css = (f, v) => `<link rel="stylesheet" href="/${f}${v ? "?v=" + v : ""}">`;
const js = (f, v, defer = true) => `<script src="/${f}${v ? "?v=" + v : ""}"${defer ? " defer" : ""}></script>`;
const esc = (s) => s.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;").replace(/"/g, "&quot;");

// What a page needs. kind: "site" = kit styles only (words, tables); "landing" and "app" = the older app styles stay too (sheets, JS-drawn cards).
const COMMON_HEAD = ["guide.js", "blackbox.js", "rum.js", "v.js"]; // the scripts every public page carries
const LD = (extra = "") => `<script type="application/ld+json">[{"@context":"https://schema.org","@type":"Organization","name":"${NAME}","url":"${ORIGIN}/","logo":"${ORIGIN}/logo-512.png"},{"@context":"https://schema.org","@type":"WebSite","name":"${NAME}","url":"${ORIGIN}/"}${extra}]</script>`;
const FAQ = [["How do I set up a game?", "Use the free AI assistant (the easiest way): tell it what you want and your draft is ready in minutes. Or set it up yourself in the organizer console. Building and publishing are free."], ["Do players pay or install anything?", "No. Players never pay and there is no app to download. They open your link, type a nickname and get their own board. A mobile number is asked only if the organizer chose that."], ["Who gives the gifts?", "You, the organizer. Corporate Snakes and Ladders is software only. We never hold or pay prize money."], ["Who decides the winners?", "The software only. Phones work out winners from the public random numbers, and a win counts only when enough different phones agree. No person, including the organizer and us, can choose, change or remove a winner. Cheating is very hard."], ["Who takes the payment?", "All payments are taken only by IT Services by Rajat Agarwal, through Razorpay. You pay once per game, before it starts."], ["How is the organizer verified?", "Through the link or the 6-digit code we send to your e-mail. There is no password to remember."], ["Can people in other countries play?", "Yes. Anyone with the link can play on their own phone, in any country."]];
const LD_FAQ = `,{"@context":"https://schema.org","@type":"FAQPage","mainEntity":${JSON.stringify(FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })))}}`;
const LD_APP = `,{"@type":"SoftwareApplication","@context":"https://schema.org","name":"${NAME}","applicationCategory":"BusinessApplication","operatingSystem":"Web","description":"${DESC_DEFAULT}","url":"${ORIGIN}/","publisher":{"@type":"Organization","name":"${PAYEE}"},"offers":{"@type":"AggregateOffer","priceCurrency":"INR","lowPrice":"2399","highPrice":"29499","offerCount":"8"}}` + LD_FAQ;

/** file, address, title, description, kind, index (listed in search), cur (the menu item that is this page), more head scripts, scripts before </body>, bar (games bar), extra head */
export const PAGES = [
  { f: "index.html", path: "/", title: `${NAME} | ${STRAPLINE}`, desc: "Run snakes and ladders for your team in minutes. Share one link. Everyone has their own board on their phone. Players never pay. Software only.", kind: "landing", index: true, bar: true, head: ["pwa.js", ...COMMON_HEAD, "keep.js", "autoupdate.js"], end: ["common.js", "consent.js", "google.js", "site.js"], ld: LD(LD_APP) },
  { f: "how-it-works.html", path: "/how-it-works.html", title: "How it works", desc: "From setup to winners in five steps. Every player has their own board, every turn is a 20-second window and the software finds every winner.", kind: "site", index: true, bar: true, cur: 0, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "organizer-guide.html", path: "/organizer-guide.html", title: "Organizer guide", desc: "Short notes for a safe, simple Corporate Snakes and Ladders: how to set up, share, run and close a game.", kind: "site", index: true, bar: true, cur: 2, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "brochure.html", path: "/brochure.html", title: "Brochure", desc: "One page for organizers: what Corporate Snakes and Ladders is, how it works, what it costs. Print it or save it as a PDF.", kind: "site", index: true, bar: true, cur: 3, head: ["autoupdate.js"] },
  { f: "partner.html", path: "/partner.html", title: "Refer & earn", desc: "Earn 50% of the software price when a company you bring buys Corporate Snakes and Ladders, and 20% every time it buys again within 12 months. Join free with just your mobile number: your number is your code.", kind: "app", index: true, bar: true, cur: 4, css: ["app.css", "z.css", "zc.css", "partner.css"], head: ["pwa.js", ...COMMON_HEAD, "keep.js", "autoupdate.js"], end: ["common.js", "partner.js"], main: "main" },
  { f: "helpdesk.html", path: "/helpdesk.html", title: "Help Desk: prepare games for Organizers", desc: "Become a Help Desk person. Set up a Corporate Snakes and Ladders game for an Organizer. They publish it with one tap, and you earn Refer & earn commission when it is paid.", kind: "app", index: true, bar: true, css: ["app.css", "z.css", "zc.css", "partner.css"], head: [...COMMON_HEAD, "autoupdate.js"], end: ["common.js", "helpdesk.js"], main: "main" },
  { f: "pricing.html", path: "/pricing.html", title: "Pricing", desc: "Corporate Snakes and Ladders prices by game size, from US$ 34 (Rs 2,399) for 100 players to US$ 421 for 10,000. No tax added. Players never pay.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "about.html", path: "/about.html", title: "About", desc: "Corporate Snakes and Ladders is snakes and ladders software for company events and teams, from IT Services by Rajat Agarwal.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "contact.html", path: "/contact.html", title: "Contact us", desc: "How to reach Corporate Snakes and Ladders, a product of IT Services by Rajat Agarwal: e-mail and phone.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "terms.html", path: "/terms.html", title: "Terms", desc: "The short, plain-English terms for organizers who run a Corporate Snakes and Ladders game for their company or team.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "privacy.html", path: "/privacy.html", title: "Privacy", desc: "What Corporate Snakes and Ladders keeps about players and organizers, why, for how long, who receives it, your rights and how to reach the Grievance Officer. Plain English.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "refund-policy.html", path: "/refund-policy.html", title: "Refund and cancellation policy", desc: "Corporate Snakes and Ladders gives no refunds. A cancelled paid game stays as credit for 365 days. Full policy here.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "dpa.html", path: "/dpa.html", title: "Data processing terms", desc: "Data processing terms for organizers: what we do with your players' details, on one page.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "subprocessors.html", path: "/subprocessors.html", title: "Sub-processors", desc: "The providers that help us run Corporate Snakes and Ladders, and what each one receives.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "legal.html", path: "/legal.html", title: "Rules, privacy and disclaimer", desc: "The rules of a Corporate Snakes and Ladders game, how guest names are erased within 24 hours, and the disclaimer. Plain English.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "legal-position.html", path: "/legal-position.html", title: "Legal position", desc: "How Corporate Snakes and Ladders is supplied: software only, no stake from players, no cash prizes.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "partner-terms.html", path: "/partner-terms.html", title: "Partner terms", desc: "The terms for Refer and earn partners of Corporate Snakes and Ladders, in plain English.", kind: "site", index: true, bar: true, head: [...COMMON_HEAD, "autoupdate.js"] },
  { f: "trust.html", path: "/trust.html", title: "How it works and what it keeps", desc: "Ten plain facts about Corporate Snakes and Ladders: who runs the game, fair boards, guest data erased within 24 hours, encryption, fair winners, the laws it is designed to follow, the AI assistant and money.", kind: "site", index: true, bar: true, head: ["autoupdate.js"] },
  { f: "404.html", path: "/404.html", title: "Page not found", desc: "We could not find that page.", kind: "site", index: false, bar: true, head: ["autoupdate.js"] },
  { f: "offline.html", path: "/offline.html", title: "You are offline", desc: "This page needs the internet.", kind: "site", index: false, bar: false, head: ["autoupdate.js"], end: ["offline.js"] },
  { f: "zc.html", path: "/zc.html", title: "Organizer console", desc: "Your organizer console for Corporate Snakes and Ladders.", kind: "console", index: false, bar: false, css: ["app.css", "z.css", "zc.css"], head: ["pwa.js", "guide.js", "blackbox.js", "rum.js", "keep.js", "autoupdate.js"], end: ["zgame.js", "control.js", "consent.js", "zc.js"], main: "app" },
  { f: "signin.html", path: "/signin.html", title: "Sign in", desc: "Press the button to sign in to Corporate Snakes and Ladders.", kind: "app", index: false, nofollow: true, bar: false, css: ["app.css", "z.css"], extra: '<meta name="referrer" content="no-referrer">', head: [...COMMON_HEAD, "keep.js", "autoupdate.js"], end: ["consent.js", "google.js", "signin.js"], main: "app" },
  { f: "ai-link.html", path: "/ai-link.html", title: "Your AI work link", desc: "Your personal work link for your own AI assistant.", kind: "app", index: false, nofollow: true, bar: false, css: ["app.css", "z.css"], head: ["guide.js", "blackbox.js", "rum.js", "keep.js", "autoupdate.js"], end: ["consent.js", "ai-link.js"], main: "app" },
  { f: "helpdesk-accept.html", path: "/helpdesk-accept.html", title: "Help Desk invitation", desc: "Accept an invitation to help set up a game.", kind: "app", index: false, nofollow: true, bar: false, css: ["app.css", "z.css"], head: ["guide.js", "blackbox.js", "rum.js", "keep.js", "autoupdate.js"], end: ["consent.js", "helpdesk-accept.js"], main: "app" },
  { f: "helpdesk-approve.html", path: "/helpdesk-approve.html", title: "Publish your game", desc: "Check and publish the game your helper prepared.", kind: "app", index: false, nofollow: true, bar: false, css: ["app.css", "z.css"], head: ["guide.js", "blackbox.js", "rum.js", "autoupdate.js"], end: ["consent.js", "helpdesk-approve.js"], main: "app" },
  { f: "pay.html", path: "/pay.html", title: "Publish and pay", desc: "Publish your game and pay once. Payments are taken by IT Services by Rajat Agarwal through Razorpay.", kind: "app", index: false, bar: false, css: ["app.css", "z.css", "zc.css"], head: ["guide.js", "blackbox.js", "rum.js", "v.js", "keep.js", "autoupdate.js"], end: ["common.js", "consent.js", "pay.js"], main: "app" },
  { f: "paylink.html", path: "/paylink.html", title: "Pay for a game", desc: "Pay for a game with the link you were sent. Payments are taken by IT Services by Rajat Agarwal through Razorpay.", kind: "app", index: false, nofollow: true, bar: false, css: ["app.css", "z.css", "zc.css"], head: ["guide.js", "blackbox.js", "rum.js", "v.js", "autoupdate.js"], end: ["common.js", "consent.js", "paylink.js"], main: "app" },
  { f: "paytest.html", path: "/paytest.html", title: "Payment testing", desc: "Test a payment of Rs 1. Payments are taken by IT Services by Rajat Agarwal through Razorpay.", kind: "app", index: false, bar: false, css: ["app.css", "z.css", "zc.css"], head: ["guide.js", "blackbox.js", "rum.js", "v.js", "autoupdate.js"], end: ["common.js", "consent.js", "paytest.js"], main: "app" },
  { f: "report.html", path: "/report.html", title: "Your game report", desc: "Your report for the game that ended.", kind: "app", index: false, bar: false, css: ["app.css", "z.css"], head: ["guide.js", "blackbox.js", "rum.js", "autoupdate.js"], end: ["reportgen.js", "report.js"], main: "app" },
];

export const PAGE_FILES = PAGES.map((p) => p.f);

const read = (u) => readFileSync(u, "utf8").replace(/\r\n/g, "\n");
const sprite = () => read(new URL("sprite.html", SHELL)).trim();

/** Everything from <!doctype html> to the opening <body> tag. */
export function headHtml(p) {
  const url = ORIGIN + p.path, title = esc(p.title.includes(NAME) ? p.title : `${p.title} | ${NAME}`), desc = esc(p.desc || DESC_DEFAULT), kit = V.kit;
  const robots = p.index ? '<meta name="robots" content="index, follow, max-image-preview:large">' : `<meta name="robots" content="noindex${p.nofollow ? ", nofollow" : ""}">`;
  const app = p.kind !== "site" && p.kind !== "landing", cssList = [css("fonts.css", kit), ...(p.kind !== "site" ? [css("fonts-game.css", V.game)] : []), ...(p.css || (p.kind === "landing" ? ["app.css"] : [])).map((f) => css(f)), css("tokens.css", kit), css("components.css", kit), ...(p.kind === "console" ? [css("console.css", kit)] : []), css("site.css", V.site), ...(p.bar ? [css("gamesbar.css", V.bar)] : [])];
  const scripts = [js("theme-init.js", kit, false), ...(app ? [js("light-only.js", V.site, false)] : []), ...(p.head || []).map((f) => js(f)), ...(p.bar ? [`<script src="/gamesbar.js?v=${V.bar}" data-game="snakes" defer></script>`] : [])];
  return [
    `<!doctype html>`,
    `<html lang="en" data-theme="blue"${p.kind === "app" || p.kind === "console" ? ' data-mode="light"' : ""}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`,
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}">`,
    p.index ? `<link rel="canonical" href="${url}">` : "",
    robots,
    `<meta name="theme-color" content="${THEME_COLOR}">${p.extra ? p.extra : ""}`,
    p.index ? `<meta property="og:type" content="website"><meta property="og:site_name" content="${NAME}"><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}"><meta property="og:url" content="${url}"><meta property="og:image" content="${ORIGIN}/og-card.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${NAME}"><meta property="og:locale" content="en_US">` : "",
    p.index ? `<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${ORIGIN}/og-card.png">` : "",
    p.ld || "",
    `<link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48"><link rel="icon" href="/favicon-32.png?v=${V.icons}" type="image/png" sizes="32x32">`,
    `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${V.icons}"><link rel="manifest" href="/manifest.webmanifest">`,
    `<link rel="preload" href="/fonts/Inter-normal-400.woff2" as="font" type="font/woff2" crossorigin><link rel="preload" href="/fonts/Fraunces-normal-500-700.woff2" as="font" type="font/woff2" crossorigin>`,
    cssList.join(""),
    scripts.join(""),
    `</head><body class="${p.kind === "console" ? "ck-app ck-console" : app ? "ck-app" : "ck"}">`, // an app page keeps its own headings and cards: only its header and footer sit inside a .ck wrapper
  ].filter(Boolean).join("\n");
}

/** The header: skip link and the six-item menu. `cur` marks the page's own item. */
export function headerHtml(p) {
  const links = MENU.map(([label, href, cls], i) => {
    const attrs = [`href="${href}"`, cls ? `class="${cls}"` : "", cls === "login" ? 'id="loginLink"' : "", p.cur === i ? 'aria-current="page"' : ""].filter(Boolean).join(" ");
    return `<a ${attrs}>${label}</a>`;
  }).join("");
  const dots = `<span class="ck-dots" role="group" aria-label="Colour theme"><button type="button" data-t="blue" aria-pressed="true" aria-label="Studio blue theme" title="Studio blue"></button><button type="button" data-t="maroon" aria-pressed="false" aria-label="Maroon theme" title="Maroon"></button><button type="button" data-t="emerald" aria-pressed="false" aria-label="Emerald theme" title="Emerald"></button></span>`;
  return `<header class="ck-top"><div class="ck-top-in">
<a class="ck-brand" href="/" aria-label="${NAME}, home"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-snakes"/></svg><span class="ck-name"><i>Corporate</i><b>Snakes and Ladders</b></span></a>
<button class="ck-menu" type="button" id="ck-menu" aria-expanded="false" aria-controls="ck-nav">Menu</button>
<nav class="ck-nav" id="ck-nav" aria-label="Main">${links}${dots}</nav>
</div></header>`;
}

const skip = (p) => `<a class="ck-skip" href="#${p.main || "main"}">Skip to the content</a>`; // the very first thing in the page: the games bar mounts right after it
const wrap = (p, html) => (p.kind === "app" || p.kind === "console" ? `<div class="ck">\n${html}\n</div>` : html);
export function consoleHeaderHtml(p) {
  return `<header class="cs-top"><div class="cs-top-in"><a class="ck-brand" href="/" aria-label="${NAME}, home"><svg class="ck-badge" aria-hidden="true" focusable="false"><use href="#i-snakes"/></svg><span class="ck-name"><i>Corporate</i><b>Snakes and Ladders</b></span></a><div class="cs-top-end"><a class="cs-link" href="https://home.corporatetambola.com/">All games</a></div></div></header>`;
}
export function topHtml(p) {
  const head = p.kind === "console" ? consoleHeaderHtml(p) : headerHtml(p);
  return `<!--shell:top-->\n${p.kind === "site" || p.kind === "landing" ? sprite() + "\n" + skip(p) + "\n" + head : skip(p) + "\n" + wrap(p, sprite() + "\n" + head)}\n<!--/shell:top-->`;
}

/** The footer (links, contact, payee line) and the scripts that close the page. */
export function footerHtml(p) {
  if (p.kind === "console") return `<!--shell:foot-->\n${(p.end || []).map((f) => js(f, 0, false)).join("")}`;
  const site = [...MENU.map(([l, h]) => `<li><a href="${h}">${l}</a></li>`), '<li><a href="/pricing.html">Pricing</a></li>', '<li><a href="/trust.html">Safety and privacy: 10 facts</a></li>', '<li><a href="/about.html">About</a></li>', '<li><a href="/contact.html">Contact</a></li>'].join("");
  const legal = [["/terms.html", "Terms"], ["/privacy.html", "Privacy notice"], ["/refund-policy.html", "Refund policy"], ["/subprocessors.html", "Sub-processors"], ["/dpa.html", "Data processing terms"], ["/legal.html", "Rules and disclaimer"], ["/legal-position.html", "Legal position"], ["/partner-terms.html", "Referral terms"], ["/paytest.html", "Test a payment (Rs 1)"]].map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("");
  const games = [["https://housie.corporatetambola.com/", "Tambola"], ["https://bingo.corporatetambola.com/", "Bingo"], ["https://tictactoe.corporatetambola.com/", "Tic Tac Toe"], ["https://snakes.corporatetambola.com/", "Snakes and Ladders"], ["https://luck.corporatetambola.com/", "Luck by Chance"], ["https://home.corporatetambola.com/contact", "Lucky Draw: tell us you want it"]].map(([h, l]) => `<li><a href="${h}">${l}</a></li>`).join("");
  const foot = `<footer class="ck-foot"><div class="ck-wrap"><div class="ck-foot-grid">
<div><p class="ck-brandline">${NAME}</p><p>${STRAPLINE}, for the people you invite.</p><p>A product of ${PAYEE}.</p><p><a href="mailto:hello@corporatetambola.com">hello@corporatetambola.com</a><br><a href="tel:+919650397480">(+91) 96503 97480</a></p>${p.kind === "app" ? "" : '<p><button class="ck-mode" type="button" data-ck-mode>Dark</button></p>'}</div>
<div><h2>The games</h2><ul>${games}</ul></div>
<div><h2>This site</h2><ul>${site}</ul></div>
<div><h2>Legal</h2><ul>${legal}</ul></div>
</div>
<div class="ck-legal"><p>${PAYEE} is the trade name of Rajat Agarwal, an individual running a sole proprietorship in India. B-1105, Shipra Krishna Vista, Indirapuram, Ghaziabad, Uttar Pradesh, 201014, India. GST is not charged. ${PAY_LINE}</p><p>&copy; 2026 Rajat Agarwal. All rights reserved.</p></div>
</div></footer>`;
  const end = [js("brandkit.js", V.kit), ...(p.end || []).map((f) => js(f, 0, false))].join("");
  return `<!--shell:foot-->\n${wrap(p, foot)}\n${end}`;
}

/** The three shell regions of a page, or an error text when the page has no markers. */
export function apply(p, html) {
  const a = html.indexOf("<!--shell:top-->"), b = html.indexOf("<!--/shell:top-->"), c = html.indexOf("<!--shell:foot-->");
  if (a < 0 || b < 0 || c < 0) throw new Error(p.f + ": the shell markers are missing");
  const mid = html.slice(b + "<!--/shell:top-->".length, c);
  return `${headHtml(p)}\n${topHtml(p)}${mid}${footerHtml(p)}\n</body></html>\n`;
}

export function run(check) {
  const bad = [];
  for (const p of PAGES) {
    const u = new URL(p.f, PUB);
    let before; try { before = read(u); } catch { bad.push(p.f + " (missing)"); continue; }
    const after = apply(p, before);
    if (after !== before) { bad.push(p.f); if (!check) writeFileSync(u, after); }
  }
  return bad;
}

if (import.meta.main) {
  const check = process.argv.includes("--check"), bad = run(check);
  if (check && bad.length) { console.error("site shell differs: " + bad.join(", ") + "\nRun: bun tools/make-site-shell.mjs"); process.exit(1); }
  console.log(check ? "site shell is in step" : "site shell written to " + bad.length + " page(s)" + (bad.length ? ": " + bad.join(", ") : ""));
}
