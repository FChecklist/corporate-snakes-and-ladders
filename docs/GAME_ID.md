# Game ID with the payment (this game)

A real payment for a game carries the game ID in all three records: Razorpay (order notes `game_id`), the central ledger (`payment.game_id`, `pay_order.game_id`, central migration 0014) and this game's own payment meta (`meta.gameId`, next to `meta.eid`). A bare pack purchase has none. The invoice (page and text) and the mails print `Game ID: <id>`; the owner's "paid order" mail too.

* `pay.ts` `placeOrder`: new option `gameId`; sent to the central service as top-level `game_id` (central validates `^[A-Za-z0-9_-]{1,40}$`, else 400) or, if central is not used, added to the direct Razorpay notes.
* Payment test: an optional free-text `gameId` in the body is cleaned (letters, digits, space, `_ . -`, 40 characters), never looked up, goes to the order notes as `test_ref`, and is printed on the receipt as Game ID next to "payment test". Empty = as before. (The page box is built by the payment-pages session.)
* Nothing here changes what an organizer sees about price; see PRICE_ADJUST.md.
* Release order: central migration 0014 + central functions first, then each game. A game that sends no `game_id`, or a central service not yet updated, keeps working (an older central ignores the extra field; the notes still carry `game_id`).
