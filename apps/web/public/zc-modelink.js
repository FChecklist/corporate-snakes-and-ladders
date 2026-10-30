/* The link at the top of the organizer console: "Try the new screens" / "Use the previous screens" (?flow=new / ?flow=old). */
(function () {
  try {
    var q = new URLSearchParams(location.search), a = document.getElementById("trynewtop"); if (!a) return;
    var n = q.get("flow") === "new"; q.set("flow", n ? "old" : "new");
    a.href = location.pathname + "?" + q.toString() + location.hash; a.textContent = n ? "Use the previous screens" : "Try the new screens";
  } catch (e) { /* the link stays as it is */ }
})();
