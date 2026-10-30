// Deliberate-break runner (test author's tool; it never edits the repo). For each mutation: copy the repo to a scratch folder, change ONE piece of product code there,
// run the named test file with `bun test --isolate`, and expect it to go RED; then run the same file on an unchanged copy and expect GREEN.
// Usage: bun tools/breakcheck/run.mjs [id ...]   (no ids = all).  Output: one JSON line per mutation, then a table.
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, symlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = join(import.meta.dir, "../..");
const E = "apps/edge/test/", W = "apps/web/test/";
/** { id, item, file, from, to, all?, test } : `from` must occur exactly once (or `all` times for all:true) so a mutation can never silently do nothing. */
export const MUTATIONS = [
  { id: "M1a", item: "1 account email: inner space accepted", file: "apps/edge/src/emailclean.ts", from: 'return /\\s/.test(v) ? "" : v; }', to: "return v; }", test: E + "audit141-email.test.ts" },
  { id: "M1b", item: "1 account email: regex lost its backslash (/s/)", file: "apps/edge/src/emailclean.ts", from: 'return /\\s/.test(v) ? "" : v; }', to: 'return /s/.test(v) ? "" : v; }', test: E + "audit141-email.test.ts" },
  { id: "M1c", item: "1 isTestLogin repairs inner spaces again", file: "apps/edge/src/testlogins.ts", from: 'TEST_LOGINS.has(cleanAccountEmail(String(email ?? "")))', to: 'TEST_LOGINS.has(String(email ?? "").normalize("NFKC").trim().replace(/\\s+/g, "").toLowerCase())', test: E + "audit141-email.test.ts" },
  { id: "M1d", item: "1 sign-in (/api/start) repairs inner spaces again", file: "apps/edge/src/worker.ts", from: 'const email = typeof b?.email === "string" ? cleanAccountEmail(b.email) : "";\n    if (!/^[^\\s@]{1,64}@[^\\s@]{1,255}\\.[^\\s@]{2,}$/.test(email)) return json({ error: "Please enter a valid e-mail address." }, 400);\n    const eh = await sha("email|" + email);\n    if (await env.DB.prepare("SELECT org FROM organizer_email WHERE email_hash=?").bind(eh).first()) { await holdPassForSignIn(env, eh, b?.pass, now); return json({ ok: true, exists: true }); }', to: 'const email = typeof b?.email === "string" ? b.email.normalize("NFKC").trim().replace(/\\s+/g, "").toLowerCase() : "";\n    if (!/^[^\\s@]{1,64}@[^\\s@]{1,255}\\.[^\\s@]{2,}$/.test(email)) return json({ error: "Please enter a valid e-mail address." }, 400);\n    const eh = await sha("email|" + email);\n    if (await env.DB.prepare("SELECT org FROM organizer_email WHERE email_hash=?").bind(eh).first()) { await holdPassForSignIn(env, eh, b?.pass, now); return json({ ok: true, exists: true }); }', test: E + "audit141-email.test.ts" },
  { id: "M1e", item: "1 participant Email ID stops removing inner spaces", file: "apps/edge/src/people.ts", from: "const k = cleanEmail(raw); if (!k) return \"\";", to: "const k = String(raw ?? \"\").normalize(\"NFKC\").trim().toLowerCase(); if (!k) return \"\";", test: E + "audit141-email.test.ts" },
  { id: "M3a", item: "3 email in an employee-ID box no longer refused (new reading)", file: "apps/edge/src/people.ts", from: "  if (clean && looksLikeEmail(raw)) return null;\n", to: "", test: E + "audit141-ids.test.ts" },
  { id: "M4a", item: "4 id-locked ignores LISTED people", file: "apps/edge/src/worker.ts", from: "&& (have?.c ?? 0) + (listed?.c ?? 0) > 0) return json({ error: \"You already have people listed.", to: "&& (have?.c ?? 0) > 0) return json({ error: \"You already have people listed.", test: E + "audit141-ids.test.ts" },
  { id: "M4b", item: "4 id-locked ignores JOINED people", file: "apps/edge/src/worker.ts", from: "&& (have?.c ?? 0) + (listed?.c ?? 0) > 0) return json({ error: \"You already have people listed.", to: "&& (listed?.c ?? 0) > 0) return json({ error: \"You already have people listed.", test: E + "audit141-ids.test.ts" },
  { id: "M4c", item: "4 id-locked removed", file: "apps/edge/src/worker.ts", from: "&& (have?.c ?? 0) + (listed?.c ?? 0) > 0) return json({ error: \"You already have people listed.", to: "&& false) return json({ error: \"You already have people listed.", test: E + "audit141-ids.test.ts" },
  { id: "M4d", item: "4 id-locked also refuses unchanged values", file: "apps/edge/src/worker.ts", from: "if ((cur.idKind !== (vc.cfg.idKind ?? \"emp\") || cur.mode !== (vc.cfg.verify ?? \"mobile\")) &&", to: "if (true &&", test: E + "audit141-ids.test.ts" },
  { id: "M6a", item: "idClean not sent by /info", file: "apps/edge/src/worker.ts", from: "idClean: empCleanFor(e), tickets: c.tickets,", to: "idClean: false, tickets: c.tickets,", test: E + "audit141-ids.test.ts" },
  { id: "M8a", item: "8 clone does not re-hash with the new game's rule", file: "apps/edge/src/clone.ts", from: "await copyPeople(env, e.id, id, e.cap, now, spend, { config: e.config ?? null, created_ms: now })", to: "await copyPeople(env, e.id, id, e.cap, now, spend)", test: E + "audit141-ids.test.ts" },
  { id: "M8b", item: "8 clone keeps a person the new rule refuses", file: "apps/edge/src/clone.ts", from: "if (pii?.empId && emp === null) continue;", to: "", test: E + "audit141-ids.test.ts" },
  { id: "M9a", item: "9 server accepts IDs longer than 30 after cleaning", file: "apps/edge/src/people.ts", from: "return s && s.length <= 30 ? s : null; }\n  const s = String", to: "return s && s.length <= 300 ? s : null; }\n  const s = String", test: E + "audit141-ids.test.ts", optional: true },
  { id: "M10a", item: "10 duplicate rows not named", file: "apps/edge/src/people.ts", from: 'duplicates++; duplicateRows.push({ raw, why: "Same person as an earlier row (the ID reads the same after cleaning)." }); continue;', to: "duplicates++; continue;", all: 3, test: E + "audit141-ids.test.ts" },
  { id: "M2a", item: "2 release gate removed from pages/build.mjs", file: "pages/build.mjs", from: 'if (process.env.RELEASE === "1") {', to: 'if (false) {', test: W + "audit141-release.test.ts" },
  { id: "M2b", item: "2 release gate lets the placeholder through", file: "pages/build.mjs", from: "Number(m[1]) >= 4102444800000", to: "Number(m[1]) >= 9999999999999", test: W + "audit141-release.test.ts" },
  { id: "M2c", item: "2 release gate ignores an empty releasedAtIST", file: "pages/build.mjs", from: "if (!r.releasedAtIST) throw", to: "if (false) throw", test: W + "audit141-release.test.ts" },
  { id: "M2d", item: "2 gate number pattern loses its backslash", file: "pages/build.mjs", from: "\\s*=\\s*(\\d+)", to: "\\s*=\\s*(d+)", test: W + "audit141-release.test.ts" },
  { id: "M2e", item: "2 phone says 'read this as' for any game (no idClean)", file: "apps/web/public/z.js", from: "else if (INFO.idClean) {", to: "else if (true) {", test: W + "audit141-screens.test.ts" },
  { id: "M2f", item: "2 console promises 'Dashes and spaces are ignored' for any game", file: "apps/web/public/zc.js", from: '(S.info && S.info.idClean ? " Dashes and spaces are ignored." : "")', to: '" Dashes and spaces are ignored."', test: W + "audit141-console.test.ts" },
  { id: "M2g", item: "2 /info drops idClean for the phone page", file: "apps/web/public/z.js", from: "INFO.idClean = r.idClean === true;", to: "INFO.idClean = false;", test: W + "audit141-screens.test.ts" },
  { id: "M3b", item: "3 email in an employee-ID box falls to 'read this as'", file: "apps/web/public/z.js", from: 'else if (nf.includes("@")) msg =', to: "else if (false) msg =", test: W + "audit141-screens.test.ts" },
  { id: "M5a", item: "5 new flow shows 'Which ID?' + preview again", file: "apps/web/public/zc-flow-game.js", from: "idKind: false", to: "idKind: true", test: W + "audit141-flow.test.ts" },
  { id: "M5b", item: "5 old console shows 'Which ID?' for mobile games", file: "apps/web/public/zc.js", from: '(f.ver === "mobile" ? "" : grp("idk", "Which ID?"', to: '(false ? "" : grp("idk", "Which ID?"', test: W + "audit141-console.test.ts" },
  { id: "M6b", item: "6 console duration line: no team rule, no cap", file: "apps/web/public/zc.js", from: '${f.gm === "team" ? "the first whole team is" : ep + (ep === 1 ? " player is" : " players are")} home. Whatever happens, it stops after ${tc} turns.', to: '${ep} ${ep === 1 ? "player is" : "players are"} home.', test: W + "audit141-console.test.ts" },
  { id: "M6c", item: "6 player chip loses the team rule and the cap", file: "apps/web/public/z.js", from: '`Turn ${turnNo} of ${v.turnCap} &middot; ends sooner when ${v.kind === "team" ? "the first whole team is" : v.endPrizes + (v.endPrizes === 1 ? " player is" : " players are")} home`', to: '`Turn ${turnNo} &middot; ends when ${v.endPrizes} ${v.endPrizes === 1 ? "player is" : "players are"} home`', test: W + "audit141-console.test.ts" },
  { id: "M7a", item: "7 new flow shows the feed and asks for /gamelog", file: "apps/web/public/zc-flow-game.js", from: "feed: false", to: "feed: true", test: W + "audit141-flow.test.ts" },
  { id: "M7b", item: "7 a gamelog link comes back into a page", file: "apps/web/public/z.html", from: "</body>", to: '<a href="/pack/gamelog.html">log</a></body>', test: W + "audit141-flow.test.ts" },
  { id: "M9b", item: "9 maxlength=30 back on the ID box", file: "apps/web/public/z.js", from: `'autocomplete="off" autocapitalize="characters"'`, to: `'autocomplete="off" autocapitalize="characters" maxlength="30"'`, test: W + "audit141-screens.test.ts" },
  { id: "M10b", item: "10 console summary drops the duplicate names", file: "apps/web/public/zc.js", from: 'for (const x of r.duplicateRows || []) dupNames.push(String(x.raw || "").slice(0, 60));', to: "", test: W + "audit141-console.test.ts" },
  { id: "M11a", item: "11 internal note back in release.json", file: "apps/web/public/release.json", from: '"releasedAtIST":""}', to: '"releasedAtIST":"","note":"TEST_HANDOFF: fix item 7"}', test: W + "audit141-release.test.ts" },
  { id: "M12a", item: "12 sound default off again", file: "apps/web/public/z.js", from: 'store.get("cbz-sound") !== "off"', to: 'store.get("cbz-sound") === "on"', test: W + "audit141-release.test.ts" },
];

