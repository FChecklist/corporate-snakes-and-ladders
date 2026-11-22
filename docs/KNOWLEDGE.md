# Knowledge: Corporate Snakes and Ladders (corporate-snakes-and-ladders)

Written 20 Nov 2026 for a future AI session that has never seen this repo (standard: marketing-ledger plans/VERSION-AND-KNOWLEDGE-STANDARD-2026-11-20.md). It describes the CURRENT state only, from the code and existing docs. Anything not found is marked "unknown". Do not publish this file on the website.

## 1. What this is
Snakes and ladders for company events; non-cash gifts only, players never pay.
- Live site: https://snakes.corporatetambola.com (Cloudflare Pages project `corporate-snakes-and-ladders`). Live version now: **1.4.1** (`apps/web/public/release.json` at the live commit `042b4d666c68`, built 2026-11-05 17:13 UTC; the live `/version.json` has no version field yet). **This branch is version 1.5.1 (22 Nov 2026; 1.5.0 plus the audit fixes), not deployed.** The live line is the branch `rc/snakes-runner-2026-11-05`, NOT `master` (master is older: 1.3.0 plus docs). Always base work on the live line.
- Other repos and what they are for: `KNOWLEDGE-MAP.md` in the repo root.

## 2. How it connects
Players and organizers reach the suite like this: home.corporatetambola.com (login gate) -> console.corporatetambola.com (set up, invite, pay) -> moneypenny.corporatetambola.com (credits; the single payment gate) -> IT Services by Rajat Agarwal -> Razorpay. Each game is its own website and takes settings from the console by API; a game calls ONLY Moneypenny for payment, never IT Services or Razorpay. The console-to-game contract is `docs/CONTRACT_V1.md` and `contract/` in corporate-console; the pay contract is `GAME_PAY_CONTRACT.md` (in the console pay-step branch: unknown on the default branch). Moneypenny chat: moneypennychat.corporatetambola.com.

## 3. Map of folders and the files that matter
apps/edge (pay.ts, paylink.ts, people.ts, lifecycle.ts, pages-redirect.ts, migrations up to 0028_game_record.sql), apps/web/public, apps/cron, packages/beacon, packages/billing, packages/shared, pages/, site/ (a static marketing copy: index, about, how-it-plays, legal-position), tools/, docs/.

Files that matter: apps/edge/src/pay.ts; apps/edge/src/people.ts; apps/edge/src/lifecycle.ts; pages/version.mjs; site/index.html (second index page).

