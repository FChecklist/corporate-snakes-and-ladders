# Breach runbook (internal)

For Corporate Snakes and Ladders. A breach is any loss, leak or unauthorised use of personal data (names and mobile numbers of players, winners' prize details, organizer or partner details), or of a key that opens them. Keep it short. Act first, write after.

## 1. Spot it (who, what)
* Signs: an unfamiliar-use alert mail to an organizer; a spike in `ai_audit` rows; 403 or 503 bursts; `GET /api/status/health` showing `ok: false` or a high `errors_last_hour`; a vendor notice (Cloudflare, Resend, Razorpay, GitHub); a report from a player or organizer; a leaked key.
* Owner of this runbook: Rajat Agarwal, the Grievance Officer. Contact: `rajatsiroffice@gmail.com` (phone +91 96503 97480).

## 2. Contain (first hour)
1. Write down the time and what you saw. Do not delete evidence.
2. Leaked platform key or secrets: rotate as in `docs/compliance/KEY_RUNBOOK.md` (`wrangler pages secret bulk`, redeploy). Do NOT rotate `DATA_KEY` while games hold participants (sealed rows would become unreadable); treat a `DATA_KEY` leak as the highest case below.
3. One organizer's key leaked: in the console press "Replace my AI link"; retire other keys in the Keys card. An organizer's lasting key is stored sealed, so a database copy alone does not reveal it.
4. Stop the bleeding if needed: switch the site off with `POST /api/owner/site {"off": true}` (every page answers a plain "Back soon"), or set `STRICT_KEYS=1` and remove one required secret so the Worker answers 503 to everything. Restore after the fix.
5. A vendor breach: follow the vendor's steps, then continue at 3.

## 3. Assess (same day)
* What data, how many people, which games (`SELECT eid ...`), over what period.
* Names and numbers are sealed (AES-256-GCM) in the database: a copy of the database without `DATA_KEY` is not readable. Winners' prize details are sealed the same way. Participant data is deleted 23 hours after a game ends, so a leak of an old copy covers only games that were live or ended less than a day before.
* The security log's personal part for players (network address, browser, device id) is sealed under a per-game key and destroyed at 23 hours; the rest is sealed with `DATA_KEY`. An anonymous visitor's rows hold the first part of the network address only and are removed after 90 days.
* Was `DATA_KEY` exposed? If yes, assume all sealed rows of live games are exposed.
* Decide: is there a likely risk to people? Write the decision and the reason.

## 4. Tell people (do not wait for a perfect picture)
* Organizers affected: by e-mail from the Grievance Officer address, without undue delay. Say what happened, what data, what you did, what they should do. Our data processing terms promise this.
* Players: through their organizer (we hold no way to reach players directly, by design).
* Regulators (decided the same day): India Data Protection Board (DPDP Act s8(6) and Rule 7: tell the Board without delay and send the detailed report within 72 hours) and each affected person. CERT-In has its own reporting window of 6 hours for some incidents. EU/UK supervisory authority within 72 hours if GDPR applies; US state rules vary. Keep the adviser's contact here: ________.
* Vendors: Cloudflare, Resend, Razorpay and GitHub each have their own incident contact; tell them if their service was the path.

## 5. Fix and learn (within a week)
* Fix the cause. Add a test that would have caught it. Update `docs/RETENTION.md` and this file if something changed.
* Write a short record: date, cause, data, people told, regulator notices, fix. Keep it 3 years.

## What we cannot do alone
* Decide whether a regulator must be told, and the exact wording of notices: the Grievance Officer with an adviser.
* Vendor-side logs and investigation: vendor dashboard and support.
