/* Load in <head> WITHOUT defer so it runs before the page is drawn:
   marks the page as script-capable (class "js") and applies the saved Light or Dark choice (the Dark button on the home page).
   The choice lives on this device only. The colours themselves come from snakes-scheme.css. An older colour choice saved
   on this device by a former version is cleared here. */
(function () {
  var d = document.documentElement;
  d.classList.add("js");
  d.setAttribute("data-snk-dark", "auto"); // only the home page loads this file: it follows the device (see snakes-scheme.css); the player page and the console stay light
  try {
    localStorage.removeItem("cb-theme"); localStorage.removeItem("ct-theme");
    var m = localStorage.getItem("cg-theme");
    if (m === "dark" || m === "light") d.setAttribute("data-mode", m);
  } catch (e) { /* storage blocked: follow the page default and the device */ }
})();