## 4. Rules in force
- Suite rules version 1.1 (20 Nov 2026): `docs/SUITE_RULES.md`; source in the ledger `plans/SUITE-RULES-VERSION-2026-11-20.md`. **Built in 1.5.0** (see section 4a).
- One login (home), one console, one credit/payment system (Moneypenny), one chatbot system; no game or console has its own login, payment or chat; pay only via Moneypenny.
- Invite by ID only: one alphanumeric ID field, no names or personal details; strip every non-alphanumeric and uppercase before matching; not-on-list people need organizer/host approval; optional family invites (default 4) with approval.
- Console voice = "you", polite, simple English; privacy line "designed to follow US privacy laws, EU GDPR and India's DPDP"; all participant information including IDs deleted within 24 hours after the game; billing line only "We keep billing data for audit and tax reasons."
- Fairness wording (the owner's note says "next number"; this game says "next roll", as the pages do): "No one knows the next roll: not the organizer, not the host, not even the software." Prices with the rupee sign. Prizes: "You (the company) give the prizes directly to the winners."
- Do not claim "100% secure", "most secure gateway", "played by major companies".

## 4a. Owner rules 1.1 as built (version 1.5.0; audit fixes in 1.5.1)
- **Switch:** `OWNER_RULES = "1.1"` in `pages/wrangler.toml [vars]`. A game made while it is on stores `rules: "1.1"` in its settings and keeps those rules for life; games made before are untouched. Remove the line to go back for new games. Code: `packages/beacon/src/config.ts` (`validateCfg`, `opts.rules`), `apps/edge/src/people.ts` (`rulesOf`, `verifyOf`, `empCleanFor`, `addPeople`), `apps/edge/src/worker.ts` (create, join, `ownerRules` in `/info` and `/summary`).
- **Invite by ID only:** the game is `verify: "id"`, `employeesOnly: true`, list only, guest invites off. An ID is read one way: every character that is not a letter or digit is dropped, upper case (`A-1101` = `A 1101` = `A/1101` = `A1101`). A roster row keeps the ID only: a name or number sent along is dropped. A join ignores `name` and `phone`. An ID not on the list waits (`POST /api/z/:id/waiting/:wid {decision}`) for the host. IDs are deleted by the purge (20 hours after the game ends; the promise is 24).
- **Everything by itself:** the game starts at the time set (nothing to press); `play: "presence"` ("players throw") is refused under the rules; a roll is `rollFor(game, seat, turn, b_t)` with `b_t` the public beacon value published after the turn closes. The fairness sentence is proved in `packages/beacon/test/fairness-line.test.ts`.
- **Paid only from the console:** `POST /api/console/paid` with `{orderId, gameId}`, headers `x-console-timestamp` (ms, within 5 minutes) and `x-console-signature` (hex HMAC-SHA-256 of `timestamp.body` with `CONSOLE_PAID_SECRET`). Once per order id (`kv cpaid/<orderId>`); the answer for a repeat is `already: true`; an order id used for another game is 409. 404 unless `CONSOLE_PAID_SECRET` and `OWNER_RULES` are both set. Under the rules `/api/checkout`, `/api/payments/test`, `/api/payments/paytest` and the pay-link routes answer 410 `pay-in-console`; `verify` and the Razorpay webhook still finish an order opened before.
- **Guessing IDs: matched, not proven (owner decision, `docs/SUITE_RULES.md`).** An ID is matched, not proven: it is matched to the list and nothing more. Anyone who types a listed ID takes that person's seat, so the game link should go only to the people invited. **A right ID is never counted** and is never refused by a limit (an office shares one network address): do not add a per-address limit on right IDs. Wrong IDs (an ID not on the list) are limited: `wrongIdOverLimit` in `apps/edge/src/worker.ts`, 30 for each game, each network and each 10 minutes (`ID_MISS_PER_10MIN`), one count shared by "Is this you?" (`who`) and join, raised in ONE database step (`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) so parallel guesses cannot read the same old number. The network is `networkOf(cf-connecting-ip)`: IPv4 as it is, IPv6 by its first 64 bits, no address = one shared bucket `local` (never on the live site). The 31st wrong ID answers 429 `too-many-tries` and is not put on the waiting list. What this does not do: it only slows a guesser; the 429 shows which tries were wrong; an ID that is already seated answers `id-used` and a right ID answers `known:true` without any limit. The counters (`idmiss/<game>/<10 minutes>/<hash of the network>`) hold no ID; `erasePersonal` deletes them and the retention sweep removes old ones. Tests: `apps/edge/test/owner-rules.test.ts` (guessing IDs).
- **Console notice, 1.5.1:** the order id is claimed first and a game is marked only by the notice that won the claim; a game already paid answers `already` and uses no order id; a `CONSOLE_PAID_SECRET` shorter than 32 characters counts as no secret (404). The older routes `verify` and the Razorpay webhook still finish an order that was opened before the deploy, so "paid only from the console" holds for every order opened after it.
- **Wording:** organizer and host screens say you (test `apps/web/test/owner-rules-lines.test.ts`). The privacy line and the fairness sentence are in `packages/shared/src/lines.ts` and on the pages word for word. Prices carry the rupee sign (the PDF report still prints `Rs` because its font has no rupee glyph).

## 5. How to run the tests
`bun test packages apps tools/control-worker`; `tsc --noEmit -p tsconfig.json`.
RAM on the owner's laptop is tight: no full builds or browsers without the heavy lock (C:/ct/HEAVY_JOB_PROTOCOL.md).

## 6. Deploy and roll back
Cloudflare Pages project corporate-snakes-and-ladders. Rollback in the Cloudflare dashboard; previous deploy id: unknown.
Nothing is deployed from a docs-only change. Cloudflare only, no Vercel. Every deploy needs a version bump and a CHANGELOG entry (standard section 1).

## 7. Known issues and open failures
- The recorded tick-box sentences in `consent.js` and `consent-text.json` are still first person ("I agree"): legal text tied to Terms version 2026-11-01. Making them "you" needs a new Terms version: owner decision.
- `EMP_CLEAN_FROM_MS` in `apps/edge/src/people.ts` is still the year-2100 placeholder for games made without the rules; the release build (`RELEASE=1`) still refuses until the release session sets it. Games made under owner rules 1.1 do not depend on it.
- Players-throw play, mobile-number games and the pay-link and Razorpay checkout code are still in the source for games made without the rules; they are switched off by `OWNER_RULES`.
- The `/changes` page and the footer link to it (VERSIONING-TODO items 3 and 4) are not built yet; the footer shows "Version X" from `release.json`.

## 8. Owner-only steps still open
Secrets and keys are the owner's (names only in config/SECRETS_NAMES.md). Deploy, domain and payment live mode are the owner's decisions via BOSS. Before deploying 1.5.1: set the Pages secret `CONSOLE_PAID_SECRET` (a long random value of at least 32 characters, the same one the console signs with; never in git), set `releasedAtIST` in `apps/web/public/release.json` and `EMP_CLEAN_FROM_MS` for the release build, and know that with `OWNER_RULES=1.1` this site stops taking payments itself, so a game can be paid only once the console sends its notice. Versioning work still to do: `docs/VERSIONING-TODO.md`.
