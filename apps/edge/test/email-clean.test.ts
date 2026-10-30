import { describe, expect, test } from "bun:test";
import { cleanEmail, cleanEmpId } from "../src/people";

const variants = (s: string) => { const out: string[] = []; for (let m = 0; m < 1 << 4; m++) out.push([...s].map((ch, i) => (i < 4 && m & (1 << i) ? ch.toUpperCase() : ch)).join("")); return out; };
describe("email id", () => {
  test("all 16 case variants, full-width at-sign, are one form", () => {
    const vs = variants("rajat1＠demo.com"); expect(new Set(vs).size).toBe(16);
    for (const v of vs) expect(cleanEmail(v)).toBe("rajat1@demo.com");
    expect(cleanEmail("RAJAT1＠DEMO.COM")).toBe(cleanEmail("Rajat1＠Demo.com"));
  });
  test("whitespace trimmed and removed", () => { expect(cleanEmail("  Rajat1 @ Demo.com \t")).toBe("rajat1@demo.com"); });
  test("duplicates by case are the same key", () => { expect(new Set(["A@x.com", "a@X.COM", "Ａ＠x.com"].map(cleanEmail)).size).toBe(1); });
  test("the employee ID cleaner is not the email cleaner", () => { expect(cleanEmpId("a@x.com")).not.toBe(cleanEmail("a@x.com")); });
  test("deliberate break: a case-sensitive compare would split them", () => { expect("Rajat1@demo.com" === "rajat1@demo.com").toBe(false); expect(cleanEmail("Rajat1@demo.com")).toBe(cleanEmail("rajat1@demo.com")); });
});
