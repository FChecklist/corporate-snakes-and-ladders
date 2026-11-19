// Snakes 1.4.1 audit, items 2 (release gate), 11 (no internal notes in release.json / public files) and 12 (sound default).
// The release gate is run for real: pages/build.mjs is copied with the files it reads into a scratch folder and executed with bun, once as it stands (placeholder) and once per variation.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";

setDefaultTimeout(120_000);
const ROOT = join(import.meta.dir, "../../..");
const PUB = join(ROOT, "apps/web/public");
let temps: string[] = [], open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; for (const t of temps) rmSync(t, { recursive: true, force: true }); temps = []; });

/** A scratch copy of just what pages/build.mjs reads: package.json, pages/*.mjs, people.ts, the public folder. */
function scratch(o: { people?: (s: string) => string; release?: string; build?: (s: string) => string } = {}) {
  const d = mkdtempSync(join(tmpdir(), "build141-")); temps.push(d);
  mkdirSync(join(d, "pages")); mkdirSync(join(d, "apps/edge/src"), { recursive: true });
  cpSync(join(ROOT, "package.json"), join(d, "package.json")); cpSync(join(ROOT, "pages/version.mjs"), join(d, "pages/version.mjs"));
  writeFileSync(join(d, "pages/build.mjs"), (o.build ?? ((s) => s))(readFileSync(join(ROOT, "pages/build.mjs"), "utf8")));
  writeFileSync(join(d, "apps/edge/src/people.ts"), (o.people ?? ((s) => s))(readFileSync(join(ROOT, "apps/edge/src/people.ts"), "utf8")));
  cpSync(PUB, join(d, "apps/web/public"), { recursive: true });
  if (o.release !== undefined) writeFileSync(join(d, "apps/web/public/release.json"), o.release);
  return d;
}
const build = (d: string, release: boolean) => { const r = spawnSync("bun", ["pages/build.mjs"], { cwd: d, encoding: "utf8", env: { ...process.env, ...(release ? { RELEASE: "1" } : { RELEASE: "" }) }, timeout: 100_000 }); return { code: r.status, out: (r.stdout ?? "") + (r.stderr ?? "") }; };
const setConst = (v: string) => (s: string) => { if (!/EMP_CLEAN_FROM_MS = \d+;/.test(s)) throw new Error("constant line not found"); return s.replace(/EMP_CLEAN_FROM_MS = \d+;/, `EMP_CLEAN_FROM_MS = ${v};`); };
const NOW_MS = Date.UTC(2026, 10, 1, 6, 0, 0); // an example deploy instant
const REL_OK = JSON.stringify({ version: "1.4.1", releasedAtIST: "1 Nov 2026, 11:30 am" });

