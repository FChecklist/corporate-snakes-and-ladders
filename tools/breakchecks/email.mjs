import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "email", tests: ["apps/edge/test/t30-m2-email.test.ts"], mutations: [
  { note: "the cleaner no longer lower-cases", file: "apps/edge/src/emailclean.ts", from: '.replace(/\\s+/g, "").toLowerCase();', to: '.replace(/\\s+/g, "");' },
  { note: "the cleaner no longer folds the full-width at-sign", file: "apps/edge/src/emailclean.ts", from: '.normalize("NFKC")', to: "" },
  { note: "the cleaner no longer removes inner spaces", file: "apps/edge/src/emailclean.ts", from: '.trim().replace(/\\s+/g, "")', to: ".trim()" },
  { note: "sign-in (start, e-mail code, verify) reads the address as typed", file: "apps/edge/src/worker.ts", from: 'cleanEmail(b.email) : "";', to: 'String(b.email).trim() : "";', all: true },
  { note: "the Host setup link hashes the address as typed", file: "apps/edge/src/hostsetup.ts", from: 'sha("email|" + cleanEmail(email))', to: 'sha("email|" + email)' },
  { note: "the visits hash uses the address as typed", file: "apps/edge/src/visits.ts", from: '"email|" + cleanEmail(email)', to: '"email|" + email' },
  { note: "test logins are matched case-sensitively", file: "apps/edge/src/testlogins.ts", from: 'TEST_LOGINS.has(cleanEmail(String(email ?? "")))', to: 'TEST_LOGINS.has(String(email ?? ""))' },
  { note: "the employee ID cleaner is applied to e-mail in sign-in (merges a.b-c with abc)", file: "apps/edge/src/worker.ts", from: "const email = typeof b?.email === \"string\" ? cleanEmail(b.email) : \"\";\n    if (!/^[^\\s@]{1,64}@[^\\s@]{1,255}\\.[^\\s@]{2,}$/.test(email)) return json({ error: \"Please enter a valid e-mail address.\" }, 400);\n    const eh = await sha(\"email|\" + email);\n    if (await env.DB.prepare(\"SELECT org FROM organizer_email", to: "const email = typeof b?.email === \"string\" ? cleanEmail(b.email).replace(/[-.]/g, \"\") : \"\";\n    if (!/^[^\\s@]{1,64}@[^\\s@]{1,255}\\.[^\\s@]{2,}$/.test(email)) return json({ error: \"Please enter a valid e-mail address.\" }, 400);\n    const eh = await sha(\"email|\" + email);\n    if (await env.DB.prepare(\"SELECT org FROM organizer_email" },
] });
