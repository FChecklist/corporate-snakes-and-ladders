// Snakes 1.4.1 audit, item 1: ACCOUNT / sign-in / Host emails REFUSE an inner space; a participant's Email ID still removes inner spaces.
// Every check is by behaviour (so a regex written without its backslash, /s/ for /\s/, is caught). The matrix is streamed: nothing is kept except one counter.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanAccountEmail, cleanEmail } from "../src/emailclean";
import { isTestLogin } from "../src/testlogins";
import { verifyGoogleCredential, setGoogleKeyProvider } from "../src/google";
import { CLIENT_ID, claims, makeIdp, trust } from "./google-fake";
import { call, j, organizer, publish, create, reset, restore, uid, W } from "./param-harness";

beforeEach(() => reset());
afterEach(() => { restore(); setGoogleKeyProvider(); });

/** The rule written out a second time, on purpose, with NO regex: the characters JavaScript calls white space, listed one by one. */
const WS = new Set([..." \t\n\v\f\r      　﻿", ...Array.from({ length: 11 }, (_, i) => String.fromCharCode(0x2000 + i))]);
const model = (raw: string): string => {
  let v = raw.normalize("NFKC"); let a = 0, b = v.length;
  while (a < b && WS.has(v[a]!)) a++; while (b > a && WS.has(v[b - 1]!)) b--;
  v = v.slice(a, b).toLowerCase();
  for (const ch of v) if (WS.has(ch)) return ""; // a space inside: refused
  return v;
};

describe("cleanAccountEmail: the rule", () => {
  test("the owner's example: 'ab c＠x.com' is refused (empty), 'ab＠x.com' is fine", () => {
    expect(cleanAccountEmail("ab c＠x.com")).toBe("");
    expect(cleanAccountEmail("ab＠x.com")).toBe("ab@x.com");
  });
  test("every kind of white space inside is refused; the same kinds at the ends are trimmed (proves the backslash in /\\s/ is real)", () => {
    for (const w of [" ", "\t", "\n", "\r", "\v", "\f", " ", " ", "　", " "]) {
      expect([w, cleanAccountEmail(`ab${w}c@x.com`)]).toEqual([w, ""]);
      expect([w, cleanAccountEmail(`${w}abc@x.com${w}`)]).toEqual([w, "abc@x.com"]);
    }
  });
  test("the letter s, the letter d and the digit 5 are NOT white space (a regex without its backslash, /s/, would refuse them)", () => {
    for (const a of ["s@x.com", "ss@sss.com", "sam.s+s@s.in", "dd5@d5.com", "SAM@SS.COM"]) expect(cleanAccountEmail(a)).toBe(a.toLowerCase());
  });
  test("plus tags, dots, upper case, full-width at sign and letters are kept or lower-cased; nothing else is touched", () => {
    expect(cleanAccountEmail("  Sam.Rao+Tag＠Acme.COM ")).toBe("sam.rao+tag@acme.com");
    expect(cleanAccountEmail("Ｓａｍ＠ａｃｍｅ．ｃｏｍ")).toBe("sam@acme.com");
  });
  test("nothing, null and rubbish give empty", () => { for (const x of [undefined, null, "", "   "]) expect(cleanAccountEmail(x as any)).toBe(""); expect(cleanAccountEmail({} as any)).toBe(""); /* "[object Object]" has a space */ });
  test("the participant Email ID cleaner is the other rule: it REMOVES inner spaces", () => {
    expect(cleanEmail("ab c＠x.com")).toBe("abc@x.com");
    expect(cleanEmail(" A B\tC ＠X.com ")).toBe("abc@x.com");
  });
  test("the two cleaners agree whenever there is no inner space, and differ exactly when there is one", () => {
    for (const a of ["a@x.com", " A@X.com ", "ａ＠ｘ.com"]) expect(cleanAccountEmail(a)).toBe(cleanEmail(a));
    for (const a of ["a b@x.com", "a@x .com", "a　b@x.com"]) { expect(cleanAccountEmail(a)).toBe(""); expect(cleanEmail(a)).not.toBe(""); }
  });
});

