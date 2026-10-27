// The page the sign-in e-mail's buttons open. Opening it (a GET, which mail scanners do too) changes nothing: it only shows a button. Pressing the button POSTs the single-use token,
// which starts the session (the same kind of key the 6-digit code gives) and goes to the AI-link page or the console.
(() => {
  const app = document.getElementById("app");
  const q = new URLSearchParams(location.search), hs = (() => { try { return history.state || {}; } catch { return {}; } })(), t = q.get("t") || hs.t || "", go = (q.get("go") || hs.go) === "ai" ? "/ai-link.html" : "/zc.html";
  try { history.replaceState({ t, go: go === "/ai-link.html" ? "ai" : "" }, "", location.pathname); } catch {} // the token leaves the address bar at once
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // K2: the sign-in boxes. Never pre-ticked; the Continue and Google buttons stay off until both are ticked; the server refuses without them. The wording comes from the server.
  let info = null, loadErr = ""; const state = {};
  const getJson = (p) => fetch(p, { headers: { accept: "application/json" } }).then((r) => r.json());
  const loadConsent = async () => { try { info = await CBConsent.load("K2", getJson); loadErr = ""; } catch { loadErr = "The terms could not be loaded. Please reload this page."; } };
  const draw = (msg) => {
    app.innerHTML = `<div class="zhead"><b><a class="zlogo" href="/" aria-label="Corporate Snakes and Ladders home"><img src="/logo-mark.svg" alt="Corporate Snakes and Ladders logo" width="20" height="20"></a>Corporate Snakes and Ladders</b></div><div class="zcard zform"><h2>Press the button to sign in</h2>
      <p class="zsmall" style="margin-top:0">This is Option 2 from your e-mail. It works once, for 10 minutes.</p>
      ${msg ? `<div class="zbanner bad" role="alert">${esc(msg)}</div>` : ""}
      <div id="k2">${info ? CBConsent.html(info, state) : `<p class="zsmall" role="status">${esc(loadErr || "Loading the terms…")}</p>`}</div>
      ${t ? `<button class="zbtn" id="go" disabled aria-disabled="true">Continue to Corporate Snakes and Ladders</button>` : `<div class="zbanner bad">This sign-in link is incomplete. Please ask for a new one from the sign-in page.</div>`}
      <p id="gOr" class="gor" hidden>or</p><div id="gWrap" class="gwrap" hidden></div>
      <p class="zsmall">Something wrong? <a href="/#login">Go back to the sign-in page</a> and ask for a new e-mail.</p></div>`;
    const b = document.getElementById("go"), ready = () => !!info && CBConsent.ready(info, state);
    const sync = () => { if (window.TB && TB.google && TB.google.setEnabled) TB.google.setEnabled(ready()); };
    if (info) { const box = document.getElementById("k2"), s0 = CBConsent.bind(box, info, state, b); box.querySelectorAll("input.cbc-tick").forEach((i) => i.addEventListener("change", sync)); s0(); }
    sync(); // set before Google's button is drawn, so it starts switched off
    const gw = document.getElementById("gWrap"); // "Continue with Google" shows only when the server has a Google client id; it signs in exactly like the e-mail does
    if (gw && window.TB && TB.google) TB.google.mount(gw, { intent: "signin", consent: () => (info ? CBConsent.payload(info, state) : null), onConsent: (c) => { if (c && Array.isArray(c.boxes)) { info = c; Object.keys(state).forEach((k) => delete state[k]); draw("Please read and tick the box again."); } }, onDone: (j) => { try { CTK.set("cbz-org", j.token); } catch {} location.replace(go); }, onError: (m) => draw(m) }).then((shown) => { const o = document.getElementById("gOr"); if (o && shown) o.hidden = false; }).catch(() => {});
    if (b) b.onclick = async () => {
      const consent = info ? CBConsent.payload(info, state) : null; if (!consent) return draw("Please tick the box first.");
      b.disabled = true;
      try {
        const r = await fetch("/api/auth/link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t, consent }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok && (j.code === "consent-required" || j.code === "terms-changed")) { // the token stays valid: show the fresh boxes, unticked, and let the person tick and press again
          if (j.consent && Array.isArray(j.consent.boxes)) info = j.consent; Object.keys(state).forEach((k) => delete state[k]);
          return draw("Please read and tick the box again, then press Continue.");
        }
        if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
        try { CTK.set("cbz-org", j.token); } catch {}
        location.replace(go);
      } catch (e) { draw(e && e.name === "TypeError" ? "We could not reach the service. Please check your internet and try again." : e && e.message ? e.message : "Something went wrong. Please try again."); }
    };
  };
  draw("");
  loadConsent().then(() => draw(""));
})();
