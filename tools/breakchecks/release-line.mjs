import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "release-line", tests: ["apps/web/test/t30-m1-release-line.test.ts"], mutations: [
  { note: "a 'pending' date is printed as if it were real", file: "apps/web/public/release-line.js", from: 'indexOf("pending") !== 0', to: 'indexOf("pending") !== -2' },
  { note: "a real date is never printed", file: "apps/web/public/release-line.js", from: 'indexOf("pending") !== 0 ?', to: 'indexOf("pending") === 0 ?' },
  { note: "a failed fetch writes an error text", file: "apps/web/public/release-line.js", from: ".catch(function () {});", to: '.catch(function () { var s = document.getElementById("relline"); if (s) s.textContent = "error"; });' },
  { note: "the line says Release instead of Version", file: "apps/web/public/release-line.js", from: '"Version " + j.version', to: '"Release " + j.version' },
  { note: "the line asks for another address", file: "apps/web/public/release-line.js", from: 'fetch("/release.json"', to: 'fetch("/version.json"' },
  { note: "the shipped release.json is not 1.4.0", file: "apps/web/public/release.json", from: '"version":"1.4.0"', to: '"version":"1.3.9"' },
] });
