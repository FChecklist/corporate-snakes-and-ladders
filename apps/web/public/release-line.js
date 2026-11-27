// Footer line "Version X, released ... IST", read from /release.json. Nothing personal is read or sent.
(function () {
  fetch("/release.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (j) {
    var p = document.createElement("p"); p.className = "zsmall relline"; var slot = document.getElementById("relline"); if (slot) { slot.textContent = ""; p = slot; }
    p.textContent = "Version " + j.version + (j.releasedAtIST && j.releasedAtIST.indexOf("pending") !== 0 ? ", released " + j.releasedAtIST + " IST" : "");
    if (!slot) (document.querySelector("footer") || document.body).appendChild(p);
  }).catch(function () {});
})();
