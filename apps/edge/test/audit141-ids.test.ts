// Snakes 1.4.1 audit items 3, 4, 8, 9, 10 on the server: how an ID is read, when the kind of ID is locked, clone re-hash, over-long IDs, duplicate rows by name.
// A game "made after the cleaning date" is simulated by setting its created_ms past the placeholder, because EMP_CLEAN_FROM_MS is year 2100 until the release session sets it.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { call, create, dev, j, mob, one, organizer, publish, q, reset, restore, uid, W, T } from "./param-harness";
import { EMP_CLEAN_FROM_MS, empHashOf } from "../src/people";
import { sealPii } from "../src/pii";

beforeEach(() => reset());
afterEach(restore);
const CLEAN_MS = EMP_CLEAN_FROM_MS + 1;
const cleanOn = (id: string) => W.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(CLEAN_MS, id);
const WHY = "Same person as an earlier row (the ID reads the same after cleaning)."; // 1.4.1 round 2: a row is named by the ID as typed
const LOCK = "You already have people listed. Start a new game to use a different kind of ID."; // the kind of ID was changed
const LOCK_VERIFY = "You already have people listed. Start a new game to use a different way of asking for IDs."; // only the way of asking (verify) was changed
async function game(over: Record<string, unknown> = {}, settings: Record<string, unknown> = {}, clean = false) {
  const o = await organizer(), id = uid(); expect((await create(o.key, id, { cap: 8, ...over })).status).toBe(200); expect((await publish(o.key, id)).status).toBe(200);
  if (clean) cleanOn(id);
  if (Object.keys(settings).length) expect((await call("PATCH", `/api/z/${id}/settings`, settings, o.h)).status).toBe(200);
  return { o, id };
}
const patch = (g: { o: any; id: string }, b: Record<string, unknown>) => call("PATCH", `/api/z/${g.id}/settings`, b, g.o.h);
const addPeople = (g: { o: any; id: string }, people: unknown[]) => call("POST", `/api/z/${g.id}/people`, { people }, g.o.h);
const joinId = (id: string, empId: string, i = 1, extra: Record<string, unknown> = {}) => call("POST", `/api/z/${id}/join`, { name: "G" + i, device: dev(i), empId, ...extra });

describe("idClean: the server tells the screens how it reads an ID", () => {
  test("/info and the organizer summary say idClean false for a game made before the date and true after it", async () => {
    const g = await game({}, { verify: "id" });
    expect((await j(await call("GET", `/api/z/${g.id}/info`))).idClean).toBe(false);
    expect((await j(await call("GET", `/api/z/${g.id}/summary`, undefined, g.o.h))).idClean).toBe(false);
    cleanOn(g.id);
    expect((await j(await call("GET", `/api/z/${g.id}/info`))).idClean).toBe(true);
    expect((await j(await call("GET", `/api/z/${g.id}/summary`, undefined, g.o.h))).idClean).toBe(true);
  });
});

