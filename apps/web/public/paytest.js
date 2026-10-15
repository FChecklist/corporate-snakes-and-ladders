/* Corporate Snakes and Ladders: Payment testing. A real payment of Rs 1 (India) or US$ 1 (abroad) that buys nothing, so anyone can see that paying and the invoice work. Any number of times. */
(function () {
  const TB = window.TB, esc = TB.esc, $app = document.getElementById("app");
  const S = { country: "IN", pcode: "91", err: "", busy: false, done: null, ...(() => { const v = TB.payer.load(); return { name: v.name || "", email: v.email || "", phone: v.phone || "", org: v.org || "", tax: v.tax || "" }; })() };
  // K3 (payment boxes): the wording and the Terms version come from the server (consent.js). Never pre-ticked; the pay button stays off until every box is ticked; the tick lives here because the page repaints.
  const K3 = { info: null, state: {}, err: "", loading: false };
  const k3Ready = () => !!K3.info && !!window.CBConsent && CBConsent.ready(K3.info, K3.state);
  function k3Html() {
    if (!window.CBConsent) return `<p class="zsmall" role="status">The terms could not be shown. Please reload this page.</p>`;
    if (!K3.info && !K3.loading && !K3.err) {
      K3.loading = true;
      CBConsent.load("K3", (p) => TB.api("GET", p)).then((i) => { K3.info = i; }, () => { K3.err = "The terms could not be loaded. Please reload this page and try again."; }).then(() => { K3.loading = false; keep(); draw(); });
    }
    return K3.info ? CBConsent.html(K3.info, K3.state) : `<p class="zsmall" role="status">${esc(K3.err || "Loading the terms…")}</p>`;
  }
  const head = `<div class="zhead"><b><a class="zlogo" href="/" aria-label="Corporate Snakes and Ladders home"><img src="/logo-mark.svg" alt="Corporate Snakes and Ladders logo" width="20" height="20"></a>Corporate Snakes and Ladders · Payment testing</b><a class="zsnd" href="/" style="text-decoration:none">Home</a></div>${TB.payBrand ? TB.payBrand() : ""}`;
  function view() {
    if (S.done) {
      const d = S.done;
      return `${head}<div class="zcard" style="border:2px solid #2e7d4f"><h2>Payment received. The test worked.</h2>${TB.payReceipt ? TB.payReceipt(d, "Payment test (no game)") : ""}
        <p style="margin:0 0 10px">You paid <b>${esc(TB.money(d.total, d.currency))}</b>. Nothing was bought and nothing else will happen.</p>
        ${TB.invoiceBox ? TB.invoiceBox(d, S.email) : ""}<p class="zsmall">We also e-mailed it to you.</p>
        <button class="zbtn" id="again">Test again</button></div>`;
    }
    const cur = S.country === "IN" ? "INR" : "USD", amt = TB.money(1, cur);
    return `${head}<div class="zcard"><h2>Test our payment</h2>
      <p class="zsmall" style="margin-top:0">This is a real payment of <b>${esc(amt)}</b> (Rs 1 if you are in India, US$ 1 if you are abroad). It buys nothing. You get an invoice, so you can see the whole experience. Anyone can test it, any number of times.</p></div>
      <div class="zcard zform"><h2>Details</h2>
        <label for="nm">Name</label><input id="nm" autocomplete="name" value="${esc(S.name)}" placeholder="Full name">
        <label for="em">Email (your invoice comes here)</label><input id="em" type="email" autocomplete="email" value="${esc(S.email)}" placeholder="Email">
        <label for="ph">Mobile <span class="zsmall" style="display:inline">(optional)</span></label>
        <div style="display:flex;gap:8px"><select id="pcode" aria-label="Country code" style="flex:0 0 112px">${TB.COUNTRIES.map(([c, n, d]) => `<option value="${d}" ${String(d) === String(S.pcode) ? "selected" : ""}>${c} +${d}</option>`).join("")}</select><input id="ph" type="tel" autocomplete="tel-national" value="${esc(S.phone)}" placeholder="Mobile number" style="flex:1"></div>
        <label for="org">Company name <span class="zsmall" style="display:inline">(optional)</span></label><input id="org" autocomplete="organization" value="${esc(S.org || "")}" placeholder="Company name">
        <label for="tax">GST / Tax number <span class="zsmall" style="display:inline">(optional)</span></label><input id="tax" autocomplete="off" maxlength="30" value="${esc(S.tax || "")}" placeholder="GST / Tax number" style="text-transform:uppercase">
        <label for="cty">Your country</label><select id="cty">${TB.countryOpts(S.country)}</select>
        ${S.err ? `<div class="zbanner bad">${esc(S.err)}</div>` : ""}${S.busy ? `<div class="zbanner info" role="status">Confirming your payment with Razorpay. Please keep this page open.</div>` : ""}
        <div id="k3box">${k3Html()}</div>
        <button class="zbtn" id="go" ${S.busy || !k3Ready() ? "disabled" : ""}>${S.busy ? "Confirming your payment…" : "Pay " + esc(amt) + " (test)"}</button>
        <p class="zsmall">Secure payment by Razorpay to IT Services by Rajat Agarwal. Your name, e-mail and payment details are kept for invoice purposes. No refunds are given for test payments.</p></div>`;
  }
  const keep = () => { const g = (id) => { const e = document.getElementById(id); return e ? e.value : undefined; }; const v = { name: g("nm"), email: g("em"), phone: g("ph"), pcode: g("pcode"), org: g("org"), tax: g("tax") }; for (const k in v) if (v[k] !== undefined) S[k] = v[k]; };
  const draw = () => { $app.innerHTML = view(); bind(); TB.payer.mark($app); if (S.done && TB.invoiceWire) TB.invoiceWire(S.done); };
  async function waitForConfirm(paymentId) {
    const t0 = Date.now();
    while (Date.now() - t0 < 300000) {
      await new Promise((ok) => setTimeout(ok, 4000));
      try { const r = await TB.api("GET", "/api/payments/paytest/" + paymentId); if (r && !r.confirming) return r; } catch (e) { if (e.status && e.status < 500) throw e; }
    }
    throw new Error("Razorpay has not confirmed yet. If money was taken, your invoice will be e-mailed to you once it is.");
  }
  function bind() {
    const $ = (id) => document.getElementById(id);
    if ($("cty")) $("cty").onchange = () => { keep(); S.country = $("cty").value; draw(); };
    if ($("again")) $("again").onclick = () => { S.done = null; S.err = ""; draw(); };
    if ($("k3box") && K3.info && window.CBConsent) { // ticking the boxes switches the pay button on (unless a payment is already running)
      const pg = $("go"), hard = S.busy;
      CBConsent.bind($("k3box"), K3.info, K3.state, null);
      const sync = () => { if (pg) { const ok = !hard && CBConsent.ready(K3.info, K3.state); pg.disabled = !ok; pg.setAttribute("aria-disabled", ok ? "false" : "true"); } };
      $("k3box").querySelectorAll("input.cbc-tick").forEach((i) => i.addEventListener("change", sync)); sync();
    }
    if ($("go")) $("go").onclick = async () => {
      keep(); S.err = "";
      if ((S.name || "").trim().length < 2) { S.err = "Please enter your name."; return draw(); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((S.email || "").trim())) { S.err = "Please enter a valid email."; return draw(); }
      const taxId = (S.tax || "").trim().toUpperCase();
      if (S.country === "IN" && taxId && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(taxId)) { S.err = "Please enter a valid 15-character GSTIN, like 27ABCDE1234F1Z5."; return draw(); }
      const consent = K3.info ? CBConsent.payload(K3.info, K3.state) : null; if (!consent) { S.err = "Please tick the box first."; return draw(); } // never sent without every tick
      TB.payer.save(S);
      S.busy = true; draw();
      try {
        const r = await TB.api("POST", "/api/payments/paytest", { org: (S.org || "").trim(), taxId, name: S.name.trim(), email: S.email.trim().toLowerCase(), country: S.country, phone: S.phone, phoneCode: S.pcode, consent });
        let res = await TB.pay(r.razorpay, r.paymentId, r.hop); // opens Razorpay Checkout; the server verifies the payment
        if (res && res.confirming) res = await waitForConfirm(r.paymentId);
        S.done = res;
      } catch (e) {
        if (e.code === "consent-required" || e.code === "terms-changed") { if (e.consent && Array.isArray(e.consent.boxes)) K3.info = e.consent; Object.keys(K3.state).forEach((k) => delete K3.state[k]); S.err = "Please read and tick the box again, then press the pay button."; }
        else S.err = e.message;
      }
      S.busy = false; draw();
    };
  }
  draw();
})();
