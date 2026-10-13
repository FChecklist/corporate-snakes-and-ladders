-- Every ticked Terms / consent box: who, which game, which Terms version, the exact wording shown, and when (consent.ts). A player's rows (kind K4) are erased with the game.
CREATE TABLE IF NOT EXISTS consent (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, box TEXT NOT NULL, who TEXT NOT NULL, eid TEXT, version TEXT NOT NULL, wording TEXT NOT NULL, at_ms INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS consent_who ON consent (kind, who, version);
CREATE INDEX IF NOT EXISTS consent_eid ON consent (eid);
