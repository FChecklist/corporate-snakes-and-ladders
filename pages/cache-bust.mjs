// Cache safety for returning visitors (31 Oct 2026). Without this a browser that has an old script cached (Cloudflare Pages gives a plain asset 4 hours) runs it against new HTML after a release and the page breaks.
// 1. versionRefs: every local script and stylesheet reference in every shipped HTML page gets ?v=<commit>, so a new release means new addresses.
// 2. noCacheRules: an explicit "Cache-Control: no-cache" rule for every shipped .js and .css file (the suffix form "/*.js" is not honoured by Cloudflare Pages, so each file is named). The browser then checks with the server each time (a cheap 304).
// Images and fonts keep their long cache (their rules are written elsewhere in the build).
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
const REF = /(<script\b[^>]*?\bsrc=|<link\b[^>]*?\bhref=)"(\/[^"?#]+\.(?:js|css))(\?[^"#]*)?"/g;

export function versionRefs(outDir, commit) {
  if (!/^[0-9a-f]{7,40}$/.test(commit)) throw new Error("cache-bust: the commit is not a hex id: " + commit);
  let n = 0;
  for (const f of walk(outDir).filter((x) => x.endsWith(".html"))) {
    const s = readFileSync(f, "utf8");
    const t = s.replace(REF, (_m, pre, path, q) => {
      n++;
      const params = (q || "").replace(/^\?/, "").split("&").filter((p) => p && !/^v=/.test(p));
      params.push("v=" + commit);
      return `${pre}"${path}?${params.join("&")}"`;
    });
    if (t !== s) writeFileSync(f, t);
  }
  return n;
}

export function noCacheRules(outDir) {
  let rules = "";
  for (const f of walk(outDir).sort()) {
    if (!/\.(js|css)$/.test(f)) continue;
    rules += `/${relative(outDir, f).split("\\").join("/")}\n  Cache-Control: no-cache\n`;
  }
  return rules;
}
