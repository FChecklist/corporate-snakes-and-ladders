// QA MODEL, part 5: wording. Reads the files customers and players can see and checks the owner's wording rules:
//   - the word "private" never appears in text people read (say "close group")             - docs/boss/README.md, ALL_GAMES_CARRY_TAMBOLA_RULES.md WORDING RULE
//   - money is only ever taken by "IT Services by Rajat Agarwal" through Razorpay            - docs/boss/README.md
//   - no cash prize / betting words (RULES 9: players never pay and never stake money)
//   - English only (no other script)
//   - every message in docs/boss/RULES_snakesladders.md section 10 exists in the player code (or is listed as a difference)
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const SKIP_DIR = new Set(["node_modules", ".git", "vendor", "test", "tests", "fixtures"]);
const SKIP_FILE = /(\.min\.|pdf\.worker|zgame\.js$|control\.js$|reportgen\.js$|releases\.json$|bun\.lock|\.woff2?$|\.png$|\.svg$|\.ico$|\.pdf$|\.mp[34]$)/;
const walk = (dir, out = []) => { for (const n of readdirSync(dir)) { if (SKIP_DIR.has(n)) continue; const p = join(dir, n); const s = statSync(p); if (s.isDirectory()) walk(p, out); else if (!SKIP_FILE.test(p) && [".html", ".js", ".ts", ".json", ".txt", ".md", ".mjs", ".css", ".xml"].includes(extname(p))) out.push(p); } return out; };

export function listCustomerFiles() {
  const roots = ["apps/web/public", "apps/edge/src", "packages/beacon/src", "packages/shared/src", "packages/billing/src", "site", "config"].map((r) => join(ROOT, r)).filter(existsSync);
  const files = roots.flatMap((r) => walk(r));
  return files.map((f) => relative(ROOT, f));
}

