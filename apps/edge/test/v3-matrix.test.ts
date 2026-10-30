// Test author, run v3 (31 Oct 2026): a STREAMED matrix of more than one million DISTINCT ID inputs.
// Every input is a string a person could type into an ID box. It is cleaned by the product's four ID paths (employee-ID cleaner, employee-ID join/list reader on the new reading,
// the same reader used in an employee game, the participant Email ID reader) and by the account e-mail cleaner, and each answer is compared with a second copy of the owner's rule
// written without any regex and without calling the product. Nothing is kept except one Set that proves distinctness (exact strings, no hashing: no false "distinct").
// A repeated input is SKIPPED and counted; the report says how many were skipped. No backslash is typed in a literal: characters are built from code points.
import { describe, expect, test } from "bun:test";
import { cleanAccountEmail, cleanEmail } from "../src/emailclean";
import { cleanEmpId, normEmp, normId } from "../src/people";

const ch = (...n: number[]) => String.fromCharCode(...n);
const TARGET = 1_050_000; // distinct inputs to reach (the owner asked for at least 1,000,000)

/* ---------------------------------------------------------------- the rule, a second time (no regex, no product calls) */
const WSCH = new Set<string>([...[0x20, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0xa0, 0x1680, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff].map((c) => ch(c)), ...Array.from({ length: 11 }, (_, i) => ch(0x2000 + i))]);
const INV = new Set<string>([0x200b, 0x200c, 0x200d, 0x2060, 0xfeff, 0x85, 0x2028, 0x2029].map((c) => ch(c)));
const isAZ09 = (c: string) => (c >= "A" && c <= "Z") || (c >= "0" && c <= "9");
const mEmp = (raw: string) => { let o = ""; for (const c of raw.normalize("NFKC").toUpperCase()) if (isAZ09(c)) o += c; return o; };
const mTyped = (raw: string) => { let a = 0, b = raw.length; while (a < b && WSCH.has(raw[a]!)) a++; while (b > a && WSCH.has(raw[b - 1]!)) b--; return raw.slice(a, b); }; // trim: white space only (U+0085 is not white space for a trim; it is an invisible character)
/** employee ID on the new reading: "" nothing typed, null refused, else the cleaned ID (at most 30 after cleaning). An "@" (after NFKC) is refused first, in every game. */
const mEmpRead = (raw: string): string | null => { if (raw.normalize("NFKC").indexOf("@") >= 0) return null; if (mTyped(raw) === "") return ""; const c = mEmp(raw); return c !== "" && c.length <= 30 ? c : null; };
/** participant Email ID: NFKC, remove white space and invisible characters, lower case. */
const mEmailId = (raw: string) => { let o = ""; for (const c of raw.normalize("NFKC")) if (!WSCH.has(c) && !INV.has(c)) o += c; return o.toLowerCase(); };
const mEmailRead = (raw: string): string | null => {
  const k = mEmailId(raw); if (k === "") return "";
  const at = k.indexOf("@"); if (at < 1 || at !== k.lastIndexOf("@")) return null;
  const local = k.slice(0, at), dom = k.slice(at + 1); if (local.length > 64) return null;
  let ok = false; for (let d = 1; d < dom.length; d++) if (dom[d] === "." && d <= 255 && dom.length - d - 1 >= 2) { ok = true; break; } // a dot with something before it and at least two characters after it
  return ok && k.length <= 254 ? k : null;
};
/** account e-mail: NFKC, trim, lower case; a space or an invisible character INSIDE refuses it (""). */
const mAccount = (raw: string): string => { const v = mTyped(raw.normalize("NFKC")).toLowerCase(); for (const c of v) if (WSCH.has(c) || INV.has(c)) return ""; return v; };