describe("item 4: the kind of ID is locked once anyone is listed or has joined", () => {
  test("nobody yet: the kind and the verify rule can change freely", async () => {
    const g = await game();
    for (const b of [{ idKind: "email" }, { idKind: "emp" }, { verify: "id" }, { verify: "both", idKind: "email" }, { verify: "mobile", idKind: "emp" }]) expect([JSON.stringify(b), (await patch(g, b)).status]).toEqual([JSON.stringify(b), 200]);
  });
  test("a LISTED person (person row, not joined) locks idKind and verify, with the exact words and code", async () => {
    const g = await game({}, { verify: "id" });
    expect((await j(await addPeople(g, [{ name: "Asha", empId: "E101" }]))).added).toBe(1);
    expect(one("SELECT COUNT(*) AS c FROM participant WHERE eid=?", g.id).c).toBe(0); // proves this is the listed-only case
    for (const [b, words] of [[{ idKind: "email" }, LOCK], [{ verify: "mobile" }, LOCK_VERIFY], [{ verify: "both" }, LOCK_VERIFY], [{ verify: "either" }, LOCK_VERIFY], [{ verify: "mobile", idKind: "email" }, LOCK]] as [Record<string, unknown>, string][]) {
      const r = await patch(g, b), body = await j(r);
      expect([JSON.stringify(b), r.status, body.error, body.code]).toEqual([JSON.stringify(b), 409, words, "id-locked"]);
    }
    expect(one("SELECT config FROM engagement WHERE id=?", g.id).config).not.toContain("email");
  });
  test("a JOINED person (participant row, nobody listed) locks them too", async () => {
    const g = await game();
    expect((await call("POST", `/api/z/${g.id}/join`, { phone: mob(1), name: "Open", device: dev(1) })).status).toBe(200);
    expect(one("SELECT COUNT(*) AS c FROM participant WHERE eid=?", g.id).c).toBe(1);
    W.raw.prepare("DELETE FROM person WHERE eid=?").run(g.id); // joining also makes a list row: take it away, so only the participant row can be the reason for the lock
    expect(one("SELECT COUNT(*) AS c FROM person WHERE eid=?", g.id).c).toBe(0);
    expect(one("SELECT COUNT(*) AS c FROM participant WHERE eid=?", g.id).c).toBe(1);
    for (const [b, words] of [[{ verify: "id" }, LOCK_VERIFY], [{ idKind: "email" }, LOCK]] as [Record<string, unknown>, string][]) { const r = await patch(g, b), body = await j(r); expect([JSON.stringify(b), r.status, body.error, body.code]).toEqual([JSON.stringify(b), 409, words, "id-locked"]); }
  });
  test("saving the SAME values still works with people in the game, and so do other settings", async () => {
    const g = await game({}, { verify: "id", idKind: "email" });
    await addPeople(g, [{ name: "Asha", empId: "a@x.com" }]);
    for (const b of [{ idKind: "email" }, { verify: "id" }, { verify: "id", idKind: "email" }, { name: "Renamed", cap: 9 }]) expect([JSON.stringify(b), (await patch(g, b)).status]).toEqual([JSON.stringify(b), 200]);
  });
  test("a person who was removed no longer locks", async () => {
    const g = await game({}, { verify: "id" });
    const add = await j(await addPeople(g, [{ name: "Asha", empId: "E101" }]));
    expect((await patch(g, { idKind: "email" })).status).toBe(409);
    expect((await call("POST", `/api/z/${g.id}/people/${add.people[0].id}/remove`, {}, g.o.h)).status).toBe(200);
    expect((await patch(g, { idKind: "email" })).status).toBe(200);
  });
  test("a bad value is still the old 400, not a lock", async () => {
    const g = await game({}, { verify: "id" }); await addPeople(g, [{ name: "Asha", empId: "E101" }]);
    const r = await patch(g, { idKind: "x" }); expect(r.status).toBe(400); expect((await j(r)).code).toBeUndefined();
  });
});

describe("item 3 (server): an email typed in an employee-ID box gets the plain refusal", () => {
  test("a game on the new reading says 'This looks like an Email ID...'", async () => {
    const g = await game({}, { verify: "id" }, true);
    for (const t of ["a@b.com", "a＠b.com", "A.B@C.IN", "1b-678@x"]) { const r = await joinId(g.id, t), b = await j(r); expect([t, r.status, b.code, b.error]).toEqual([t, 400, "bad-id", "This looks like an Email ID. This game asks for an employee ID: letters and numbers only."]); }
  });
  test("a game on the old reading gives the same plain refusal for an email (1.4.1 round 2), never letters", async () => {
    const g = await game({}, { verify: "id" });
    const b = await j(await joinId(g.id, "a@b.com")); expect(b.code).toBe("bad-id"); expect(b.error).toBe("This looks like an Email ID. This game asks for an employee ID: letters and numbers only.");
  });
  test("an Email ID game takes the email and never says 'employee'", async () => {
    const g = await game({}, { verify: "id", idKind: "email" }, true);
    const bad = await j(await joinId(g.id, "rajat1@")); expect(bad.error).toBe("Please check your Email ID. It looks incomplete.");
    expect(JSON.stringify(bad)).not.toMatch(/employee/i);
  });
});

