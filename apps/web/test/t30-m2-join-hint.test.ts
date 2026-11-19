// TEST_HANDOFF Milestone 2, Employee ID rule 4: the join page shows "The system will read this as 1B678" under the ID box only when cleaning changes the text.
// Also: the page's reading equals the server's reading (cleanEmpId) for a corpus of spellings, so the hint never promises something the server does not do.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";
import { cleanEmpId } from "../../edge/src/people";

setDefaultTimeout(120_000);
const START = roundAt(T) + 1200;
let open: Page[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; });

async function joinPage(verify: string) {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "demo2@demo-test.invalid" }));
  const id = "T30-HINT";
  expect((await w.api("POST", "/api/z", { id, startRound: START, callSeconds: 20, cap: 100 }, s.aiKey)).status).toBe(200);
  expect((await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
  expect((await w.api("PATCH", `/api/z/${id}/settings`, { verify }, s.token)).status).toBe(200);
  const p = await openPage(w.world, { url: `http://localhost/z?e=${id}`, html: "z.html", scripts: ["audio.js", "zgame.js", "screenrules.js", "z.js"] });
  open.push(p); await p.waitFor((x) => /Join the game/.test(x), 20000);
  return p;
}
const type = (p: Page, v: string) => { const el = p.$("#emp") as any; el.value = v; el.dispatchEvent(new p.win.Event("input", { bubbles: true })); return String(p.$("#empread")?.textContent ?? ""); };

describe("join page: 'The system will read this as ...'", () => {
  test("an ID box and its hint line exist when the organizer asks for an employee ID; they do not exist when only a mobile number is asked", async () => {
    const p = await joinPage("id"); expect(!!p.$("#emp")).toBe(true); expect(!!p.$("#empread")).toBe(true);
    const m = await joinPage("mobile"); expect(!!m.$("#emp")).toBe(false);
  });
  test("the hint appears only when cleaning changes the text, and shows the cleaned ID", async () => {
    const p = await joinPage("id");
    expect(type(p, "1B678")).toBe("");                                         // already clean: no hint
    expect(type(p, "1B-678")).toBe("The system will read this as 1B678");
    expect(type(p, "1b-678")).toBe("The system will read this as 1B678");
    expect(type(p, "1B/678")).toBe("The system will read this as 1B678");
    expect(type(p, "1B 678")).toBe("The system will read this as 1B678");
    expect(type(p, "１Ｂ－６７８")).toBe("The system will read this as 1B678");
    expect(type(p, "1B​678")).toBe("The system will read this as 1B678");
    expect(type(p, "")).toBe("");                                              // nothing typed: no hint
    expect(type(p, "1B678")).toBe("");                                         // and it goes away again when the text is clean
  });
  test("symbols only gives no 'read this as' line (there is nothing to read it as)", async () => { const p = await joinPage("id"); for (const v of ["---", "😀", "///"]) expect([v, type(p, v)]).toEqual([v, ""]); });
  test("the page's reading equals the server's cleanEmpId for 60 spellings", async () => {
    const p = await joinPage("id"); const corpus = ["1B-678", "ab 12", "x/y/z", "A.B.C", "Ａｂ１２", "emp_007", "  9 9 9  ", "n°5", "É-1", "a\tb", "z‍z", "AB-12-CD", "q!w?e", "(77)", "#12", "x".repeat(40), "12345", "ab12", "AB12", "a-b-c-d-e-f-g", "٣٤٥", "日本1", "1B😀8", "1b‐678", "1b—678", "1b_678", "1b'678", "1b\\678", "1b,678", "1b;678", "1b:678", "1b|678", "1b+678", "1b=678", "1b*678", "1b&678", "1b^678", "1b%678", "1b$678", "1b@678", "1b~678", "1b`678", "1b<678>", "1b[678]", "1b{678}", "ǅ1", "ﬁ1", "ⓐ1", "①②", "Ⅻ1", "ｱ1", "ｶﾞ1", "½1", "²3", "ℹ1", "1b678", "1B678", "0001", "00-01"];
    for (const v of corpus) { const c = cleanEmpId(v), line = type(p, v); const expected = c && c !== v ? "The system will read this as " + c : ""; expect([v, line]).toEqual([v, expected]); }
  });
});
