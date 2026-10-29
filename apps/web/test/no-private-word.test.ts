// Owner rule (2026-10-28): the games are ONLINE and CLOSE GROUP. The word "private" is never used in anything people read: site, game pages, e-mails, reports, WhatsApp texts.
// Say "close group" for the game, "personal link" for a link meant for one person, "sealed" for a record only we can open. Code keywords, comments and security terms
// that nobody reads ("private key", "private browsing") are not text people read and are left alone.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
setDefaultTimeout(30_000);
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SCANNED = ["apps/web/public", "site", "pages/functions", "apps/edge/src", "packages/beacon/src", "packages/shared/src", "packages/billing/src"];
const BINARY = /\.(png|webp|woff2|pdf|jpg|jpeg|gif|ico|sqlite|mp3|mp4|m4a|webm)$/i;
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === ".wrangler" || n === ".git" || n === "vendor") continue;
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) walk(p, out); else if (!BINARY.test(n)) out.push(p);
  }
  return out;
}
/** True when this use of the word is a code keyword, a security term or a comment: not text a person reads. */
function notReadByPeople(line: string, at: number, file: string): boolean {
  const t = line.trim();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("<!--")) return true;
  const before = line.slice(0, at), after = line.slice(at);
  if (/(^|\s)\/\/\s/.test(before) || (before.lastIndexOf("/*") > before.lastIndexOf("*/") && after.includes("*/"))) return true; // after a comment mark on the same line
  const ctx = line.slice(Math.max(0, at - 12), at + 30);
  if (/\bprivate (key|browsing)\b/i.test(ctx)) return true;
  if (file.endsWith(".ts") && /^private\s+(readonly\s+|static\s+|async\s+|get\s+|set\s+)?[A-Za-z_$][\w$]*\s*[:=(<?!;]/.test(after)) return true; // a TypeScript member marker, not a word
  return false;
}

describe("the word 'private' is not used in anything people read", () => {
  const files = SCANNED.flatMap((d) => { try { return walk(join(ROOT, d)); } catch { return []; } });
  test("there are files to scan", () => { expect(files.length).toBeGreaterThan(80); });
  test("not in the site, the game pages, the e-mails, the AI texts or the engine messages", () => {
    const bad: string[] = [];
    for (const f of files) {
      const lines = readFileSync(f, "utf8").split("\n");
      lines.forEach((line, i) => { for (const m of line.matchAll(/\bprivate\b/gi)) if (!notReadByPeople(line, m.index!, f)) bad.push(`${f.slice(ROOT.length)}:${i + 1}: ${line.slice(Math.max(0, m.index! - 40), m.index! + 50).trim()}`); });
    }
    expect(bad).toEqual([]);
  });
});
