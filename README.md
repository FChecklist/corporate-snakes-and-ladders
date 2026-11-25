# Corporate Snakes and Ladders

Snakes and ladders for company events and teams. Every player has their own 10 by 10 board, with different snakes and ladders that are all equally hard. Everyone throws the dice in the same 20-second window, and nobody can know a throw in advance because the dice come from a public random beacon. The first to a milestone square wins a gift, and the first five to reach the last square get 1st to 5th place. Never a tie. Players give a name, play on their own phone and download nothing.

Players never pay. No real-money stake by players. No cash prizes. No betting. The organizer supplies non-cash gifts.

A separate product, built as a one-time copy of another game's source and then renamed and rebuilt. Nothing here imports from, links to or shares anything with that other product.

**The site is live** on Cloudflare Pages (project `corporate-snakes-and-ladders`, database `corporate-snakes-and-ladders`). What is live right now is in `/version.json` on the site (the commit and the build time); the last deploys are listed in `docs/DEPLOYS.md`. Whether payments are real follows the site's TEST / LIVE mode (`/api/mode`). The game logic is still being rewritten from the older copy; `docs/SPEC.md` is the truth.

- Product and build specification (the game rules, prizes, fairness and build plan): `docs/SPEC.md`
- Running it on this laptop: `docs/RUNNING.md`
- Cloudflare config for a NEW project `corporate-snakes-and-ladders` and D1 database `corporate-snakes-and-ladders`: `pages/wrangler.toml`, `apps/edge/wrangler.toml` (the database id is in `pages/wrangler.toml`; `apps/edge/wrangler.toml` keeps a placeholder)

Layout: `packages/shared` (pricing and shared helpers), `packages/beacon` (random beacon, engine, phone runtime), `packages/billing`, `apps/edge` (Worker API), `apps/web/public` (all pages), `apps/cron`, `pages/` (Pages build and functions), `tools/sim2` (simulation harness).


See [KNOWLEDGE-MAP.md](KNOWLEDGE-MAP.md) for what this repository is for and what the other repositories are for (updated 14 Nov 2026).

## Owner rules, 20 Nov 2026

The owner's decisions for every Corporate Games product. Full text: `plans/ID-INVITE-AND-ARCHITECTURE-RULES-2026-11-20.md` in the private `marketing-ledger` repository (FChecklist/marketing-ledger). If this README and that file disagree, that file wins.

- **One login.** home.corporatetambola.com is the only login gate. No game or page has its own login: if one exists it is hidden or redirects there. Players joining by game link are not "logged in".
- **One console for all games.** console.corporatetambola.com, for organizers and hosts only: set up, invite, pay, approve, monitor. Settings flow console to game by API; the game keeps no copy of the rules.
- **One credit and payment system, one chatbot.** Payment and credits through moneypenny.corporatetambola.com; chat through moneypennychat.corporatetambola.com. All systems are independent and joined by API. An AI helper uses only the limited AI key and never confirms an irreversible step itself.
- **Console and game are separate.** The console is for set-up and running; the game is for playing, each game with its own website and rules.
- **Invite by ID only.** The ID is ONE alphanumeric field (employee, associate, vendor or customer ID are the same thing, wording only), with no choice menu and no names or mobile numbers. The organizer pastes or uploads one ID per line; a person who opens the game link and enters a listed ID joins and plays; an unlisted ID waits for the organizer or host to approve or decline. "Anyone with the link" is not offered. Family invite is optional (each listed person may invite 1 to 10, default 4, with approval). Only the organizer and hosts see the list, the invite chain and the log of joins, approvals and declines.
- **ID normalisation and deletion.** Every character that is not a letter or digit is removed and the rest is upper case, so A-1101, A 1101 and A/1101 are all A1101, at upload, join, approval and matching. The list and all IDs are deleted within 24 hours after the game ends.
- **Console voice.** The organizer console speaks to the organizer as "you", never "I" or "my", in simple words. Start wording: "The game starts by itself" / "You start the game"; numbers (Tambola and Bingo only): "Numbers come by themselves" / "You call the numbers". Rules and examples: [docs/CONSOLE_VOICE.md](docs/CONSOLE_VOICE.md). Ledger notes: `plans/ID-INVITE-AND-ARCHITECTURE-RULES-2026-11-20.md` in the private `marketing-ledger` repo.

suiteRulesVersion: 1.1 (20 Nov 2026). Owner rules copy: docs/SUITE_RULES.md. Source: marketing-ledger plans/SUITE-RULES-VERSION-2026-11-20.md.

## Version 1.6.0 (25 Nov 2026): the gaps of the owner's evaluation of 24 Nov

A player gives a name (the word nickname is gone); each player can choose a Retro or Modern board look; Snakes and Ladders has its own colour scheme; a full AI manual page (`/ai-manual`) and `llms.txt`, where an AI can prepare the pre-game, winner and closing messages but cannot pay; a winner is told what they won and the organizer can set a closing message; one wording set (game and player, co-organizer, boards, Pay now and credits); the rules in one short line each. Built on version 1.5.4 (owner rules 1.1, `OWNER_RULES = "1.1"` in `pages/wrangler.toml`: invite by employee ID only, the game and every throw by themselves, a game paid only by the console's signed notice). What it does and what is left for the owner: [CHANGELOG.md](CHANGELOG.md), [docs/KNOWLEDGE.md](docs/KNOWLEDGE.md) sections 4a and 4b, and [docs/WORDING_2026-11-25.md](docs/WORDING_2026-11-25.md).
