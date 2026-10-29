// The Corporate Games brand kit and games bar are ONE shared set of files: this site's copies must equal the canonical files byte for byte (SHA-256 below).
// If a hash fails, copy the canonical files again (python -I docs/boss/brand-kit/vendor.py snakes apps/web/public --console --no-manifest --apply, and the two games-bar files);
// never edit a copy here. Line endings do not count (git may check files out with CRLF). Also: the logo and icons are the kit's, and the two PDFs are made from the pages and open.
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const PUB = join(ROOT, "apps/web/public");
const sha = (file: string, text = true, base = PUB) => {
  let b = readFileSync(join(base, file));
  if (text) b = Buffer.from(b.toString("utf8").split(String.fromCharCode(13)).join(""));
  return createHash("sha256").update(b).digest("hex");
};

export const KIT_TEXT: Record<string, string> = {
  "tokens.css": "32566fe7a4bdd8d2880459d353dadff1f7d97f23ab7228d94313ef7e80017638",
  "fonts.css": "94ca9271029ca0e0cdb269698e334dd8dedc001f5ca2c4a5d228a6dc11306a9c",
  "components.css": "22196acdfbda615dfa2b0bf5bc61568155f9acfa94b979af36f1c3c11b46b786",
  "console.css": "690b28be74be67487fd478350ff99e3b2d21bbabc2163e004ff94dfbfcbf5c0b", // the organizer console pages (zc.html) take only this visual shell
  "brandkit.js": "00dabcc77138e157a432705f18cc9145bf50164421bc08d173f7424d517f802b",
  "theme-init.js": "8ff0eb6def5cf8a95b54a2b81738a022b7a7a2b2dc76325fed78c455e45c6d7f",
  "gamesbar.js": "16f02208af3c84cef63d81cdfcbc788f1baf23957ed71e912d44cafd4f881b98",
  "gamesbar.css": "6b0311de98525de646e637a28102163dfecf9fde35b8befe0344a5e16fff8b5b",
  "favicon.svg": "2a03845a6a90f8f4d69c1d807bc890ce1b39e245dc958ca8d722e4925b958c9f", // logos/snakes.svg
  "logo-mark.svg": "2a03845a6a90f8f4d69c1d807bc890ce1b39e245dc958ca8d722e4925b958c9f", // the same badge: every page and script that draws the logo uses this file
  "logo.svg": "25c70996647405912f15385803472ef2a2fe434eb6092af4e4b870472d9ffb8c", // logos/lockups/snakes-lockup-light.svg
};
export const KIT_BINARY: Record<string, string> = {
  "fonts/Inter-normal-400.woff2": "3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62",
  "fonts/Fraunces-normal-500-700.woff2": "7234ed860a9cc83045413c4faee63c960a8f2d1917adcf728119307d56e0d783",
  "icon-192.png": "e02a44fdad428e2fa5eff830e96e250459ca62681c7b608520fb64f7d3827c8f",
  "icon-512.png": "6037f5d00361b916e62825a8bdb81a5c245abe926d920094e570666a9cd8be32",
  "icon-maskable-192.png": "4d56ce76e4ad55c41bfa2b9a9de594433e54f55d90d4b69bc422d1960c68d221",
  "icon-maskable-512.png": "a2c44f2aff91af6a78cb43a4d8f9c84d9f9328e73b84f2200143f899b50314af",
  "apple-touch-icon.png": "17a87ee4a2e9895b0d4e10c0753d10667cbd284aa0e64f2e4b144adc3655dc86",
  "favicon-32.png": "65edd64295b858b5285e5ed95ec68cfa7f620deca517a3848ebfca64a2357b46",
  "favicon.ico": "190439ecc85bf9d175a12453f490788ad51fec342a294bd66d1cedc0cf3131ae",
  "og-card.png": "8c1282bfe7e078b539f36bfa4a2027a6ff435e340274ca88cafb884ed2266a2d", // the 1200 x 630 share card
  "logo-512.png": "6037f5d00361b916e62825a8bdb81a5c245abe926d920094e570666a9cd8be32", // the same picture as icon-512.png
};
const SNIPPETS: Record<string, string> = { // the pieces the page shell is built from (tools/site-shell), copied from the kit's snippets/
  "sprite.html": "bc5750f4398bd470f8ed890630bd3b85af3c3fad3690f5b996d0daede7bfd751", // the six badges, including #i-snakes
  "gameday.html": "64441b162f7c164ae903fe11f9a7fc35e7df29e658ea68b8b58e862fdfdd7a5e", // "How a game day feels": the three drawings
};