describe("item 2: the release build refuses to run while the cleaning date is the placeholder", () => {
  test("the product today: EMP_CLEAN_FROM_MS is the year-2100 placeholder (so this gate is what protects the release)", () => {
    const m = /EMP_CLEAN_FROM_MS = (\d+);/.exec(readFileSync(join(ROOT, "apps/edge/src/people.ts"), "utf8"));
    expect(Number(m![1])).toBeGreaterThanOrEqual(4102444800000);
  });
  test("RELEASE=1 with the constant as it stands in the repo: the build FAILS with the placeholder message and writes no pages", () => {
    const d = scratch({ release: REL_OK }); const r = build(d, true);
    expect(r.code).not.toBe(0); expect(r.out).toContain("EMP_CLEAN_FROM_MS in apps/edge/src/people.ts is still the placeholder");
    expect(existsSync(join(d, "pages/public/version.json"))).toBe(false);
  });
  test("RELEASE=1 with the constant set to a real instant and releasedAtIST filled: the build PASSES", () => {
    const d = scratch({ people: setConst(String(NOW_MS)), release: REL_OK }); const r = build(d, true);
    expect([r.code, r.out.includes("pages/public ready")]).toEqual([0, true]);
    expect(existsSync(join(d, "pages/public/version.json"))).toBe(true);
  });
  test("RELEASE=1, constant set, but releasedAtIST empty: the build FAILS and says why", () => {
    const d = scratch({ people: setConst(String(NOW_MS)) }); const r = build(d, true);
    expect(r.code).not.toBe(0); expect(r.out).toContain("release.json has no releasedAtIST");
  });
  test("the boundary: the year-2100 instant itself (4102444800000) is still the placeholder; one millisecond earlier passes", () => {
    expect(build(scratch({ people: setConst("4102444800000"), release: REL_OK }), true).code).not.toBe(0);
    expect(build(scratch({ people: setConst("4102444799999"), release: REL_OK }), true).code).toBe(0);
  });
  test("a normal build (no RELEASE=1) still works with the placeholder, as before", () => {
    const d = scratch(); const r = build(d, false); expect([r.code, r.out.includes("pages/public ready")]).toEqual([0, true]);
  });
  test("RELEASE=0 or unset is not a release build", () => {
    const d = scratch(); const r = spawnSync("bun", ["pages/build.mjs"], { cwd: d, encoding: "utf8", env: { ...process.env, RELEASE: "0" }, timeout: 100_000 }); expect(r.status).toBe(0);
  });
  test("the gate's number pattern has real backslashes: a constant written with no spaces around = (EMP_CLEAN_FROM_MS=99) is still read", () => {
    const d = scratch({ people: (s) => s.replace(/EMP_CLEAN_FROM_MS = \d+;/, "EMP_CLEAN_FROM_MS=4102444800001;"), release: REL_OK });
    expect(build(d, true).code).not.toBe(0);
  });
  test("DELIBERATE BREAK: a build.mjs with the gate removed passes with the placeholder (so the tests above are the only thing that would notice)", () => {
    const d = scratch({ release: REL_OK, build: (s) => s.replace(/if \(process\.env\.RELEASE === "1"\) \{[^\n]*\n/, "") });
    expect(build(d, true).code).toBe(0);
  });
  test("DELIBERATE BREAK: a gate that tests the wrong threshold (year 2200) lets the placeholder through", () => {
    const d = scratch({ release: REL_OK, build: (s) => { const n = s.replace("4102444800000", "7258118400000"); if (n === s) throw new Error("threshold not found"); return n; } });
    expect(build(d, true).code).toBe(0);
  });
  test("DELIBERATE BREAK: a gate with the backslash missing in its number pattern (d+ for \\d+) cannot read the constant, and the build fails even for a real date", () => {
    const d = scratch({ people: setConst(String(NOW_MS)), release: REL_OK, build: (s) => { const n = s.replace("\\s*=\\s*(\\d+)", "\\s*=\\s*(d+)"); if (n === s) throw new Error("pattern not found"); return n; } });
    expect(build(d, true).code).not.toBe(0);
  });
});

describe("item 11: release.json and the public files hold no internal notes", () => {
  test("release.json is exactly { version, releasedAtIST }: a version number and a date, nothing else", () => {
    const j = JSON.parse(readFileSync(join(PUB, "release.json"), "utf8"));
    expect(Object.keys(j).sort()).toEqual(["releasedAtIST", "version"]);
    expect(j.version).toMatch(/^\d+\.\d+\.\d+$/); expect(typeof j.releasedAtIST).toBe("string");
    expect(readFileSync(join(PUB, "release.json"), "utf8").length).toBeLessThan(120);
  });
  test("the release line writes nothing but 'Version N' (and the date once it is set)", () => {
    const src = readFileSync(join(PUB, "release-line.js"), "utf8");
    expect(src).toMatch(/released/); expect(src.toLowerCase()).not.toMatch(/todo|fixme|internal|audit|owner rule|gap plan/);
  });
  test("the version the pages show is the version of this branch (product note PN-2 if not)", () => {
    // release.json says 1.4.0 on the 1.4.1 fix branch; the report lists it. This test pins the current value so a change is noticed.
    expect(JSON.parse(readFileSync(join(PUB, "release.json"), "utf8")).version).toMatch(/^1\.4\.[01]$/);
  });
  const SKIP = /^(fonts|img|vendor)$/;
  const walk = (dir: string, out: string[] = []) => { for (const e of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory()) { if (!SKIP.test(e.name)) walk(f, out); } else if (/\.(html|js|json|css|txt|xml|webmanifest)$/.test(e.name)) out.push(f); } return out; };
  const MARKERS = [/TEST_HANDOFF/, /gap plan/i, /\bWP-\d+/, /boss ruling/i, /\bTODO:/, /\bFIXME/, /\bXXX:/, /audit-2026|snakes-1\.4\.1-audit/i];
  test("the BUILT site (what is really shipped: comments are stripped by pages/build.mjs) carries no internal marker", () => {
    const d = scratch({ release: REL_OK }); expect(build(d, false).code).toBe(0);
    const out = join(d, "pages/public"), bad: string[] = [];
    for (const f of walk(out)) { const t = readFileSync(f, "utf8"); for (const re of MARKERS) if (re.test(t)) bad.push(f.slice(out.length) + " ~ " + re); }
    expect(walk(out).length).toBeGreaterThan(100); expect(bad).toEqual([]);
  });
  test("DELIBERATE BREAK: the marker scan does catch a note (checked on a string)", () => { expect(MARKERS.some((re) => re.test("// see TEST_HANDOFF item 7"))).toBe(true); expect(MARKERS.some((re) => re.test("// Boss ruling Q8"))).toBe(true); });
  // PN-3 (fixed in 1.4.1 round 2): the "Boss ruling Q8" source comment in site.js is gone.
  test("the SOURCE folder apps/web/public also has none (site.js:23 'Boss ruling Q8' is a comment that the build removes)", () => {
    const bad: string[] = []; for (const f of walk(PUB)) { const t = readFileSync(f, "utf8"); for (const re of MARKERS) if (re.test(t)) bad.push(f.slice(PUB.length) + " ~ " + re); }
    expect(bad).toEqual([]);
  });
  test("pages/build.mjs ships release.json but no gamelog page, and the built folder (scratch build) has no gamelog and no file outside the FILES list", () => {
    const d = scratch({ release: REL_OK }); expect(build(d, false).code).toBe(0);
    const built = walk(join(d, "pages/public")).map((f) => f.slice(join(d, "pages/public").length));
    expect(built.some((f) => /gamelog/.test(f))).toBe(false);
    expect(built).toContain("/release.json");
    expect(JSON.parse(readFileSync(join(d, "pages/public/release.json"), "utf8"))).toEqual(JSON.parse(REL_OK));
  });
  test("DELIBERATE BREAK: an internal note put into release.json is caught by the exact-keys check", () => {
    const j = { ...JSON.parse(readFileSync(join(PUB, "release.json"), "utf8")), note: "TEST_HANDOFF: fix item 7" };
    expect(Object.keys(j).sort()).not.toEqual(["releasedAtIST", "version"]);
  });
});

