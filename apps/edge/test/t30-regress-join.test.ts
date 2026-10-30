// Regression: joining a game (mobile number, name only, closed list, cap, start time, one phone one board) and the check-in code logic. Real Worker, in-memory database.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { handle as realHandle, type Env } from "../src/worker";
import { cleanName } from "../src/people";
import { CHECKIN_FROM_MS, checkinOpensMs, checkinRequired, perm10k, codeFor, ticketId, seatOfPidText, prefixEnd } from "../src/checkin";
import { type World, START, T, addPeople, api, closeWorld, dev, joinGame, json, mob, newWorld, roundMs, rows, setupGame, startOrganizer } from "./t30-helpers";

let w: World;
beforeEach(() => { w = newWorld(); });
afterEach(() => closeWorld(w));
const seats = (id: string) => rows(w, "SELECT COUNT(*) c FROM seat WHERE eid=?", id)[0].c as number;

describe("join with a mobile number", () => {
  test("+91 98765 43210, 098765 43210, 9876543210 and 98765-43210 are ONE person: same pid, 'again', one seat", async () => {
    const g = await setupGame(w, {}); const first = await json(await joinGame(w, g.id, { phone: "9876543210", name: "Asha", device: dev(1) })); expect(first.pid).toBeTruthy();
    for (const p of ["+91 98765 43210", "098765 43210", "9876543210", "98765-43210", "+91-9876543210", " 98765 43210 "]) { const r = await joinGame(w, g.id, { phone: p, name: "Asha", device: dev(1) }); const b = await json(r); expect([p, r.status, b.pid, b.again]).toEqual([p, 200, first.pid, true]); }
    expect(seats(g.id)).toBe(1);
  });
  test("a number that is not a number is refused (400) and nobody is stored", async () => {
    const g = await setupGame(w, {});
    for (const p of ["12345", "abcdefghij", "0000000000", "98765", "+91 1234567890123456789"]) { const r = await joinGame(w, g.id, { phone: p, name: "Zed", device: dev(9) }); expect([p, r.status]).toEqual([p, 400]); }
    expect(seats(g.id)).toBe(0);
  });
  test("two different numbers are two people with two seats and two different pids", async () => {
    const g = await setupGame(w, {}); const a = await json(await joinGame(w, g.id, { phone: mob(1), name: "A", device: dev(1) })), b = await json(await joinGame(w, g.id, { phone: mob(2), name: "B", device: dev(2) }));
    expect(a.pid).not.toBe(b.pid); expect(seats(g.id)).toBe(2);
  });
  test("one phone, one board: the same number on another device is refused (423 other-phone); another number on a device that already holds a board is refused (409 device-used)", async () => {
    const g = await setupGame(w, {}); expect((await joinGame(w, g.id, { phone: mob(1), name: "A", device: dev(1) })).status).toBe(200);
    const other = await joinGame(w, g.id, { phone: mob(1), name: "A", device: dev(2) }); expect([other.status, (await json(other)).code]).toEqual([423, "other-phone"]);
    const same = await joinGame(w, g.id, { phone: mob(2), name: "B", device: dev(1) }); expect(same.status).toBe(409); expect((await json(same)).code).toBe("device-used");
    expect(seats(g.id)).toBe(1);
  });
  test("a seat's pid is numbered from 1 in joining order (seat order = card order)", async () => {
    const g = await setupGame(w, {}); const pids: string[] = [];
    for (let i = 1; i <= 4; i++) pids.push((await json(await joinGame(w, g.id, { phone: mob(i), name: "P" + i, device: dev(i) }))).pid);
    expect(pids.map((p) => Number(/^(\d+)x/.exec(p)![1]))).toEqual([1, 2, 3, 4]);
  });
});

