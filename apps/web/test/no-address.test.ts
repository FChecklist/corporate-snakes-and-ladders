// Owner order 1 Nov 2026: no street, city, state or pin code anywhere in what ships. Only "India".
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const BAD = /Ghaziabad|Uttar\s+Pradesh|Indirapuram|Shipra|B-1105|\b20101[0-9]\b/i;
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules" || n === "vendor" || n === ".git") continue;
    const p = join(dir, n), s = statSync(p);
    if (s.isDirectory()) walk(p, out); else if (/\.(html|js|ts|json|md|txt|svg|css)$/.test(n)) out.push(p);
  }
  return out;
}
describe("no address, city or state in shipped files", () => {
  test("pages, scripts, e-mail and PDF builders, billing, config, docs and tests carry none of them", () => {
    const hits: string[] = [];
    for (const d of ["apps", "packages", "config", "docs", "site"]) { try { for (const f of walk(join(ROOT, d))) { if (f.endsWith("no-address.test.ts") || f.endsWith("pdf.worker.min.mjs")) continue; const m = readFileSync(f, "utf8").match(BAD); if (m) hits.push(f.slice(ROOT.length + 1) + ": " + m[0]); } } catch { /* folder not present */ } }
    expect(hits).toEqual([]);
  });
});
