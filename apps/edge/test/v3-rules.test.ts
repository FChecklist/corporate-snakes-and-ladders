// Test author, run v3 (31 Oct 2026): gap tests written straight from the owner's rules, not from the code.
//  1. employee-ID cleaning, the 30 cap, empty refusal, an email typed in an employee-ID game
//  2. participant Email ID cleaning (NFKC, trim, inner spaces and invisible characters removed, lower case)
//  3. ACCOUNT / sign-in / host / payment e-mails REFUSE inner spaces and invisible characters, door by door
//  4. idKind / verify lock (who holds an ID hash)
//  5. endedAtMs
// A test marked `test.failing` is a PRODUCT DEFECT written down as a test: it passes while the product is wrong and turns red the day it is fixed (then change it to `test`). Every one is listed in docs/TESTER_REPORT.md.
// No backslash is typed inside a string or a regex here: characters are built from code points, so an editing tool cannot drop one.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanAccountEmail, cleanEmail } from "../src/emailclean";
import { badIdMessage, cleanEmpId, EMP_CLEAN_FROM_MS, empHashOf, looksLikeEmail, normEmp, normId } from "../src/people";
import { endBoundMs, erasePersonal } from "../src/lifecycle";
import { call, checkout, create, dev, HOUR, j, mob, MIN, one, organizer, PLAT, publish, reset, restore, startIn, uid, W } from "./param-harness";

beforeEach(() => reset());
afterEach(restore);

const ch = (...n: number[]) => String.fromCharCode(...n);
const INVISIBLE: [string, string][] = [["U+200B", ch(0x200b)], ["U+200C", ch(0x200c)], ["U+200D", ch(0x200d)], ["U+2060", ch(0x2060)], ["U+FEFF", ch(0xfeff)], ["U+0085", ch(0x85)], ["U+2028", ch(0x2028)], ["U+2029", ch(0x2029)]];
const SPACES: [string, string][] = [["space", ch(0x20)], ["tab", ch(9)], ["newline", ch(10)], ["carriage return", ch(13)], ["vertical tab", ch(11)], ["form feed", ch(12)], ["no-break space", ch(0xa0)], ["ideographic space", ch(0x3000)], ["en space", ch(0x2002)], ["narrow no-break space", ch(0x202f)]];
const CLEAN_MS = EMP_CLEAN_FROM_MS + 1;

/* ------------------------------------------------------------------------------------------------ 1. employee ID */
/** The rule written a second time with no regex: NFKC, upper case, keep only the characters A to Z and 0 to 9. */
const modelEmp = (raw: string): string => { let o = ""; for (const c of raw.normalize("NFKC").toUpperCase()) if ((c >= "A" && c <= "Z") || (c >= "0" && c <= "9")) o += c; return o; };

describe("employee ID: NFKC, upper case, keep A-Z 0-9", () => {
  const rows: [string, string, string][] = [
    ["lower case", "e101", "E101"], ["dashes and dots", "e-101.b", "E101B"], ["slashes and underscores", "e/101_b", "E101B"], ["inner and edge spaces", "  e 101  ", "E101"], ["tabs and new lines", "e" + ch(9, 10) + "101", "E101"],
    ["full-width letters and digits", "ＥＭＰ１２３", "EMP123"], ["circled digit and superscript", "A" + ch(0x2460) + ch(0xb2), "A12"], ["ligature fi", ch(0xfb01) + "1", "FI1"],
    ["sharp s becomes SS", "STRA" + ch(0xdf) + "E1", "STRASSE1"], ["dotless i", "k" + ch(0x131) + "m1", "KIM1"], ["Kelvin sign", ch(0x212a) + "1", "K1"],
    ["accented letter is not A-Z (dropped)", "caf" + ch(0xe9) + "1", "CAF1"], ["Devanagari digits and letters are dropped", "A" + ch(0x967, 0x928) + "1", "A1"], ["emoji dropped", "A1" + ch(0xd83d, 0xde00) + "B", "A1B"],
    ["invisible characters dropped", "a" + ch(0x200b) + "1" + ch(0xfeff) + "b", "A1B"], ["only punctuation cleans to nothing", "--//..", ""], ["only spaces", "    ", ""], ["only digits", "0001234", "0001234"],
  ];
  for (const [label, raw, want] of rows) test(`cleanEmpId: ${label}`, () => { expect(cleanEmpId(raw)).toBe(want); expect(modelEmp(raw)).toBe(want); });
  test("cleanEmpId agrees with the second, regex-free model on 20 000 mixed inputs", () => {
    const pool = ["a", "Z", "0", "9", "-", " ", "_", "/", ".", ch(0xff21), ch(0xff11), ch(0x200b), ch(0xe9), ch(0xdf), ch(0xfb01), "@", ch(0x3000), ch(0x2460)];
    let s = 12345; const rnd = (n: number) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 20000; i++) { let t = ""; for (let k = rnd(14); k > 0; k--) t += pool[rnd(pool.length)]; expect([t, cleanEmpId(t)]).toEqual([t, modelEmp(t)]); }
  });
});