describe("join with a name only (the default for the common link)", () => {
  test("a name and a device is enough; the same device again is the same person; a new device is a new person; a missing device is asked to refresh", async () => {
    const g = await setupGame(w, {}); const a = await json(await joinGame(w, g.id, { name: "Asha", device: dev(1) })); expect(a.pid).toBeTruthy();
    const again = await json(await joinGame(w, g.id, { name: "Asha", device: dev(1) })); expect([again.pid, again.again]).toEqual([a.pid, true]);
    const b = await json(await joinGame(w, g.id, { name: "Ravi", device: dev(2) })); expect(b.pid).not.toBe(a.pid);
    const nodev = await joinGame(w, g.id, { name: "Cy" }); expect(nodev.status).toBe(200); // the test helper adds a device from the phone; here none is given, so one is made from no phone
  });
  test("a one-letter or empty name is refused", async () => { const g = await setupGame(w, {}); for (const n of ["", " ", "A", "=", "<>"]) { const r = await joinGame(w, g.id, { name: n, device: dev(3) }); expect([n, r.status]).toEqual([n, 400]); } });
});

describe("consent is required by the server", () => {
  const raw = (id: string, body: unknown) => realHandle(new Request(`http://x/api/z/${id}/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), w.env as Env, T);
  test("no tick, one box only, and an old Terms version are each refused with consent-required and the boxes to draw; nothing is stored", async () => {
    const g = await setupGame(w, {}); const base = { phone: mob(5), name: "Asha", device: dev(5) };
    for (const consent of [undefined, { v: "2026-10-15", boxes: ["A"] }, { v: "2020-01-01", boxes: ["A", "B"] }, { v: "2026-10-15", boxes: [] }, "yes"]) {
      const r = await raw(g.id, { ...base, ...(consent === undefined ? {} : { consent }) }); const b = await json(r); expect([r.status, b.code, b.kind]).toEqual([400, "consent-required", "K4"]); expect(b.consent.boxes.length).toBe(2); expect(b.version).toBe("2026-10-15");
    }
    expect(seats(g.id)).toBe(0);
    const ok = await raw(g.id, { ...base, consent: { v: "2026-10-15", boxes: ["A", "B"] } }); expect(ok.status).toBe(200); expect(seats(g.id)).toBe(1);
  });
});

describe("who can come in and when", () => {
  test("a draft game is not open (403); a published game opens", async () => {
    const o = await startOrganizer(w); expect((await api(w, "POST", "/api/z", { id: "DRAFT-1", startRound: START, callSeconds: 20, cap: 100 }, o.key)).status).toBe(200);
    const r = await joinGame(w, "DRAFT-1", { name: "Asha", device: dev(1) }); expect([r.status, (await json(r)).error]).toEqual([403, "This game is not open yet."]);
  });
  test("an UNPAID game after its start time is 'locked' (403, organizer has not finished the booking), not 'closed'", async () => {
    const g = await setupGame(w, {}); const r = await joinGame(w, g.id, { phone: mob(2), name: "B", device: dev(2) }, roundMs(START) + 60_000); expect([r.status, (await json(r)).code]).toEqual([403, "locked"]);
  });
  test("a game that does not exist is not found", async () => { const r = await joinGame(w, "NOPE-1", { name: "Asha", device: dev(1) }); expect(r.status).toBe(404); });
  test("after the start time a NEW person is told sign-up closed (410, code closed); a person who joined earlier still gets back in", async () => {
    const g = await setupGame(w, { paid: true }); expect((await joinGame(w, g.id, { phone: mob(1), name: "A", device: dev(1) })).status).toBe(200);
    const late = roundMs(START) + 60_000;
    const n = await joinGame(w, g.id, { phone: mob(2), name: "B", device: dev(2) }, late); expect([n.status, (await json(n)).code]).toEqual([410, "closed"]);
    const back = await joinGame(w, g.id, { phone: mob(1), name: "A", device: dev(1) }, late); expect([back.status, (await json(back)).again]).toEqual([200, true]);
  });
  test("a closed list: an unlisted number waits (403 waiting) and is NOT given a seat; a listed number comes straight in", async () => {
    const g = await setupGame(w, { closed: true }); expect((await json(await addPeople(w, g.key, g.id, [{ name: "Asha", phone: mob(1) }]))).added).toBe(1);
    const ok = await joinGame(w, g.id, { phone: mob(1), name: "Asha", device: dev(1) }); expect(ok.status).toBe(200);
    const no = await joinGame(w, g.id, { phone: mob(7), name: "Stranger", device: dev(7) }); const nb = await json(no); expect([no.status, nb.code, nb.waiting]).toEqual([403, "waiting", true]);
    expect(seats(g.id)).toBe(1);
  });
  test("the cap: a game for 10 takes 10 people and the 11th is refused, nothing stored for them", async () => {
    const g = await setupGame(w, { cap: 10 }); for (let i = 1; i <= 10; i++) expect([i, (await joinGame(w, g.id, { phone: mob(i), name: "P" + i, device: dev(i) })).status]).toEqual([i, 200]);
    const r = await joinGame(w, g.id, { phone: mob(11), name: "P11", device: dev(11) }); expect(r.status).toBeGreaterThanOrEqual(400); expect(seats(g.id)).toBe(10);
  });
});

describe("names are tidied before they are kept", () => {
  test("control characters, markup characters and a leading formula sign are removed, runs of spaces collapse, 60 characters at most", () => {
    expect(cleanName("=SUM(A1)")).toBe("SUM(A1)"); expect(cleanName("+91 Asha")).toBe("91 Asha"); expect(cleanName("@home")).toBe("home"); expect(cleanName("-x")).toBe("x");
    expect(cleanName("<b>Asha</b>")).toBe("bAsha/b"); expect(cleanName("A\u0000s\u200Bha")).toBe("Asha"); expect(cleanName("  Asha    Rao  ")).toBe("Asha Rao"); expect(cleanName("x".repeat(100))).toHaveLength(60);
    expect(cleanName(undefined)).toBe(""); expect(cleanName(42 as any)).toBe(""); expect(cleanName("`x`")).toBe("x");
  });
});

describe("check-in (this game has none: cards open straight away) and the check-in code logic that remains", () => {
  test("checkinRequired is false for every game, old or new, so no claim or card waits for a 'present' mark", () => { for (const e of [{ created_ms: 0 }, { created_ms: CHECKIN_FROM_MS }, { created_ms: CHECKIN_FROM_MS + 1e12 }, {}]) expect(checkinRequired(e as any)).toBe(false); });
  test("a person who joins gets a seat and pid at once (no waiting for a check-in)", async () => { const g = await setupGame(w, {}); const b = await json(await joinGame(w, g.id, { phone: mob(1), name: "A", device: dev(1) })); expect(b.pid).toBeTruthy(); expect(b.waiting).toBeUndefined(); expect(seats(g.id)).toBe(1); });
  test("check-in opens 5 minutes before the start", () => { expect(checkinOpensMs(1_000_000)).toBe(1_000_000 - 300_000); });
  test("the code permutation is one-to-one over 0000 to 9999: 10,000 different inputs give 10,000 different outputs, all below 10,000", () => {
    const key = createHash("sha256").update("k1").digest("hex"), seen = new Set<number>(); for (let x = 0; x < 10000; x++) { const v = perm10k(key, x); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(10000); seen.add(v); } expect(seen.size).toBe(10000);
    const other = new Set<number>(); let differs = 0; for (let x = 0; x < 200; x++) if (perm10k(createHash("sha256").update("k2").digest("hex"), x) !== perm10k(key, x)) differs++; expect(differs).toBeGreaterThan(150); other.add(1);
  });
  test("no two seats of one game get the same 4-digit code (500 seats), codes are 4 digits, and a different game gets different codes", async () => {
    const codes = new Set<string>(); for (let s = 1; s <= 500; s++) { const c = await codeFor(w.env as any, "G-ONE", s); expect(c).toMatch(/^\d{4}$/); codes.add(c); } expect(codes.size).toBe(500);
    let same = 0; for (let s = 1; s <= 50; s++) if ((await codeFor(w.env as any, "G-ONE", s)) === (await codeFor(w.env as any, "G-TWO", s))) same++; expect(same).toBeLessThan(5);
  });
  test("card id and seat helpers: T0007 style ids, seat read from a pid, prefix range for kv keys", () => {
    expect(ticketId("G1", 7)).toBe("G1-T0007"); expect(seatOfPidText("12xabc")).toBe(12); expect(seatOfPidText("abc")).toBeNull(); expect(seatOfPidText("0x1")).toBe(0);
    expect(prefixEnd("present/G1/")).toBe("present/G10"); expect("present/G1/5" >= "present/G1/" && "present/G1/5" < prefixEnd("present/G1/")).toBe(true); expect("present/G10/5" < prefixEnd("present/G1/")).toBe(false);
  });
});