function copyRepo() {
  const d = mkdtempSync(join(tmpdir(), "brk141-"));
  cpSync(ROOT, d, { recursive: true, filter: (s) => s !== join(ROOT, ".git") && !s.startsWith(join(ROOT, ".git") + "/") && s !== join(ROOT, "node_modules") && !s.startsWith(join(ROOT, "node_modules") + "/") && !/\/pages\/public(\/|$)/.test(s) });
  symlinkSync(join(ROOT, "node_modules"), join(d, "node_modules"));
  return d;
}
function last(out) { // numbers from the last summary lines only
  const p = [...out.matchAll(/^\s*(\d+) pass\s*$/gm)].pop(), f = [...out.matchAll(/^\s*(\d+) fail\s*$/gm)].pop();
  return { pass: p ? Number(p[1]) : null, fail: f ? Number(f[1]) : null };
}
function bun(dir, test) { const r = spawnSync("bun", ["test", "--isolate", test], { cwd: dir, encoding: "utf8", timeout: 600_000, maxBuffer: 512 * 1024 * 1024 }); const out = (r.stdout ?? "") + (r.stderr ?? ""); if (process.env.BREAK_DEBUG) console.log(out.slice(-1500)); return last(out); }

const want = process.argv.slice(2), rows = [];
for (const m of MUTATIONS) {
  if (want.length && !want.includes(m.id)) continue;
  const d = copyRepo();
  try {
    const f = join(d, m.file), src = readFileSync(f, "utf8"), n = src.split(m.from).length - 1;
    if (n !== (m.all ?? 1)) { rows.push({ id: m.id, item: m.item, error: `from-text occurs ${n} times, expected ${m.all ?? 1}` }); continue; }
    writeFileSync(f, src.split(m.from).join(m.to));
    const red = bun(d, m.test);
    writeFileSync(f, src);
    const green = bun(d, m.test);
    rows.push({ id: m.id, item: m.item, file: m.file, test: m.test.split("/").pop(), broken: red, restored: green, ok: (red.fail ?? 0) > 0 && green.fail === 0 });
  } finally { rmSync(d, { recursive: true, force: true }); }
  console.log(JSON.stringify(rows[rows.length - 1]));
}
console.log("\n| id | what was broken | file | broken (pass/fail) | restored (pass/fail) | red then green |\n|---|---|---|---|---|---|");
for (const r of rows) console.log(r.error ? `| ${r.id} | ${r.item} | | ${r.error} | | NO |` : `| ${r.id} | ${r.item} | ${r.file} | ${r.broken.pass}/${r.broken.fail} | ${r.restored.pass}/${r.restored.fail} | ${r.ok ? "yes" : "NO"} |`);
process.exitCode = rows.every((r) => r.ok) ? 0 : 1;
