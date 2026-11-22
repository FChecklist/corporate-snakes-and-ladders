// Owner rules 1.1 (20 Nov 2026) on the pages: the organizer and host screens speak to "you" (never I, my, me, myself), prices carry the rupee sign, the two fixed sentences
// (privacy and fairness) are on the pages word for word, and no claim nobody can prove is made. Plain file scans: no browser is needed.
import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { FAIRNESS_LINE, FORBIDDEN_CLAIMS, PRIVACY_LINE } from "../../../packages/shared/src/lines";

const ROOT = join(import.meta.dir, "../../..");
const PUB = join(ROOT, "apps/web/public");
const rd = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

/** Every screen an organizer, a Host or a Co-host reads. (The player pages z.js and big.js speak to players and are not listed. consent.js holds the recorded tick-box sentences: see the note in the last test.) */
export const ORGANIZER_FILES = ["zc.js", "zc-flow-game.js", "zc-modelink.js", "zc.html", "guide.js", "pay.js", "pay.html", "paylink.js", "paylink.html", "payfields.js", "paykit.js", "signin.js", "signin.html", "ai-link.js", "ai-link.html", "helpdesk.js", "helpdesk.html", "helpdesk-accept.js", "helpdesk-accept.html", "helpdesk-approve.js", "helpdesk-approve.html", "brandkit.js", "screenrules.js", "funnel.js", "organizer-guide.html"];

const FIRST_PERSON = /(?<![\w.'/-])(I|I'll|I'm|I've|I'd|[Mm]y|[Mm]e|[Mm]yself|[Mm]ine)(?![\w-])/g;
/** The words a person can read in a file: the text of quoted strings and template texts in a script (template ${...} holes and tags removed), or the text outside tags, scripts and styles in a page. */
export function visibleText(file: string, src: string): { line: number; text: string }[] {
  const out: { line: number; text: string }[] = [];
  if (file.endsWith(".html")) { src.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<style[\s\S]*?<\/style>/g, " ").split("\n").forEach((l, i) => { const t = l.replace(/<[^>]+>/g, " "); if (t.trim()) out.push({ line: i + 1, text: t }); }); return out; }
  src.split("\n").forEach((line, i) => {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const parts: string[] = []; const re = /"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g; let m: RegExpExecArray | null;
    while ((m = re.exec(line))) parts.push((m[1] ?? m[2] ?? m[3] ?? "").replace(/\$\{[^}]*\}/g, " ").replace(/<[^>]+>/g, " "));
    if (parts.length) out.push({ line: i + 1, text: parts.join(" | ") });
  });
  return out;
}
export const firstPersonIn = (file: string, src: string) => visibleText(file, src).flatMap(({ line, text }) => [...text.matchAll(FIRST_PERSON)].map((m) => `${file}:${line}: "${m[1]}" in ${text.trim().slice(0, 90)}`));

