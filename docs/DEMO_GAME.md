# Free demo game and the Rs 1 payment test (owner order 1 Nov 2026)

## Free demo game (flag `DEMO_GAME`, OFF until audited)
* Switch: Pages variable `DEMO_GAME` = `on`. Any other value or none = off (create answers 404, `GET /api/demo/status` says `enabled:false`, no button or link is shown).
* Made with the normal create call `POST /api/z` plus `"demo": true` by a signed-in organizer. The server forces 10 people, names it `Demo: <name>`, never looks at purchased packs, never writes a payment or entitlement row. It is published the usual way (free).
* Same engine and rules as a real game (no special path); a guest's details are deleted by the normal job 23 hours after the game ends.
* Limit: 3 demo games per organizer account (one account is one e-mail or employee ID) and 3 per network address, per UTC day. Table `demo_game` (eid, org, hashed address, day), created on first use.
* "Demo" is shown on every guest screen and the console (a bar added by z.js and zc.js when the server says `demo:true`), and the game name starts with `Demo:`.
* Entry: console home "Try a free demo (up to 10 people)" and a link under the home-page heading, both only while the flag is on.
* Tests: `apps/edge/test/demo-game.test.ts` (8).

## Rs 1 payment test
Exists at `/paytest.html`, `POST /api/payments/paytest`: opens the order through the central path (IT Services by Rajat Agarwal / Razorpay), writes ledger C with `product_type payment_test` and `txn_id`, reports to the central ledger (B). It is open to anyone, any number of times, and is not inside each game. The order asks for owner-only: that is a change to live behaviour and is waiting for the boss's decision.