describe("item 9 (server): over-long IDs are refused AFTER cleaning, short ones with dashes are not", () => {
  test("new reading: 31 letters refused, 30 accepted, 40 characters that clean to 20 accepted", async () => {
    const g = await game({}, { verify: "id" }, true);
    await addPeople(g, [{ name: "Z", empId: "Z9" }]); // make the game open to anyone with an ID: an unlisted ID waits, it is not refused for length
    const long = await j(await joinId(g.id, "A".repeat(31), 1)); expect([long.code, long.error]).toEqual(["bad-id", "An employee ID has letters and numbers only (up to 30)."]);
    const dashed = "AB-".repeat(13) + "AB"; // 41 characters, 28 after cleaning
    expect(dashed.length).toBeGreaterThan(30);
    const ok = await joinId(g.id, dashed, 2); expect([ok.status, (await j(ok)).code]).not.toEqual([400, "bad-id"]);
    const edge = await joinId(g.id, "A".repeat(30), 3); expect((await j(edge)).code).not.toBe("bad-id");
  });
  test("organizer list rows: the 31-letter row is 'invalid', the dashed 41-character row is added", async () => {
    const g = await game({}, { verify: "id" }, true);
    const r = await j(await addPeople(g, [{ name: "Long", empId: "A".repeat(31) }, { name: "Dashed", empId: "AB-".repeat(13) + "AB" }]));
    expect([r.added, r.invalid.length]).toEqual([1, 1]);
  });
});

describe("item 10: duplicates after cleaning are named row by row", () => {
  test("three spellings of one ID: one is added, two are named with the reason, in order", async () => {
    const g = await game({}, { verify: "id" }, true);
    const r = await j(await addPeople(g, [{ name: "A", empId: "1B-678" }, { name: "B", empId: "1b 678" }, { name: "C", empId: "1B/678" }, { name: "D", empId: "2C-9" }]));
    expect([r.added, r.duplicates]).toEqual([2, 2]);
    expect(r.duplicateRows).toEqual([{ raw: "1b 678", why: WHY }, { raw: "1B/678", why: WHY }]);
  });
  // PB-2 of the first report was fixed in 1.4.1 round 2: a row that repeats someone already listed is now named too.
  test("a second upload of an already-listed ID is named too (every counted duplicate has a name)", async () => {
    const g = await game({}, { verify: "id" }, true);
    await addPeople(g, [{ name: "A", empId: "1B-678" }]);
    const r = await j(await addPeople(g, [{ name: "A again", empId: "1b 678" }]));
    expect([r.added, r.duplicates, r.duplicateRows]).toEqual([0, 1, [{ raw: "1b 678", why: "Already on the list." }]]);
  });
  test("Email ID games: the same address in another case is named", async () => {
    const g = await game({}, { verify: "id", idKind: "email" });
    const r = await j(await addPeople(g, [{ name: "A", empId: "a@x.com" }, { name: "B", empId: "A＠X.COM" }]));
    expect([r.added, r.duplicates, r.duplicateRows.map((x: any) => x.raw)]).toEqual([1, 1, ["A＠X.COM"]]);
  });
  test("mobile numbers: the same number twice is named as well", async () => {
    const g = await game();
    const r = await j(await addPeople(g, [{ name: "A", phone: mob(5) }, { name: "B", phone: "+91 " + mob(5) }]));
    expect([r.added, r.duplicates, r.duplicateRows.length]).toEqual([1, 1, 1]);
  });
  test("no duplicates: the list is empty and present", async () => {
    const g = await game({}, { verify: "id" }, true);
    const r = await j(await addPeople(g, [{ name: "A", empId: "E1" }, { name: "B", empId: "E2" }]));
    expect([r.added, r.duplicates, r.duplicateRows]).toEqual([2, 0, []]);
  });
  test("old reading (game before the date): '1B-678' and '1B 678' are two different people, as before", async () => {
    const g = await game({}, { verify: "id" });
    const r = await j(await addPeople(g, [{ name: "A", empId: "1B-678" }, { name: "B", empId: "1B 678" }]));
    expect([r.added, r.duplicates]).toEqual([2, 0]);
  });
});

