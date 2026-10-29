// WP-14 / WP-15 wording guards (gap plan 2026-10-29). Each fails if the old wording comes back. Set GUARD_ROOT to point the scan at another checkout (used to prove the guards fail on the old code).
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.env.GUARD_ROOT || join(import.meta.dir, "../../..");
const list = (dir: string, ext: RegExp) => readdirSync(join(ROOT, dir)).filter((f) => ext.test(f)).map((f) => ({ file: `${dir}/${f}`, raw: readFileSync(join(ROOT, dir, f), "utf8") }));
const pages = [...list("apps/web/public", /\.html$/), ...list("site", /\.html$/)];
const scripts = list("apps/web/public", /\.js$/).filter((s) => !/^(reportgen|control|zgame|autoupdate)\.js$/.test(s.file.split("/").pop()!));
const visible = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const hits = (re: RegExp, sources: { file: string; raw: string }[], text = false) => sources.flatMap((s) => [...(text ? visible(s.raw) : s.raw).matchAll(re)].map((m) => `${s.file}: ${m[0]}`));

describe("SL-02: the dice roll by themselves by default; no page tells players to tap to throw", () => {
  test("no page or script says 'tap to throw', 'press the dice inside the window' as the normal way, or 'Throw the dice in 20 seconds'", () => {
    const re = /\btaps? to (?:throw|roll)\b|\bpress the dice inside the window\b|\bThrow the dice in 20 seconds\b|\bThrow in 20 seconds\b|\bTap to throw\b/gi;
    expect([...hits(re, pages, true), ...hits(re, scripts)]).toEqual([]);
  });
});
