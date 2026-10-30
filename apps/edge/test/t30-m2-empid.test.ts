// TEST_HANDOFF Milestone 2, Employee ID rules 1 to 3. Pure cleaner tests plus the real Worker (list upload, "who" check, join) on an in-memory database.
// A game made at or after the switch-on instant reads IDs the new way; the tests flip the game row's created_ms (a test-only database edit) because the switch-on constant is a year-2100 placeholder.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { cleanEmpId, normEmp, empCleanFor, empHashOf, EMP_CLEAN_FROM_MS } from "../src/people";
import { type World, addPeople, closeWorld, dev, joinGame, json, mob, newWorld, one, rows, setupGame, who } from "./t30-helpers";

const FOUR = ["1B-678", "1b-678", "1B/678", "1B 678"];
let w: World;
beforeEach(() => { w = newWorld(); });
afterEach(() => closeWorld(w));

describe("employee ID cleaner (unit)", () => {
  test("the four spellings all become 1B678", () => { for (const t of FOUR) { expect(cleanEmpId(t)).toBe("1B678"); expect(normEmp(t, true)).toBe("1B678"); } });
  test("tabs, newlines, dots, underscores, backslashes, brackets and mixed separators are dropped", () => {
    for (const t of ["1B\t678", "1B\n678", "1.B.6.7.8", "1B_678", "1B\\678", "(1B)678", "[1B]-[678]", "  1b -- 678  ", "1B/6/7/8"]) expect(normEmp(t, true)).toBe("1B678");
  });
  test("full-width letters, digits and dash read as the plain ID", () => { expect(normEmp("１Ｂ－６７８", true)).toBe("1B678"); expect(normEmp("１ｂ　６７８", true)).toBe("1B678"); });
  test("zero-width characters (space, non-joiner, joiner, word joiner, BOM) are dropped", () => {
    for (const z of ["​", "‌", "‍", "⁠", "﻿"]) { expect(normEmp(`1B${z}678`, true)).toBe("1B678"); expect(normEmp(`${z}1B678${z}`, true)).toBe("1B678"); }
  });
  test("emoji, accents and symbols inside an ID are removed; the rest is kept", () => { expect(normEmp("1B😀678", true)).toBe("1B678"); expect(normEmp("1B👨‍👩‍👧678", true)).toBe("1B678"); expect(normEmp("1B#$%678!", true)).toBe("1B678"); expect(normEmp("1B-6é7ü8", true)).toBe("1B678"); });
  test("a non-Latin letter is not an ID character (it is dropped), so an ID made only of them is refused", () => { expect(normEmp("१२३", true)).toBeNull(); expect(normEmp("日本語", true)).toBeNull(); expect(normEmp("1B日本678", true)).toBe("1B678"); });
  test("only symbols or only emoji is refused (null), only blanks is 'nothing typed' (empty string)", () => {
    for (const t of ["---", "///", "!@#$%^&*()", "😀😀", "​​​", "...", "-_-"]) expect(normEmp(t, true)).toBeNull();
    for (const t of ["", "   ", "\t \n", undefined, null]) expect(normEmp(t as any, true)).toBe("");
  });
  test("the 30 character cap counts characters AFTER cleaning: 30 passes, 31 is refused, 30 letters hidden among 100 symbols pass", () => {
    expect(normEmp("A".repeat(30), true)).toBe("A".repeat(30));
    expect(normEmp("A".repeat(31), true)).toBeNull();
    expect(normEmp("A".repeat(300), true)).toBeNull();
    expect(normEmp("-".repeat(100) + "A".repeat(30) + "-".repeat(100), true)).toBe("A".repeat(30));
    expect(normEmp("A-".repeat(31), true)).toBeNull(); // 31 letters once the dashes are gone
  });
  test("the cleaner is idempotent and never returns anything but A-Z 0-9", () => {
    for (const t of [...FOUR, "１Ｂ－６７８", "x y z", "ab​cd", "Ünï-çode"]) { const c = cleanEmpId(t); expect(cleanEmpId(c)).toBe(c); expect(c).toMatch(/^[A-Z0-9]*$/); }
  });
  test("the hash of an ID is the same for every spelling and differs for another ID", async () => {
    const hs = await Promise.all(FOUR.map((t) => empHashOf({ PHONE_SALT: "s" }, normEmp(t, true)!)));
    expect(new Set(hs).size).toBe(1);
    expect(await empHashOf({ PHONE_SALT: "s" }, "1B679")).not.toBe(hs[0]);
    expect(await empHashOf({ PHONE_SALT: "other" }, "1B678")).not.toBe(hs[0]); // salt is part of the hash
  });
  test("the switch: a game is new only when its created_ms is at or after the threshold, and a missing or odd created_ms is old", () => {
    expect(empCleanFor({ created_ms: 200 }, 200)).toBe(true);
    expect(empCleanFor({ created_ms: 199 }, 200)).toBe(false);
    expect(empCleanFor({}, 200)).toBe(false); expect(empCleanFor(null, 200)).toBe(false); expect(empCleanFor({ created_ms: null }, 200)).toBe(false); expect(empCleanFor({ created_ms: "300" as any }, 200)).toBe(false);
    expect(EMP_CLEAN_FROM_MS).toBeGreaterThan(Date.UTC(2026, 11, 31)); // the placeholder: nobody gets the new rule before the boss sets it at deploy
  });
  test("old reading (clean=false) keeps dots, dashes and slashes, drops only spaces, and is upper case", () => {
    expect(normEmp("1b-678")).toBe("1B-678"); expect(normEmp("1B/678")).toBe("1B/678"); expect(normEmp("1.b.678")).toBe("1.B.678"); expect(normEmp("1B 678")).toBe("1B678");
    expect(normEmp("---")).toBeNull(); expect(normEmp("😀")).toBeNull(); expect(normEmp("A".repeat(31))).toBeNull();
  });
});

