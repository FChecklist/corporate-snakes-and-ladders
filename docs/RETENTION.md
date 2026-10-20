# What we keep, and for how long

Corporate Snakes and Ladders, as built on 2026-10-14. Everything is kept in one Cloudflare D1 database (table `kv` holds small keyed records). Two things enforce this schedule: the lifecycle job (`apps/edge/src/lifecycle.ts`, `lifecycleTick`) and the sweep (`purgeOld` in `apps/edge/src/worker.ts`). Both run from the scheduled tick, `POST /api/lifecycle/tick`, called every 5 minutes (Supabase `pg_cron` job `game-ticks`, and GitHub Actions in the `scheduler` repository as a second trigger). The sweep and the mail-log clean-up also run from the first organizer request of each UTC day, as a safety net. Tests: `apps/edge/test/retention.test.ts`, `privacy.test.ts`, `shred.test.ts`, `admin.test.ts` (A8). The data map with every field is `docs/PRIVACY_AND_LIFECYCLE.md`.

"End" means the moment the phones agree the game is over, or the scheduled end of the last turn if they never agree. The promise to players is "within 24 hours"; the job deletes at **23 hours** (`PURGE_AFTER_MS`). The health address `GET /api/status/health` raises an alarm (`ok: false`, `overdue_purge`) when a game is more than 30 minutes past that and its players' data is still stored, and the scheduler's uptime check fails on it.

| Data | Where | Kept | Then |
|---|---|---|---|
| Participant name and mobile number (sealed), seat, device hashes, invitation record, consent record (Terms version, boxes, hash of the wording, time), people lists, waiting requests, votes, claims, working copies of the report | `participant`, `seat`, `person`, `waiting`, `claim`, `settled`, `rvote`, `rcand`, `overvote`, `consent_log` (K4 rows), `kv seats-base/ rpt*` | 23 hours after the game ends | Deleted (`erasePersonal`) |
| The personal part of players' security-log rows (network address, browser string, device id, fields sent, network number) | `audit_pii`, key salt in `eng_key` | 23 hours after the game ends | Crypto-shredded: salt and blobs destroyed, the hash chain still verifies |
| A player's request to see, correct or delete their data, or to name another person (card id, kind, short note, times: no name, no number) | `data_request` | 23 hours after the game ends, with the participants | Deleted (`erasePersonal`); again with the game at 365 days |
| Winners record (seat, prize, round, time) | `winner` | 365 days after the game ends | Deleted with the game |
| Winner's prize hand-over details (name and number as confirmed, change trail, given date), sealed | `prize` | 365 days | Deleted with the game |
| Game, its settings, the end-of-game clock, organizer contact | `engagement`, `life`, `cbl_request`, `kv control/ contact/ pub/ ann/` | Until 00:00 IST at the end of day 365 after the game ended. An unpublished draft: 30 days | Deleted (`eraseEverything`) |
| Security log: the non-personal core of players' rows; whole rows of organizers, hosts, co-hosts and AI keys | `audit_log` | 365 days (deleted with the game) | Deleted; an anonymous count (`audit_stats`) and a deletion certificate (`audit_cert`) stay |
| Security log of an anonymous visitor (no game and no organizer: a refused request, a failed payment, a wrong key). The network address is cut to its first part (IPv4 /24, IPv6 /48) before it is sealed | `audit_log`, chain `anon` | **90 days** | Deleted from the front of the chain by `sweepAudit` |
| Organizer account: sign-in keys, e-mail hash, sealed e-mail for our mails, sealed lasting AI key, terms version accepted | `organizer_key`, `organizer_email`, `kv orgmail/ aikey/`, `organizer_terms` | While the account exists | Deleted by "Close my organizer account" in the console (with every game and the AI audit trail) |
| E-mailed 24-hour AI keys | `organizer_key` (expires_ms) | Expire after 24 hours; row deleted 7 days later | Deleted by the sweep |
| Retired (revoked) keys | `organizer_key` | 90 days | Deleted by the sweep |
| Sign-in codes and one-click sign-in tokens (hash only) | `login_code` | 10 minutes; row deleted 1 day after it expires | Deleted by the sweep |
| Partner sign-up codes and e-mail deletion confirmation codes (hash only) | `kv penr/ delreq/` | 10 minutes (deletion codes 30 minutes); row deleted after 1 day | Deleted by the sweep |
| Report-link salt | `kv rptsalt/` | Until the game is deleted | Deleted with it |
| Network-address hashes for daily limits (sign-up count, bad sign-in tries, partner limits, join limits) | `kv start/ linkfail/ plim/ jlim/ jbm/` | 2 days | Deleted by the sweep |
| "New place" records for AI keys (country, network prefix, program family) and the alert clock | `kv seen/ alert/` | While their key is live | Deleted by the sweep when the key is retired or expired |
| AI audit trail (time, key id, call, status, network address, program, country) | `ai_audit` | 365 days | Deleted |
| Mail log: the address a mail went to and its subject | `outbox` | **3 days.** A sent mail keeps no body. An unsent mail with a body gets one more try a day while it is under 3 days old | Deleted by `purgeOutbox`, called from the tick every hour (and daily from the first organizer request) |
| Monitoring from `rum.js` (page path without query, referrer site, device class, speed, script errors, failed or slow API calls with their path, country) | `telemetry` (`pages/functions/api/telemetry.ts`) | 90 days | Deleted by the clean-up that runs on about 1 write in 100 |
| Visits to the public pages (source, landing page, device, language, country and city, sections seen with time, choices made, exit page and section, first-party visitor id, shortened network address, keyed hash of the address, funnel step, organizer id once an account is made; never names or mobile numbers; never the game pages) | `visit_session`, `visit_event` | 365 days after the visit began | Rolled into anonymous per-day totals (`visit_agg`, kept), then deleted by the lifecycle tick. With Global Privacy Control or Do Not Track only the anonymous totals are made |
| Daily write counters | `usage` | 90 days | Deleted by the sweep |
| Payments, invoices, entitlements, the payment ledger | `payment`, `invoice`, `entitlement`, `payment_ledger` | We keep billing data for audit and tax reasons | Not deleted by code (TEST-mode clean-up only removes test payments) |
| Organizer's invoice details and who paid | `legal_party` (a copy per paid game, written at payment and again just before the game is deleted), and the payment and invoice rows | Same | Not deleted by code |
| Partner account (name, random code, hashes of phone and e-mail, key hash) and commissions | `partner`, `commission` | While the partner is active; commissions as accounting records | Partner row deleted by "Close my partner account"; commission rows stay without any link to a person |
| Ideas from organizers' AI assistants (no names or numbers) | `suggestion`, `suggestion_vote` | Until we remove them | Not deleted by code |

## Not decided in code

* Partner commission records are kept as accounting records.
* Whether the one-year log rule in DPDP Rule 6(1)(e) reaches players' security-log rows, which are destroyed at 23 hours.

## Error reports (added 2026-10-20)

Error reports hold no names, phone numbers, e-mail addresses, typed text, keys, tokens or visitor addresses (cleaned on the device and again on the server; `apps/web/test/blackbox.test.ts`). They are kept until the error is fixed, then 90 days after it was last seen; up to four full reports per error are kept for 90 days. A report waiting on a phone while it is offline is the only thing stored on the device (key `ctz-bbq`), removed as soon as it is sent.