describe("the shared Corporate Games brand kit", () => {
  test("css and js are identical to the canonical copy (tokens, fonts, components, console, brandkit.js, theme-init.js)", () => {
    for (const f of ["tokens.css", "fonts.css", "components.css", "console.css", "brandkit.js", "theme-init.js"]) expect([f, sha(f)]).toEqual([f, KIT_TEXT[f]!]);
  });
  test("the two fonts are identical (self-hosted Inter and Fraunces, never an outside address)", () => {
    for (const f of ["fonts/Inter-normal-400.woff2", "fonts/Fraunces-normal-500-700.woff2"]) expect([f, sha(f, false)]).toEqual([f, KIT_BINARY[f]!]);
    expect(readFileSync(join(PUB, "fonts.css"), "utf8")).not.toMatch(/https?:\/\//);
  });
  test("the logo, the icons for a phone's home screen and the share card are the kit's files", () => {
    for (const f of ["favicon.svg", "logo-mark.svg", "logo.svg"]) expect([f, sha(f)]).toEqual([f, KIT_TEXT[f]!]);
    for (const f of ["icon-192.png", "icon-512.png", "icon-maskable-192.png", "icon-maskable-512.png", "apple-touch-icon.png", "favicon-32.png", "favicon.ico", "og-card.png", "logo-512.png"]) expect([f, sha(f, false)]).toEqual([f, KIT_BINARY[f]!]);
    expect(readFileSync(join(PUB, "logo-mark.svg"), "utf8")).toContain("<title>Corporate Snakes and Ladders</title>");
    expect(existsSync(join(PUB, "img/card.png"))).toBe(false); // the old teal card is gone
  });
  test("the page-shell snippets (badge sprite, game-day drawings) are the kit's", () => {
    for (const [f, h] of Object.entries(SNIPPETS)) expect([f, sha(f, true, join(ROOT, "tools/site-shell"))]).toEqual([f, h]);
  });
  test("the kit has one more safeguard: no file of the kit mentions the banned word or an outside address", () => {
    for (const f of ["tokens.css", "components.css", "console.css", "brandkit.js", "theme-init.js", "gamesbar.js", "gamesbar.css"]) {
      const t = readFileSync(join(PUB, f), "utf8");
      expect([f, /priv[a]te/i.test(t)]).toEqual([f, false]);
      expect([f, /@import|url\(\s*["']?https?:/i.test(t)]).toEqual([f, false]);
    }
  });
});

describe("the shared Corporate Games bar", () => {
  test("gamesbar.js and gamesbar.css are identical to the canonical copy", () => {
    expect(sha("gamesbar.js")).toBe(KIT_TEXT["gamesbar.js"]!); expect(sha("gamesbar.css")).toBe(KIT_TEXT["gamesbar.css"]!);
  });
});

describe("the copies here equal the canonical folders (checked while the docs are in the repo)", () => {
  const boss = join(ROOT, "docs/boss");
  test.skipIf(!existsSync(join(boss, "brand-kit/vendor-checksums.json")))("every kit file hash is the one the kit itself lists, and the games bar files are the canonical ones", () => {
    const listed = JSON.parse(readFileSync(join(boss, "brand-kit/vendor-checksums.json"), "utf8")).files as Record<string, string>;
    for (const [f, h] of Object.entries(listed)) expect([f, sha(f, !f.endsWith(".woff2"))]).toEqual([f, h]);
    for (const f of ["gamesbar.js", "gamesbar.css"]) expect([f, sha(f, true, join(boss, "games-bar"))]).toEqual([f, KIT_TEXT[f]!]);
    for (const [from, to] of [["snakes.svg", "favicon.svg"], ["lockups/snakes-lockup-light.svg", "logo.svg"]] as const) expect([to, sha(to)]).toEqual([to, sha("logos/" + from, true, join(boss, "brand-kit"))]);
    for (const [from, to] of [["png/snakes-192.png", "icon-192.png"], ["png/snakes-512.png", "icon-512.png"], ["png/snakes-maskable-192.png", "icon-maskable-192.png"], ["png/snakes-maskable-512.png", "icon-maskable-512.png"], ["png/snakes-180.png", "apple-touch-icon.png"], ["png/snakes-32.png", "favicon-32.png"], ["ico/snakes.ico", "favicon.ico"], ["social/snakes-social-1200x630.png", "og-card.png"]] as const) expect([to, sha(to, false)]).toEqual([to, sha("logos/" + from, false, join(boss, "brand-kit"))]);
  });
});

describe("the brochure and the guide PDFs are made from the pages, carry the brand and the payee line, and open", () => {
  const norm = (s: string) => s.replace(/\s+/g, " ");
  async function open(file: string) {
    const bytes = new Uint8Array(readFileSync(join(PUB, file)));
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-"); expect(Buffer.from(bytes.subarray(-8)).toString("latin1")).toContain("%%EOF");
    const lib: any = await import(join(PUB, "vendor/pdfjs/pdf.min.mjs")); lib.GlobalWorkerOptions.workerSrc = "file://" + join(PUB, "vendor/pdfjs/pdf.worker.min.mjs");
    const doc = await lib.getDocument({ data: bytes, disableWorker: true, verbosity: 0 }).promise; let text = "";
    for (let i = 1; i <= doc.numPages; i++) text += " " + (await (await doc.getPage(i)).getTextContent()).items.map((x: any) => x.str).join(" ");
    return { pages: doc.numPages as number, text: norm(text) };
  }
  for (const f of ["brochure.pdf", "organizer-guide.pdf"]) test(`${f}: a real PDF, one to six pages, the brand (CORPORATE above Snakes and Ladders) and the payee line`, async () => {
    const { pages, text } = await open(f);
    expect(pages).toBeGreaterThanOrEqual(1); expect(pages).toBeLessThanOrEqual(6);
    expect(text.replace(/ /g, "")).toContain("CORPORATESnakesandLadders"); // the small CORPORATE line, then the proper name (letter-spaced in the picture of the badge line)
    expect(text.replace(/\s/g, "")).toContain("Allpaymentsaretakenonlyby" + "IT Services by Rajat Agarwal".replace(/\s/g, "") + ",throughRazorpay."); // words only: the PDF reader splits the lines and the dots
    expect(text).not.toMatch(/priv[a]te/i); expect(text).not.toMatch(/Stripe|PayPal|Paytm|PayU|Cashfree|Instamojo|PhonePe/i);
  });
  test("the PDFs are linked from their pages and shipped by the build", () => {
    expect(readFileSync(join(PUB, "brochure.html"), "utf8")).toContain('href="/brochure.pdf"');
    expect(readFileSync(join(PUB, "organizer-guide.html"), "utf8")).toContain('href="/organizer-guide.pdf"');
    const b = readFileSync(join(ROOT, "pages/build.mjs"), "utf8"); expect(b).toContain('"brochure.pdf"'); expect(b).toContain('"organizer-guide.pdf"');
    expect(existsSync(join(ROOT, "tools/make-pdfs.mjs"))).toBe(true);
  });
});
