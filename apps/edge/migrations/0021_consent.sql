-- Every acceptance of the Terms: who, which point, which game, which version, which boxes, a hash of the exact wording shown, and when (consent.ts). A player's rows (kind K4) are erased with the game.
CREATE TABLE IF NOT EXISTS consent_log (id TEXT PRIMARY KEY, subject TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, version TEXT NOT NULL, boxes TEXT NOT NULL, text_hash TEXT NOT NULL, at_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS consent_log_who ON consent_log (kind, subject, version);
CREATE INDEX IF NOT EXISTS consent_log_ref ON consent_log (ref);
