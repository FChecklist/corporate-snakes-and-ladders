// The sets of files and the rules behind the wording tests (apps/web/test/wording-rules.test.ts). One place, so the test and the baseline writer count the same way.
import { rd, ls, hitsIn } from "./wording-scan";

const LEGAL = /(^|\/)(terms|dpa|legal-position|legal|privacy|subprocessors|partner-terms|refund-policy)\.html$/;
const NOT_OURS = /(^|\/)(zgame|reportgen|control|zboard|autoupdate|rum|blackbox|pwa|keep|screenrules|consent|vendor)(\.js|\/)/;
export const PAGES = ls("apps/web/public", /\.html$/).filter((f) => !LEGAL.test(f));
export const SCRIPTS = ls("apps/web/public", /\.js$/).filter((f) => !NOT_OURS.test(f));
export const EDGE = ls("apps/edge/src", /\.ts$/);
/** The AI documentation texts name API fields and routes (tickets, /participants, host and co-host as role values): the rules for words that are also API names are checked there with those names taken out. */
export const API_DOC = new Set(["apps/edge/src/ai-link.ts", "apps/edge/src/ai-functions.ts", "apps/edge/src/ai-go.ts", "apps/edge/src/worker.ts"]);
export const USER_FILES = [...PAGES, ...SCRIPTS, ...EDGE, "apps/web/public/llms.txt"];
export const MARKETING = ["index", "about", "brochure", "organizer-guide", "pricing", "demo", "contact", "partner", "trust", "helpdesk"].map((n) => `apps/web/public/${n}.html`).concat(["apps/web/public/site.js", "apps/web/public/llms.txt"]);

const API_NAMES = /(\/|\{|`|"|')\s*(?:participants|tickets?|hosts?|co-hosts?)\b|\b(?:participants|tickets|host|co-host)\s*[|:}]|[|]\s*(?:host|co-host)\b|\btickets? is (?:always|never)\b|\blimit, tickets\b|organizer,\s*host,\s*co-host(?: or none)?|organizer, host or co-host|\bhost\/co-host\b/gi;
const apiClean = (s: string) => s.replace(API_NAMES, " ");

export const RULES: Record<string, { re: RegExp; files: string[]; what: string }> = {
  ticket: { re: /\btickets?\b/gi, files: USER_FILES, what: "ticket" },
  host: { re: /\b(?:co-?)?hosts?\b/gi, files: USER_FILES, what: "host or co-host (say co-organizer)" },
  guest: { re: /\bguests?\b/gi, files: USER_FILES, what: "guest (say player)" },
  participant: { re: /\bparticipants?\b/gi, files: USER_FILES, what: "participant (say player)" },
  pay: { re: /\b(?:buy now|buy (?:a |the )?(?:bigger |smaller )?(?:pack|credits?)|check-?out|purchase[sd]?|top[- ]?up|recharge)\b/gi, files: USER_FILES, what: "a payment word outside the set Pay now and credits" },
  pronoun: { re: /\b(?:my|mine|your|yours)\b/gi, files: USER_FILES, what: "my, mine, your or yours" },
};
export const countIn = (rule: string, file: string): { n: number; hits: string[] } => {
  const { re } = RULES[rule]!;
  const raw = rd(file);
  const hits = API_DOC.has(file) ? hitsIn(file, raw, re, apiClean) : hitsIn(file, raw, re);
  return { n: hits.length, hits };
};