describe("isTestLogin", () => {
  test("the three owner logins count in any case, with full-width at sign and edge spaces; 'demo 1＠xyz.in' does not", () => {
    for (const a of ["demo1@xyz.in", "DEMO2@XYZ.IN", " demo3＠xyz.in ", "Demo1＠Xyz.In"]) expect([a, isTestLogin(a)]).toEqual([a, true]);
    for (const a of ["demo 1＠xyz.in", "demo 1@xyz.in", "demo1@ xyz.in", "de mo1@xyz.in", "demo4@xyz.in", "demo1@xyz.in.x", "", "demo1"]) expect([a, isTestLogin(a)]).toEqual([a, false]);
  });
});

/* ---------------------------------------------------------------------------------------------------- the streamed matrix */
const ALNUM = "abcdefghijklmnopqrstuvwxyz0123456789"; // letters including s, and digits
const core = (i: number): string => { let s = "", n = i + 1296; while (n > 0) { s = ALNUM[n % 36]! + s; n = Math.floor(n / 36); } return s; }; // distinct for every i, mixes letters (incl. s) and digits
const CASES = [(s: string) => s, (s: string) => s.toUpperCase(), (s: string) => s.replace(/./g, (c, k) => (k % 2 ? c.toUpperCase() : c))];
const ATS = ["@", "＠"]; // @ and the full-width at sign
const TAGS = ["", "+t", "+s1"];
const DOTS = [false, true];
const SPACES = ["none", "edge", "innerSpace", "innerTab"] as const;
const ZW = [false, true]; // a zero-width space inside the local part
const LONG = [false, true]; // a local part padded to 300 characters
const N_CORE = 6000;
export const MATRIX_SIZE = N_CORE * CASES.length * ATS.length * TAGS.length * DOTS.length * SPACES.length * ZW.length * LONG.length;
export function* emailMatrix(): Generator<string> {
  for (let i = 0; i < N_CORE; i++) for (const cs of CASES) for (const at of ATS) for (const tag of TAGS) for (const dot of DOTS) for (const sp of SPACES) for (const zw of ZW) for (const lg of LONG) {
    let local = cs(core(i)); if (dot) local = local.slice(0, 1) + "." + local.slice(1) + "." + "s";
    if (zw) local = local.slice(0, 1) + "​" + local.slice(1);
    if (lg) local = local + "s".repeat(300); local += tag;
    if (sp === "innerSpace") local = local.slice(0, 1) + " " + local.slice(1); else if (sp === "innerTab") local = local.slice(0, 1) + "\t" + local.slice(1);
    const e = local + at + cs("acme.co.in");
    yield sp === "edge" ? "  " + e + " \t" : e;
  }
}
/** Runs a cleaner over the whole matrix and counts addresses where it disagrees with the white-space-free model. */
function runMatrix(clean: (s: string) => string, stopAtFirst = false) {
  let n = 0, wrong = 0, refused = 0, kept = 0; const seen = new Set<string>(); let dup = 0;
  for (const raw of emailMatrix()) {
    n++; if (n <= 1_100_000) { if (seen.has(raw)) dup++; else seen.add(raw); } // distinctness is proven on the first 1.1 million (a Set of all 3.4 million would be memory only)
    const got = clean(raw), want = model(raw);
    if (got !== want) { wrong++; if (stopAtFirst) break; }
    if (want === "") refused++; else kept++;
  }
  return { n, wrong, refused, kept, dup, distinctChecked: seen.size };
}
describe("streamed email matrix", () => {
  test("every address is read exactly as the rule says (spaces refused, everything else lower-cased), and the matrix is over a million DISTINCT addresses", () => {
    const r = runMatrix(cleanAccountEmail);
    console.log("EMAIL MATRIX", JSON.stringify(r), "MATRIX_SIZE", MATRIX_SIZE);
    expect(r.n).toBe(MATRIX_SIZE);
    expect(r.n).toBeGreaterThanOrEqual(1_000_000);
    expect(r.dup).toBe(0);
    expect(r.distinctChecked).toBe(1_100_000);
    expect(r.wrong).toBe(0);
    expect(r.refused).toBe(MATRIX_SIZE / SPACES.length * 2); // innerSpace + innerTab refused, none + edge kept
    expect(r.kept).toBe(MATRIX_SIZE / SPACES.length * 2);
  }, 300000);
  test("DELIBERATE BREAK: a cleaner that forgot the backslash (/s/) is caught by the matrix", () => {
    const broken = (raw: string) => { const v = String(raw ?? "").normalize("NFKC").trim().toLowerCase(); return /s/.test(v) ? "" : v; };
    expect(runMatrix(broken, true).wrong).toBeGreaterThan(0);
  }, 300000);
  test("DELIBERATE BREAK: the old Email ID cleaner (spaces removed) used for accounts is caught", () => {
    expect(runMatrix(cleanEmail, true).wrong).toBeGreaterThan(0);
  }, 300000);
  test("DELIBERATE BREAK: a cleaner that does not lower-case is caught", () => {
    expect(runMatrix((raw) => { const v = String(raw).normalize("NFKC").trim(); return /\s/.test(v) ? "" : v; }, true).wrong).toBeGreaterThan(0);
  }, 300000);
});

