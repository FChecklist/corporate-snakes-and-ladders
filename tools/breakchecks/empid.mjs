import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "empid", tests: ["apps/edge/test/t30-m2-empid.test.ts"], mutations: [
  { note: "the cleaner keeps dashes (1B-678 stays 1B-678)", file: "apps/edge/src/people.ts", from: 'toUpperCase().replace(/[^A-Z0-9]/g, "");', to: 'toUpperCase().replace(/[^A-Z0-9-]/g, "");' },
  { note: "no Unicode folding: full-width letters are dropped", file: "apps/edge/src/people.ts", from: 'String(raw ?? "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "")', to: 'String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "")' },
  { note: "the 30 character cap becomes 31", file: "apps/edge/src/people.ts", from: "return s && s.length <= 30 ? s : null; }", to: "return s && s.length <= 31 ? s : null; }" },
  { note: "symbols only is accepted as an empty ID instead of refused", file: "apps/edge/src/people.ts", from: "return s && s.length <= 30 ? s : null; }", to: "return s.length <= 30 ? s : null; }" },
  { note: "a game created exactly at the switch instant is treated as old", file: "apps/edge/src/people.ts", from: "e.created_ms >= from", to: "e.created_ms > from" },
  { note: "organizer list upload ignores the new reading", file: "apps/edge/src/people.ts", from: "normEmp(x?.empId ?? x?.employeeId, empCleanFor(c.e))", to: "normEmp(x?.empId ?? x?.employeeId, false)" },
  { note: "the 'who' check ignores the new reading", file: "apps/edge/src/worker.ts", from: "id = normEmp(b?.empId, empCleanFor(e));", to: "id = normEmp(b?.empId, false);" },
  { note: "join ignores the new reading", file: "apps/edge/src/worker.ts", from: "empNorm = normEmp(b?.empId, empCleanFor(e));", to: "empNorm = normEmp(b?.empId, false);" },
  { note: "the old reading changes: dashes are dropped in old games too", file: "apps/edge/src/people.ts", from: 'const s = String(raw ?? "").replace(/\\s+/g, "").toUpperCase(); if (!s) return "";', to: 'const s = String(raw ?? "").replace(/[\\s\\-]+/g, "").toUpperCase(); if (!s) return "";' },
  { note: "the ID hash no longer depends on the ID (everyone is the same person)", file: "apps/edge/src/people.ts", from: "|emp|${id}`", to: "|emp|`" },
] });
