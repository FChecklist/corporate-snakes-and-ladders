import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "join-hint", tests: ["apps/web/test/t30-m2-join-hint.test.ts"], mutations: [
  { note: "the hint shows even when cleaning changes nothing", file: "apps/web/public/z.js", from: 'empRead.textContent = c && c !== String(em.value || "") ? ', to: 'empRead.textContent = c ? ' },
  { note: "the hint never shows", file: "apps/web/public/z.js", from: 'c && c !== String(em.value || "") ? "The system will read this as " + c : ""', to: '""' },
  { note: "the page reads the ID differently from the server (keeps dashes)", file: "apps/web/public/z.js", from: 'const c = String(em.value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9]/g, "");', to: 'const c = String(em.value || "").normalize("NFKC").toUpperCase().replace(/[^A-Z0-9-]/g, "");' },
  { note: "the hint wording changes", file: "apps/web/public/z.js", from: '"The system will read this as "', to: '"We will use "' },
  { note: "the hint is not updated while typing", file: "apps/web/public/z.js", from: 'em.addEventListener("input", showRead); showRead();', to: "showRead();" },
] });
