// Regression: the 24-hour erase (purge at 20 h, report link ends at 19 h), the permanent game log and the 365-day rule, and consent that is safe across Terms versions.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { PURGE_AFTER_MS, REPORT_LINK_MS, endBoundMs, fullDeleteAt, lifecycleTick, personalDeleteAt, reportLinkUntil } from "../src/lifecycle";
import { lazyTickReset, purgeOld, type Env } from "../src/worker";
import { phoneHashOf } from "../src/people";
import { sentReports } from "../src/pay";
import { CONSENT_KINDS, boxesFor, checkConsent, eraseParticipantConsent, hasConsent, recordConsent, textHash, consentInfo } from "../src/consent";
import { TERMS_VERSION } from "../src/brand";
import { HOUR, MIN, T, W, create, join, mob, one, q, reset, restore, startIn, uid } from "./param-harness";

const DAY = 86_400_000, IST = 19_800_000;
beforeEach(() => { reset(); lazyTickReset(); sentReports.length = 0; });
afterEach(restore);
const tick = (now: number) => lifecycleTick(W.env as any, now);
/** A played game with 3 named guests; returns the id and the instant the game ended. */
async function playedGame() {
  const id = uid("ERA");
  expect((await create(undefined, id, { startRound: startIn(-2 * HOUR), callSeconds: 20, cap: 5000 })).status).toBe(200);
  await W.env.DB.prepare("INSERT INTO kv(k,v) VALUES(?,?)").bind(`contact/${id}`, JSON.stringify({ email: "boss@acme.com", phone: "9811122233" })).run();
  for (let i = 1; i <= 3; i++) expect((await join(id, i, {}, T - 3 * HOUR)).status).toBe(200);
  const end = await endBoundMs(W.env as any, one("SELECT * FROM engagement WHERE id=?", id));
  return { id, end };
}
const everything = () => { const out: string[] = []; for (const t of q("SELECT name FROM sqlite_master WHERE type='table'")) out.push(JSON.stringify(q(`SELECT * FROM "${t.name}"`))); return out.join("\n"); };