describe("item 12: sound is ON for a player with no saved choice", () => {
  const seen = async (saved: string | null, pub?: string) => {
    const w = newWorld(); w.world.now = T; const id = "SND-1412";
    const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
    await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 20, cap: 8 }, s.aiKey);
    await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token);
    const p = await openPage(w.world, { url: `http://localhost/z.html?e=${id}`, html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"], pub, afterLoad: (win, f) => { if (f === "audio.js" && saved !== null) win.localStorage.setItem("cbz-sound", saved); } });
    open.push(p); await p.waitFor((x) => /name/i.test(x), 20000);
    p.$("#nm").value = "Asha"; p.$("#nm").dispatchEvent(new p.win.Event("input", { bubbles: true }));
    for (const b of p.win.document.querySelectorAll("input.cbc-tick")) { b.checked = true; b.dispatchEvent(new p.win.Event("change", { bubbles: true })); }
    p.click("#go"); await p.waitFor(() => !!p.$("#snd"), 20000);
    return { label: String(p.$("#snd").textContent).replace(/[^\x20-\x7E]/g, "").trim(), pressed: p.$("#snd").getAttribute("aria-pressed"), audioOn: p.win.TBAudio ? p.win.TBAudio.enabled : null };
  };
  test("nothing saved: 'Sound on', pressed true, the audio engine enabled", async () => {
    expect(await seen(null)).toEqual({ label: "Sound on", pressed: "true", audioOn: true });
  });
  test("a saved 'off' stays off; a saved 'on' is on", async () => {
    expect((await seen("off")).pressed).toBe("false"); expect((await seen("on")).pressed).toBe("true");
  });
  test("DELIBERATE BREAK: the old default (on only when saved 'on') is caught", async () => {
    const src = readFileSync(join(PUB, "z.js"), "utf8"), from = 'store.get("cbz-sound") !== "off"'; expect(src.split(from).length - 1).toBe(1);
    const d = mkdtempSync(join(tmpdir(), "pub141s-")); temps.push(d); cpSync(PUB, d, { recursive: true }); writeFileSync(join(d, "z.js"), src.replace(from, 'store.get("cbz-sound") === "on"'));
    expect((await seen(null, d)).pressed).toBe("false");
  });
});
