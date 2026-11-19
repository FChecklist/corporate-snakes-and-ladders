// TEST_HANDOFF Milestone 2, Email rule: RAJAT1＠DEMO.COM and every case or spacing variant is ONE address everywhere; the employee ID cleaner is never applied to an email.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanEmail } from "../src/emailclean";
import { cleanEmpId, normEmp } from "../src/people";
import { emailHashOf } from "../src/hostsetup";
import { emailHash as visitsEmailHash } from "../src/visits";
import { isTestLogin, TEST_LOGIN_CODE } from "../src/testlogins";
import { setMode } from "../src/mode";
import { type World, T, closeWorld, json, newWorld, rows, api, TICKS } from "./t30-helpers";

const SRC = join(import.meta.dir, "../src");
const src = (f: string) => readFileSync(join(SRC, f), "utf8");
/** Every upper/lower case mix of the letters of `s` (2^letters strings). */
function* caseMixes(s: string): Generator<string> {
  const idx = [...s].map((ch, i) => (ch.toLowerCase() !== ch.toUpperCase() ? i : -1)).filter((i) => i >= 0);
  for (let m = 0; m < 1 << idx.length; m++) { const a = [...s]; idx.forEach((p, b) => { if (m & (1 << b)) a[p] = a[p]!.toUpperCase(); }); yield a.join(""); }
}

let w: World;
beforeEach(() => { w = newWorld(); });
afterEach(() => closeWorld(w));

describe("email cleaner (unit)", () => {
  test("RAJAT1＠DEMO.COM, with the full-width at-sign, is rajat1@demo.com", () => { expect(cleanEmail("RAJAT1＠DEMO.COM")).toBe("rajat1@demo.com"); });
  test("EVERY case mix of demo1@demo-test.invalid (2^19 = 524,288 strings, all distinct) cleans to the one address", () => {
    const base = "demo1@demo-test.invalid"; let n = 0; const seen = new Set<string>();
    for (const v of caseMixes(base)) { n++; if (n <= 600) seen.add(v); expect(cleanEmail(v) === base).toBe(true); }
    expect(n).toBe(1 << 19); expect(seen.size).toBe(600);
  });
  test("full-width and compatibility forms: ＠, ．, full-width letters and digits, ideographic space", () => {
    for (const v of ["ＤＥＭＯ１＠ＤＥＭＯ－ＴＥＳＴ．ＩＮＶＡＬＩＤ", "demo1＠demo-test.invalid", "demo1@demo-test．invalid", "demo1@demo-test.invalid　", "　DEMO1@demo-test.invalid"]) expect(cleanEmail(v)).toBe("demo1@demo-test.invalid");
  });
  test("spaces, tabs and newlines at the ends and inside are removed", () => {
    for (const v of ["  demo1@demo-test.invalid  ", "demo1 @ demo-test.invalid", "demo1@demo-test.invalid\n", "\tdemo1@demo-test.invalid\t", "de mo1@demo-test.in valid"]) expect(cleanEmail(v)).toBe("demo1@demo-test.invalid");
  });
  test("dots, dashes, plus and digits in an address are KEPT (it is not an ID): demo.1, demo-1, demo+1 and demo1 stay four different people", () => {
    const a = ["demo.1@demo-test.invalid", "demo-1@demo-test.invalid", "demo+1@demo-test.invalid", "demo1@demo-test.invalid", "demo_1@demo-test.invalid"].map(cleanEmail);
    expect(new Set(a).size).toBe(5); expect(a[0]).toBe("demo.1@demo-test.invalid"); expect(a[2]).toBe("demo+1@demo-test.invalid");
  });
  test("different people stay different: demo1 vs demo2, and a different domain", () => {
    expect(cleanEmail("DEMO1@demo-test.invalid")).not.toBe(cleanEmail("demo2@demo-test.invalid")); expect(cleanEmail("demo1@demo-test.invalid")).not.toBe(cleanEmail("demo1@demo-test.invalid.in"));
  });
  test("nothing typed gives an empty string, never a throw; a number is read as its text", () => { for (const v of [undefined, null, "", "   ", "\t\n"]) expect(cleanEmail(v as any)).toBe(""); expect(cleanEmail(0 as any)).toBe("0"); });
  test("the cleaner is idempotent", () => { for (const v of ["RAJAT1＠DEMO.COM", "A B@C.D", "demo1@demo-test.invalid"]) expect(cleanEmail(cleanEmail(v))).toBe(cleanEmail(v)); });
});

describe("the employee ID cleaner is not the email cleaner", () => {
  test("the ID cleaner would destroy an address (no @, no dots); the email cleaner keeps it", () => {
    const e = "Raj.At-1@Demo-Test.invalid"; expect(cleanEmpId(e)).toBe("RAJAT1DEMOTESTINVALID"); expect(cleanEmail(e)).toBe("raj.at-1@demo-test.invalid"); expect(normEmp(e, true)).toBe(cleanEmpId(e)); expect(cleanEmail(e)).not.toBe(cleanEmpId(e).toLowerCase());
  });
  test("no file that reads an email calls cleanEmpId or normEmp; the ID code in people.ts never calls cleanEmail", () => {
    for (const f of ["admin.ts", "credit.ts", "google.ts", "helpdesk.ts", "hostsetup.ts", "mode.ts", "partners.ts", "pay.ts", "testlogins.ts", "visits.ts", "emailclean.ts"]) { const s = src(f); expect(s.includes("cleanEmpId(")).toBe(false); expect(s.includes("normEmp(")).toBe(false); }
    const ppl = src("people.ts"); expect(/cleanEmail\([^)]*emp/i.test(ppl)).toBe(false); expect(/cleanEmpId\([^)]*mail/i.test(ppl)).toBe(false);
    const wk = src("worker.ts"); expect(/cleanEmpId\([^)]*mail/i.test(wk)).toBe(false); expect(/normEmp\([^)]*mail/i.test(wk)).toBe(false);
  });
});

