import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "landing", tests: ["apps/web/test/t30-m3-landing.test.ts"], mutations: [
  { note: "a menu item (Brochure) is missing", file: "apps/web/public/index.html", from: '<a href="/brochure.html">Brochure</a><a href="/partner.html">Refer &amp; earn</a><a href="/zc.html" class="login">', to: '<a href="/partner.html">Refer &amp; earn</a><a href="/zc.html" class="login">' },
  { note: "the Guide link points to the wrong page", file: "apps/web/public/index.html", from: '<a href="/organizer-guide.html">Guide</a><a href="/brochure.html">', to: '<a href="/guide-old.html">Guide</a><a href="/brochure.html">' },
  { note: "the old header (.snav) comes back", file: "apps/web/public/index.html", from: '<header class="ck-top">', to: '<header class="snav"></header><header class="ck-top">' },
  { note: "the Version slot is removed from the footer", file: "apps/web/public/index.html", from: '<p class="ck-ver" id="relline"></p>', to: "" },
  { note: "a theme dot is missing", file: "apps/web/public/index.html", from: '<button type="button" data-t="emerald" aria-pressed="false" aria-label="Emerald theme" title="Emerald"></button>', to: "" },
  { note: "the Menu button does not open the menu", file: "apps/web/public/brandkit.js", from: 'nav.classList.toggle("open", o);', to: 'nav.classList.toggle("openx", o);' },
  { note: "a theme dot does not change the theme", file: "apps/web/public/brandkit.js", from: 'd.setAttribute("data-theme", t); store("ct-theme", t);', to: 'd.setAttribute("data-theme", "blue"); store("ct-theme", t);' },
  { note: "Escape no longer closes the menu", file: "apps/web/public/brandkit.js", from: 'e.key === "Escape"', to: 'e.key === "F13"' },
  { note: "a legal link points to a page that does not exist", file: "apps/web/public/index.html", from: '<a href="/privacy.html">Privacy notice</a>', to: '<a href="/privacy-gone.html">Privacy notice</a>' },
  { note: "the page stops loading release-line.js", file: "apps/web/public/index.html", from: '<script src="/release-line.js" defer></script>', to: "" },
] });