describe("24-hour erase", () => {
  test("constants: the personal purge is at 20 hours (inside the 24-hour promise), the report link ends at 19 hours, one hour before", () => {
    expect(PURGE_AFTER_MS).toBe(20 * HOUR); expect(REPORT_LINK_MS).toBe(19 * HOUR); expect(PURGE_AFTER_MS).toBeLessThan(24 * HOUR); expect(REPORT_LINK_MS).toBeLessThan(PURGE_AFTER_MS);
    for (const end of [0, 1_700_000_000_000, T]) { expect(personalDeleteAt(end)).toBe(end + 20 * HOUR); expect(reportLinkUntil(end)).toBe(end + 19 * HOUR); }
  });
  test("before the 20 hours the guests are still there; after them every participant, seat, person, consent tick and name is gone", async () => {
    const { id, end } = await playedGame();
    expect(one("SELECT COUNT(*) c FROM participant WHERE eid=?", id).c).toBe(3); expect(one("SELECT COUNT(*) c FROM seat WHERE eid=?", id).c).toBe(3); expect(one("SELECT COUNT(*) c FROM consent_log WHERE kind='K4' AND ref=?", id).c).toBe(3);
    await tick(end + 5 * MIN); expect(one("SELECT COUNT(*) c FROM participant WHERE eid=?", id).c).toBe(3);
    await tick(end + 20 * HOUR - 2 * MIN); expect(one("SELECT COUNT(*) c FROM participant WHERE eid=?", id).c).toBe(3); expect(one("SELECT COUNT(*) c FROM consent_log WHERE kind='K4' AND ref=?", id).c).toBe(3);
    await tick(end + 20 * HOUR + 2 * MIN);
    for (const t of ["participant", "seat", "person"]) expect([t, one(`SELECT COUNT(*) c FROM ${t} WHERE eid=?`, id).c]).toEqual([t, 0]);
    expect(one("SELECT COUNT(*) c FROM consent_log WHERE kind='K4' AND ref=?", id).c).toBe(0);
  });
  test("by 24 hours no guest is left in ANY table: not their sealed name, not the hash of their mobile number (whole-database scan before and after)", async () => {
    const { id, end } = await playedGame(); const hashes = await Promise.all([1, 2, 3].map((i) => phoneHashOf(W.env as any, mob(i))));
    const before = everything(); for (const h of hashes) expect([h.slice(0, 8), before.includes(h)]).toEqual([h.slice(0, 8), true]);
    expect(q("SELECT COUNT(*) c FROM participant WHERE eid=? AND pii IS NOT NULL", id)[0].c).toBe(3); // names are kept sealed, never as plain text
    await tick(end + 5 * MIN); await tick(end + 22 * HOUR); await tick(end + 24 * HOUR);
    const dump = everything();
    for (const h of hashes) expect([h.slice(0, 8), dump.includes(h)]).toEqual([h.slice(0, 8), false]);
    for (let i = 1; i <= 3; i++) { expect(dump.includes(`Guest ${i}`)).toBe(false); expect(dump.includes(mob(i))).toBe(false); }
    expect(one("SELECT COUNT(*) c FROM engagement WHERE id=?", id).c).toBe(1); // the game itself (settings, organizer) stays for 365 days
  });
  test("the 365-day end of everything falls on an IST midnight, 365 to 366 days after the game, and never earlier than 365 days", () => {
    for (const end of [T, T + 1, T + 5 * HOUR, T + 18 * HOUR, Date.UTC(2027, 0, 1, 18, 29, 59), Date.UTC(2027, 0, 1, 18, 30, 0), Date.UTC(2028, 1, 28, 12, 0, 0)]) {
      const at = fullDeleteAt(end); expect(at).toBeGreaterThanOrEqual(end + 365 * DAY); expect(at).toBeLessThan(end + 366 * DAY + 1); expect((at + IST) % DAY).toBe(0);
    }
    expect(fullDeleteAt(T)).toBeLessThanOrEqual(fullDeleteAt(T + DAY)); expect(fullDeleteAt(T + 2 * DAY)).toBe(fullDeleteAt(T + DAY) + DAY);
  });
});

describe("the permanent game log", () => {
  test("the settings record is made when the game ends, holds the counts, survives the erase of the guests and holds no guest", async () => {
    const { id, end } = await playedGame(); await tick(end + 5 * MIN);
    const mid = one("SELECT * FROM game_record WHERE eid=?", id); expect(mid).toBeTruthy(); expect(JSON.parse(mid.settings)).toMatchObject({ gameId: id, callSeconds: 20, cap: 5000 });
    await tick(end + 22 * HOUR);
    const after = one("SELECT * FROM game_record WHERE eid=?", id); expect(after).toBeTruthy(); expect(JSON.parse(after.outcome).joined).toBe(3);
    const text = after.settings + (after.outcome ?? ""); for (let i = 1; i <= 3; i++) { expect(text.includes(`Guest ${i}`)).toBe(false); expect(text.includes(mob(i))).toBe(false); } expect(text.includes("9811122233")).toBe(false); expect(text.includes("boss@acme.com")).toBe(false);
  });
  test("the record is still there after the game's own rows are erased at 365 days (it is never deleted); the count is not overwritten by zero", async () => {
    const { id, end } = await playedGame(); await tick(end + 5 * MIN); await tick(end + 22 * HOUR);
    expect(one("SELECT COUNT(*) c FROM engagement WHERE id=?", id).c).toBe(1);
    await purgeOld(W.env as Env, fullDeleteAt(end) - HOUR); expect(one("SELECT COUNT(*) c FROM engagement WHERE id=?", id).c).toBe(1); // the day before: kept
    await purgeOld(W.env as Env, fullDeleteAt(end) + HOUR);
    expect(one("SELECT COUNT(*) c FROM engagement WHERE id=?", id).c).toBe(0);
    const rec = one("SELECT * FROM game_record WHERE eid=?", id); expect(rec).toBeTruthy(); expect(JSON.parse(rec.outcome).joined).toBe(3);
  });
  test("one record per game however many passes run (the same game id is one row)", async () => {
    const { id, end } = await playedGame(); for (const k of [5 * MIN, 10 * MIN, HOUR, 5 * HOUR]) await tick(end + k);
    expect(one("SELECT COUNT(*) c FROM game_record WHERE eid=?", id).c).toBe(1);
  });
});