/* ---------------------------------------------------------------- the stream */
const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
const body = (i: number) => { let n = i + 46656, s = ""; while (n > 0) { s = B36[n % 36]! + s; n = Math.floor(n / 36); } return s; }; // distinct for every i, letters and digits mixed
const wide = (s: string) => { let o = ""; for (const c of s) { const k = c.charCodeAt(0); o += k >= 0x21 && k <= 0x7e ? ch(k + 0xfee0) : c; } return o; }; // full-width forms
const mixed = (s: string) => { let o = ""; for (let k = 0; k < s.length; k++) o += k % 2 ? s[k]!.toUpperCase() : s[k]!; return o; };
const CASE: ((s: string) => string)[] = [(s) => s, (s) => s.toUpperCase(), mixed];
const SEP: (string | null)[] = [null, "-", " ", "/", "_", "."];
const WIDE = [false, true];
const INSERT: string[] = ["", ch(0x200b), ch(0xfeff), ch(0x85), ch(0x2060), ch(0x2028)];
const EDGE: [string, string][] = [["", ""], ["  ", " " + ch(9)], [ch(0x3000), ch(0xa0)]];
const PAD: number[] = [0, 28, 31, 45]; // pad the body with letters up to this length (0 = leave it)
const TAIL: string[] = ["", "1", "x", "9z", "-", "_a", ".b", "00", "@acme.com", ch(0xff20) + "Acme.COM", "@a", "@x.y", "@@x.com", "@ac me.in"]; // eight plain endings, six that make it an e-mail shape

const DIMS = [CASE.length, SEP.length, WIDE.length, INSERT.length, EDGE.length, PAD.length, TAIL.length];
const NV = DIMS.reduce((a, b) => a * b, 1); // 36,288 shapes
const VPB = 1000; // shapes tried for each body, picked by a fixed stride so every body meets a different spread of shapes
export function* idInputs(): Generator<string> {
  for (let i = 0; ; i++) {
    const b0 = i % 40 === 0 ? "-/." : body(i); // every 40th body is only punctuation: it cleans to nothing
    for (let j = 0; j < VPB; j++) {
      let v = (i * 7919 + j * 37) % NV; const d: number[] = []; for (const n of DIMS) { d.push(v % n); v = Math.floor(v / n); }
      const [cs, sep, wd, ins, ed, pad, tail] = [CASE[d[0]!]!, SEP[d[1]!]!, WIDE[d[2]!]!, INSERT[d[3]!]!, EDGE[d[4]!]!, PAD[d[5]!]!, TAIL[d[6]!]!];
      let s = cs(b0); if (PAD[d[5]!]! > s.length) { const need = PAD[d[5]!]! - s.length; for (let q = 0; q < need; q++) s += B36[(i + q * 7) % 36]!; }
      if (sep !== null && s.length > 4) s = s.slice(0, 2) + sep + s.slice(2, 4) + sep + s.slice(4);
      if (ins) s = s.slice(0, 1) + ins + s.slice(1);
      if (wd) s = wide(s);
      void pad;
      yield ed[0] + s + tail + ed[1];
    }
  }
}

type Impl = { emp: (s: string) => string; read: (s: string) => string | null; readEmpGame: (s: string) => string | null; readEmail: (s: string) => string | null; email: (s: string) => string; account: (s: string) => string };
const product: Impl = { emp: cleanEmpId, read: (s) => normEmp(s, true), readEmpGame: (s) => normId(s, "emp", true), readEmail: (s) => normId(s, "email"), email: cleanEmail, account: cleanAccountEmail };

