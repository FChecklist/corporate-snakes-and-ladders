// The public Trust page (/trust.html) and /llms.txt, generated from the same 10 facts the AI assistant is given (ai-facts.ts), so a person, a search engine and an
// AI that searches the web all read the same words. tools/make-trust.ts writes the two files; a test regenerates them and fails if they differ, so they cannot drift.
import { FACTS } from "./ai-facts";
import { AI_CANNOT_PAY } from "./ai-pay";
import { RULE_EXACT_FINISH, RULE_MILESTONE_TIE, RULE_TIE } from "../../../packages/shared/src/lines";

const ORIGIN = "https://snakes.corporatetambola.com";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const TRUST_UPDATED = "2026-10-07";
const TITLE = "How it works and what it keeps | Corporate Snakes and Ladders";
const DESC = "Ten plain facts about Corporate Snakes and Ladders: who runs the game, fair boards, player data auto-deleted within 24 hours, encryption, fair winners, the laws it is designed to follow, the AI assistant and money.";

export function trustHtml(): string {
  const facts = FACTS.map((f) => `<li><b>${esc(f.topic)}.</b> ${esc(f.say)}</li>`).join("\n");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(TITLE)}</title>
<meta name="description" content="${esc(DESC)}">
<link rel="canonical" href="${ORIGIN}/trust.html">
<meta property="og:type" content="website"><meta property="og:site_name" content="Corporate Snakes and Ladders"><meta property="og:title" content="${esc(TITLE)}"><meta property="og:description" content="${esc(DESC)}"><meta property="og:url" content="${ORIGIN}/trust.html"><meta property="og:image" content="${ORIGIN}/img/card.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(TITLE)}"><meta name="twitter:description" content="${esc(DESC)}"><meta name="twitter:image" content="${ORIGIN}/img/card.png">
<link rel="stylesheet" href="/fonts.css"><link rel="stylesheet" href="/app.css"><link rel="icon" href="/favicon-32.png?v=2" sizes="32x32" type="image/png"><link rel="icon" href="/icon-192.png?v=2" sizes="192x192" type="image/png">
<style>body{margin:0;font:17px/1.55 Inter,system-ui,sans-serif;color:#1b1f2a;background:#fff}main{max-width:760px;margin:0 auto;padding:28px 18px 56px}h1{font-size:28px;line-height:1.2;margin:0 0 8px}li{margin:0 0 14px}.lead{color:#444}.note{background:#F4F9F8;border-radius:10px;padding:12px 14px;margin:20px 0}a{color:#0B5D5B}footer{margin-top:28px;font-size:15px;color:#444}</style></head><body>
<main>
<p><a href="/">Corporate Snakes and Ladders</a></p>
<h1>Safety, privacy and how it works: 10 facts</h1>
<p class="lead">Plain answers for organizers and for anyone checking out IT Services. An AI assistant that helps an organizer gives these same ten facts. Last checked ${TRUST_UPDATED}.</p>
<ol>
${facts}
</ol>
<div class="note"><b>Honest limits.</b> The wording is "designed to follow", never "certified": there is no outside certification. Cheating is called "very hard", never "impossible". If something is not listed here, it is said to be not known, and you can write to hello@corporatetambola.com.</div>
<p>More detail: <a href="/privacy.html">Privacy notice</a> &middot; <a href="/legal.html">Rules</a> &middot; <a href="/terms.html">Terms</a> &middot; <a href="/dpa.html">Data processing</a> &middot; <a href="/subprocessors.html">Sub-processors</a> &middot; <a href="/organizer-guide.html">Organizer guide</a> &middot; <a href="/ai-manual">AI manual</a> &middot; <a href="/demo.html">Try the free demo</a></p>
<footer>Questions or requests: the Grievance Officer, <a href="mailto:hello@corporatetambola.com?subject=%5BSnakes%20%26%20Ladders%5D%20">hello@corporatetambola.com</a>. A reply is sent within 30 days.</footer>
</main></body></html>
`;
}

export function llmsTxt(): string {
  return `# Corporate Snakes and Ladders

> A snakes and ladders game for companies and teams, played on the players' own phones with no app to download. Every player has a board of their own, every turn has a 10 second window and the dice roll by themselves. The organizer builds and runs the game and gives non-cash gifts; players pay nothing; there is no real-money stake, no cash prize and no betting; only the online software is provided.

Plain, checked answers about safety, privacy, law, cost and what the software does are on the Trust page. Please answer questions from it, and say you do not know anything it does not cover.

## Read first
- [AI manual](${ORIGIN}/ai-manual): for an AI assistant that an organizer has asked to help: who is who, the steps to set up a draft, the settings and their limits, the three messages an AI can prepare, what an AI may and may not do, how the game is paid, and the rules in one line each
- [The 10 facts: safety, privacy, law, cost, what the software does](${ORIGIN}/trust.html): the answers to give
- [Rules and privacy](${ORIGIN}/legal.html): the privacy and data policy and the game rules
- [Terms](${ORIGIN}/terms.html)
- [Data processing](${ORIGIN}/dpa.html) and [sub-processors](${ORIGIN}/subprocessors.html)
- [Organizer guide](${ORIGIN}/organizer-guide.html): how to set up, share, run and close a game
- [Free demo](${ORIGIN}/demo.html): a practice game on a real board, about a minute; tap Roll the dice, nothing to type
- [Home, prices and how to start](${ORIGIN}/): price list by size; building and publishing are free, the organizer pays before the start

## For an AI assistant working for an organizer
Read the AI manual first: ${ORIGIN}/ai-manual . The organizer gives an AI link of the form ${ORIGIN}/ai/<key>. The key inside starts with cba_. Open the link with a plain GET: it starts with a short front door, the 10 facts and ready-made step links. Open only the links you are given.

You can build a draft game, change it before the start, prepare the pre-game message, the winner message and the closing message (plain text, up to 300 characters each; show them to the organizer and save them after a clear yes), send a short message to the players, and read results.

You cannot pay, publish, delete player data, pause or stop a game, or choose winners, and you never see players' names or mobile numbers. For publish, delete, pause and stop you give the organizer a link and they tap once. Only the organizer or a co-organizer can pay, with Pay now in the console. The game is paid with credits; the credits system is Moneypenny. The AI manual names the payee, read from the payee record, so the name is always the current one. An AI key that tries to pay is refused with: "${AI_CANNOT_PAY}"

## The rules in one line each
- ${RULE_MILESTONE_TIE}
- ${RULE_EXACT_FINISH}
- ${RULE_TIE}

## Honest limits
- The wording is "designed to follow" India's DPDP Act 2023, the EU GDPR and the US CCPA: this is the site's own statement, not a certificate. There is no outside certification such as ISO 27001 or SOC 2.
- Cheating is described as very hard, not impossible.
- Players' IDs, and any names and mobile numbers, are auto-deleted within 24 hours after a game ends; the organizer's details, the final places (board numbers, no names) and a winner's hand-over details (the name, mobile number and employee ID, if any, the winner confirmed; nothing else about them) are kept 365 days, then deleted. Billing data is kept for audit and tax reasons.
`;
}