describe("item 8: a clone re-hashes people with the NEW game's rule", () => {
  const CLONE_NOW = Date.UTC(2101, 0, 1); // after the placeholder date, so the clone is a "new reading" game
  const cloneAt = (g: { o: any; id: string }, now: number) => call("POST", `/api/z/${g.id}/clone`, { withPeople: true }, g.o.h, now);
  test("old-rule game with '1B-678' listed: the clone (new rule) holds the person under the hash of '1B678', not of '1B-678'", async () => {
    const g = await game({}, { verify: "id" });
    await addPeople(g, [{ name: "Asha", empId: "1b-678" }, { name: "Ravi", empId: "E102" }]);
    expect(q("SELECT ph FROM person WHERE eid=?", g.id).map((x) => x.ph).sort()).toEqual([await empHashOf(W.env, "1B-678"), await empHashOf(W.env, "E102")].sort());
    const c = await j(await cloneAt(g, CLONE_NOW)); expect([c.ok, c.peopleCopied]).toEqual([true, 2]);
    expect(one("SELECT created_ms FROM engagement WHERE id=?", c.id).created_ms).toBe(CLONE_NOW);
    expect(q("SELECT ph FROM person WHERE eid=?", c.id).map((x) => x.ph).sort()).toEqual([await empHashOf(W.env, "1B678"), await empHashOf(W.env, "E102")].sort());
  });
  test("then the person who types '1b 678' on the clone's join page IS the listed person (no one is orphaned)", async () => {
    const g = await game({}, { verify: "id" });
    await addPeople(g, [{ name: "Asha", empId: "1b-678" }]);
    const c = await j(await cloneAt(g, CLONE_NOW));
    const r = await call("POST", `/api/z/${c.id}/join`, { name: "Asha", device: dev(1), empId: "1b 678" }, {}, CLONE_NOW);
    expect([r.status, (await j(r)).code]).not.toEqual([403, "waiting"]);
  });
  test("a clone made BEFORE the date keeps the old hashes (same rule as the old game)", async () => {
    const g = await game({}, { verify: "id" });
    await addPeople(g, [{ name: "Asha", empId: "1b-678" }]);
    const c = await j(await call("POST", `/api/z/${g.id}/clone`, { withPeople: true }, g.o.h, T));
    expect(q("SELECT ph FROM person WHERE eid=?", c.id).map((x) => x.ph)).toEqual([await empHashOf(W.env, "1B-678")]);
  });
  test("a mobile-number game is copied as it was (the hash is the phone's)", async () => {
    const g = await game();
    await addPeople(g, [{ name: "Asha", phone: mob(7) }]);
    const before = q("SELECT ph FROM person WHERE eid=?", g.id)[0].ph;
    const c = await j(await cloneAt(g, CLONE_NOW));
    expect(q("SELECT ph FROM person WHERE eid=?", c.id)[0].ph).toBe(before);
  });
  test("a person whose stored ID the new rule refuses is left out of the clone, the rest come", async () => {
    const g = await game({}, { verify: "id" });
    await addPeople(g, [{ name: "Asha", empId: "E101" }]);
    const sealed = await sealPii(W.env as any, { phone: "", name: "Odd", empId: "odd@x.com" }); // an old row holding an email-looking ID
    W.raw.prepare("INSERT INTO person(eid,id,ph,pii,inviter,role,status,tok_hash,tok_sealed,approved_by,approved_ms,added_ms) VALUES(?,?,?,?,?,NULL,'invited','h','s',NULL,NULL,?)").run(g.id, "oddrow000001", "oddphash", sealed, "o", T);
    const c = await j(await cloneAt(g, CLONE_NOW));
    expect(c.peopleCopied).toBe(1);
    expect(q("SELECT ph FROM person WHERE eid=?", c.id).map((x) => x.ph)).toEqual([await empHashOf(W.env, "E101")]);
  });
});
