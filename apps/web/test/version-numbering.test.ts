// Version numbering (owner standard, 20 Nov 2026): one number, in version.json, every package file, release.json, the changelog and the knowledge file; the build carries it to /version.json.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
// @ts-ignore (plain .mjs next to the build script)
import { versionStamp } from "../../../pages/version.mjs";

const ROOT = join(import.meta.dir, "../../..");
const rd = (p: string) => readFileSync(join(ROOT, p), "utf8");
const json = (p: string) => JSON.parse(rd(p));
const SEMVER = /^\d+\.\d+\.\d+$/;

describe("one version number everywhere", () => {
  const v = json("version.json");
  test("version.json holds the product, a number and at most the last 20 changes, each in plain words with where and which pull request", () => {
    expect(v.product).toBe("Corporate Snakes and Ladders"); expect(v.version).toMatch(SEMVER);
    expect(v.changes.length).toBeGreaterThan(0); expect(v.changes.length).toBeLessThanOrEqual(20);
    for (const c of v.changes) for (const k of ["id", "what", "where", "pr"]) expect([c.id, k, typeof c[k] === "string" && c[k].length > 1]).toEqual([c.id, k, true]);
    expect(JSON.stringify(v)).not.toMatch(/secret|password|token|\bkey\b/i); // the file is served to everyone
  });
  test("the package files, the footer line (release.json) and the owner's release list carry the same number", () => {
    for (const p of ["package.json", "packages/beacon/package.json", "packages/billing/package.json", "packages/shared/package.json", "apps/edge/package.json"]) expect([p, json(p).version]).toEqual([p, v.version]);
    expect(json("apps/web/public/release.json").version).toBe(v.version);
    expect(json("apps/edge/src/releases.json")[0].version).toBe(v.version);
  });
  test("the changelog and the knowledge file say this version, newest first", () => {
    const c = rd("CHANGELOG.md"); const first = c.match(/^## (\d+\.\d+\.\d+)/m); expect(first![1]).toBe(v.version);
    expect(c.indexOf(`## ${v.version}`)).toBeLessThan(c.indexOf("## Live now"));
    for (const w of ["Added", "Changed", "Fixed", "Rollback id", "Audit PASS ids"]) expect(c).toContain(w);
    const k = rd("docs/KNOWLEDGE.md"); expect(k).toContain(v.version); expect(k).toContain("OWNER_RULES"); expect(k).toContain("/api/console/paid");
  });
  test("the build copies the number and the changes into /version.json, and nothing else new", () => {
    const s = versionStamp({ root: ROOT, game: "g", now: () => new Date("2026-11-22T10:00:00Z"), run: (a: string[]) => (a[0] === "rev-parse" ? "abc123def456" : ""), meta: { ...v, changes: Array.from({ length: 25 }, (_, i) => ({ id: "c" + i, what: "w", where: "x", pr: "1" })) } });
    expect(Object.keys(s).sort()).toEqual(["builtAt", "changes", "commit", "dirty", "game", "product", "version"]); expect(s.version).toBe(v.version); expect(s.changes.length).toBe(20);
    expect(Object.keys(versionStamp({ root: ROOT, game: "g", run: () => "abc123def456" })).sort()).toEqual(["builtAt", "commit", "dirty", "game"]); // without the file: as before
    const r = Bun.spawnSync([process.execPath, "pages/build.mjs"], { cwd: ROOT, stdout: "pipe", stderr: "pipe" }); expect(r.exitCode).toBe(0);
    const live = json("pages/public/version.json"); expect(live.version).toBe(v.version); expect(live.changes[0].id).toBe(v.changes[0].id);
  });
});