export async function run({ add, mk, hit, log }) {
  const files = listCustomerFiles();
  const text = Object.fromEntries(files.map((f) => [f, readFileSync(join(ROOT, f), "utf8")]));
  // ---- "private" ----
  const C = { priv: mk(), pay: mk(), cash: mk(), lang: mk(), msgs: mk() };
  const found = [];
  for (const [f, t] of Object.entries(text)) {
    if (/^apps\/edge\/src\/(legal|consent-text)\./.test(f) && false) continue;
    const lines = t.split("\n");
    lines.forEach((line, i) => {
      const tl = line.trim(); if (tl.startsWith("//") || tl.startsWith("*") || tl.startsWith("/*") || tl.startsWith("<!--")) return; // a comment is not text people read
      for (const m of line.matchAll(/\bprivate\b/gi)) {
        const bf = line.slice(0, m.index); if (/(^|\s)\/\/\s/.test(bf) || (bf.lastIndexOf("/*") > bf.lastIndexOf("*/") && line.slice(m.index).includes("*/"))) continue;
        // code keywords are not words anybody reads: "private key", "private static", "private readonly", "private:" in TypeScript, JSON "private": true
        const ctx = line.slice(Math.max(0, m.index - 24), m.index + 40);
        if (/\bprivate (key|browsing)\b/i.test(ctx) || (f.endsWith(".ts") && /^private\s+(readonly\s+|static\s+|async\s+|get\s+|set\s+)?[A-Za-z_$][\w$]*\s*[:=(<?!;]/.test(line.slice(m.index)))) continue; // a TypeScript member marker, not a word
        if (/"private"\s*:\s*(true|false)/.test(line)) continue;
        found.push(`${f}:${i + 1}: ${line.trim().slice(0, 160)}`);
      }
    });
  }
  C.priv.cases = Object.keys(text).length; C.priv.bad = found.length; C.priv.ex = found.slice(0, 3).join(" || ");
  add("X-01", "wording", "the word 'private' never appears in text people read (say 'close group'); counted over every customer-facing file", C.priv.cases, C.priv.bad, C.priv.ex || "", found.slice(0, 12).join("; "), "GAP", `${found.length} places: ${[...new Set(found.map((x) => x.split(":")[0]))].join(", ")}`);
  // ---- payments ----
  const payBad = [];
  for (const [f, t] of Object.entries(text)) {
    if (/billing\/src\/index\.ts$/.test(f)) continue; // brand table of the shared billing library: invoice titles of the other products, never shown on this site
    for (const m of t.matchAll(/\b(Stripe|PayPal|Paytm|PhonePe|PayU|Cashfree|Instamojo|bank transfer|NEFT|RTGS|cheque|Google Pay|Apple Pay)\b/g)) payBad.push(`${f}: ${m[0]}`);
  }
  const razorOnly = Object.entries(text).filter(([f, t]) => /pricing|terms|refund|legal/.test(f) && /pay/i.test(t) && !/Razorpay|IT Services by Rajat Agarwal/.test(t)).map(([f]) => f);
  C.pay.cases = Object.keys(text).length; C.pay.bad = payBad.length; C.pay.ex = payBad.slice(0, 4).join("; ");
  add("X-02", "wording", "money is only taken by 'IT Services by Rajat Agarwal' through Razorpay: no other payment company or method is named in customer-facing text", C.pay.cases, C.pay.bad, C.pay.ex, payBad.slice(0, 6).join("; "), "GAP");
  // the seller name appears wherever a payment is taken: pay page, terms, refund policy, receipts
  const sellerFiles = ["apps/web/public/pay.html+pay.js", "apps/web/public/paylink.html+paylink.js", "site/terms.html", "site/refund-policy.html", "site/pricing.html"].filter((f) => f.split("+").some((x) => text[x.includes("/") ? x : "apps/web/public/" + x]));
  const missingSeller = sellerFiles.filter((f) => !f.split("+").some((x) => /IT Services by Rajat Agarwal/.test(text[x.includes("/") ? x : "apps/web/public/" + x] ?? "")));
  add("X-03", "wording", "the pay page, terms, refund policy and pricing page name the seller 'IT Services by Rajat Agarwal'", sellerFiles.length, missingSeller.length, `missing in ${missingSeller.join(", ")}`, missingSeller.join(", "), "GAP");
  // ---- money words ----
  const cashHits = [];
  for (const f of files) { if (/(legal|terms|privacy|trust|refund|subprocessors|dpa|partner-terms|llms|facts)/.test(f)) continue; /* legal pages name these words to deny them */ const t = text[f].split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l)).join("\n"); /* comments are not text people read */ for (const m of t.matchAll(/\b(cash prize|cash reward|betting|bet on|gambl\w*|jackpot|lottery|wager|stake money|real money)\b/gi)) cashHits.push(`${f}: ${m[0]}`); }
  // sentences that DENY money ("no cash prize", "never stake money") are the rule itself, not a breach
  const real = cashHits.filter((h) => { const [f, w] = h.split(": "); const t = text[f]; const i = t.toLowerCase().indexOf(w.toLowerCase()); const ctx = t.slice(Math.max(0, i - 40), i + w.length + 20).toLowerCase(); return !/\b(no|not|never|nor|without|isn't|is not|don't|does not|cannot|can't)\b/.test(ctx); });
  add("X-04", "wording", "no cash prize / betting / gambling wording (RULES 9: players never pay and never stake money)", Object.keys(text).length, real.length, real.slice(0, 3).join("; "), real.slice(0, 6).join("; "), "GAP");
  // ---- English only ----
  const nonEnglish = [];
  for (const [f, t] of Object.entries(text)) { if (!/\.(html|js|json|ts)$/.test(f)) continue; const m = t.match(/[ऀ-ॿ਀-੿஀-௿ఀ-౿一-鿿؀-ۿЀ-ӿ]/); if (m) nonEnglish.push(`${f}: ${m[0]}`); }
  add("X-05", "wording", "English only: no other script (Hindi, Chinese, Arabic, Cyrillic ...) in customer-facing files", Object.keys(text).length, nonEnglish.length, nonEnglish.slice(0, 3).join("; "), nonEnglish.slice(0, 6).join("; "), "GAP");
  // ---- the messages of RULES section 10 ----
  const player = ["apps/web/public/z.js", "apps/web/public/big.js", "apps/web/public/demo.js", "packages/beacon/src/phone-runtime.ts"].map((f) => text[f] ?? "").join("\n");
  const rules = readFileSync(join(ROOT, "docs/boss/RULES_snakesladders.md"), "utf8");
  const table = [...rules.matchAll(/^\| (.+?) \| (.+?) \|$/gm)].filter((m) => !/^-+$/.test(m[1]) && m[1] !== "When");
  const miss = [];
  for (const [, when, msg] of table) {
    const probe = msg.replace(/\{[a-z]+\}/g, "\u0000").split("\u0000").map((s) => s.trim()).filter((s) => s.length >= 8).sort((a, b) => b.length - a.length)[0];
    if (!probe) continue;
    const norm = (s) => s.replace(/\u{1F60A}|\(smile\)/gu, "").replace(/\s+/g, " ").trim();
    if (!norm(player).includes(norm(probe).slice(0, 28))) miss.push(`${when}: "${msg}"`);
  }
  add("X-06", "wording", `every message of docs/boss/RULES_snakesladders.md section 10 (${table.length} rows) is in the player screens`, table.length, miss.length, miss.slice(0, 3).join(" || "), "apps/web/public/z.js (the phone page words these differently or not at all; player wording is the owner's separate track, handover 50)", "GAP", miss.length ? `${miss.length} of ${table.length} differ: ${miss.map((m) => m.split(":")[0]).join("; ")}` : "");
  // ---- Step 2 of the organizer console: how many choices are visible, against docs/boss/100-console-spec section 5.4 ----
  const zc = text["apps/web/public/zc.js"] ?? "";
  const body = zc.slice(zc.indexOf("function gameBlock()"), zc.indexOf("// ---------- step 3: prizes"));
  const hiddenPart = (body.match(/<div class="zc-hide" data-hidden="1">[\s\S]*?<\/div>/g) ?? []).join("");
  const SPEC = { cap: ["Size (the demo first)", "visible"], who: ["Who can join", "visible"], emp: ["Only my employees (tick)", "visible"], ver: ["What must a person give (only when the tick is on)", "visible"], ex: ["One prize per person (tick)", "visible"], ep: ["Ends when N players are home", "visible"],
    spd: ["Turn window", "hide, 20 s"], gm: ["Game type (Race / Team race / Table)", "hide, Race"], tm: ["How many teams", "hide"], pl: ["Throws (automatic / players throw)", "hide, automatic"], bs: ["Board size", "hide, 100"], sn: ["Snakes", "hide, 9"], ld: ["Ladders", "hide, 9"], fin: ["How a player finishes", "hide, exact"],
    ms: ["Milestone squares", "hide, 75"], tc: ["Turn limit", "already hidden"], th: ["Look of the board", "hide, Jungle"], gj: ["What guests type to join", "hide, name only"], inv: ["Guests bring their own people (tick)", "hide, off"], per: ["How many each guest can invite", "hide"], cats: ["Who they can invite (10 kinds)", "hide"] };
  const ids = [...new Set([...body.matchAll(/(?:grp|bchip|inp|lbl)\("(?:f-)?(\w+)"/g)].map((m) => m[1]))].filter((k) => SPEC[k]);
  const shownToday = ids.filter((k) => !hiddenPart.includes(`"${k}"`) && !hiddenPart.includes(`f-${k}`));
  const toHide = shownToday.filter((k) => SPEC[k][1].startsWith("hide"));
  const keep = shownToday.filter((k) => SPEC[k][1] === "visible");
  const stepNote = `shown today: ${shownToday.length} choices (${keep.length} the spec keeps + ${toHide.length} it hides). To hide at a fixed default: ${toHide.map((k) => `${SPEC[k][0]} -> ${SPEC[k][1].replace("hide, ", "")}`).join("; ")}. Kept: ${keep.map((k) => SPEC[k][0]).join("; ")}. Not recorded by the spec: Day, Time, Prize set (steps 1 and 3).`;
  add("S-01", "console", "Step 2 shows only the choices of the console spec 5.4 (Size, Who can join, Only my employees, One prize per person, Ends when N are home); the rest sit at a fixed default", shownToday.length, toHide.length, `Step 2 shows ${shownToday.length} choices; ${toHide.length} of them are meant to be hidden`, "apps/web/public/zc.js gameBlock() lines ~294-326 and stepPlay() ~328-362 (not changed: owner said record only)", "GAP", stepNote);
  log(`[wording] Step 2: ${stepNote}`);
  log(`[wording] ${files.length} customer-facing files read; 'private' in ${found.length} places`);
}