describe("employee ID on a game on the new reading: cap 30 AFTER cleaning, empty refused, nothing typed is nothing", () => {
  test("30 characters accepted, 31 refused (letters), but 41 typed characters that clean to 28 are accepted", () => {
    expect(normEmp("A".repeat(30), true)).toBe("A".repeat(30));
    expect(normEmp("A".repeat(31), true)).toBeNull();
    expect(normEmp("AB-".repeat(13) + "AB", true)).toBe("AB".repeat(1) + "AB".repeat(13)); // 41 typed, 28 kept
    expect(normEmp("-".repeat(40) + "A".repeat(30), true)).toBe("A".repeat(30)); // 70 typed, 30 kept
    expect(normEmp("-".repeat(40) + "A".repeat(31), true)).toBeNull();
  });
  test("empty after cleaning is refused (null), while nothing typed at all is the empty string (the caller decides)", () => {
    for (const t of ["--", "//", " . ", ch(0x200b), ch(0xe9)]) expect([t, normEmp(t, true)]).toEqual([t, null]);
    for (const t of ["", "   ", undefined, null]) expect([String(t), normEmp(t as any, true)]).toEqual([String(t), ""]);
  });
  test("normId (employee kind) gives the same answers and never returns letters for an e-mail", () => {
    expect(normId("e-101", "emp", true)).toBe("E101");
    for (const t of ["a@b.com", "A.B@C.IN", "a" + ch(0xff20) + "b.com", "1b-678@x", "@", "  a @b "]) expect([t, normId(t, "emp", true), normId(t, "emp", false)]).toEqual([t, null, null]);
  });
  test("an e-mail in an employee-ID game gets one plain refusal (no letters of the address) on either reading", () => {
    for (const clean of [true, false]) { const m = badIdMessage("rajat.agarwal@acme.com", "emp", clean); expect(m).toBe("This looks like an Email ID. This game asks for an employee ID: letters and numbers only."); expect(m).not.toMatch(/RAJAT|AGARWAL|ACME|rajat|acme/); }
  });
  test("looksLikeEmail sees the full-width at sign too (NFKC first)", () => { expect(looksLikeEmail("a" + ch(0xff20) + "b.com")).toBe(true); expect(looksLikeEmail("a-b")).toBe(false); });
});

async function idGame(kind: "emp" | "email" = "emp", clean = true, over: Record<string, unknown> = {}) {
  const o = await organizer(), id = uid(); expect((await create(o.key, id, { cap: 20, ...over })).status).toBe(200); expect((await publish(o.key, id)).status).toBe(200);
  expect((await call("PATCH", `/api/z/${id}/settings`, { verify: "id", idKind: kind }, o.h)).status).toBe(200);
  if (clean) W.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(CLEAN_MS, id);
  return { o, id };
}
const listIds = (g: { o: any; id: string }, ids: string[]) => call("POST", `/api/z/${g.id}/people`, { people: ids.map((e, i) => ({ name: "P" + i, empId: e })) }, g.o.h);
const joinAs = (id: string, empId: string, i: number) => call("POST", `/api/z/${id}/join`, { name: "G" + i, device: dev(i), empId });

