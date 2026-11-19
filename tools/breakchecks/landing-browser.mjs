import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "landing-browser", tests: ["apps/web/test/t30-m3-landing-browser.test.ts"], mutations: [
  { note: "a wide element makes the page scroll sideways", file: "apps/web/public/index.html", from: '<main>', to: '<main><div style="width:2000px;height:4px"></div>' },
  { note: "the kit header is gone", file: "apps/web/public/index.html", from: '<header class="ck-top">', to: '<header class="ck-top-gone">' },
  { note: "the old header (.snav) is shown again", file: "apps/web/public/index.html", from: '<header class="ck-top">', to: '<div class="snav">old</div><header class="ck-top">' },
  { note: "the Version slot is removed", file: "apps/web/public/index.html", from: '<p class="ck-ver" id="relline"></p>', to: "" },
  { note: "the Menu button stays visible on a laptop", file: "apps/web/public/components.css", from: ".ck-menu", to: ".ck-menu-renamed" , all: true },
  { note: "a theme dot does not change the theme", file: "apps/web/public/brandkit.js", from: 'd.setAttribute("data-theme", t); store("ct-theme", t);', to: 'store("ct-theme", t);' },
  { note: "the Menu button no longer opens the links", file: "apps/web/public/brandkit.js", from: 'nav.classList.toggle("open", o);', to: 'nav.classList.toggle("openx", o);' },
] });
