// Planted-break checks (TEST AUTHOR). For each rule: copy the repo to a scratch folder, run its tests (must be GREEN), plant ONE deliberate break in the scratch copy, run the same tests (must go RED),
// put the file back, and at the end run the tests again (must be GREEN). The branch itself is never edited: the script also checks that `git status` shows no change to product code afterwards.
// Run one:  bun tools/breakchecks/<name>.mjs        Run all:  bash tools/breakchecks/run-all.sh
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const REPO = resolve(import.meta.dir, "../..");
const sh = (cmd, args, cwd) => spawnSync(cmd, args, { cwd, encoding: "utf8", timeout: 900_000, maxBuffer: 64 * 1024 * 1024 });
const count = (out, word) => Number((new RegExp(`^\\s*(\\d+) ${word}\\b`, "m").exec(out) ?? [0, 0])[1]);

function makeScratch() {
  const root = mkdtempSync(join(process.env.BREAKCHECK_TMP ?? tmpdir(), "breakcheck-"));
  const skip = new Set([".git", "node_modules", "results", ".wrangler", "dist"]);
  cpSync(REPO, root, { recursive: true, filter: (src) => !skip.has(src.split("/").pop()) || src === REPO });
  const link = (rel) => { const from = join(REPO, rel, "node_modules"); if (existsSync(from)) symlinkSync(from, join(root, rel, "node_modules")); };
  link(""); for (const d of ["packages", "apps", "tools"]) for (const n of readdirSync(join(REPO, d))) link(join(d, n));
  return root;
}
function runTests(scratch, tests) {
  const r = sh("bun", ["test", "--isolate", "--timeout", "120000", ...tests], scratch);
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  return { out, pass: count(out, "pass"), fail: count(out, "fail"), failed: [...out.matchAll(/^\(fail\) (.*?)(?: \[[\d.]+ms\])?$/gm)].map((m) => m[1]) };
}

/** id: name of the check. tests: test files (repo-relative). mutations: [{ file, from, to, all?, note }] each planted alone. */
export async function breakcheck({ id, tests, mutations }) {
  const logDir = join(REPO, "results", "breakchecks"); mkdirSync(logDir, { recursive: true });
  const logFile = join(logDir, id + ".log"); writeFileSync(logFile, "");
  const say = (s) => { console.log(s); appendFileSync(logFile, s + "\n"); };
  const scratch = makeScratch(); let bad = 0;
  say(`BREAKCHECK ${id}  (scratch copy: ${scratch}; tests: ${tests.join(", ")})`);
  try {
    const base = runTests(scratch, tests);
    say(`  baseline: ${base.fail === 0 && base.pass > 0 ? "GREEN" : "NOT GREEN"}  ${base.pass} pass, ${base.fail} fail`);
    if (base.fail !== 0 || base.pass === 0) { bad++; say("  the baseline must be green before a break means anything: " + base.failed.slice(0, 3).join(" | ")); }
    for (const [i, m] of mutations.entries()) {
      const path = join(scratch, m.file), original = readFileSync(join(REPO, m.file), "utf8");
      const n = original.split(m.from).length - 1;
      if (n === 0 || (n > 1 && !m.all)) { bad++; say(`  break ${i + 1} [${m.note}] NOT PLANTED: ${m.file} has ${n} copies of the text to change`); continue; }
      writeFileSync(path, m.all ? original.split(m.from).join(m.to) : original.replace(m.from, () => m.to));
      const r = runTests(scratch, tests);
      writeFileSync(path, original); // put the file back
      const red = r.fail > 0;
      if (!red) bad++;
      say(`  break ${i + 1}: ${m.note}  [${m.file}]  -> ${red ? "RED" : "STILL GREEN (the tests did not notice)"}  ${r.pass} pass, ${r.fail} fail`);
      for (const f of r.failed.slice(0, 3)) say(`      failing: ${f}`);
    }
    const after = runTests(scratch, tests);
    say(`  restored: ${after.fail === 0 ? "GREEN" : "NOT GREEN"}  ${after.pass} pass, ${after.fail} fail`);
    if (after.fail !== 0) bad++;
    const dirty = sh("git", ["status", "--porcelain", "--", "apps/edge/src", "apps/web/public", "packages/beacon/src", "packages/billing/src", "packages/shared/src", "pages", "config", "site"], REPO).stdout.trim();
    say(`  branch product code untouched: ${dirty === "" ? "yes" : "NO: " + dirty}`); if (dirty) bad++;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
  say(`RESULT ${id}: ${bad === 0 ? "every planted break was caught" : bad + " problem(s)"}`);
  if (bad) process.exitCode = 1;
}