describe("employee ID through the real join door", () => {
  test("every spelling of one listed ID is that listed person (joins, no waiting list)", async () => {
    for (const typed of ["1b-678", "1B 678", "1b/678.", "１Ｂ６７８", "  1b678  ", "1" + ch(0x200b) + "B678"]) {
      const g = await idGame(); expect((await j(await listIds(g, ["1B678"]))).added).toBe(1);
      const r = await joinAs(g.id, typed, 1), b = await j(r);
      expect([typed, r.status, b.code]).toEqual([typed, 200, undefined]);
      expect(one("SELECT COUNT(*) AS c FROM participant WHERE eid=?", g.id).c).toBe(1);
    }
  });
  test("31 letters, only punctuation and an empty box are refused with 400 and no participant is made", async () => {
    const g = await idGame(); await listIds(g, ["E1"]);
    for (const [typed, i] of [["A".repeat(31), 1], ["--//", 2], ["", 3]] as [string, number][]) { const r = await joinAs(g.id, typed, i); expect([typed.length, r.status]).toEqual([typed.length, 400]); }
    expect(one("SELECT COUNT(*) AS c FROM participant WHERE eid=?", g.id).c).toBe(0);
  });
  test("an e-mail typed in an employee-ID game: 400, code bad-id, the plain sentence, no letters of the address, on both readings", async () => {
    for (const clean of [true, false]) {
      const g = await idGame("emp", clean), r = await joinAs(g.id, "Rajat.Agarwal＠Acme.com", 1), b = await j(r);
      expect([r.status, b.code, b.error]).toEqual([400, "bad-id", "This looks like an Email ID. This game asks for an employee ID: letters and numbers only."]);
      expect(JSON.stringify(b)).not.toMatch(/rajat|agarwal|acme/i);
    }
  });
  test("the list door refuses the same e-mail with the row named invalid, and an empty-after-cleaning row too", async () => {
    const g = await idGame(), r = await j(await listIds(g, ["a@b.com", "--", "E7"]));
    expect([r.added, r.invalid.length]).toEqual([1, 2]);
  });
  test("two spellings of one ID in one upload: one person, the other named as a duplicate; a third different ID is added", async () => {
    const g = await idGame(), r = await j(await listIds(g, ["ab-12", "AB 12", "ab12", "AB13"]));
    expect([r.added, r.duplicates, r.duplicateRows.length]).toEqual([2, 2, 2]);
  });
  test("a second person who types another spelling of an ID that is already in the game does not become a second participant", async () => {
    const g = await idGame(); await listIds(g, ["E100"]);
    expect((await joinAs(g.id, "e-100", 1)).status).toBe(200);
    const r = await joinAs(g.id, "E 100", 2);
    expect(r.status).not.toBe(200); expect(one("SELECT COUNT(*) AS c FROM participant WHERE eid=?", g.id).c).toBe(1);
  });
  test("the hash is by the cleaned ID: the same on every spelling and in every game", async () => {
    const a = await empHashOf(W.env, cleanEmpId("1b-678")), b = await empHashOf(W.env, cleanEmpId("１Ｂ 678")), c = await empHashOf(W.env, "1B678");
    expect(a).toBe(b); expect(a).toBe(c); expect(a).not.toBe(await empHashOf(W.env, "1B679"));
  });
  // PRODUCT DEFECT PD-1: the owner's sentence for an over-long ID is 'This ID is too long. An employee ID may be up to 30 characters once cleaned.' The product answers 'An employee ID has letters and numbers only (up to 30).' on the server (people.ts badIdMessage) and on the phone (z.js showRead).
  test.failing("a 31-letter ID is answered with the too-long sentence (server)", async () => {
    const g = await idGame(), b = await j(await joinAs(g.id, "A".repeat(31), 1));
    expect([b.code, b.error]).toEqual(["bad-id", "This ID is too long. An employee ID may be up to 30 characters once cleaned."]);
  });
  test("what the server says for a 31-letter ID today (evidence for PD-1)", async () => {
    const g = await idGame(), b = await j(await joinAs(g.id, "A".repeat(31), 1));
    expect([b.code, b.error]).toEqual(["bad-id", "An employee ID has letters and numbers only (up to 30)."]);
  });
});