describe("employee ID through the real Worker, game made after the switch (new reading)", () => {
  test("organizer list upload: the four spellings are ONE person (1 added, 3 duplicates counted after cleaning)", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    const r = await json(await addPeople(w, g.key, g.id, FOUR.map((t, i) => ({ name: "Asha " + i, empId: t }))));
    expect(r.added).toBe(1); expect(r.duplicates).toBe(3); expect(r.invalid).toEqual([]);
    expect(rows(w, "SELECT COUNT(*) c FROM person WHERE eid=?", g.id)[0].c).toBe(1);
  });
  test("list upload: unicode, full-width, zero-width and emoji spellings of different IDs are each stored once under the cleaned ID", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    const r = await json(await addPeople(w, g.key, g.id, [{ name: "A", empId: "１Ｂ－６７８" }, { name: "B", empId: "2C​-9😀9" }, { name: "C", empId: "3d 4e" }]));
    expect(r.added).toBe(3); expect(r.invalid).toEqual([]);
    for (const [spell, clean] of [["1b/678", "1B678"], ["2c 99", "2C99"], ["3D-4E", "3D4E"]]) { expect(cleanEmpId(spell)).toBe(clean); expect((await json(await who(w, g.id, spell))).known).toBe(true); }
  });
  test("list upload refuses symbols-only and over-30 with the plain words, and does not store them", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    const r = await json(await addPeople(w, g.key, g.id, [{ name: "S", empId: "---//" }, { name: "E", empId: "😀" }, { name: "L", empId: "Z".repeat(31) }, { name: "OK", empId: "Z".repeat(30) }]));
    expect(r.added).toBe(1); expect(r.invalid).toHaveLength(3);
    for (const bad of r.invalid) expect(bad.why).toContain("An employee ID has letters and numbers only");
    expect(rows(w, "SELECT COUNT(*) c FROM person WHERE eid=?", g.id)[0].c).toBe(1);
  });
  test("'who' check: every spelling finds the same listed person and shows the same first name", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    await addPeople(w, g.key, g.id, [{ name: "Asha Rao", empId: "1B-678" }]);
    for (const t of [...FOUR, "１Ｂ－６７８", "1B​678"]) { const r = await json(await who(w, g.id, t)); expect(r.known).toBe(true); expect(r.name).toBe("Asha R."); }
    expect((await json(await who(w, g.id, "1B679"))).known).toBe(false);
    expect((await json(await who(w, g.id, "---"))).known).toBe(false); // symbols only: nothing to look up
  });
  test("join: each spelling joins as the listed person; the same phone and same spelling or another spelling returns the SAME participant (same board), a second phone is refused", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    await addPeople(w, g.key, g.id, [{ name: "Asha Rao", empId: "1B678" }]);
    const first = await joinGame(w, g.id, { empId: "1b-678", name: "Asha", device: dev(1) });
    const fb = await json(first); expect(first.status).toBe(200); expect(fb.pid).toBeTruthy();
    for (const t of [...FOUR, "１Ｂ－６７８"]) {
      const again = await joinGame(w, g.id, { empId: t, name: "Asha", device: dev(1) });
      const b = await json(again); expect(again.status).toBe(200); expect(b.pid).toBe(fb.pid); expect(b.again).toBe(true);
    }
    const other = await joinGame(w, g.id, { empId: "1B/678", name: "Asha", device: dev(2) });
    expect(other.status).toBe(423); expect((await json(other)).code).toBe("id-used");
    expect(rows(w, "SELECT COUNT(*) c FROM seat WHERE eid=?", g.id)[0].c).toBe(1); // one person, one seat, whatever the spelling
  });
  test("join: symbols-only and over-30 are refused with bad-id (400) and nothing is stored", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    for (const t of ["---//", "😀😀", "​​", "A".repeat(31), "A-".repeat(31)]) {
      const r = await joinGame(w, g.id, { empId: t, name: "Zed", device: dev(3) }); const b = await json(r);
      expect(r.status).toBe(400); expect(b.code).toBe("bad-id"); expect(b.error).toContain("An employee ID has letters and numbers only");
    }
    expect(rows(w, "SELECT COUNT(*) c FROM seat WHERE eid=?", g.id)[0].c).toBe(0);
  });
  test("different cleaned IDs are different people (1B678 and 1B679)", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "new" });
    await addPeople(w, g.key, g.id, [{ name: "Asha", empId: "1B678" }, { name: "Ravi", empId: "1B679" }]);
    const a = await json(await joinGame(w, g.id, { empId: "1b-678", name: "A", device: dev(1) })), b = await json(await joinGame(w, g.id, { empId: "1B 679", name: "R", device: dev(2) }));
    expect(a.pid).toBeTruthy(); expect(b.pid).toBeTruthy(); expect(a.pid).not.toBe(b.pid);
  });
  test("'either' mode: a listed person with a mobile and an ID can come in with the ID in any spelling, and a person known by ID alone is stored under the cleaned ID hash", async () => {
    const g = await setupGame(w, { verify: "either", employeesOnly: true, era: "new" });
    await addPeople(w, g.key, g.id, [{ name: "Asha", empId: "1B-678", phone: mob(1) }, { name: "Ravi", empId: "4F/222" }]);
    const a = await joinGame(w, g.id, { empId: "1b 678", name: "A", device: dev(1) }); expect(a.status).toBe(200);
    const r = await joinGame(w, g.id, { empId: "4f-222", name: "R", device: dev(2) }); expect(r.status).toBe(200);
    expect(one(w, "SELECT COUNT(*) c FROM seat WHERE eid=?", g.id).c).toBe(2);
  });
});

