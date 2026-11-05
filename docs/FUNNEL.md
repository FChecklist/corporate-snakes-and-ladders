# Sales funnel (first-party statistics)

Flag: `FUNNEL_EVENTS` must be exactly `on` to store anything. Not set, or any other value = OFF (the owner report still reads what was kept).

- Events (13, from core `funnel.ts`, vendored 0.9.11): viewed, size_chosen, signup_started, game_created, game_published, payment_page_reached, payment_page_opened, payment_link_copied, payment_started, payment_succeeded, payment_failed, game_started, game_completed.
- Page steps come from `funnel.js` (built from core `makeReporter` by `bun run build:funnel`) to `POST /api/funnel/e`: viewed (landing, pricing), size_chosen, signup_started (`site.js`), payment_page_reached (`pay.html`), payment_page_opened (`paylink.html`), payment_link_copied (`zc.js`). The route accepts only these six.
- Game steps are written by the server: game_created / game_published (`worker.ts`), payment_started / payment_succeeded / payment_failed (`pay.ts`), game_started / game_completed (`lifecycle.ts`). Once per game (a failed payment: once per payment). Accounts made in TEST mode are never counted.
- Table `funnel_event(ev, ukey, day, at_ms, game, size, mode, reason)`, primary key (ev, ukey): created on first use (no migration). `ukey` is a random per-visit id kept in memory only, or a game / payment id. No name, mobile, e-mail, employee ID, address or device id; fields are cleaned by core `cleanProps`.
- Do Not Track and Global Privacy Control: the page sends nothing, and the route stores nothing if either header arrives.
- Owner report: `GET /api/owner/funnel?from=YYYY-MM-DD&to=YYYY-MM-DD[&format=csv]` with the platform key (x-organizer); page `/owner-funnel.html`. Every read goes to the access log.
- Before switching on: audit; add one line about these anonymous counts to the Privacy page; set `FUNNEL_EVENTS=on`.
- Not done: no row clean-up job (rows hold no personal data); `payment_link_copied` is tested as source check plus the reporter call, not by clicking the console.
