// Found by the 100-million smoke test (rule T-72, 2026-11-04, seeds 96 / 592 / 835 / 1348 / 1797 of the snakes generator): the edge cleanEmpId upper-cased BEFORE dropping everything that is not A-Z / 0-9,
// so "ß" became SS, "ı" became I and "ǰ" became J, while the common engine (vendor core ids.ts) and Tambola's empid.ts drop first and so give a different ID for the same typing.
// FALSIFIED BY: emp-id-upper-before-strip (edge cleanEmpId: .toUpperCase().replace(/[^A-Z0-9]/g, ""))
import { expect, test } from "bun:test";
import { cleanEmpId } from "../src/people";
import { cleanEmpId as coreCleanEmpId } from "../../../vendor/game-core/packages/core/src/ids";

test("the edge and common-engine employee-ID cleaners agree on letters that change when upper-cased", () => {
  for (const raw of ["ǰ", "Aı", ".6éı", "86DEF4726321aBB3ǰ", "39B4ß", "1b-678", "1B/678", "1B 678", "ＡＢ12"]) expect(cleanEmpId(raw)).toBe(coreCleanEmpId(raw));
  expect(cleanEmpId("39B4ß")).toBe("39B4");
  expect(cleanEmpId("1b-678")).toBe("1B678");
  expect(cleanEmpId("ＡＢ12")).toBe("AB12"); // full-width letters still fold to A-Z first (NFKC)
});
