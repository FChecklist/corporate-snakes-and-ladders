import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "matrix", tests: ["tools/sim2/scenarios/matrix/matrix.test.ts"], mutations: [
  { note: "employee ID cleaner keeps dashes", file: "apps/edge/src/people.ts", from: 'toUpperCase().replace(/[^A-Z0-9]/g, "");', to: 'toUpperCase().replace(/[^A-Z0-9-]/g, "");' },
  { note: "old games read IDs the new way", file: "apps/edge/src/people.ts", from: "e.created_ms >= from", to: "true" },
  { note: "e-mail cleaner does not lower-case", file: "apps/edge/src/emailclean.ts", from: '.replace(/\\s+/g, "").toLowerCase();', to: '.replace(/\\s+/g, "");' },
  { note: "'either' is read as 'mobile'", file: "apps/edge/src/people.ts", from: 'j.verify === "id" || j.verify === "either" || j.verify === "both" ? j.verify : "mobile"', to: 'j.verify === "id" || j.verify === "both" ? j.verify : "mobile"' },
  { note: "a Co-host link is read as a Host link", file: "apps/edge/src/people.ts", from: "if (f >= COHOST_FROM && f < COHOST_FROM + 0x10000000) return { kind: \"cohost\", hex: (f - COHOST_FROM).toString(16).padStart(7, \"0\") };", to: "if (f >= COHOST_FROM && f < COHOST_FROM + 0x10000000) return { kind: \"host\", hex: (f - COHOST_FROM).toString(16).padStart(7, \"0\") };" },
  { note: "a personal link is case-sensitive", file: "apps/edge/src/people.ts", from: 'sha("pj|" + token.toLowerCase())', to: 'sha("pj|" + token)' },
  { note: "the rules row shows in every state", file: "apps/web/public/screenrules.js", from: 'function showRules(state) { return state === "playing"; }', to: "function showRules(state) { return true; }" },
  { note: "dice 'presence' mode throws for everybody", file: "packages/beacon/src/race.ts", from: 'const throws = cfg.play === "fate" || (input.thrown ? input.thrown(s, t) : false);', to: "const throws = true;" },
  { note: "the turn limit is one turn late", file: "packages/beacon/src/race.ts", from: "st.turnsPlayed >= cfg.turnCap", to: "st.turnsPlayed > cfg.turnCap" },
  { note: "exact finish is lost", file: "packages/beacon/src/play.ts", from: 'if (finish === "pass") return { from, roll, landed: board.size', to: 'if (finish !== "x") return { from, roll, landed: board.size' },
  { note: "(wire) an unpaid game does not lock after its start", file: "apps/edge/src/worker.ts", from: "if (locked) return json({ error: \"This game has not begun", to: "if (false) return json({ error: \"This game has not begun" },
  { note: "(wire) sign-up stays open after the start", file: "apps/edge/src/worker.ts", from: "if (now >= roundMs(e.start_round)) return json({ error: \"Sign-up for this game has closed", to: "if (false) return json({ error: \"Sign-up for this game has closed" },
  { note: "(wire) a second phone can take a board", file: "apps/edge/src/worker.ts", from: "if (have.seat && have.dev && have.dev !== dev) {", to: "if (false) {" },
  { note: "(wire) the organizer's 'admit' does nothing", file: "apps/edge/src/people.ts", from: "if (decision !== \"admit\" && decision !== \"decline\") return c.json({ error: \"Say admit or decline.\" }, 400);", to: "if (decision !== \"admit\" && decision !== \"decline\") return c.json({ error: \"Say admit or decline.\" }, 400); if (decision === \"admit\") return c.json({ ok: true });" },
  { note: "(wire) a bad mobile number is accepted", file: "apps/edge/src/worker.ts", from: "if (typedGiven && !typedPh) return json({ error: \"Enter a valid mobile number.\" }, 400);", to: "" },
  { note: "(wire) an ID that is not on the list gets a card", file: "apps/edge/src/worker.ts", from: "else if (!pr) idMiss = true; // ID alone, not on the list", to: "else if (!pr) idMiss = false; // ID alone, not on the list" },
] });
