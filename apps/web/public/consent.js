/* The agreement notice (vanilla JS, no build). No tick-boxes anywhere. Going ahead (sign-in, publishing, joining) is the act; one small gentle line with three links
   sits where the boxes used to be, and the request still carries the version so the server keeps its proof (apps/edge/src/consent.ts: version, sha256 of the shown line, time; nothing personal).
   Two ways to call it, both give the same line:
     the page-with-info way (the older pages):  const info = await CBConsent.load("K4", get);  el.innerHTML = CBConsent.html(info, state);  CBConsent.bind(el, info, state, button);  body.consent = CBConsent.payload(info, state);
     the page-with-kind way (the payment pages): el.innerHTML = CBConsent.html("K3");  body.consent = CBConsent.payload(root, "K3");
   If the server answers { code: "consent-required" | "terms-changed", consent: info }, take the fresh info and send again: nothing is shown or held back. */
(function () {
  const C = (window.CBConsent = {});
  C.version = "2026-11-01";
  C.text = {
    K1: {
      A: "I have read and agree to the Terms & Conditions, the Privacy Policy and the Refund Policy.",
      B: "I confirm: players pay nothing to play. I provide and hand over any prize. This game is allowed in my State. I am allowed to invite these guests.",
    },
    K2: { A: "I have read and agree to the Terms & Conditions and the Privacy Policy." },
    K3: { A: "I agree to the Terms and the Refund Policy. I understand there is no refund; my payment stays as credit." },
    K4: {
      A: "I agree that my name (and my mobile number, only if the organizer asks for it) is used for this game only and deleted within 24 hours after it ends. I know who invited me is recorded until then. If I win a prize, the name and mobile number I confirm for the hand-over are kept for 365 days. The final places are kept as board numbers, without names. We keep billing data for audit and tax reasons. This notice is available in Hindi on request.",
      B: "I am 18 or older.",
    },
    K5: { A: "I will not charge any player. I will hand over prizes as the organizer decides. I follow the Terms." },
    K6: { A: "I am allowed to use these names and numbers for this game. The people have been told." },
    K7: { A: "I agree to the Terms, the Privacy Policy and the Refund Policy linked here. I understand there is no promise of funding or results." },
    K9: { A: "I agree that you may use my details to reply to this request." },
  };
  const DOC = "https://home.corporatetambola.com/terms";
  C.notice = "By continuing, you agree to the Terms and Conditions, Privacy and Data, and Game rules.";
  const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const style = () => {
    if (document.getElementById("cbc-style")) return;
    const s = document.createElement("style"); s.id = "cbc-style";
    s.textContent = ".cbc{margin:10px 0;text-align:left}.cbc-note{margin:0;font-size:12px;line-height:1.45;color:#5b6b73}.cbc-note a{color:inherit;text-decoration:underline}";
    document.head.appendChild(s);
  };
  const line = (kind) => {
    style();
    return `<div class="cbc" data-cbc="${esc(kind)}" role="note"><p class="cbc-note">By continuing, you agree to the <a href="${DOC}#terms" target="_blank" rel="noopener">Terms and Conditions</a>, <a href="${DOC}#privacy" target="_blank" rel="noopener">Privacy and Data</a>, and <a href="${DOC}#game-rules" target="_blank" rel="noopener">Game rules</a>.</p></div>`;
  };
  const kindOf = (a) => (typeof a === "string" ? a : a && a.kind) || "";
  const ids = (kind, info) => (info && Array.isArray(info.boxes) ? info.boxes.map((b) => b.id) : Object.keys(C.text[kind] || {}));
  /** Reads what the server says for a point: the current version and the points the notice covers (GET /api/consent/<kind>). */
  C.load = async (kind, get) => { const r = await get("/api/consent/" + encodeURIComponent(kind)); if (!r || !Array.isArray(r.boxes)) throw new Error("no consent info"); return r; };
  /** The notice, as HTML: one small line with three links. Nothing to tick. html("K3") or html(info, state). */
  C.html = (kind) => line(kindOf(kind)); // a kind ("K3") or the older info object; the state the older pages pass as a second argument is not needed
  /** The wording is known (loaded from the server): going ahead is the agreement. Never held back by a box. */
  C.ready = (info) => !!info;
  /** What to send with the request (the version, and the points the notice covers). payload(info, state) or payload(root, kind). */
  C.payload = (a, b) => {
    if (typeof b === "string") return { v: C.version, boxes: ids(b, null), notice: true };
    return C.ready(a) ? { v: a.version, boxes: ids(kindOf(a), a), notice: true } : null;
  };
  /** Going ahead is the agreement: every point counts as agreed. */
  C.ticked = (root, kind) => ids(kind, null);
  C.all = () => true;
  /** The button of the point is held only until the wording is loaded; nothing to tick. Returns a function that re-checks it. */
  C.bind = (root, info, state, button) => {
    const sync = () => { if (button) { const ok = C.ready(info) && button.dataset.hold !== "1"; button.disabled = !ok; button.setAttribute("aria-disabled", ok ? "false" : "true"); } };
    sync();
    return sync;
  };
  /** Buttons of the point are never held back by a box; a button marked data-hold="1" stays disabled for another reason. Returns refresh(). */
  C.wire = (root, kind, store, btn) => {
    const targets = () => Array.from(root.querySelectorAll(`[data-needs="${kind}"]`)).concat(btn ? [btn] : []);
    const refresh = () => { targets().forEach((b) => { const off = b.dataset.hold === "1"; b.disabled = off; b.setAttribute("aria-disabled", off ? "true" : "false"); }); return true; };
    refresh();
    return refresh;
  };
  C.gate = (root, kind, btn, keep) => C.wire(root, kind, keep, btn);
})();