/* ------------------------------------------------------------------------------------------------ 2. participant Email ID */
/** The rule a second time, no regex: NFKC, trim, remove white space and the invisible characters wherever they are, lower case. */
const modelEmailId = (raw: string): string => {
  const drop = new Set([...SPACES.map((x) => x[1]), ...INVISIBLE.map((x) => x[1]), ch(0x2000), ch(0x2001), ch(0x2003), ch(0x2004), ch(0x2005), ch(0x2006), ch(0x2007), ch(0x2008), ch(0x2009), ch(0x200a), ch(0x1680), ch(0x205f)]);
  let o = ""; for (const c of raw.normalize("NFKC")) if (!drop.has(c)) o += c; return o.toLowerCase();
};
describe("participant Email ID: NFKC, trim, inner spaces and invisible characters removed, lower case", () => {
  for (const [name, c] of SPACES) test(`an inner ${name} is removed`, () => { expect(cleanEmail("ab" + c + "c@x.com")).toBe("abc@x.com"); expect(cleanEmail(c + "abc@x.com" + c)).toBe("abc@x.com"); });
  for (const [name, c] of INVISIBLE) test(`${name} is removed inside and at both ends`, () => { expect(cleanEmail("ab" + c + "c@x" + c + ".com")).toBe("abc@x.com"); expect(cleanEmail(c + "abc@x.com" + c)).toBe("abc@x.com"); });
  test("full-width at sign and letters (NFKC), upper case to lower case, dots, plus tags and digits untouched", () => {
    expect(cleanEmail("Ｒａｊａｔ.Agarwal+Tag１＠ＡＣＭＥ.com")).toBe("rajat.agarwal+tag1@acme.com");
    expect(cleanEmail("  A.B+c_d-e@F-G.co.IN ")).toBe("a.b+c_d-e@f-g.co.in");
  });
  test("agrees with the regex-free model on 20 000 mixed inputs", () => {
    const pool = ["a", "B", "z", "0", "@", ".", "+", "-", ch(0x20), ch(9), ch(0x200b), ch(0xfeff), ch(0x85), ch(0x2028), ch(0x2060), ch(0xff20), ch(0xff21), ch(0x3000), "É", ch(0xdf)];
    let s = 777; const rnd = (n: number) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
    for (let i = 0; i < 20000; i++) { let t = ""; for (let k = rnd(16); k > 0; k--) t += pool[rnd(pool.length)]; expect([t, cleanEmail(t)]).toEqual([t, modelEmailId(t)]); }
  });
  test("normId (email kind): a clean address is kept; incomplete ones are refused; nothing typed is the empty string", () => {
    expect(normId("A B" + ch(0x200b) + "@X.com", "email")).toBe("ab@x.com");
    for (const t of ["rajat1@", "@x.com", "a@b", "a@b.c", "plain", "a@@b.com"]) expect([t, normId(t, "email")]).toEqual([t, null]);
    for (const t of ["", "   ", ch(0x200b), undefined]) expect([String(t), normId(t as any, "email")]).toEqual([String(t), ""]);
  });
  test("through the door: the listed 'ab c@x.com' (with a zero-width space) is the person who types 'ABC＠X.COM'", async () => {
    const g = await idGame("email", false); const add = await j(await listIds(g, ["a" + ch(0x200b) + "b c@x.com"]));
    expect([add.added, add.invalid]).toEqual([1, []]);
    const r = await joinAs(g.id, "ＡＢＣ＠Ｘ.COM", 1); expect([r.status, (await j(r)).code]).toEqual([200, undefined]);
  });
  test("the same address in another case, with a space, or with a zero-width character is a duplicate in one upload", async () => {
    const g = await idGame("email", false), r = await j(await listIds(g, ["a@x.com", "A@X.COM", "a @x.com", "a" + ch(0x200d) + "@x.com", "b@x.com"]));
    expect([r.added, r.duplicates]).toEqual([2, 3]);
  });
});