/** Streams until `target` DISTINCT inputs have been checked. Returns the counts. Stops at the first mismatch when `stopAtFirst`. */
function run(impl: Impl, target: number, stopAtFirst = false) {
  const seen = new Set<string>(); let generated = 0, skipped = 0, wrong = 0; const firstWrong: string[] = [];
  const miss = (where: string, s: string, got: unknown, want: unknown) => { wrong++; if (firstWrong.length < 5) firstWrong.push(`${where}: ${JSON.stringify(s)} got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
  let tooLong = 0, refusedAt = 0, refusedEmpty = 0, kept = 0, accountRefused = 0;
  for (const s of idInputs()) {
    generated++;
    if (seen.has(s)) { skipped++; continue; } // a repeat: not checked again, counted
    seen.add(s);
    const a = impl.emp(s), b = impl.read(s), c = impl.readEmpGame(s), d = impl.readEmail(s), e = impl.email(s), f = impl.account(s);
    const wa = mEmp(s), wb = mEmpReadNoAt(s), wc = mEmpRead(s), wd = mEmailRead(s), we = mEmailId(s), wf = mAccount(s);
    if (a !== wa) miss("cleanEmpId", s, a, wa);
    if (b !== wb) miss("normEmp(new)", s, b, wb);
    if (c !== wc) miss("normId(emp)", s, c, wc);
    if (d !== wd) miss("normId(email)", s, d, wd);
    if (e !== we) miss("cleanEmail", s, e, we);
    if (f !== wf) miss("cleanAccountEmail", s, f, wf);
    if (stopAtFirst && wrong) break;
    if (wc === null) { if (s.normalize("NFKC").indexOf("@") >= 0) refusedAt++; else if (wa.length > 30) tooLong++; else refusedEmpty++; } else kept++;
    if (wf === "") accountRefused++;
    if (seen.size >= target) break;
  }
  return { generated, distinct: seen.size, skippedRepeats: skipped, wrong, firstWrong, kept, refusedBecauseAt: refusedAt, refusedTooLong: tooLong, refusedEmpty, accountRefused };
}
/** normEmp on its own (no "@" check) has the same rule without the first line. */
const mEmpReadNoAt = (raw: string): string | null => { if (mTyped(raw) === "") return ""; const c = mEmp(raw); return c !== "" && c.length <= 30 ? c : null; };

describe("streamed ID matrix: more than a million distinct inputs", () => {
  test("every one of at least 1,050,000 DISTINCT inputs is read exactly as the rule says by all six paths", () => {
    const r = run(product, TARGET);
    console.log("ID MATRIX", JSON.stringify(r));
    expect(r.distinct).toBeGreaterThanOrEqual(1_000_000);
    expect(r.distinct).toBe(TARGET);
    expect(r.generated).toBe(r.distinct + r.skippedRepeats);
    expect(r.firstWrong).toEqual([]);
    expect(r.wrong).toBe(0);
    // the stream really reaches every kind of answer (otherwise it would be a weak matrix)
    expect(r.kept).toBeGreaterThan(100_000); expect(r.refusedBecauseAt).toBeGreaterThan(100_000); expect(r.refusedTooLong).toBeGreaterThan(1000); expect(r.refusedEmpty).toBeGreaterThan(0); expect(r.accountRefused).toBeGreaterThan(100_000);
  }, 600_000);

  test("DELIBERATE BREAK: an employee-ID reader with no 30 cap is caught", () => {
    const broken: Impl = { ...product, read: (s) => { const t = String(s ?? "").trim(); if (!t) return ""; const c = cleanEmpId(t); return c || null; }, readEmpGame: (s) => (s.normalize("NFKC").includes("@") ? null : (String(s).trim() ? cleanEmpId(s) || null : "")) };
    expect(run(broken, TARGET, true).wrong).toBeGreaterThan(0);
  }, 600_000);
  test("DELIBERATE BREAK: an Email ID reader that keeps zero-width characters is caught", () => {
    const broken: Impl = { ...product, email: (s) => { let o = ""; for (const c of String(s).normalize("NFKC").trim()) if (!WSCH.has(c)) o += c; return o.toLowerCase(); } }; // removes white space but not the invisible characters
    expect(run(broken, TARGET, true).wrong).toBeGreaterThan(0);
  }, 600_000);
  test("DELIBERATE BREAK: an account e-mail cleaner that repairs inner spaces is caught", () => {
    const broken: Impl = { ...product, account: (s) => cleanEmail(s) };
    expect(run(broken, TARGET, true).wrong).toBeGreaterThan(0);
  }, 600_000);
  test("DELIBERATE BREAK: an employee-ID cleaner that forgets to upper-case is caught", () => {
    const broken: Impl = { ...product, emp: (s) => { let o = ""; for (const c of String(s).normalize("NFKC")) if (isAZ09(c)) o += c; return o; } };
    expect(run(broken, TARGET, true).wrong).toBeGreaterThan(0);
  }, 600_000);
});
