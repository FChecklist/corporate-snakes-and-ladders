// Reads the raw logs in results/<dir>/*.log and prints: totals copied from each log, per-file pass/fail counts, and for every failing test its name and the first 8 error lines.
// Usage: bun tools/breakchecks/summarize.mjs results/final [--tests-only-mine]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
const dir = process.argv[2] ?? "results/final";
const only = process.argv.includes("--mine") ? /\/t30-|scenarios\/matrix\// : null;
const out = [];
let P = 0, F = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith(".log")).sort()) {
  const lines = readFileSync(join(dir, f), "utf8").split("\n");
  const pass = lines.map((l) => /^ *(\d+) pass$/.exec(l)).find(Boolean)?.[1], fail = lines.map((l) => /^ *(\d+) fail$/.exec(l)).find(Boolean)?.[1], ran = lines.find((l) => l.startsWith("Ran "));
  out.push(`### ${f}\nraw: ${pass ?? "?"} pass, ${fail ?? "?"} fail. ${ran ?? ""}`); P += Number(pass ?? 0); F += Number(fail ?? 0);
  const perFile = new Map(); let cur = "?";
  lines.forEach((l, i) => {
    const h = /^([\w./@-]+\.test\.\w+):$/.exec(l); if (h) cur = h[1];
    const t = /^\((pass|fail)\) /.exec(l); if (t) { const r = perFile.get(cur) ?? { pass: 0, fail: 0 }; r[t[1]]++; perFile.set(cur, r); }
  });
  out.push("| test file | pass | fail |\n|---|---|---|"); for (const [k, v] of perFile) if (!only || only.test("/" + k)) out.push(`| ${k} | ${v.pass} | ${v.fail} |`);
  const fails = [];
  lines.forEach((l, i) => {
    const m = /^\(fail\) (.*?)(?: \[[\d.]+ms\])?$/.exec(l); if (!m) return;
    let j = i - 1; const block = [];
    while (j >= 0 && !/^\(pass\)|^\(fail\)/.test(lines[j]) && !/^\d+ \|/.test(lines[j]) && !/^\s*\^+\s*$/.test(lines[j]) && !/^[\w./@-]+\.test\.\w+:$/.test(lines[j])) { if (lines[j].trim()) block.unshift(lines[j]); j--; }
    let file = "?"; for (let k = i; k >= 0; k--) { const h = /^([\w./@-]+\.test\.\w+):$/.exec(lines[k]); if (h) { file = h[1]; break; } }
    fails.push({ name: m[1], file, err: block.slice(0, 8) });
  });
  for (const x of fails) { out.push(`\nFAIL ${x.file} :: ${x.name}`); for (const e of x.err) out.push("    " + e.slice(0, 220)); }
  out.push("");
}
out.push(`TOTAL copied from the logs: ${P} pass, ${F} fail`);
console.log(out.join("\n"));
