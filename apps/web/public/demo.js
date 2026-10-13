// The free demo page. The Snakes and Ladders demo (a short scripted game on a sample board) is not built yet, so this page only says so.
// Setting __CB_DEMO_STUB tells z.js (loaded right after this file) to leave the page alone.
(function () {
  "use strict";
  window.__CB_DEMO_STUB = true;
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = '<div class="zhead"><b>Corporate Snakes and Ladders</b></div><div class="zcard" role="status"><h2>Free demo</h2><p class="zsmall zflush zgap">The free demo is being rebuilt for Snakes and Ladders. Please check back soon.</p><a class="zbtn" href="/">Create my game</a></div>';
})();
