/* Corporate Games brand kit. Load with defer. Does two small jobs, with no outside request and no inline code:
   1. the phone menu button (#ck-menu opens and closes #ck-nav),
   2. the Dark / Light button (any button with data-ck-mode).
   The colours come from snakes-scheme.css (the old theme dots are gone). */
(function () {
  var d = document.documentElement;
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* blocked */ } }

  var menu = document.getElementById("ck-menu"), nav = document.getElementById("ck-nav");
  if (menu && nav) {
    var setOpen = function (o) { nav.classList.toggle("open", o); menu.setAttribute("aria-expanded", String(o)); menu.textContent = o ? "Close" : "Menu"; };
    menu.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && nav.classList.contains("open")) { setOpen(false); menu.focus(); } });
  }

  var modeBtns = [].slice.call(document.querySelectorAll("[data-ck-mode]"));
  function isDark() { var m = d.getAttribute("data-mode"); return m ? m === "dark" : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches); }
  function paintMode() { modeBtns.forEach(function (b) { b.textContent = isDark() ? "Light" : "Dark"; b.setAttribute("aria-pressed", String(isDark())); }); }
  modeBtns.forEach(function (b) { b.addEventListener("click", function () { var next = isDark() ? "light" : "dark"; d.setAttribute("data-mode", next); store("cg-theme", next); paintMode(); }); });
  paintMode();
})();
