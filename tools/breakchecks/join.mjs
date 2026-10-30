import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "join-checkin", tests: ["apps/edge/test/t30-regress-join.test.ts"], mutations: [
  { note: "a second phone can take over a board", file: "apps/edge/src/worker.ts", from: "if (have.seat && have.dev && have.dev !== dev) {", to: "if (false) {" },
  { note: "a game that is not paid does not lock after its start", file: "apps/edge/src/worker.ts", from: "if (locked) return json({ error: \"This game has not begun", to: "if (false) return json({ error: \"This game has not begun" },
  { note: "sign-up stays open after the start", file: "apps/edge/src/worker.ts", from: "if (now >= roundMs(e.start_round)) return json({ error: \"Sign-up for this game has closed", to: "if (false) return json({ error: \"Sign-up for this game has closed" },
  { note: "a draft game accepts guests", file: "apps/edge/src/worker.ts", from: "if (isDraft && (((action === \"join\"", to: "if (false && isDraft && (((action === \"join\"" },
  { note: "a 5-digit number is accepted as a mobile number", file: "apps/edge/src/worker.ts", from: "if (n.length < (withCode ? 8 : 10) || n.length > 15) return null;", to: "if (n.length < 3 || n.length > 15) return null;" },
  { note: "the game has no cap (both guards removed)", edits: [{ file: "apps/edge/src/worker.ts", from: "if ((n?.c ?? 0) >= e.cap) return json({ error: \"This game is full.\" }, 409);", to: "" }, { file: "apps/edge/src/worker.ts", from: "eid, eid, e.cap, eid, ph, eid, eid, e.cap,", to: "eid, eid, e.cap + 100000, eid, ph, eid, eid, e.cap + 100000," }] },
  { note: "the Terms version is not checked", file: "apps/edge/src/consent.ts", from: "c.v !== TERMS_VERSION", to: "false" },
  { note: "not every consent box is needed", file: "apps/edge/src/consent.ts", from: "boxesFor(kind).every((b) => got.includes(b.id))", to: "true" },
  { note: "the leading = + - @ of a name is kept (spreadsheet formula)", file: "apps/edge/src/people.ts", from: '.replace(/^[=+\\-@\\s]+/, "")', to: "" },
  { note: "names may be longer than 60", file: "apps/edge/src/people.ts", from: ".trim().slice(0, 60) : \"\");", to: ".trim().slice(0, 600) : \"\");" },
  { note: "check-in is required for every game", file: "apps/edge/src/checkin.ts", from: "export const checkinRequired = (_e: { created_ms?: number | null }): boolean => false;", to: "export const checkinRequired = (_e: { created_ms?: number | null }): boolean => true;" },
  { note: "the check-in code permutation is no longer one-to-one", file: "apps/edge/src/checkin.ts", from: "nR = L ^ f(r, R)", to: "nR = L & f(r, R)" },
  { note: "check-in opens after the start", file: "apps/edge/src/checkin.ts", from: "startMs - CHECKIN_OPENS_BEFORE_MS", to: "startMs + CHECKIN_OPENS_BEFORE_MS" },
  { note: "card ids are 3 digits", file: "apps/edge/src/checkin.ts", from: "String(seat).padStart(4, \"0\")", to: "String(seat).padStart(3, \"0\")" },
] });
