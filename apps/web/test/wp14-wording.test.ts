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

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// WP-15 wording sweep (SL-22, SL-23): the owner's rules in docs-games/ALL_GAMES_CARRY_TAMBOLA_RULES.md. Legal documents (terms, dpa, legal-position, privacy, ...) are NOT edited
// for wording without the lawyer, so the "engagement" / "closed-group" checks skip them; "private" and the hour figures are checked everywhere.
const LEGAL = /(^|\/)(terms|dpa|legal-position|legal|privacy|subprocessors|partner-terms|refund-policy|trust)\.html$/;
const stripComments = (js: string) => js.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");
const textFiles = ["mails.ts", "ai-facts.ts", "ai-go.ts", "ai-link.ts", "ai-functions.ts", "pay.ts", "partners.ts", "report-layout.ts", "trust-page.ts", "legal.ts", "worker.ts", "helpdesk.ts", "brand.ts", "owner-mail.ts", "cancel.ts", "credit.ts", "errorbox.ts", "hostsetup.ts", "people.ts", "rights.ts", "winners.ts", "clone.ts", "checkin.ts", "lifecycle.ts"];
const edgeText = textFiles.map((f) => ({ file: `apps/edge/src/${f}`, raw: stripComments(readFileSync(join(ROOT, "apps/edge/src", f), "utf8")) }));
const jsText = scripts.map((s) => ({ file: s.file, raw: stripComments(s.raw) }));
const configText = ["config.ts", "race.ts", "schedule.ts", "board.ts", "table.ts"].map((f) => ({ file: `packages/beacon/src/${f}`, raw: stripComments(readFileSync(join(ROOT, "packages/beacon/src", f), "utf8")) }));

describe("WP-15 / SL-23: the word 'private' is never shown to anyone", () => {
  test("not in any page, any page script, any mail, report or manual text", () => {
    expect([...hits(/\bprivate\b/gi, pages, true), ...hits(/\bprivate\b/gi, jsText), ...hits(/\bprivate\b/gi, edgeText), ...hits(/\bprivate\b/gi, configText)]).toEqual([]);
  });
});

describe("WP-15 / SL-22: plain words for players and organizers", () => {
  test("'engagement' appears only in the approved phrase 'online engagement' (legal documents excepted); Worker error messages say 'game'", () => {
    const strip = (t: string) => t.replace(/online engagement/gi, "");
    const nonLegal = pages.filter((p) => !LEGAL.test(p.file));
    const pageHits = hits(/\bengagement\b/gi, nonLegal.map((p) => ({ file: p.file, raw: strip(visible(p.raw)) })));
    const jsHits = hits(/\bengagement\b/gi, jsText.map((p) => ({ file: p.file, raw: strip(p.raw) })).filter((p) => !/guide\.js$/.test(p.file)));
    expect([...pageHits, ...jsHits]).toEqual([]);
    const w = readFileSync(join(ROOT, "apps/edge/src/worker.ts"), "utf8");
    const msgs = [...w.matchAll(/error: ([`"])((?:\\.|(?!\1).)*?)\1/g)].map((m) => m[2]).filter((t) => /\bengagements?\b/i.test(t));
    expect(msgs).toEqual([]);
  });
  test("the error guide says 'board', never 'ticket', in what a person reads (title, what happened, what to do)", () => {
    const g = readFileSync(join(ROOT, "apps/web/public/guide.js"), "utf8");
    const read: string[] = [];
    for (const line of g.split(/\r?\n/)) {
      for (const m of line.matchAll(/\b[tw]: "((?:[^"\\]|\\.)*)"/g)) read.push(m[1]!);
      for (const m of line.matchAll(/\bd: \[((?:[^\]"]|"(?:[^"\\]|\\.)*")*)\]/g)) read.push(m[1]!);
    }
    expect(read.length).toBeGreaterThan(100);
    expect(read.filter((t) => /\btickets?\b/i.test(t))).toEqual([]);
  });
  test("no 'decided by fate' and no 'closed-group' on player and organizer pages", () => {
    const a = hits(/decided by fate/gi, [...jsText, ...edgeText, ...configText]);
    const b = hits(/\bclosed-group\b/gi, jsText);
    const c = hits(/\bclosed-group\b/gi, pages.filter((p) => !LEGAL.test(p.file)), true);
    expect([...a, ...b, ...c]).toEqual([]);
  });
});

describe("WP-15 / Q6: the hours printed on pages are the ones the lifecycle really uses (no window is changed)", () => {
  test("no '22 hours' / '23 hours' anywhere; the report link and the erase job are quoted from lifecycle.ts's own constants", async () => {
    const all = [...pages.map((p) => ({ file: p.file, raw: visible(p.raw) })), ...jsText, ...edgeText];
    expect(hits(/\b(?:22|23)[- ]hours?\b/gi, all)).toEqual([]);
    const { REPORT_LINK_MS, PURGE_AFTER_MS } = await import(join(ROOT, "apps/edge/src/lifecycle.ts"));
    const link = REPORT_LINK_MS / 3_600_000, job = PURGE_AFTER_MS / 3_600_000;
    const guide = visible(readFileSync(join(ROOT, "apps/web/public/organizer-guide.html"), "utf8")), priv = visible(readFileSync(join(ROOT, "apps/web/public/privacy.html"), "utf8"));
    expect(guide).toContain(`report link works for ${link} hours`);
    expect(priv).toContain(`job runs at ${job} hours`);
  });
});
