// What is live, in one small file: pages/public/version.json = { commit, dirty, builtAt, game } plus { product, version, changes } from the repository's version.json, written by pages/build.mjs and served at /version.json.
// `commit` is the git commit the build was made from (short), `dirty` says whether files differed from it, `builtAt` is UTC. No secret, no person, no setting is ever put here.
import { execFileSync } from "node:child_process";

export function versionStamp({ root, game, run, now = () => new Date(), meta }) {
  const git = run ?? ((args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  let commit = "unknown", dirty = false;
  try { commit = git(["rev-parse", "--short=12", "HEAD"]); dirty = git(["status", "--porcelain", "--untracked-files=no"]).length > 0; } catch { /* built outside git: the stamp says so */ }
  const base = { commit, dirty, builtAt: now().toISOString(), game };
  // `meta` is the repository's version.json: the number and the last 20 changes in plain words (no secret, no person, no internal id).
  return meta && typeof meta.version === "string" ? { ...base, product: String(meta.product ?? game), version: meta.version, changes: Array.isArray(meta.changes) ? meta.changes.slice(0, 20).map((c) => ({ id: String(c.id), what: String(c.what), where: String(c.where), pr: String(c.pr) })) : [] } : base;
}