/* ---------------------------------------------------------------------------------------------------- the real doors */
const bad = ["ab c＠x.com", "ab c@x.com", "a\tb@x.com", "ab@x .com", "a　b@x.com"];
describe("sign-in and sign-up refuse an inner space", () => {
  test("POST /api/start (new account) refuses each; the clean twin works", async () => {
    for (const e of bad) { const r = await call("POST", "/api/start", { email: e }); expect([e, r.status]).toEqual([e, 400]); expect((await j(r)).token).toBeUndefined(); }
    expect((await call("POST", "/api/start", { email: "abc＠x.com" })).status).toBe(200);
  });
  test("POST /api/auth/email (sign-in code) refuses each and sends no mail", async () => {
    for (const e of bad) { const r = await call("POST", "/api/auth/email", { email: e }); expect([e, r.status]).toEqual([e, 400]); }
    expect((W.raw.prepare("SELECT COUNT(*) AS c FROM outbox").get() as any).c).toBe(0);
  });
  test("an existing account is NOT reached by a spaced copy of its address", async () => {
    const o = await organizer("abc@x.com");
    const r = await call("POST", "/api/auth/email", { email: "ab c@x.com" }); expect(r.status).toBe(400);
    expect(o.email).toBe("abc@x.com");
  });
  test("the demo logins: 'demo 1＠xyz.in' with the fixed code is refused even in TEST mode", async () => {
    const { setMode } = await import("../src/mode");
    await setMode(W.env as any, "TEST", "t", 0);
    expect((await call("POST", "/api/auth/verify", { email: "demo1@xyz.in", code: "123456" })).status).toBe(200);
    expect((await call("POST", "/api/auth/verify", { email: "demo 1＠xyz.in", code: "123456" })).status).toBe(400);
  });
});

describe("Google sign-in refuses an inner space", () => {
  test("a verified token whose email has an inner space is not accepted; a clean one is, lower-cased", async () => {
    const idp = await makeIdp(); trust(idp);
    const env = { ...W.env, GOOGLE_CLIENT_ID: CLIENT_ID } as any, T = Date.UTC(2026, 9, 1, 10, 0, 0);
    expect(await verifyGoogleCredential(env, await idp.sign(claims("ab c@acme.com", T)), T)).toEqual({ ok: false, why: "claims" });
    expect(await verifyGoogleCredential(env, await idp.sign(claims("Ab＠Acme.com", T)), T)).toEqual({ ok: true, email: "ab@acme.com" });
  });
});

