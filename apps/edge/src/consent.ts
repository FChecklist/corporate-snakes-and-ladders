// Terms checkboxes. Every point where a person accepts the Terms has its own box wording (consent-text.json), one version string (TERMS_VERSION in brand.ts)
// and one rule: never pre-ticked; the action button stays disabled until every box is ticked; THE SERVER refuses the request without the tick and without the
// current version; each acceptance is stored (consent_log) and asked again when the version changes.
import { TERMS_VERSION } from "./brand";
import TEXT from "./consent-text.json";
import type { D1 } from "./worker";

export type ConsentKind = "K1" | "K2" | "K3" | "K4" | "K5" | "K6" | "K9";
export interface Box { id: "A" | "B"; text: string }

const WORDING = TEXT as unknown as Record<string, Record<"A" | "B", string | undefined>>;
export const CONSENT_KINDS: ConsentKind[] = ["K1", "K2", "K3", "K4", "K5", "K6", "K9"];
export const isKind = (k: unknown): k is ConsentKind => typeof k === "string" && (CONSENT_KINDS as string[]).includes(k);

/** The boxes of one point, in order, with their exact wording. */
export const boxesFor = (kind: ConsentKind): Box[] => (["A", "B"] as const).filter((id) => typeof WORDING[kind]?.[id] === "string").map((id) => ({ id, text: WORDING[kind]![id]! }));
/** What a page needs to draw the boxes (GET /api/consent/<kind>). */
export const consentInfo = (kind: ConsentKind) => ({ kind, version: TERMS_VERSION, boxes: boxesFor(kind), termsUrl: "/terms.html", privacyUrl: "/privacy.html", refundUrl: "/refund-policy.html" });

export const CONSENT_SCHEMA: string[] = [
  // one row per acceptance: who (an organizer id, a host id or a player id), the point, the game, the Terms version, the boxes ticked and a hash of the exact wording shown. No address, no device, no phone number.
  `CREATE TABLE IF NOT EXISTS consent_log (id TEXT PRIMARY KEY, subject TEXT NOT NULL, kind TEXT NOT NULL, ref TEXT, version TEXT NOT NULL, boxes TEXT NOT NULL, text_hash TEXT NOT NULL, at_ms INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS consent_log_who ON consent_log (kind, subject, version)`,
  `CREATE INDEX IF NOT EXISTS consent_log_ref ON consent_log (ref)`,
];

export type ConsentRefusal = { ok: false; status: 400; code: "consent-required"; error: string; kind: ConsentKind; version: string };
/** The body of a refusal: the page redraws the boxes (unticked) from `consent`. */
export const refusalBody = (kind: ConsentKind, r: ConsentRefusal) => ({ error: r.error, code: r.code, kind, version: TERMS_VERSION, consent: consentInfo(kind) });

/**
 * Checks what the page sent: `consent: { v, boxes: ["A","B"] }`. Every box of the point must be listed and `v` must be the current version.
 * Anything else (nothing sent, one box missing, an old version) is refused, so a script that skips the page cannot get round it.
 */
export function checkConsent(kind: ConsentKind, input: unknown): { ok: true } | ConsentRefusal {
  const refuse: ConsentRefusal = { ok: false, status: 400, code: "consent-required", error: "Please tick the box to continue.", kind, version: TERMS_VERSION };
  const c = input as { v?: unknown; boxes?: unknown } | null | undefined;
  if (!c || typeof c !== "object" || c.v !== TERMS_VERSION) return refuse;
  const got = Array.isArray(c.boxes) ? c.boxes : [];
  return boxesFor(kind).every((b) => got.includes(b.id)) ? { ok: true } : refuse;
}

const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
/** sha256 of the exact wording of the boxes of a point (what the person saw). */
export const textHash = async (kind: ConsentKind): Promise<string> => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(boxesFor(kind).map((b) => `${b.id}: ${b.text}`).join("\n"))));
const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(12)), (x) => x.toString(16).padStart(2, "0")).join("");

/** Stores one acceptance. Safe to repeat: the same subject, point, game and version are stored once. */
export async function recordConsent(db: D1, kind: ConsentKind, subject: string, ref: string | null, now: number): Promise<void> {
  const had = await db.prepare("SELECT 1 AS x FROM consent_log WHERE kind=? AND subject=? AND version=? AND COALESCE(ref,'')=?").bind(kind, subject, TERMS_VERSION, ref ?? "").first();
  if (had) return;
  await db.prepare("INSERT INTO consent_log(id,subject,kind,ref,version,boxes,text_hash,at_ms) VALUES(?,?,?,?,?,?,?,?)").bind(rid(), subject, kind, ref, TERMS_VERSION, JSON.stringify(boxesFor(kind).map((b) => b.id)), await textHash(kind), now).run();
}
/** True when this person already accepted this point under the CURRENT version (for that game when `ref` is given). */
export async function hasConsent(db: D1, kind: ConsentKind, subject: string, ref: string | null = null): Promise<boolean> {
  const r = ref === null
    ? await db.prepare("SELECT 1 AS x FROM consent_log WHERE kind=? AND subject=? AND version=?").bind(kind, subject, TERMS_VERSION).first()
    : await db.prepare("SELECT 1 AS x FROM consent_log WHERE kind=? AND subject=? AND version=? AND ref=?").bind(kind, subject, TERMS_VERSION, ref).first();
  return !!r;
}
/** A player's acceptance is erased with the game's other personal data (the 24-hour job). Organizers' rows stay with the account. */
export async function eraseParticipantConsent(db: D1, eid: string): Promise<void> {
  await db.prepare("DELETE FROM consent_log WHERE ref=? AND kind='K4'").bind(eid).run();
}
