/* Terms and consent boxes (consent.ts on the server is the source of the wording and of the Terms version).
   Rules: never pre-ticked; the button stays disabled until every box is ticked; the SERVER refuses the request without the tick and the current version.
   Usage:
     const info = await CBConsent.load("K4", (path) => api("GET", path));       // { version, boxes:[{id,text}], termsUrl, privacyUrl, refundUrl }
     el.innerHTML = CBConsent.html(info, state);                                // state = {} kept by the page between repaints
     CBConsent.bind(el, info, state, buttonEl);                                 // ticks update state; the button is disabled until all are ticked
     body.consent = CBConsent.payload(info, state);                             // { version, boxes:["A","B"] } or null when not all ticked
   If the server answers { code: "consent-required" | "terms-changed", consent: info }, draw the boxes from `consent` again (unticked) and send once ticked. */
(function () {
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const CB = {
    async load(kind, get) { const r = await get("/api/consent/" + encodeURIComponent(kind)); if (!r || !Array.isArray(r.boxes)) throw new Error("no consent info"); return r; },
    /** The boxes as HTML: a real label per box (keyboard and screen readers), links that open the full text in a new tab, and nothing ticked unless `state` says the person ticked it. */
    html(info, state) {
      state = state || {};
      const links = `<p class="zsmall cbc-links" style="margin:4px 0 0"><a href="${esc(info.termsUrl || "/terms.html")}" target="_blank" rel="noopener">Terms &amp; Conditions</a> &middot; <a href="${esc(info.privacyUrl || "/legal.html#privacy")}" target="_blank" rel="noopener">Privacy Policy</a> &middot; <a href="${esc(info.refundUrl || "/refund-policy.html")}" target="_blank" rel="noopener">Refund Policy</a> &middot; version ${esc(info.version)}</p>`;
      const boxes = info.boxes.map((b) => `<label class="cbc-box" style="display:flex;gap:10px;align-items:flex-start;margin:8px 0;line-height:1.35"><input type="checkbox" class="cbc-tick" data-box="${esc(b.id)}" ${state[b.id] ? "checked" : ""} style="width:22px;height:22px;flex:none;margin-top:2px"><span>${esc(b.text)}</span></label>`).join("");
      return `<fieldset class="cbc" style="border:0;padding:0;margin:8px 0"><legend class="sr" style="position:absolute;left:-9999px">Terms and consent</legend>${boxes}${links}</fieldset>`;
    },
    ready(info, state) { return !!info && info.boxes.every((b) => state && state[b.id] === true); },
    payload(info, state) { return CB.ready(info, state) ? { version: info.version, boxes: info.boxes.map((b) => b.id) } : null; },
    /** Wires the boxes inside `root`: ticking updates `state`, and `button` is disabled until every box is ticked. Returns a function that re-checks the button. */
    bind(root, info, state, button) {
      const sync = () => { if (button) { const ok = CB.ready(info, state); button.disabled = !ok; button.setAttribute("aria-disabled", ok ? "false" : "true"); } };
      root.querySelectorAll("input.cbc-tick").forEach((i) => { i.checked = state[i.dataset.box] === true; i.onchange = () => { state[i.dataset.box] = i.checked; sync(); }; });
      sync();
      return sync;
    },
  };
  window.CBConsent = CB;
})();