describe("add a Host refuses an inner space in the e-mail", () => {
  test("POST /api/org/host with only a spaced e-mail is refused", async () => {
    const o = await organizer();
    for (const e of bad) { const r = await call("POST", "/api/org/host", { email: e }, o.h); expect([e, r.status]).toEqual([e, 400]); }
  });
  // PRODUCT BUG PB-1 (see TESTER_REPORT): the route cleans the e-mail to "" and then treats it as "no e-mail typed", so the Host is made from the mobile number alone and the typed address is silently dropped. test.failing turns green when it is fixed (then change it to test).
  test.failing("POST /api/org/host with a spaced e-mail AND a mobile number is refused too (the bad address must not be silently dropped)", async () => {
    const o = await organizer();
    const r = await call("POST", "/api/org/host", { email: "ho st@acme.com", mobile: "9876500009" }, o.h);
    expect(r.status).toBe(400);
  });
  test("the clean address is accepted", async () => {
    const o = await organizer();
    expect((await call("POST", "/api/org/host", { email: "Host＠Acme.com", mobile: "9876500009" }, o.h)).status).toBe(200);
  });
});

describe("Host setup e-mail refuses an inner space", () => {
  test("POST /api/host/setup/email with an inner space is a 400 'valid e-mail'", async () => {
    const o = await organizer();
    const hk = await j(await call("POST", "/api/org/host", { mobile: "9876500009", email: "host@acme.com" }, o.h));
    expect(hk.hostKey).toMatch(/^cbh_/);
    const r = await call("POST", "/api/host/setup/email", { email: "ho st@acme.com" }, { "x-organizer": hk.hostKey });
    expect([r.status, String((await j(r)).error)]).toEqual([400, "Please enter a valid e-mail address."]);
  });
});

describe("a participant's Email ID still REMOVES inner spaces (the other rule)", () => {
  test("in an Email ID game the organizer lists 'ab c＠x.com'; the person who types 'ABC@x.com' or 'a b c@X.com' is that listed person and gets in", async () => {
    const o = await organizer(), id = uid(); expect((await create(o.key, id, { cap: 8 })).status).toBe(200); expect((await publish(o.key, id)).status).toBe(200);
    expect((await call("PATCH", `/api/z/${id}/settings`, { verify: "id", idKind: "email" }, o.h)).status).toBe(200);
    const dev = (i: number) => (String(i).padStart(2, "0") + "b".repeat(32)).slice(0, 32);
    const add = await j(await call("POST", `/api/z/${id}/people`, { people: [{ name: "Asha Rao", empId: "ab c＠x.com" }] }, o.h));
    expect([add.added, add.invalid]).toEqual([1, []]);
    const a = await call("POST", `/api/z/${id}/join`, { name: "Asha", device: dev(1), empId: "ABC@x.com" });
    expect([a.status, (await j(a)).code]).toEqual([200, undefined]);
    const b = await call("POST", `/api/z/${id}/join`, { name: "Asha", device: dev(1), empId: "a b c＠X.com" });
    expect(b.status).toBe(200);
    expect((W.raw.prepare("SELECT COUNT(*) AS c FROM participant WHERE eid=?").get(id) as any).c).toBe(1);
  });
});

describe("source: the account cleaner is the one every account door imports", () => {
  const src = (f: string) => readFileSync(join(import.meta.dir, "../src", f), "utf8");
  test("emailclean.ts has the backslash-s test written out, and people.ts normId (participant Email ID) still uses cleanEmail", () => {
    expect(src("emailclean.ts")).toContain("/\\s/.test(v)");
    expect(src("emailclean.ts")).toContain(".replace(/\\s+/g, \"\")");
    expect(src("people.ts")).toMatch(/cleanEmail\(raw\)/);
  });
  for (const f of ["admin.ts", "credit.ts", "google.ts", "helpdesk.ts", "hostsetup.ts", "mode.ts", "partners.ts", "pay.ts", "testlogins.ts", "visits.ts", "worker.ts"])
    test(f + " reads accounts with cleanAccountEmail and never with the spaces-removed cleaner", () => { const s = src(f); expect(s).toContain("cleanAccountEmail("); expect(/[^A-Za-z]cleanEmail\(/.test(s)).toBe(false); });
});
