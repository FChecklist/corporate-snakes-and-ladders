import { describe, expect, test } from "bun:test";
import { cleanEmpId, normEmp, empCleanFor } from "../src/people";

describe("uniform employee ID", () => {
  test("the four examples", () => { for (const t of ["1B-678", "1b-678", "1B/678", "1B 678"]) expect(normEmp(t, true)).toBe("1B678"); });
  test("unicode, full-width, emoji, zero-width, accents", () => {
    expect(cleanEmpId("１Ｂ－６７８")).toBe("1B678");
    expect(cleanEmpId("1B\u200B678\u{1F600}")).toBe("1B678");
    expect(cleanEmpId("1B.6_7é8")).toBe("1B678");
  });
  test("empty after cleaning is refused, nothing typed is empty", () => { expect(normEmp("---//", true)).toBeNull(); expect(normEmp("😀", true)).toBeNull(); expect(normEmp("  ", true)).toBe(""); });
  test("30 character cap after cleaning", () => { expect(normEmp("A".repeat(30), true)).toBe("A".repeat(30)); expect(normEmp("A".repeat(31), true)).toBeNull(); expect(normEmp("A-".repeat(15), true)).toHaveLength(15); });
  test("duplicates appear only after cleaning", () => { expect(normEmp("1B-678", true)).toBe(normEmp("1b 678", true)); });
  test("a game made before the switch keeps the old reading", () => {
    expect(empCleanFor({ created_ms: 100 }, 200)).toBe(false);
    expect(empCleanFor({ created_ms: 300 }, 200)).toBe(true);
    expect(normEmp("1b-678")).toBe("1B-678");
    expect(normEmp("1B 678")).toBe("1B678");
  });
  test("deliberate break: a reading that keeps dashes fails the examples", () => {
    const broken = (t: string) => t.replace(/\s+/g, "").toUpperCase();
    expect(broken("1B-678")).not.toBe(normEmp("1B 678", true));
  });
});