describe("employee ID through the real Worker, game made BEFORE the switch (old reading kept)", () => {
  test("list upload keeps dashes and slashes: 1B-678 and 1B/678 are two different people, 1B 678 equals 1B678", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "old" });
    const r = await json(await addPeople(w, g.key, g.id, [{ name: "A", empId: "1B-678" }, { name: "B", empId: "1B/678" }, { name: "C", empId: "1B 678" }, { name: "D", empId: "1B678" }]));
    expect(r.added).toBe(3); expect(r.duplicates).toBe(1); // 1B 678 and 1B678 only
  });
  test("a listed 1B-678 is found by 1b-678 (case, as before) but NOT by 1B678 or 1B/678", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "old" });
    await addPeople(w, g.key, g.id, [{ name: "Asha Rao", empId: "1B-678" }]);
    expect((await json(await who(w, g.id, "1b-678"))).known).toBe(true);
    expect((await json(await who(w, g.id, "1B678"))).known).toBe(false);
    expect((await json(await who(w, g.id, "1B/678"))).known).toBe(false);
  });
  test("old game: symbols-only, full-width and over-30 are refused with the old rule; emoji is refused", async () => {
    const g = await setupGame(w, { verify: "id", employeesOnly: true, era: "old" });
    for (const t of ["---", "😀", "１Ｂ－６７８", "A".repeat(31)]) { const r = await joinGame(w, g.id, { empId: t, name: "Zed", device: dev(4) }); expect([r.status, (await json(r)).code]).toEqual([400, "bad-id"]); }
  });
});