/* ------------------------------------------------------------------------------------------------ 3. ACCOUNT / sign-in / host / payment e-mails */
describe("account e-mail: an inner space or invisible character is REFUSED, never repaired", () => {
  for (const [name, c] of [...SPACES, ...INVISIBLE]) test(`cleanAccountEmail refuses an inner ${name}`, () => { expect(cleanAccountEmail("ab" + c + "c@x.com")).toBe(""); expect(cleanAccountEmail("abc@x" + c + ".com")).toBe(""); });
  test("a plain trim of white space at the ends is still allowed, and the full-width at sign is read", () => { expect(cleanAccountEmail("  Abc" + ch(0xff20) + "X.com" + ch(9))).toBe("abc@x.com"); });
  const bads: [string, string][] = [...SPACES, ...INVISIBLE].map(([n, c]) => [n, "ab" + c + "c@x.com"]);
  test("sign-up, sign-in code and verify refuse each, make no account and send no mail", async () => {
    for (const [n, e] of bads) {
      const a = await call("POST", "/api/start", { email: e }), b = await call("POST", "/api/auth/email", { email: e }), c = await call("POST", "/api/auth/verify", { email: e, code: "123456" });
      expect([n, a.status, b.status, c.status]).toEqual([n, 400, 400, 400]); expect((await j(a)).token).toBeUndefined();
    }
    expect(one("SELECT COUNT(*) AS c FROM organizer_email").c).toBe(0); expect(one("SELECT COUNT(*) AS c FROM outbox").c).toBe(0);
  });
  test("add a Host: refused with a bad address alone and with a mobile number beside it", async () => {
    const o = await organizer();
    for (const [n, e] of bads) { for (const extra of [{}, { mobile: "9876500009" }]) { const r = await call("POST", "/api/org/host", { email: e, ...extra }, o.h); expect([n, Object.keys(extra).length, r.status]).toEqual([n, Object.keys(extra).length, 400]); } }
  });
  test("Host sign-up e-mail step refuses each", async () => {
    const o = await organizer(); const hk = await j(await call("POST", "/api/org/host", { mobile: "9876500009", email: "host@acme.com" }, o.h));
    for (const [n, e] of bads) { const r = await call("POST", "/api/host/setup/email", { email: e }, { "x-organizer": hk.hostKey }); expect([n, r.status]).toEqual([n, 400]); }
  });
  // The payment door (/api/checkout) checks the address with a test that only knows white space, then cleans it with cleanAccountEmail. Invisible characters get through the first check; see PD-2.
  test("checkout refuses an inner space, tab and no-break space in the buyer's e-mail", async () => {
    const o = await organizer();
    for (const [n, e] of bads.filter(([n]) => SPACES.some((s) => s[0] === n))) { const r = await checkout(o.key, { email: e, pack: 100 }); expect([n, r.status]).toEqual([n, 400]); }
  });
  test.failing("PD-2: checkout refuses an invisible character inside the buyer's e-mail (U+200B, U+200C, U+200D, U+2060, U+FEFF, U+0085, U+2028, U+2029)", async () => {
    const o = await organizer();
    for (const [n, e] of bads.filter(([n]) => INVISIBLE.some((s) => s[0] === n))) { const r = await checkout(o.key, { email: e, pack: 100 }); expect([n, r.status]).toEqual([n, 400]); }
  });
});

