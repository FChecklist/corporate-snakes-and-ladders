// Everything that is deployed must read as a finished product: no internal notes, no names of other legal entities.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(30_000); // it reads every deployed file; on a busy laptop that takes more than bun's 5 seconds
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const DEPLOYED = ["apps/web/public", "pages/functions", "site"];
const BINARY = /\.(png|webp|woff2|pdf|jpg|jpeg|gif|ico|sqlite)$/i;
const FORBIDDEN = /COUNSEL|\[●\]|legal(ly)?\s+(review|pending|sign-?off)|review\s+pending|pending\s+(legal|review|approval)|awaiting\s+(legal|counsel|lawyer|approval|review)|\blawyer\b|\badvocate\b|owner'?s?\s+(told|instruction|order|directive|decision)|\bTODO\b|\bFIXME\b|under review|not yet (reviewed|approved)|Shobha/i;
/** On the legal pages the word draft is also forbidden (elsewhere "a draft game" is ordinary product language). */
const LEGAL_PAGES = ["terms.html", "legal.html", "privacy.html", "refund-policy.html", "about.html", "contact.html", "pricing.html"];
const DRAFT = /\bdraft\b/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".wrangler" || n === ".git" || n === "vendor") continue; // vendor: third-party libraries copied as they are (pdf.js)
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) walk(p, out); else if (!BINARY.test(n)) out.push(p);
  }
  return out;
}

// apps/web/public/pack/ is vendored byte for byte from the console repo and uses "todo" as a CSS state class (.zf-ready.todo, class "todo"). Only those exact uses are
// blanked, so the rest of the pack is still scanned and a real TODO note (the check is case-insensitive) in it is still caught.
const PACK_TODO_CLASS = /\.zf-ready\.todo\b|\? "ok" : "todo"/g;
const scanText = (f: string, t: string) => (f.replace(/\\/g, "/").includes("/public/pack/") ? t.replace(PACK_TODO_CLASS, "") : t);

describe("no internal notes in anything that is deployed", () => {
  const files = DEPLOYED.flatMap((d) => { try { return walk(join(ROOT, d)); } catch { return []; } });
  test("there are files to scan", () => { expect(files.length).toBeGreaterThan(20); });
  test("no file contains an internal note, a review or approval remark, a TODO, or the name of another legal entity", () => {
    const bad: string[] = [];
    for (const f of files) { const t = scanText(f, readFileSync(f, "utf8")); const m = FORBIDDEN.exec(t); if (m) bad.push(`${f.slice(ROOT.length)}: ${m[0]} ... ${t.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ")}`); }
    expect(bad).toEqual([]);
  });
  test("the legal pages never use the word draft", () => {
    const bad: string[] = [];
    for (const f of files) {
      if (!LEGAL_PAGES.some((p) => f.replace(/\\/g, "/").endsWith("/" + p))) continue;
      const t = readFileSync(f, "utf8"); const m = DRAFT.exec(t);
      if (m) bad.push(`${f.slice(ROOT.length)}: ${t.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, " ")}`);
    }
    expect(bad).toEqual([]);
  });
  test("the pack exemption is narrow: the vendored class is ignored, a real TODO note in a pack file is still caught", () => {
    const f = "/x/apps/web/public/pack/zc-flow.js";
    expect(FORBIDDEN.test(scanText(f, '.zf-ready.todo { background: #fff; } class: "zf-ready " + (ok ? "ok" : "todo")'))).toBe(false);
    expect(FORBIDDEN.test(scanText(f, "// TODO: fix this"))).toBe(true);
    expect(FORBIDDEN.test(scanText(f, "a todo item"))).toBe(true);
    expect(FORBIDDEN.test(scanText("/x/apps/web/public/z.js", ".zf-ready.todo {}"))).toBe(true); // outside the pack nothing is exempt
  });
  test("the scan itself works: each kind of note is caught", () => {
    for (const s of ["for counsel", "[●]", "legal review", "pending approval", "awaiting lawyer", "the advocate", "owner's order", "TODO", "FIXME", "under review", "not yet approved", "Shobha Kamal"]) expect(FORBIDDEN.test(s)).toBe(true);
    expect(DRAFT.test("a draft")).toBe(true);
  });
});
