// Terms and consent boxes (owner order 2026-10-13; wording and places: LEGAL_NOTE_AND_TERMS_CORPORATE_GAMES_DRAFT_2026-10-13.md, Part D).
// Rules for every box: never pre-ticked; the button stays disabled until ticked; THE SERVER refuses the request without the tick and without the current
// Terms version; each tick is stored (who, which game, version, the wording shown, time); when the Terms version changes the box is asked again.
// This replaces "accepted by continuing" (organizer_terms, kept only as a trail) for the actions below.
import { TERMS_VERSION } from "./brand";
import type { D1 } from "./worker";

export type ConsentKind = "K1" | "K2" | "K3" | "K4" | "K5" | "K6";
export interface Box { id: "A" | "B"; text: string }

/** Part D, exact wording. `%V` is replaced by the Terms version. Do not edit without the owner (a test compares these strings with the legal note). */
const WORDING: Record<ConsentKind, { where: string; who: string; boxes: { id: "A" | "B"; text: string }[] }> = {
  K1: { where: "Publish a Game", who: "organizer", boxes: [
    { id: "A", text: "I have read and agree to the Terms & Conditions, the Privacy Policy and the Refund Policy (version %V)." },
    { id: "B", text: "I confirm: players pay nothing to play. I provide and hand over any prize. This game is allowed in my State. I am allowed to invite these guests." } ] },
  K2: { where: "First sign-in / account creation", who: "organizer", boxes: [{ id: "A", text: "I have read and agree to the Terms & Conditions and the Privacy Policy." }] },
  K3: { where: "Before paying", who: "organizer", boxes: [{ id: "A", text: "I agree to the Terms and the Refund Policy. I understand there is no refund; my payment stays as credit." }] },
  K4: { where: "Join a Game", who: "participant", boxes: [
    { id: "A", text: "I agree that my name and mobile number are used for this game only and deleted within 24 hours after it ends. I know who invited me is recorded until then." },
    { id: "B", text: "I am 18 or older, or I am on a parent's or guardian's device with their permission." } ] },
  K5: { where: "Accept a Host / Co-host role", who: "host", boxes: [{ id: "A", text: "I will not charge any player. I will hand over prizes as the organizer decides. I follow the Terms." }] },
  K6: { where: "Upload or type the guest list", who: "organizer", boxes: [{ id: "A", text: "I am allowed to use these names and numbers for this game. The people have been told." }] },
};
export const CONSENT_KINDS = Object.keys(WORDING) as ConsentKind[];
export const isKind = (k: unknown): k is ConsentKind => typeof k === "string" && k in WORDING;

/** The boxes of one place, with the current Terms version in the wording. */
export const boxesFor = (kind: ConsentKind): Box[] => WORDING[kind].boxes.map((b) => ({ id: b.id, text: b.text.replace("%V", TERMS_VERSION) }));
/** What a page needs to draw the boxes (served at GET /api/consent/<kind>). */
export const consentInfo = (kind: ConsentKind) => ({ kind, where: WORDING[kind].where, version: TERMS_VERSION, boxes: boxesFor(kind), termsUrl: "/terms.html", privacyUrl: "/legal.html#privacy", refundUrl: "/refund-policy.html" });

export const CONSENT_SCHEMA: string[] = [
  // one row per ticked box: who ticked (an organizer id, a host id or a player id), the game, the Terms version, the exact wording shown, and when
  `CREATE TABLE IF NOT EXISTS consent (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, box TEXT NOT NULL, who TEXT NOT NULL, eid TEXT, version TEXT NOT NULL, wording TEXT NOT NULL, at_ms INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS consent_who ON consent (kind, who, version)`,
  `CREATE INDEX IF NOT EXISTS consent_eid ON consent (eid)`,
];

export type ConsentRefusal = { ok: false; status: number; code: "consent-required" | "terms-changed"; error: string };
/**
 * Checks what the page sent as `consent: { version, boxes: ["A","B"] }`. Every box of the place must be listed and the version must be the current one.
 * Anything else (nothing sent, one box missing, an old version) is refused, so a script that skips the page cannot get round it.
 */
export function checkConsent(kind: ConsentKind, input: unknown): { ok: true } | ConsentRefusal {
  const need = boxesFor(kind);
  const c = input as { version?: unknown; boxes?: unknown } | null | undefined;
  if (!c || typeof c !== "object") return { ok: false, status: 400, code: "consent-required", error: "Please tick the box to continue." };
  if (c.version !== TERMS_VERSION) return { ok: false, status: 409, code: "terms-changed", error: "Our Terms have changed. Please read them and tick the box again." };
  const got = Array.isArray(c.boxes) ? c.boxes : [];
  if (!need.every((b) => got.includes(b.id))) return { ok: false, status: 400, code: "consent-required", error: need.length > 1 ? "Please tick both boxes to continue." : "Please tick the box to continue." };
  return { ok: true };
}

/** Stores every box ticked, with the wording shown. Safe to repeat: the same person, place, game and version are stored once. */
export async function recordConsent(db: D1, kind: ConsentKind, who: string, eid: string | null, now: number): Promise<void> {
  for (const b of boxesFor(kind)) {
    const had = await db.prepare("SELECT 1 AS x FROM consent WHERE kind=? AND box=? AND who=? AND version=? AND COALESCE(eid,'')=?").bind(kind, b.id, who, TERMS_VERSION, eid ?? "").first();
    if (had) continue;
    await db.prepare("INSERT INTO consent(kind,box,who,eid,version,wording,at_ms) VALUES(?,?,?,?,?,?,?)").bind(kind, b.id, who, eid, TERMS_VERSION, b.text, now).run();
  }
}
/** True when this person already ticked every box of the place for the CURRENT Terms version (per game when `eid` is given). */
export async function hasConsent(db: D1, kind: ConsentKind, who: string, eid: string | null = null): Promise<boolean> {
  const need = boxesFor(kind);
  for (const b of need) {
    const r = eid === null
      ? await db.prepare("SELECT 1 AS x FROM consent WHERE kind=? AND box=? AND who=? AND version=?").bind(kind, b.id, who, TERMS_VERSION).first()
      : await db.prepare("SELECT 1 AS x FROM consent WHERE kind=? AND box=? AND who=? AND version=? AND eid=?").bind(kind, b.id, who, TERMS_VERSION, eid).first();
    if (!r) return false;
  }
  return true;
}
/** A player's ticks are personal data of the game: erased with it (24 hours after the end). The organizer's ticks are kept as proof of acceptance. */
export async function eraseParticipantConsent(db: D1, eid: string): Promise<void> {
  await db.prepare("DELETE FROM consent WHERE eid=? AND kind='K4'").bind(eid).run();
}