describe("one address, one person, at every place it is read", () => {
  const VARIANTS = ["demo7@demo-test.invalid", "DEMO7@DEMO-TEST.INVALID", "Demo7@Demo-Test.Invalid", "demo7＠demo-test.invalid", "DEMO7＠DEMO-TEST.INVALID", "  demo7@demo-test.invalid ", "demo7 @demo-test.invalid", "dEmO7@dEmO-tEsT.iNvAlId"];
  test("host setup link: the hash of the address is the same for every variant and different for another address", async () => {
    const hs = await Promise.all(VARIANTS.map(emailHashOf)); expect(new Set(hs).size).toBe(1); expect(await emailHashOf("demo8@demo-test.invalid")).not.toBe(hs[0]);
  });
  test("visits: the keyed hash of the address is the same for every variant and different for another address", async () => {
    const env = { VISIT_SECRET: "s", ORGANIZER_SECRET: "plat", DATA_KEY: "dk" } as any;
    const hs = await Promise.all(VARIANTS.map((v) => visitsEmailHash(env, v))); expect(hs[0]).toBeTruthy(); expect(new Set(hs).size).toBe(1); expect(await visitsEmailHash(env, "demo8@demo-test.invalid")).not.toBe(hs[0]);
  });
  test("organizer sign-in (/api/start): the first variant makes the account and gives a key; every other variant is told the account exists and gets no key; one account row", async () => {
    const first = await api(w, "POST", "/api/start", { email: VARIANTS[1] }, undefined, T, { "cf-connecting-ip": "5.5.5.1" }); const fb = await json(first);
    expect(first.status).toBe(200); expect(fb.token).toMatch(/^cbk_/);
    for (const [i, v] of VARIANTS.entries()) { const r = await api(w, "POST", "/api/start", { email: v }, undefined, T, { "cf-connecting-ip": `5.5.5.${i + 2}` }); const b = await json(r); expect([v, r.status, b.exists === true, b.token]).toEqual([v, 200, true, undefined]); }
    expect(rows(w, "SELECT COUNT(*) c FROM organizer_email")[0].c).toBe(1);
  });
  test("organizer sign-in: two addresses that differ only by a dot, dash or digit are TWO accounts (the ID cleaner would have merged them)", async () => {
    for (const [i, e] of ["a.b-c@demo-test.invalid", "abc@demo-test.invalid", "a.bc@demo-test.invalid", "abc2@demo-test.invalid"].entries()) { const b = await json(await api(w, "POST", "/api/start", { email: e }, undefined, T, { "cf-connecting-ip": `6.6.6.${i + 1}` })); expect([e, typeof b.token]).toEqual([e, "string"]); }
    expect(rows(w, "SELECT COUNT(*) c FROM organizer_email")[0].c).toBe(4);
  });
  test("an address that is not an address is refused plainly (400), including one the ID cleaner would have turned into letters", async () => {
    for (const e of ["", "   ", "RAJAT1DEMOCOM", "no-at-sign.example", "a@b", "@demo.com"]) { const r = await api(w, "POST", "/api/start", { email: e }, undefined, T, { "cf-connecting-ip": "4.4.4.4" }); expect([e, r.status]).toEqual([e, 400]); }
  });
});

describe("test sign-ins count in every spelling (TEST mode only)", () => {
  test("isTestLogin ignores case, full-width and spaces for the listed test addresses, and is false for any other address", () => {
    for (const v of ["demo1@xyz.in", "DEMO1@XYZ.IN", "Demo1＠Xyz.in", " demo1 @xyz.in "]) expect(isTestLogin(v)).toBe(true);
    for (const v of ["demo4@xyz.in", "demo1@xyz.com", "xdemo1@xyz.in", ""]) expect(isTestLogin(v)).toBe(false);
  });
  test("in TEST mode DEMO2@XYZ.IN with the fixed code signs in with a key; in LIVE mode the same is refused", async () => {
    await setMode(w.env, "TEST", "test", T);
    const ok = await api(w, "POST", "/api/auth/verify", { email: "DEMO2@XYZ.IN", code: TEST_LOGIN_CODE }, undefined, T, { "cf-connecting-ip": "3.3.3.3" }); const b = await json(ok);
    expect(ok.status).toBe(200); expect(typeof b.token).toBe("string");
    const full = await api(w, "POST", "/api/auth/verify", { email: "demo3＠xyz.in", code: TEST_LOGIN_CODE }, undefined, T, { "cf-connecting-ip": "3.3.3.4" }); expect(full.status).toBe(200);
    await setMode(w.env, "LIVE", "back", T);
    expect((await api(w, "POST", "/api/auth/verify", { email: "DEMO2@XYZ.IN", code: TEST_LOGIN_CODE }, undefined, T, { "cf-connecting-ip": "3.3.3.5" })).status).toBe(400);
  });
  test("a demo-test.invalid address with the fixed code is NOT a test login (the allow-list is xyz.in): see docs/TEST_FINDINGS.md F-1", async () => {
    await setMode(w.env, "TEST", "test", T);
    expect(isTestLogin("demo1@demo-test.invalid")).toBe(false);
    const r = await api(w, "POST", "/api/auth/verify", { email: "demo1@demo-test.invalid", code: TEST_LOGIN_CODE }, undefined, T, { "cf-connecting-ip": "3.3.3.9" });
    expect(r.status).toBe(400);
  });
});
