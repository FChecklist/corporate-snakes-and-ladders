// Test author, run v3 (31 Oct 2026): the words on the phone's ID box, straight from the owner's rules.
//  - 'The system will read this as ...' appears only where the server really cleans (idClean true, or an Email ID game)
//  - an e-mail typed in an employee-ID game gets the plain refusal, never letters
//  - over 30 characters once cleaned: 'This ID is too long. An employee ID may be up to 30 characters once cleaned.'
// `test.failing` = a PRODUCT DEFECT written as a test (passes while the product is wrong, goes red when it is fixed). Listed in docs/TESTER_REPORT.md.
// No backslash is typed in a string here: invisible characters are built from code points.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";

setDefaultTimeout(60_000);
const ch = (...n: number[]) => String.fromCharCode(...n);
const CLEAN_MS = 4102444800001;
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

async function phone(settings: Record<string, unknown>, clean: boolean, id: string) {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  expect((await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 20, cap: 100 }, s.aiKey)).status).toBe(200);
  expect((await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
  expect((await w.api("PATCH", `/api/z/${id}/settings`, settings, s.token)).status).toBe(200);
  if (clean) w.world.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(CLEAN_MS, id);
  const p = await openPage(w.world, { url: `http://localhost/z.html?e=${id}`, html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"] });
  open.push(p); await p.waitFor((x) => /employee ID|Email ID|mobile number/i.test(x), 20000); return p;
}
const typeId = (p: Page, text: string): string => { const el = p.$("#emp"); el.value = text; el.dispatchEvent(new p.win.Event("input", { bubbles: true })); return String(p.$("#empread").textContent); };
const READ = "The system will read this as ";
const PLAIN = "This looks like an Email ID. This game asks for an employee ID: letters and numbers only.";

describe("employee-ID box on a game that cleans (new reading)", () => {
  test("a spelling the server changes shows 'The system will read this as <cleaned>'; an ID that is already clean shows nothing", async () => {
    const p = await phone({ verify: "id" }, true, "V3-A");
    expect(typeId(p, "1b-678")).toBe(READ + "1B678");
    expect(typeId(p, "e 101")).toBe(READ + "E101");
    expect(typeId(p, "ＥＭＰ１２")).toBe(READ + "EMP12");
    expect(typeId(p, "E101")).toBe("");
    expect(typeId(p, "")).toBe("");
  });
  test("exactly 30 cleaned characters is fine; an e-mail gets the plain refusal with no letters of the address and no 'read this as'", async () => {
    const p = await phone({ verify: "id" }, true, "V3-B");
    expect(typeId(p, "A".repeat(30))).toBe("");
    for (const t of ["rajat.agarwal@acme.com", "RAJAT" + ch(0xff20) + "ACME.COM", "a@b"]) { const h = typeId(p, t); expect([t, h]).toEqual([t, PLAIN]); expect(h).not.toMatch(/rajat|acme/i); }
  });
  // PRODUCT DEFECT PD-1 (phone side): the owner's sentence is 'This ID is too long. An employee ID may be up to 30 characters once cleaned.'; z.js showRead says 'An employee ID has letters and numbers only (up to 30).'
  test.failing("31 letters: the too-long sentence", async () => {
    const p = await phone({ verify: "id" }, true, "V3-C");
    expect(typeId(p, "A".repeat(31))).toBe("This ID is too long. An employee ID may be up to 30 characters once cleaned.");
  });
  test("EVIDENCE for PD-1: what the phone says today for 31 letters, and that 41 typed characters which clean to 28 are accepted without any complaint", async () => {
    const p = await phone({ verify: "id" }, true, "V3-D");
    expect(typeId(p, "A".repeat(31))).toBe("An employee ID has letters and numbers only (up to 30).");
    expect(typeId(p, "AB-".repeat(13) + "AB")).toBe(READ + "AB".repeat(14));
  });
});

describe("employee-ID box on a game on the old reading: nothing is promised", () => {
  test("no 'read this as' for any spelling; an e-mail still gets the one plain refusal", async () => {
    const p = await phone({ verify: "id" }, false, "V3-E");
    for (const t of ["1b-678", "e 101", "ＥＭＰ１２", "A".repeat(40)]) expect([t.length, typeId(p, t)]).toEqual([t.length, ""]);
    expect(typeId(p, "a@b.com")).toBe(PLAIN);
  });
});

describe("Email ID box (the server always cleans an Email ID)", () => {
  test("upper case, a space inside and the full-width at sign show the cleaned address; a clean lower-case address shows nothing", async () => {
    const p = await phone({ verify: "id", idKind: "email" }, false, "V3-F");
    expect(typeId(p, "RAJAT1＠DEMO.COM")).toBe(READ + "rajat1@demo.com");
    expect(typeId(p, "ab c＠x.com")).toBe(READ + "abc@x.com");
    expect(typeId(p, "rajat1@demo.com")).toBe("");
  });
  // PRODUCT DEFECT PD-5: the server removes invisible characters from an Email ID (U+200B-U+200D, U+2060, U+FEFF, U+0085, U+2028, U+2029) but the phone's hint only removes white space, so a hidden character is silently
  // removed with no 'read this as' line (z.js showRead, Email branch: nf.trim().replace(white space, "")).
  test.failing("a zero-width space inside the address: the hint shows the address the server will use", async () => {
    const p = await phone({ verify: "id", idKind: "email" }, false, "V3-G");
    expect(typeId(p, "ab" + ch(0x200b) + "c@x.com")).toBe(READ + "abc@x.com");
  });
});
