import { breakcheck } from "./lib.mjs";
await breakcheck({ id: "rules-fold", tests: ["apps/web/test/t30-m1-rules-fold.test.ts"], mutations: [
  { note: "the fold also shows after the game", file: "apps/web/public/z.js", from: '&& v.phase !== "ended" : v.phase !== "ended")', to: ": true)" },
  { note: "the fold also shows in the waiting room", file: "apps/web/public/z.js", from: "${waiting || !(self.SLRules", to: "${!(self.SLRules" },
  { note: "the fold never shows", file: "apps/web/public/z.js", from: "? \"\" : rulesFold(v)}", to: "? \"\" : \"\"}" },
  { note: "screenrules says rules show in every state but the waiting room", file: "apps/web/public/screenrules.js", from: 'function showRules(state) { return state === "playing"; }', to: 'function showRules(state) { return state !== "waiting"; }' },
  { note: "screenrules shows the thank-you strip in every state", file: "apps/web/public/screenrules.js", from: 'function showThanksStrip(state) { return state === "ended"; }', to: "function showThanksStrip(state) { return true; }" },
  { note: "an unknown theme is not turned into retro", file: "apps/web/public/screenrules.js", from: 'return theme === "modern" ? "modern" : "retro";', to: "return theme;" },
  { note: "z.html loads screenrules.js after z.js", file: "apps/web/public/z.html", from: '<script src="/screenrules.js"></script><script src="/z.js"></script>', to: '<script src="/z.js"></script><script src="/screenrules.js"></script>' },
  { note: "z.html stops loading release-line.js", file: "apps/web/public/z.html", from: '<script src="/release-line.js"', to: '<script src="/release-line-gone.js"' },
  { note: "with screenrules.js missing the page no longer hides the fold after the game", file: "apps/web/public/z.js", from: ': v.phase !== "ended") ? "" : rulesFold(v)', to: ': true) ? "" : rulesFold(v)' },
] });