describe("console voice: the organizer and host screens say you, never I, my, me or myself", () => {
  test("the scan itself works: it catches the sentences the owner listed as wrong", () => {
    for (const bad of ['h = "Add to my list";', "const t = `Manual: I'll set each prize myself`;", 'x = "3 people are on my list"', "y = 'Press Start when I am ready'", 'z = "Send me a code"']) expect(firstPersonIn("t.js", bad).length).toBeGreaterThan(0);
    for (const ok of ['h = "Add to your list";', "const me = ctx.me; const I = 1;", 'x = "/api/z/people/me"', 'y = "Your people"']) expect(firstPersonIn("t.js", ok)).toEqual([]);
  });
  test("every organizer and host file that exists is free of first-person words", () => {
    const present = ORGANIZER_FILES.filter((f) => readdirSync(PUB).includes(f)); expect(present.length).toBeGreaterThan(15);
    const hits = present.flatMap((f) => firstPersonIn(f, readFileSync(join(PUB, f), "utf8")));
    expect(hits).toEqual([]);
  });
  test("the texts the server sends to the organizer (the AI guide) name the buttons as the screens do, and say you", () => {
    for (const f of ["apps/edge/src/ai-functions.ts"]) {
      const src = rd(f); expect([f, /My people/.test(src)]).toEqual([f, false]); expect(src).toContain("Your people");
      expect(firstPersonIn(f, src).filter((h) => !h.includes("I do not know that") && !h.includes("Answer questions about the software"))).toEqual([]); // the one allowed exception is the AI's own quoted reply "I do not know that"
    }
    expect(rd("apps/web/public/zc.js")).not.toMatch(/"My people"|>My people</); // the button is named Your people
  });
  test("the console says what an ID check is: matched, not proven; wrong IDs are limited for each network, a right ID is never counted", () => {
    const z = rd("apps/web/public/zc.js"); expect(z).toContain("it is not proven"); expect(z).toContain("a right ID is never counted");
    for (const f of ["docs/KNOWLEDGE.md", "CHANGELOG.md"]) { const t = rd(f); expect([f, t.includes("matched, not proven")]).toEqual([f, true]); expect([f, /right ID is never counted/.test(t)]).toEqual([f, true]); }
  });
  test("the approved start, throws and invite words are on the screens", () => {
    const zc = rd("apps/web/public/zc.js");
    for (const w of ["The game starts by itself at this time. You do nothing.", "Every throw happens by itself", "Invite people with just an ID", "No names or personal details are needed.", "Just upload or paste the IDs of the people you want to invite: employee ID, associate ID, vendor ID or customer ID, whichever you use.", "Your invitee opens the game link and enters their ID. If it is on your list, they join and play. If it is not, you get a request to approve or decline.", "The list and all IDs are deleted within 24 hours after the game ends."]) expect(zc).toContain(w);
  });
  test("consent.js keeps the recorded tick-box sentences (legal text tied to Terms version 2026-11-01): they are the only first-person words left, and they are listed here so a new one cannot slip in", () => {
    const lines = new Set(firstPersonIn("consent.js", rd("apps/web/public/consent.js")).map((h) => h.split(":")[1]));
    expect(lines.size).toBeLessThanOrEqual(11); // K1 A,B; K2; K3; K4 A,B; K5; K6; K7; K9: a new line raises this, and that is a decision for the owner
  });
});

describe("the two fixed sentences", () => {
  const PAGES = ["apps/web/public/index.html", "site/index.html", "apps/web/public/zc.js", "apps/web/public/z.js"];
  test("the fairness sentence is word for word on the landing pages, the console and the player page", () => { for (const p of PAGES) expect([p, rd(p).includes(FAIRNESS_LINE)]).toEqual([p, true]); });
  test("the one privacy line is word for word on the same pages, and each landing page says it once", () => {
    for (const p of PAGES) expect([p, rd(p).includes(PRIVACY_LINE)]).toEqual([p, true]);
    for (const p of ["apps/web/public/index.html", "site/index.html"]) expect(rd(p).split(PRIVACY_LINE).length - 1).toBe(1);
  });
  test("the privacy line makes the 24-hour promise the code keeps", () => {
    const life = rd("apps/edge/src/lifecycle.ts"); const m = life.match(/PURGE_AFTER_MS = (\d+) \* 3_600_000/); expect(m).not.toBeNull(); expect(Number(m![1])).toBeLessThanOrEqual(24);
  });
});

describe("prices and claims", () => {
  const files = [...readdirSync(PUB).filter((f) => /\.(html|js|txt)$/.test(f) && !/^(zgame|reportgen|control|v)\.js$/.test(f)).map((f) => join(PUB, f)), ...readdirSync(join(ROOT, "site")).filter((f) => f.endsWith(".html")).map((f) => join(ROOT, "site", f))];
  test("an amount in rupees carries the rupee sign, never 'Rs 1,000' or 'INR 1,000'", () => {
    const bad: string[] = []; for (const f of files) readFileSync(f, "utf8").split("\n").forEach((l, i) => { if (/\b(Rs\.?|INR) ?[0-9]/.test(l)) bad.push(`${f.replace(ROOT, "")}:${i + 1}`); });
    expect(bad).toEqual([]);
  });
  test("no page claims what nobody can prove: 100% secure, most secure gateway, played by major companies, a PDF of all details by e-mail", () => {
    const bad: string[] = []; for (const f of files) { const s = readFileSync(f, "utf8"); for (const re of FORBIDDEN_CLAIMS) if (re.test(s)) bad.push(`${f.replace(ROOT, "")} ${re}`); }
    expect(bad).toEqual([]);
  });
  test("the server's own money texts use the rupee sign", async () => {
    const { rs } = await import("../../edge/src/credit"); expect(rs(2399)).toBe("₹2,399"); expect(rs(1999.5)).toBe("₹1,999.50"); expect(rs(34, "USD")).toBe("US$34");
  });
});
