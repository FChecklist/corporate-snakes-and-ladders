/* The board look (Retro or Modern), put on the page before anything is drawn. Load it in <head> WITHOUT defer.
   The choice is kept only on this phone (localStorage "snk-look"). It is read here and never sent anywhere.
   z.js keeps the same attribute in step when a player picks the other look. Retro is the default. */
(function () {
  var look = "retro";
  try { if (localStorage.getItem("snk-look") === "modern") look = "modern"; } catch (e) { /* storage blocked or not available: Retro for this visit */ }
  try { document.documentElement.setAttribute("data-look", look); } catch (e) { /* the page still works without it */ }
})();
