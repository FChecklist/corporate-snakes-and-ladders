// Written from the release-safety rule (31 Oct 2026), not from the build code:
//   "A page must never run an old cached script against new HTML."
//   1. In every shipped HTML page, every local script and stylesheet address carries ?v=<the commit that was built> (so a release means new addresses).
//   2. Every shipped .js and .css file has its own "Cache-Control: no-cache" rule in _headers (Cloudflare Pages ignores the "/*.js" suffix form, so each file must be named).
// The test builds the site itself, then reads what would be uploaded.
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "../../..");
const OUT = join(ROOT, "pages/public");
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** every local (starts with "/") script or stylesheet address in a page, as written, with its query */
const localRefs = (html: string): { url: string; query: string }[] => {
  const out: { url: string; query: string }[] = [];
  for (const m of html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) out.push({ url: m[1]!, query: "" });
  for (const m of html.matchAll(/<link\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) if (/\.css(\?|#|$)/i.test(m[1]!)) out.push({ url: m[1]!, query: "" });
  return out.filter((r) => r.url.startsWith("/") && !r.url.startsWith("//")).map((r) => ({ url: r.url, query: r.url.split("?")[1] ?? "" }));
};
const unversioned = (html: string, commit: string) => localRefs(html).filter((r) => !new URLSearchParams(r.query.split("#")[0]).getAll("v").includes(commit)).map((r) => r.url);

describe("a returning visitor never runs an old script on a new page", () => {
  test("the checker itself catches an unversioned reference (so a pass means something)", () => {
    const c = "abc123def456";
    expect(unversioned(`<script src="/site.js"></script>`, c)).toEqual(["/site.js"]);
    expect(unversioned(`<link rel="stylesheet" href="/app.css?v=1">`, c)).toEqual(["/app.css?v=1"]);
    expect(unversioned(`<script src='/x.js?a=1'></script>`, c)).toEqual(["/x.js?a=1"]);
    expect(unversioned(`<script src="/site.js?v=${c}"></script><link rel="stylesheet" href="/app.css?v=${c}">`, c)).toEqual([]);
    expect(unversioned(`<script src="https://static.cloudflareinsights.com/beacon.min.js"></script>`, c)).toEqual([]);
  });

  test("build, then: no page references a local script or stylesheet without ?v=<this commit>", () => {
    const b = Bun.spawnSync(["bun", "run", join(ROOT, "pages/build.mjs")], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
    expect(b.exitCode, new TextDecoder().decode(b.stderr)).toBe(0);
    const commit = JSON.parse(readFileSync(join(OUT, "version.json"), "utf8")).commit as string;
    expect(commit).toMatch(/^[0-9a-f]{7,40}$/);
    const pages = walk(OUT).filter((f) => f.endsWith(".html"));
    expect(pages.length).toBeGreaterThan(10);
    const bad: string[] = [];
    let refs = 0;
    for (const f of pages) { const html = readFileSync(f, "utf8"); refs += localRefs(html).length; for (const u of unversioned(html, commit)) bad.push(`${relative(OUT, f)}: ${u}`); }
    expect(refs).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });

  test("every shipped .js and .css file has its own Cache-Control: no-cache rule in _headers", () => {
    const rules = readFileSync(join(OUT, "_headers"), "utf8").replace(/\r/g, "").split("\n");
    const noCache = new Set<string>();
    for (let i = 0; i < rules.length; i++) {
      if (!rules[i]!.startsWith("/")) continue;
      for (let j = i + 1; j < rules.length && /^\s/.test(rules[j]!); j++) if (/^\s*Cache-Control:\s*no-cache\s*$/i.test(rules[j]!)) noCache.add(rules[i]!.trim());
    }
    const files = walk(OUT).filter((f) => /\.(js|css)$/.test(f)).map((f) => "/" + relative(OUT, f).split("\\").join("/"));
    expect(files.length).toBeGreaterThan(30);
    expect(files.filter((f) => !noCache.has(f))).toEqual([]);
  });
});
