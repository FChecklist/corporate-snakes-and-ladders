# Corporate Snakes and Ladders

Snakes and ladders for company events and teams. Every player has their own 10 by 10 board, with different snakes and ladders that are all equally hard. Everyone throws the dice in the same 20-second window, and nobody can know a throw in advance because the dice come from a public random beacon. The first to a milestone square wins a gift, and the first five to reach the last square get 1st to 5th place. Never a tie. Players use nicknames, play on their own phone and download nothing.

Players never pay. No real-money stake by players. No cash prizes. No betting. The organizer supplies non-cash gifts.

A separate product, built as a one-time copy of another game's source and then renamed and rebuilt. Nothing here imports from, links to or shares anything with that other product.

Everything is local. Nothing is deployed, no cloud resource exists, no secret is set, no real payment is taken. The game logic is still being rewritten from the older copy; `docs/SPEC.md` is the truth.

- Product and build specification (the game rules, prizes, fairness and build plan): `docs/SPEC.md`
- Running it on this laptop: `docs/RUNNING.md`
- Cloudflare config for a NEW project `corporate-snakes-and-ladders` and D1 database `corporate-snakes-and-ladders`: `pages/wrangler.toml`, `apps/edge/wrangler.toml` (database ids are `REPLACE_ME`)

Layout: `packages/shared` (pricing and shared helpers), `packages/beacon` (random beacon, engine, phone runtime), `packages/billing`, `apps/edge` (Worker API), `apps/web/public` (all pages), `apps/cron`, `pages/` (Pages build and functions), `tools/sim2` (simulation harness).
