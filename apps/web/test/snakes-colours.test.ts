// Corporate Snakes and Ladders has ONE colour scheme of its own, "Ember and Rung", in apps/web/public/snakes-scheme.css.
// The owner's evaluation (24 Nov 2026) said the game "shares a copied teal block" and "copied colours". These tests keep that from coming back:
//   1. the scheme file is complete (light, and night for dark), and the coming-soon site has an identical copy;
//   2. every page links it before any other style, and the build and the service worker ship it;
//   3. nothing Snakes owns carries a colour of the old teal block, of Tambola, or of another game, and nothing is blue, green-blue or purple;
//   4. every text and background pair of the scheme reaches WCAG AA (computed here, not eyeballed);
//   5. the theme-colour metas and the manifest use the scheme's values;
//   6. the copied blue, maroon and emerald themes and their dots are gone.
// The ban list below is data on purpose: this file does not read any other game's files.
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const PUB = join(ROOT, "apps/web/public");
const SITE = join(ROOT, "site");
const rd = (p: string) => readFileSync(p, "utf8");
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const rel = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// A tiny CSS reader: comments dropped, @media and @supports flattened into plain rules.
interface Rule { selector: string; body: string }
function rulesOf(css: string): Rule[] {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const go = (t: string) => {
    let i = 0;
    while (i < t.length) {
      const j = t.indexOf("{", i); if (j < 0) break;
      const selector = t.slice(i, j).trim();
      let depth = 1, k = j + 1;
      while (k < t.length && depth) { if (t[k] === "{") depth++; else if (t[k] === "}") depth--; k++; }
      const body = t.slice(j + 1, k - 1);
      if (/^@(media|supports)/.test(selector)) go(body); else if (!selector.startsWith("@")) out.push({ selector, body });
      i = k;
    }
  };
  go(s);
  return out;
}
function declsOf(body: string): Record<string, string> {
  const d: Record<string, string> = {};
  for (const part of body.split(/;(?![^()]*\))/)) { const i = part.indexOf(":"); if (i > 0) d[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).replace(/!important/g, "").trim(); }
  return d;
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// WCAG 2 contrast
const lin = (c: number) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * lin(n[0]!) + 0.7152 * lin(n[1]!) + 0.0722 * lin(n[2]!); };
const ratio = (a: string, b: string) => { const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p); return (hi! + 0.05) / (lo! + 0.05); };

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// The scheme, read from the file
const SCHEME_PATH = join(PUB, "snakes-scheme.css");
const SCHEME = rd(SCHEME_PATH);
const sRules = rulesOf(SCHEME);
const ruleBy = (test: (s: string) => boolean) => sRules.find((r) => test(r.selector));
const light = declsOf(ruleBy((s) => s === ":root")!.body);
const darkAuto = declsOf(ruleBy((s) => s.startsWith(':root[data-snk-dark="auto"]'))!.body);
const darkMode = declsOf(ruleBy((s) => s === ':root[data-mode="dark"]')!.body);
const bridge = declsOf(ruleBy((s) => s === ":root:root:root:root")!.body);
const HEX6 = /^#[0-9A-Fa-f]{6}$/;
/** the colour a value ends up as: a hex, a var() of the scheme, or white */
function colour(v: string | undefined, vars: Record<string, string> = light, depth = 0): string {
  const t = (v ?? "").trim();
  if (HEX6.test(t)) return t.toUpperCase();
  if (/^#fff$/i.test(t)) return "#FFFFFF";
  const m = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(t);
  if (m && depth < 8) return colour(vars[m[1]!] ?? light[m[1]!], vars, depth + 1);
  throw new Error("cannot resolve colour: " + v);
}
const L = (name: string) => colour(light["--snk-" + name]);
const N = (name: string) => colour(light["--snk-night-" + name]);

const FLIPPING = ["primary", "primary-2", "deep", "accent", "accent-2", "bg", "surface", "sunk", "ink", "muted", "line", "ok", "bad", "warn", "on-primary", "ink-2", "line-2", "paper", "link", "accent-ink", "focus", "wash", "ok-bg", "bad-bg", "warn-bg", "info", "info-bg"];
const REQUIRED = [...["primary", "primary-2", "deep", "accent", "accent-2", "bg", "surface", "sunk", "ink", "muted", "line", "ok", "bad", "warn"], ...[0, 1, 2, 3, 4].flatMap((i) => [`band-${i}`, `band-${i}-alt`])].map((n) => "--snk-" + n);

describe("1. the scheme file", () => {
  test("it exists, carries its name and the idea in plain words", () => {
    expect(existsSync(SCHEME_PATH)).toBe(true);
    expect(SCHEME).toMatch(/EMBER AND RUNG/); expect(SCHEME).toMatch(/The idea, in plain words/);
  });
  test("it defines every variable the other files rely on, as a six-digit colour, for light", () => {
    for (const n of REQUIRED) expect(light[n], n).toMatch(HEX6);
  });
  test("the game colour is the suite's own Snakes colour (--g-snakes in tokens.css), and the five bands each have a deeper twin", () => {
    const tokens = rd(join(PUB, "tokens.css"));
    expect(/--g-snakes:\s*(#[0-9A-Fa-f]{6})/.exec(tokens)![1]!.toUpperCase()).toBe(L("primary"));
    for (let i = 0; i < 5; i++) expect(L(`band-${i}`)).not.toBe(L(`band-${i}-alt`));
  });
  test("night values exist for every role, and dark switches every one of them, in the two places dark can start (device, or the Dark button)", () => {
    for (const n of FLIPPING) {
      expect(N(n), "night " + n).toMatch(HEX6);
      expect(darkAuto["--snk-" + n], "auto " + n).toBe(`var(--snk-night-${n})`);
      expect(darkMode["--snk-" + n], "mode " + n).toBe(`var(--snk-night-${n})`);
    }
    expect(SCHEME).toMatch(/@media \(prefers-color-scheme:dark\)\{\s*:root\[data-snk-dark="auto"\]:not\(\[data-mode="light"\]\)/);
  });
  test("dark follows the device only on the page that asks for it (theme.js, loaded by the home page only); the player page and the console stay light", () => {
    expect(rd(join(PUB, "theme.js"))).toContain('setAttribute("data-snk-dark", "auto")');
    const loadsTheme = walk(PUB).filter((f) => f.endsWith(".html") && /src="\/theme\.js/.test(rd(f))).map((f) => rel(f));
    expect(loadsTheme).toEqual(["apps/web/public/index.html"]);
    for (const p of ["z.html", "zc.html", "big.html", "pay.html"]) expect(rd(join(PUB, p))).toMatch(/<meta name="color-scheme" content="(light|dark)">/);
    for (const p of ["z.html", "zc.html"]) expect(rd(join(PUB, p))).toContain('<meta name="color-scheme" content="light">');
  });
  test("the coming-soon site has no build, so it carries a byte-for-byte copy", () => {
    expect(rd(join(SITE, "snakes-scheme.css"))).toBe(SCHEME);
  });
  test("the Pages build ships it and the service worker saves it with the game", () => {
    expect(rd(join(ROOT, "pages/build.mjs"))).toContain('"snakes-scheme.css"');
    expect(rd(join(PUB, "zsw.js"))).toContain('"/snakes-scheme.css"');
  });
  test("app.css keeps the old short names working by pointing them at the scheme", () => {
    const app = rd(join(PUB, "app.css"));
    for (const m of ["--pri:var(--snk-primary)", "--pri2:var(--snk-primary-2)", "--deep:var(--snk-deep)", "--acc:var(--snk-accent)", "--acc2:var(--snk-accent-2)", "--bg:var(--snk-bg)", "--ink:var(--snk-ink)", "--line:var(--snk-line)", "--ok:var(--snk-ok)", "--bad:var(--snk-bad)", "--warn:var(--snk-warn)"]) expect(app).toContain(m);
  });
  test("the suite brand kit (tokens.css, generated) is left alone, and the bridge answers every colour of it that a Snakes page can show", () => {
    const tokens = declsOf(rulesOf(rd(join(PUB, "tokens.css"))).find((r) => r.selector === ":root")!.body);
    const skip = /^--(g-|gw-|st-)|^--(marigold|saffron|teal|rose|coral)$/; // the six game colours and washes draw only the game switcher; the status and bright colours are not used by any Snakes page (checked below)
    const colourish = Object.entries(tokens).filter(([k, v]) => !skip.test(k) && /^(#[0-9A-Fa-f]{3,8}|rgba?\(|var\()/.test(v)).map(([k]) => k);
    expect(colourish.length).toBeGreaterThan(40);
    expect(colourish.filter((k) => !(k in bridge))).toEqual([]);
    for (const k of ["--shadow", "--shadow-lift"]) expect(bridge[k], k).toBeDefined();
  });
  test("no Snakes file asks for a suite-only colour (a game colour, a wash of one, the status set or a bright constant)", () => {
    const bad: string[] = [];
    for (const f of [...walk(PUB), ...walk(SITE)]) {
      if (!/\.(css|html|js)$/.test(f) || /tokens\.css$/.test(f) || /vendor/.test(f)) continue;
      const m = rd(f).match(/var\(--(g-[a-z]+|gw-[a-z]+|st-[a-z-]+|marigold|saffron|teal|rose|coral)\b/g);
      if (m) bad.push(`${rel(f)}: ${[...new Set(m)].join(" ")}`);
    }
    expect(bad).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
describe("2. every page links the scheme before any other style", () => {
  const pages = [...walk(PUB), ...walk(SITE)].filter((f) => f.endsWith(".html") && !/[\\/]vendor[\\/]/.test(f));
  test("there are pages to check, including the site and the pack page", () => {
    expect(pages.length).toBeGreaterThan(40);
    expect(pages.map(rel)).toContain("site/index.html"); expect(pages.map(rel)).toContain("apps/web/public/pack/gamelog.html");
  });
  test("each page head has the link, ahead of every other stylesheet and style block", () => {
    const bad: string[] = [];
    for (const f of pages) {
      const h = rd(f); const head = h.slice(h.search(/<head[\s>]/i), h.search(/<\/head>/i));
      const at = head.search(/<link\b[^>]*href="\/snakes-scheme\.css(\?[^"]*)?"[^>]*>/);
      if (at < 0) { bad.push(`${rel(f)}: no link`); continue; }
      for (const m of head.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>|<style\b/g)) if (m.index! < at) bad.push(`${rel(f)}: ${m[0].slice(0, 50)} comes first`);
    }
    expect(bad).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// 3. no copied colours. The list is data: the old teal block of this game, the old copied theme blocks, Tambola's wine/gold/ivory, and the brand colours of the other games.
const BANNED: Record<string, string> = {};
const ban = (why: string, list: string) => { for (const h of list.split(/\s+/).filter(Boolean)) BANNED[h.replace("#", "").toUpperCase()] = why; };
ban("the old teal block (:root of app.css)", "#0B5D5B #117A77 #063B3A #F7FBFA #F3F8F7 #E9F2F1 #0F1D1C #2B403E #5C6F6D #93A5A3 #D5E3E1 #E4EEEC #CFEDEA");
ban("the old teal block: its amber accent", "#FFC93C #FFE08A #8A5A00");
ban("the old teal block: its signal colours", "#1F7A55 #E4F3EC #FBF0D9 #B3261E #FBE7E4 #1F4E8C #E6EEF9");
ban("the copied blue, maroon and emerald theme blocks", "#0B5D55 #127A6F #052623 #04201D #17977F #04302F #04193F #1E5FD0 #1553B8 #061B45 #8E2240");
ban("Tambola: wine, gold and ivory", "#5A1426 #7A1C33 #2E0812 #3A0B18 #E0B872 #F3D9A4 #B8894D #8A6228 #FBF6EC #F6F1E7 #F3ECE0 #E8DDCC");
ban("the brand colours of Tambola, Bingo, Tic Tac Toe, Luck by Chance and Lucky Draw", "#E23E57 #2D3FE0 #17784A #6A2BD9 #0E9488");

/** Exceptions, each one narrow and explained. */
// The eight colours an organizer may pick for their own company strip: a list of choices the server checks (packages/beacon/src/config.ts BRAND_COLORS), not the look of the game.
const ORGANIZER_CHOICES = ["#0B3D91", "#1B7F5C", "#B3261E", "#6A1B9A", "#C26A00", "#00798C", "#37474F", "#AD1457"];
const WITH_ORGANIZER_CHOICES = ["apps/web/public/zc.js", "apps/web/public/zgame.js"];
// The slim Corporate Games bar is the same navy on every game of the suite (gamesbar.test.ts keeps it); only its focus ring is this game's accent.
const SUITE_BAR: Record<string, string[]> = { "apps/web/public/gamesbar.css": ["#14213D", "#C9D3E8"], "site/site.css": ["#14213D", "#C9D3E8"] };
// tokens.css is the suite brand kit, generated elsewhere and shared by the six games; the bridge in snakes-scheme.css overrides every colour a Snakes page can show. vendor/ is third-party code.
const SKIP = (p: string) => /[\\/](tokens\.css|vendor|fonts)([\\/]|$)/.test(p) || /[\\/]vendor[\\/]/.test(p);

const HEXRE = /(?<![&\w(])#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g; // not an HTML number (&#127942;), not an anchor (a#b), not an id reference (url(#a1))
const norm = (h: string) => { const t = h.length <= 4 ? [...h].map((c) => c + c).join("") : h; return t.slice(0, 6).toUpperCase(); };
function hslOf(hex: string): { chroma: number; hue: number } {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
  let h = 0;
  if (c > 0) h = mx === r ? ((g - b) / c) % 6 : mx === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return { chroma: c, hue: ((h * 60) + 360) % 360 };
}
/** a colour that is blue, green-blue, green or purple: hue 100 to 345 degrees with some colour in it (the scheme's own colours run from red through amber to olive, hue 0 to 100, and the crimson at 355) */
const offScheme = (hex: string) => { const { chroma, hue } = hslOf(hex); return chroma >= 0.1 && hue >= 100 && hue <= 345; };
const neutral = (hex: string) => hslOf(hex).chroma < 0.045;

/** every problem in a text: a banned colour, or a colour that is not warm */
function problems(text: string, file: string): string[] {
  let t = text;
  if (WITH_ORGANIZER_CHOICES.includes(file)) for (const c of ORGANIZER_CHOICES) t = t.replace(new RegExp(c, "gi"), "");
  const out: string[] = [];
  for (const m of t.matchAll(HEXRE)) {
    const h = norm(m[1]!);
    if ((SUITE_BAR[file] ?? []).some((x) => x.replace("#", "") === h)) continue;
    if (BANNED[h]) out.push(`#${h} (${BANNED[h]})`); else if (offScheme(h)) out.push(`#${h} (not a warm colour)`);
  }
  for (const m of t.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) { const h = [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase(); if (offScheme(h)) out.push(`rgb ${h} (not a warm colour)`); }
  return out;
}
const OWNED: string[] = [
  ...walk(PUB).filter((f) => /\.(css|html|js|svg|webmanifest)$/.test(f) && !SKIP(f)),
  ...walk(SITE).filter((f) => /\.(css|html|js|svg)$/.test(f)),
  join(ROOT, "tools/make-icons.py"),
  ...["mails.ts", "brand.ts", "trust-page.ts"].map((f) => join(ROOT, "apps/edge/src", f)),
  join(ROOT, "packages/beacon/src/zboard.ts"),
];

describe("3. no copied colours, nothing blue, green-blue or purple", () => {
  test("the checker works: it catches a banned colour, a cold colour and an rgb, and it ignores HTML numbers, anchors and id references", () => {
    expect(problems("a{color:#0b5d5b}", "x")).toEqual(["#0B5D5B (the old teal block (:root of app.css))"]);
    expect(problems("a{color:#E23E57}", "x")[0]).toContain("Tambola");
    expect(problems("a{color:#1a2f9a}", "x")).toEqual(["#1A2F9A (not a warm colour)"]);
    expect(problems("a{box-shadow:0 0 0 rgba(11,61,145,.8)}", "x")).toEqual(["rgb 0B3D91 (not a warm colour)"]);
    expect(problems("a{color:#06c}", "x")).toEqual(["#0066CC (not a warm colour)"]);
    expect(problems('<p>&#127942; &#129693;</p><a href="p.html#faq">x</a><circle fill="url(#b285)"/>', "x")).toEqual([]);
    expect(problems("a{color:#9C3D1E;background:#FFEEE3;border:1px solid #fff;color:rgba(0,0,0,.5)}", "x")).toEqual([]);
    expect(problems("a{background:#14213D}", "apps/web/public/gamesbar.css")).toEqual([]); // the suite bar is the one narrow exception
    expect(problems("a{background:#14213D}", "apps/web/public/app.css")).toEqual(["#14213D (not a warm colour)"]);
  });
  test("the organizer's eight company-strip choices are the exception they say they are: the server list, still present in the two scripts", () => {
    const cfg = rd(join(ROOT, "packages/beacon/src/config.ts"));
    for (const c of ORGANIZER_CHOICES) { expect(cfg.toLowerCase()).toContain(c.toLowerCase()); for (const f of WITH_ORGANIZER_CHOICES) expect(rd(join(ROOT, f)).toLowerCase()).toContain(c.toLowerCase()); }
  });
  test("there are many files to scan, and the scheme file itself is one of them (none of its own colours is on the ban list)", () => {
    expect(OWNED.length).toBeGreaterThan(120);
    expect(OWNED.map(rel)).toContain("apps/web/public/snakes-scheme.css");
    for (const f of OWNED) expect(existsSync(f), rel(f)).toBe(true);
  });
  test("no CSS, HTML, script, SVG, manifest, icon tool, e-mail source or board source holds a banned or a cold colour", () => {
    const bad: string[] = [];
    for (const f of OWNED) { const p = problems(rd(f), rel(f)); if (p.length) bad.push(`${rel(f)}: ${[...new Set(p)].join(", ")}`); }
    expect(bad).toEqual([]);
  });
  test("the colours live in ONE place: a stylesheet holds only variables, white, black and grey (the suite games bar is the one exception)", () => {
    const bad: string[] = [];
    const sheets = [...walk(PUB), ...walk(SITE)].filter((f) => f.endsWith(".css") && !SKIP(f) && !/snakes-scheme\.css$/.test(f));
    expect(sheets.length).toBeGreaterThan(14);
    for (const f of sheets) {
      const css = rd(f).replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of css.matchAll(HEXRE)) { const h = norm(m[1]!); if (!neutral(h) && !(SUITE_BAR[rel(f)] ?? []).some((x) => x.replace("#", "") === h)) bad.push(`${rel(f)}: #${h}`); }
      for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) { const h = [m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join(""); if (!neutral(h.toUpperCase())) bad.push(`${rel(f)}: rgb ${h}`); }
    }
    expect(bad).toEqual([]);
  });
  test("pictures, e-mails and scripts use the scheme's own values (or grey and white), written out where a variable cannot be used", () => {
    const allowed = new Set(Object.values({ ...light }).filter((v) => HEX6.test(v)).map((v) => v.slice(1).toUpperCase()));
    const bad: string[] = [];
    const files = [
      ...walk(PUB).filter((f) => /\.(svg|webmanifest)$/.test(f)), ...walk(SITE).filter((f) => f.endsWith(".svg") || f === join(SITE, "index.html")),
      ...["z.js", "preview.js", "demo.js", "zboard.js", "reportgen.js"].map((f) => join(PUB, f)),
      ...["mails.ts", "brand.ts", "trust-page.ts"].map((f) => join(ROOT, "apps/edge/src", f)), join(ROOT, "packages/beacon/src/zboard.ts"),
    ];
    for (const f of files) for (const m of rd(f).matchAll(HEXRE)) { const h = norm(m[1]!); if (!neutral(h) && !allowed.has(h)) bad.push(`${rel(f)}: #${h}`); }
    expect([...new Set(bad)]).toEqual([]);
  });
  test("the Snakes invoice theme and the e-mail brand colours are the scheme's", () => {
    expect(rd(join(ROOT, "packages/billing/src/index.ts"))).toMatch(new RegExp(`corporate_snakes_and_ladders:[^\\n]*theme: "${L("primary")}"`, "i"));
    const brand = rd(join(ROOT, "apps/edge/src/brand.ts"));
    const get = (k: string) => new RegExp(`${k}: "(#[0-9A-Fa-f]{6})"`).exec(brand)![1]!.toUpperCase();
    expect([get("wine"), get("gold"), get("gold2"), get("ivory"), get("line")]).toEqual([L("primary"), L("accent"), L("accent-2"), L("paper"), L("line")]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
describe("4. contrast (WCAG AA), computed", () => {
  test("the calculator is right: black on white is 21, and #777 on white is just under 4.5", () => {
    expect(ratio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(ratio("#777777", "#FFFFFF")).toBeGreaterThan(4.4); expect(ratio("#777777", "#FFFFFF")).toBeLessThan(4.5);
  });
  type Pair = [string, string, number, string];
  const TEXT = 4.5, PART = 3;
  const surfaces = (c: (n: string) => string): Pair[] => {
    const out: Pair[] = [];
    for (const bg of ["bg", "surface", "sunk", "paper", "wash"]) for (const fg of ["ink", "ink-2", "muted", "link", "accent-ink"]) out.push([c(fg), c(bg), TEXT, `${fg} on ${bg}`]);
    for (const n of ["ok", "bad", "warn", "info"]) for (const bg of ["surface", "bg", `${n}-bg`]) out.push([c(n), c(bg), TEXT, `${n} on ${bg}`]);
    out.push([c("ink"), c("ok-bg"), TEXT, "ink on ok-bg"], [c("ink"), c("bad-bg"), TEXT, "ink on bad-bg"], [c("ink"), c("warn-bg"), TEXT, "ink on warn-bg"], [c("ink"), c("info-bg"), TEXT, "ink on info-bg"]);
    // buttons, bars and dark bands
    out.push([c("on-primary"), c("primary"), TEXT, "button text on primary"], [c("on-primary"), c("primary-2"), TEXT, "button text on primary-2 (hover)"], [c("deep"), c("accent"), TEXT, "deep on the accent button"],
      [c("accent"), c("deep"), TEXT, "accent on deep"], [c("accent-2"), c("deep"), TEXT, "accent-2 on deep"], [c("accent-2"), c("primary"), TEXT, "accent-2 on primary (the icon tiles and step numbers)"], [c("on-dark"), c("primary"), TEXT, "hero text on primary"], [c("on-dark"), c("primary-2"), TEXT, "hero text on primary-2"], [c("on-dark"), c("deep"), TEXT, "hero text on deep"],
      [c("on-primary"), c("deep"), TEXT, "white on deep"], [c("link"), c("wash"), TEXT, "link on its wash (chips and pills)"], [c("deep"), c("accent"), TEXT, "dark icon on an accent tile"]);
    // parts you can see or touch
    out.push([c("focus"), c("bg"), PART, "focus ring on the page"], [c("focus"), c("surface"), PART, "focus ring on a card"], [c("primary"), c("bg"), PART, "primary part on the page"]);
    return out;
  };
  const fails = (pairs: Pair[]) => pairs.filter(([a, b, min]) => ratio(a, b) < min).map(([a, b, min, why]) => `${why}: ${a} on ${b} = ${ratio(a, b).toFixed(2)} (needs ${min})`);
  test("light: text, signals, buttons, bars and parts", () => { const p = surfaces(L); expect(p.length).toBeGreaterThan(50); expect(fails(p)).toEqual([]); });
  test("night (dark): the same roles on the night surfaces (the hero text colour does not switch)", () => {
    const p = surfaces((n) => (n === "on-dark" ? L(n) : N(n)));
    expect(p.length).toBeGreaterThan(50);
    expect(fails(p)).toEqual([]);
    expect(ratio(N("primary"), N("bg"))).toBeGreaterThanOrEqual(3); expect(ratio(N("primary"), N("surface"))).toBeGreaterThanOrEqual(3);
  });
  test("the five board bands and their deeper twins carry dark text", () => {
    const p: Pair[] = [];
    for (let i = 0; i < 5; i++) p.push([L("ink"), L(`band-${i}`), TEXT, `ink on band-${i}`], [L("ink"), L(`band-${i}-alt`), TEXT, `ink on band-${i}-alt`]);
    for (let i = 0; i < 5; i++) for (const s of [0, 1, 2, 3, 4]) p.push([colour(light["--snk-snake-" + s]), colour(light[`--snk-band-${i}`]), 2, `snake ${s} stays visible on band ${i}`]); // snakes also have a white outline in z.css
    expect(fails(p)).toEqual([]);
  });
  test("the board rules in z.css use the bands, and the five snakes use the scheme's snake colours", () => {
    const z = rd(join(PUB, "z.css"));
    for (let i = 0; i < 5; i++) { expect(z).toContain(`.sq.h${i}{background:var(--snk-band-${i})}`); expect(z).toContain(`.sq.a.h${i}{background:var(--snk-band-${i}-alt)}`); expect(z).toContain(`.sqsvg .s${i}{--sn:var(--snk-snake-${i})}`); }
  });
  test("the bridge: header bar, band, call-to-action and washes keep AA with the scheme", () => {
    const v = (n: string) => colour(bridge["--" + n], { ...light, ...Object.fromEntries(Object.entries(bridge)) });
    const p: Pair[] = [
      [v("on-bar"), v("bar-a"), TEXT, "bar text on bar-a"], [v("on-bar"), v("bar-b"), TEXT, "bar text on bar-b"], [v("on-bar-muted"), v("bar-a"), TEXT, "bar small text on bar-a"], [v("on-bar-muted"), v("bar-b"), TEXT, "bar small text on bar-b"],
      [v("bar-ink"), v("bar-gold"), TEXT, "Demo button on the bar"], [v("on-action"), v("action"), TEXT, "action button text"], [v("cta-on"), v("cta-bg"), TEXT, "call-to-action text"], [v("cta-on"), v("cta-a"), TEXT, "call-to-action text (start)"],
      [v("cta-btn-on"), v("cta-btn"), TEXT, "call-to-action button"], [v("on-band"), v("band"), TEXT, "band text"], [v("band-muted"), v("band"), TEXT, "band small text"], [v("band-gold"), v("band-deep"), TEXT, "band accent on deep"],
      [v("ink"), v("wash-gold"), TEXT, "ink on the gold wash"], [v("ink"), v("wash-rose"), TEXT, "ink on the rose wash"], [v("ink"), v("wash-teal"), TEXT, "ink on the green wash"], [v("ink"), v("tint"), TEXT, "ink on the tint"], [v("ink"), v("field"), TEXT, "ink in a field"],
      [v("field-line"), v("paper"), PART, "field border on a card"],
    ];
    expect(fails(p)).toEqual([]);
  });
  test("the console step tints (names kept, warm colours) keep AA: the text colour on its tint, for all nine", () => {
    const zc = declsOf(rulesOf(rd(join(PUB, "zc.css"))).find((r) => r.selector === ".zc")!.body);
    const names = ["blue", "aqua", "violet", "magenta", "green", "yellow", "orange", "red", "lime"];
    expect(names.every((n) => zc["--bg-tint-" + n] && zc["--text-tint-" + n])).toBe(true);
    expect(fails(names.map((n) => [colour(zc["--text-tint-" + n]), colour(zc["--bg-tint-" + n]), TEXT, "tint " + n] as Pair))).toEqual([]);
  });
  test("the eight reaction colours keep ink on fill at AA, and no two of them are the same", () => {
    const rx = rulesOf(rd(join(PUB, "reactions.css"))).filter((r) => /^\.rx\.p[1-8]$/.test(r.selector));
    expect(rx.length).toBe(8);
    const fills = rx.map((r) => { const d = declsOf(r.body); return [colour(d["--rxi"]), colour(d["--rxb"])] as [string, string]; });
    expect(fails(fills.map(([i, b], k) => [i, b, TEXT, "reaction " + (k + 1)] as Pair))).toEqual([]);
    expect(new Set(fills.map((f) => f[1])).size).toBe(8);
  });
  test("the console, player and pay pages' own text pairs set in z.css, zc.css and paykit.css are no worse than before (the white-on-colour buttons)", () => {
    const z = rulesOf(rd(join(PUB, "z.css")));
    const pairOf = (sel: string) => { const r = z.filter((x) => x.selector === sel).map((x) => declsOf(x.body)).reduce((a, b) => ({ ...a, ...b }), {}); return [colour(r["color"], { ...light, ...bridge }), colour(r["background"] ?? r["background-color"], { ...light, ...bridge })] as [string, string]; };
    const checks: Pair[] = [];
    for (const sel of [".zdemotag", ".zchip2.go", ".zchip2.soon", ".zwonchip"]) { const [a, b] = pairOf(sel); checks.push([a, b, TEXT, sel]); }
    expect(fails(checks)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
describe("5. the theme colour of the browser and the installed app come from the scheme", () => {
  const metaOf = (f: string) => [...rd(f).matchAll(/<meta name="theme-color" content="(#[0-9A-Fa-f]{6})"/g)].map((m) => m[1]!.toUpperCase());
  test("every app page that has a theme-colour meta uses --snk-primary; every page of the coming-soon site uses --snk-night-bg", () => {
    const app = walk(PUB).filter((f) => f.endsWith(".html") && metaOf(f).length), site = walk(SITE).filter((f) => f.endsWith(".html") && metaOf(f).length);
    expect(app.length).toBeGreaterThan(25); expect(site.length).toBe(12);
    expect(app.filter((f) => metaOf(f).some((c) => c !== L("primary"))).map(rel)).toEqual([]);
    expect(site.filter((f) => metaOf(f).some((c) => c !== N("bg"))).map(rel)).toEqual([]);
  });
  test("the manifest: theme_color is --snk-primary and background_color is --snk-bg", () => {
    const m = JSON.parse(rd(join(PUB, "manifest.webmanifest")));
    expect(m.theme_color.toUpperCase()).toBe(L("primary")); expect(m.background_color.toUpperCase()).toBe(L("bg"));
  });
  test("the raster pictures are there, the same names as before (their colours are made by tools/make-icons.py from the SVGs)", () => {
    for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "favicon.ico", "logo-512.png", "og-card.png", "img/card.png"]) expect(existsSync(join(PUB, f)), f).toBe(true);
    const png = (f: string) => readFileSync(join(PUB, f));
    const size = (f: string) => { const b = png(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
    expect(size("icon-192.png")).toEqual([192, 192]); expect(size("icon-512.png")).toEqual([512, 512]); expect(size("apple-touch-icon.png")).toEqual([180, 180]); expect(size("favicon-32.png")).toEqual([32, 32]);
    expect(size("og-card.png")).toEqual([1200, 630]); expect(size("img/card.png")).toEqual([1200, 630]);
  });
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
describe("6. the copied colour themes and the theme dots are gone", () => {
  const files = [...walk(PUB), ...walk(SITE)].filter((f) => /\.(css|js|html)$/.test(f) && !SKIP(f) && !/snakes-colours/.test(f));
  test("no style, script or page of the game has the maroon, blue or emerald themes, or the two sets of dots (.tdots and .ck-dots)", () => {
    const re = /html\[data-theme|data-theme=["']?(maroon|emerald|blue)|\.tdots\b|class="tdots|ck-dots|Studio blue|\bmaroon\b|\bemerald\b/i;
    expect(files.filter((f) => re.test(rd(f))).map(rel)).toEqual([]);
  });
  test("nothing sets a colour theme on the page any more", () => {
    expect(files.filter((f) => /\.js$/.test(f) && /setAttribute\(\s*["']data-theme["']/.test(rd(f))).map(rel)).toEqual([]);
  });
  test("theme.js keeps only the script marker, the follow-the-device mark and the saved Light or Dark choice, and clears what the old dots saved", () => {
    const t = rd(join(PUB, "theme.js"));
    expect(t).toContain('classList.add("js")'); expect(t).toContain("cg-theme"); expect(t).toContain('removeItem("cb-theme")'); expect(t).toContain('removeItem("ct-theme")');
    expect(t).not.toMatch(/createElement|getItem\("(cb|ct)-theme"\)/);
  });
  test("the home page and the brand kit script keep the menu button and the Dark / Light button, and nothing else", () => {
    const b = rd(join(PUB, "brandkit.js")); expect(b).toContain("ck-menu"); expect(b).toContain("data-ck-mode"); expect(b).not.toMatch(/dots|data-theme|ct-theme/i);
    const h = rd(join(PUB, "index.html")); expect(h).toContain("data-ck-mode"); expect(h).not.toContain("Colour theme");
  });
  test("the old theme storage keys stay listed in the storage registry only because theme.js still removes them (the storage scan counts a removeItem)", () => {
    const reg = rd(join(ROOT, "apps/web/storage-registry.json"));
    expect(reg).toContain("cg-theme"); expect(rd(join(PUB, "theme.js"))).toContain("cb-theme");
  });
});