/* ------------------------------------------------------------------------------------------------ 4. the lock: who holds an ID hash */
describe("idKind / verify lock", () => {
  const LOCK_KIND = "You already have people listed. Start a new game to use a different kind of ID.", LOCK_VERIFY = "You already have people listed. Start a new game to use a different way of asking for IDs.";
  const patch = (g: { o: any; id: string }, b: Record<string, unknown>) => call("PATCH", `/api/z/${g.id}/settings`, b, g.o.h);
  test("a person listed WITH an ID (hash held) locks both; the sentence follows what was changed; the code is id-locked; the game is unchanged", async () => {
    const g = await idGame("emp", false); await listIds(g, ["E1"]);
    const before = one("SELECT config FROM engagement WHERE id=?", g.id).config;
    for (const [b, words] of [[{ idKind: "email" }, LOCK_KIND], [{ verify: "mobile" }, LOCK_VERIFY], [{ verify: "mobile", idKind: "email" }, LOCK_KIND]] as [Record<string, unknown>, string][]) {
      const r = await patch(g, b), body = await j(r); expect([JSON.stringify(b), r.status, body.error, body.code]).toEqual([JSON.stringify(b), 409, words, "id-locked"]);
    }
    expect(one("SELECT config FROM engagement WHERE id=?", g.id).config).toBe(before);
  });
  test("a person who JOINED with an ID (listed row removed) locks it", async () => {
    const g = await idGame("emp", false); await listIds(g, ["E1"]); expect((await joinAs(g.id, "E1", 1)).status).toBe(200);
    W.raw.prepare("DELETE FROM person WHERE eid=?").run(g.id);
    const r = await patch(g, { idKind: "email" }); expect([r.status, (await j(r)).code]).toEqual([409, "id-locked"]);
  });
  test("saving the same values or other settings still works with people in; a removed person unlocks", async () => {
    const g = await idGame("emp", false); const add = await j(await listIds(g, ["E1"]));
    for (const b of [{ idKind: "emp" }, { verify: "id" }, { name: "Renamed" }]) expect([JSON.stringify(b), (await patch(g, b)).status]).toEqual([JSON.stringify(b), 200]);
    expect((await call("POST", `/api/z/${g.id}/people/${add.people[0].id}/remove`, {}, g.o.h)).status).toBe(200);
    expect((await patch(g, { idKind: "email" })).status).toBe(200);
  });
  // PRODUCT DEFECT PD-3: the rule is "once anyone HOLDING AN ID HASH is listed or joined". The check (worker.ts, id-locked line) counts every person and every participant, including a person who joined with a mobile number only
  // (they hold no ID hash, so nothing is orphaned by changing the kind of ID). A game with only phone-number guests is locked as if it had IDs.
  test.failing("a game whose only people joined by mobile number (no ID hash) can still change the kind of ID", async () => {
    const o = await organizer(), id = uid(); await create(o.key, id, { cap: 8 }); await publish(o.key, id);
    expect((await call("POST", `/api/z/${id}/join`, { phone: mob(1), name: "P", device: dev(1) })).status).toBe(200);
    expect((await call("PATCH", `/api/z/${id}/settings`, { idKind: "email" }, o.h)).status).toBe(200);
  });
  test("what the product does today for PD-3 (evidence): 409 id-locked for a phone-only game", async () => {
    const o = await organizer(), id = uid(); await create(o.key, id, { cap: 8 }); await publish(o.key, id);
    await call("POST", `/api/z/${id}/join`, { phone: mob(1), name: "P", device: dev(1) });
    const r = await call("PATCH", `/api/z/${id}/settings`, { idKind: "email" }, o.h); expect([r.status, (await j(r)).code]).toEqual([409, "id-locked"]);
  });
});