describe("consent that is safe across Terms versions", () => {
  test("every point has its boxes; the current version is the one the server asks for", () => {
    expect(TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/); for (const k of CONSENT_KINDS) { expect([k, boxesFor(k).length > 0]).toEqual([k, true]); expect(consentInfo(k).version).toBe(TERMS_VERSION); }
    expect(boxesFor("K4").map((b) => b.id)).toEqual(["A", "B"]);
  });
  test("checkConsent accepts only the current version with every box; an old, future, missing or partial tick is refused", () => {
    const ok = { v: TERMS_VERSION, boxes: ["A", "B"] }; expect(checkConsent("K4", ok).ok).toBe(true); expect(checkConsent("K4", { v: TERMS_VERSION, boxes: ["B", "A", "A"] }).ok).toBe(true);
    for (const bad of [undefined, null, {}, "x", 5, { v: "2020-01-01", boxes: ["A", "B"] }, { v: "2099-01-01", boxes: ["A", "B"] }, { v: TERMS_VERSION, boxes: ["A"] }, { v: TERMS_VERSION, boxes: ["B"] }, { v: TERMS_VERSION, boxes: [] }, { v: TERMS_VERSION }, { boxes: ["A", "B"] }, { v: TERMS_VERSION, boxes: "AB" }]) { const r: any = checkConsent("K4", bad as any); expect([JSON.stringify(bad), r.ok, r.code]).toEqual([JSON.stringify(bad), false, "consent-required"]); }
  });
  test("an acceptance of an OLD version does not count: the person is asked again (hasConsent false), and the current one does", async () => {
    const db = W.env.DB; await create(undefined, uid("CON"), {}); // makes sure the tables exist
    W.raw.prepare("INSERT INTO consent_log(id,subject,kind,ref,version,boxes,text_hash,at_ms) VALUES('x1','sub1','K4','G9','2020-01-01','[\"A\",\"B\"]','h',1)").run();
    expect(await hasConsent(db, "K4", "sub1", "G9")).toBe(false); expect(await hasConsent(db, "K4", "sub1")).toBe(false);
    await recordConsent(db, "K4", "sub1", "G9", T); expect(await hasConsent(db, "K4", "sub1", "G9")).toBe(true); expect(await hasConsent(db, "K4", "sub1", "OTHER")).toBe(false); expect(await hasConsent(db, "K4", "sub2", "G9")).toBe(false);
  });
  test("recording the same acceptance twice stores one row; the row keeps the version, the boxes and a hash of the wording shown", async () => {
    const db = W.env.DB; await create(undefined, uid("CON"), {}); await recordConsent(db, "K4", "subA", "G1", T); await recordConsent(db, "K4", "subA", "G1", T + 1000);
    const rows = q("SELECT * FROM consent_log WHERE subject='subA'"); expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ kind: "K4", ref: "G1", version: TERMS_VERSION, boxes: '["A","B"]', text_hash: await textHash("K4"), at_ms: T });
    expect(await textHash("K4")).toMatch(/^[0-9a-f]{64}$/); expect(await textHash("K4")).not.toBe(await textHash("K2"));
  });
  test("erasing a game's guests removes only the K4 ticks of that game, not other games' and not organizers' ticks", async () => {
    const db = W.env.DB; await create(undefined, uid("CON"), {});
    await recordConsent(db, "K4", "p1", "GA", T); await recordConsent(db, "K4", "p2", "GB", T); await recordConsent(db, "K2", "orgX", null, T); await recordConsent(db, "K2", "orgY", "GA", T);
    await eraseParticipantConsent(db, "GA");
    expect(q("SELECT subject FROM consent_log ORDER BY subject").map((r: any) => r.subject)).toEqual(["orgX", "orgY", "p2"]);
  });
});