/* ------------------------------------------------------------------------------------------------ 5. endedAtMs */
// The owner's rule: endedAtMs is the real end of the game. Phones-confirmed or organizer end: returned whatever the clock says. Scheduled end: recomputed at read time (+60 s), returned only once now >= that bound.
// Absent while the game can still be live. Once returned it never moves. Purge / erase is not an end. Cancel is not an end.
// PRODUCT DEFECT PD-4: no response of this service carries a field called endedAtMs (searched: public info, organizer summary, life, control, game list, report). The only end value is `endMs` on GET /api/z/:id/life, which is ALWAYS present
// (the planned end while the game is live) and so breaks "absent while the game can be live". The tests below read `endedAtMs` anywhere in those answers.
async function endedAt(id: string, h: Record<string, string>, now: number): Promise<{ found: boolean; value?: number }> {
  const seen = (o: any): number | undefined => { if (!o || typeof o !== "object") return undefined; if ("endedAtMs" in o) return o.endedAtMs; for (const v of Object.values(o)) { const r = seen(v); if (r !== undefined) return r; } return undefined; };
  for (const p of ["info", "summary", "life", "report", "control"]) { const r = await call("GET", `/api/z/${id}/${p}`, undefined, h, now); if (r.status !== 200) continue; const v = seen(await j(r)); if (v !== undefined) return { found: true, value: v }; }
  const l = await call("GET", "/api/org/games", undefined, h, now); if (l.status === 200) { const v = seen(await j(l)); if (v !== undefined) return { found: true, value: v }; }
  return { found: false };
}
async function played() {
  const o = { key: undefined as string | undefined, h: PLAT }, id = uid("END"); // a platform-made game that began two hours ago (an organizer cannot publish into the past)
  expect((await create(undefined, id, { startRound: startIn(-2 * HOUR), callSeconds: 20, cap: 50 })).status).toBe(200);
  const row = () => one("SELECT * FROM engagement WHERE id=?", id);
  const bound = await endBoundMs(W.env as any, row());
  return { o, id, bound };
}
describe("endedAtMs", () => {
  test("GUARD: absent while the game can still be live (before the scheduled end)", async () => {
    const g = await played();
    for (const now of [g.bound - 6 * HOUR, g.bound - 1000, g.bound - 1]) expect([now - g.bound, (await endedAt(g.id, g.o.h, now)).found]).toEqual([now - g.bound, false]);
  });
  test.failing("PD-4: the scheduled end is returned at read time once now >= the bound (bound already includes the +60 s), and equals the bound", async () => {
    const g = await played();
    expect((await endedAt(g.id, g.o.h, g.bound)).value).toBe(g.bound);
    expect((await endedAt(g.id, g.o.h, g.bound + 5 * HOUR)).value).toBe(g.bound);
  });
  test.failing("PD-4: once returned it never moves, whatever later reads happen", async () => {
    const g = await played(); const first = (await endedAt(g.id, g.o.h, g.bound + MIN)).value;
    expect(first).toBe(g.bound);
    for (const dt of [2 * MIN, HOUR, 23 * HOUR]) expect((await endedAt(g.id, g.o.h, g.bound + dt)).value).toBe(first);
  });
  test.failing("PD-4: a phones-confirmed end is returned whatever the clock says, even before the scheduled bound", async () => {
    const g = await played(); const early = g.bound - 3 * HOUR;
    W.raw.prepare("INSERT INTO life(eid,end_ms,end_src) VALUES(?,?,'phones')").run(g.id, early);
    expect((await endedAt(g.id, g.o.h, early - HOUR)).value).toBe(early);
  });
  test.failing("PD-4: an organizer end is returned whatever the clock says", async () => {
    const g = await played(); const at = g.bound - 2 * HOUR;
    W.raw.prepare("INSERT INTO life(eid,end_ms,end_src) VALUES(?,?,'organizer')").run(g.id, at);
    expect((await endedAt(g.id, g.o.h, at - HOUR)).value).toBe(at);
  });
  test("GUARD: a cancelled game has no endedAtMs (cancel is not an end), now or after the bound", async () => {
    const g = await played(); W.raw.prepare("UPDATE engagement SET cancelled_ms=? WHERE id=?").run(g.bound - 3 * HOUR, g.id);
    for (const now of [g.bound - 2 * HOUR, g.bound + HOUR]) expect((await endedAt(g.id, g.o.h, now)).found).toBe(false);
  });
  test("GUARD: erasing the personal data of a game that is still live is not an end: endedAtMs stays absent", async () => {
    const g = await played(); await erasePersonal(W.env as any, g.id, g.bound - 3 * HOUR, "organizer");
    expect((await endedAt(g.id, g.o.h, g.bound - 3 * HOUR)).found).toBe(false);
  });
  test("EVIDENCE for PD-4: GET life always carries endMs, even while the game is live, and no answer carries endedAtMs", async () => {
    const g = await played(); const l = await j(await call("GET", `/api/z/${g.id}/life`, undefined, g.o.h, g.bound - 6 * HOUR));
    expect(typeof l.endMs).toBe("number"); expect(l.endedAtMs).toBeUndefined(); expect(l.endMs).toBe(g.bound);
  });
});

/* ------------------------------------------------------------------------------------------------ the guide texts the server can send (exact words) */
describe("the exact words", () => {
  test("lock sentences, over-length and e-mail refusals are the owner's words", async () => {
    const src = await Bun.file(new URL("../src/worker.ts", import.meta.url)).text();
    expect(src).toContain("You already have people listed. Start a new game to use a different kind of ID.");
    expect(src).toContain("You already have people listed. Start a new game to use a different way of asking for IDs.");
    expect(badIdMessage("a@b.com", "emp", true)).toBe("This looks like an Email ID. This game asks for an employee ID: letters and numbers only.");
    expect(badIdMessage("x@", "email", true)).toBe("Please check your Email ID. It looks incomplete.");
  });
});
