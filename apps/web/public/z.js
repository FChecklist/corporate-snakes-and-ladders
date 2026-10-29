/* Corporate Snakes and Ladders, phone page for zero-server games. All game logic lives in zgame.js (window.ZG); this file only draws it.
   Note: the page is served with a strict style policy (no inline style attributes), so everything dynamic is drawn with classes and SVG attributes. */
(function () {
  if (window.__CB_DEMO_STUB) return; // demo.html while the demo is not rebuilt: demo.js shows its own message
  const ZG = window.ZG;
  const $app = document.getElementById("app");
  const q = new URLSearchParams(location.search);
  const LAST = "cb-last-eid";
  const DEMO = window.__CB_DEMO || null; // kept for a future free demo: nothing stored on our side
  let EID = DEMO ? DEMO.eid : (q.get("e") || location.hash.replace(/^#/, "") || "").trim();
  if (!DEMO) try { if (EID) localStorage.setItem(LAST, EID); else EID = localStorage.getItem(LAST) || ""; } catch {} // the installed app opens without the link: use the last game
  const BASE = (q.get("api") || "").replace(/\/$/, "");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const store = DEMO ? DEMO.store : { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const rawApi = DEMO ? DEMO.api : async (method, path, body) => {
    let r;
    try { r = await fetch(BASE + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch { throw new Error("offline"); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = Object.assign(new Error(j.error || "http " + r.status), { status: r.status, code: j.code, body: j }); if (window.CTG) CTG.wrap(err, { what: method + " " + path.split("?")[0].replace(/\/[A-Za-z0-9_-]{6,}(?=\/|$)/g, "/...") }); throw err; }
    return j;
  };
  // ---------- what the game's public settings say besides the plan: the brand strip, a cancelled game; and a personal invite link's token ----------
  const TOKEN = (q.get("t") || "").trim().slice(0, 80); // a personal link: sent as `token` when joining, so no mobile number is needed
  const INFO = { brand: null, cancelled: null, dns: false, joinPhone: false, verify: "mobile", empOnly: false }; // dns = "this game did not start": nobody paid, the time and 20 hours passed, the guest data was erased
  const cleanBrand = (b) => {
    if (!b || typeof b !== "object") return null;
    const name = String(b.name == null ? "" : b.name).replace(/\s+/g, " ").trim().slice(0, 60);
    let color = String(b.color || ""); if (/^#[0-9a-f]{3}$/i.test(color)) color = "#" + color.slice(1).split("").map((c) => c + c).join("");
    if (!/^#[0-9a-f]{6}$/i.test(color)) color = "#0B5D5B";
    const logo = typeof b.logo === "string" && b.logo.length < 90000 && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(b.logo) ? b.logo : ""; // only a small picture that travels inside the settings: never an outside address
    if (!name && !logo) return null;
    const lin = (h) => { const c = parseInt(h, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = 0.2126 * lin(color.slice(1, 3)) + 0.7152 * lin(color.slice(3, 5)) + 0.0722 * lin(color.slice(5, 7));
    return { name, color, logo, fg: (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.05) ? "#ffffff" : "#111111" }; // whichever of white and near-black reads better on the colour
  };
  const noteInfo = (r, fromJoin) => {
    if (!r || typeof r !== "object") return;
    if ("brand" in r && !(fromJoin && INFO.brand)) { INFO.brand = cleanBrand(r.brand); if (!DEMO && EID && INFO.brand && INFO.brand.logo !== undefined) { try { store.set("cbz:" + EID + ":brand", JSON.stringify(INFO.brand)); } catch { /* storage full or blocked: the strip just is not kept */ } } } // a join answer carries the brand without its logo: never let it replace the full one read from info
    if ("joinPhone" in r) INFO.joinPhone = r.joinPhone === true;
    if ("verify" in r) { INFO.verify = r.verify === "id" || r.verify === "both" ? r.verify : "mobile"; INFO.empOnly = r.employeesOnly === true; }
    if (r.didNotStart === true) INFO.dns = true; else if ("startRound" in r && !fromJoin) INFO.dns = false;
    if ("cancelled" in r || "startRound" in r) INFO.cancelled = r.cancelled ? { message: String(r.message || "").slice(0, 200) } : null;
  };
  if (!DEMO && EID) { try { const kept = JSON.parse(store.get("cbz:" + EID + ":brand") || "null"); if (kept && typeof kept === "object") INFO.brand = cleanBrand(kept); } catch { /* nothing kept yet */ } } // the installed app shows the organizer's logo and name even before (or without) the network
  window.addEventListener("online", () => { if (window.__cbzOff) location.reload(); }); // back online while the page could not reach the game: open it again by itself
  let lastJoin = null; // what the server said when a join was refused: the page decides what to show from it
  const api = async (method, path, body) => {
    const isJoin = method === "POST" && /\/join$/.test(path);
    const sent = isJoin && TOKEN && body && typeof body === "object" && !body.token ? Object.assign({}, body, { token: TOKEN }) : body;
    try {
      const r = await rawApi(method, path, sent);
      if (isJoin) { lastJoin = null; noteInfo(r, true); } else if (method === "GET" && /\/info$/.test(path)) noteInfo(r);
      return r;
    } catch (e) { if (isJoin) lastJoin = { status: e && e.status, code: (e && e.code) || (e && e.body && e.body.code) || "", body: (e && e.body) || {}, message: String((e && e.message) || "") }; throw e; }
  };
  const INVITE_FROM = Number(q.get("from")) || 0, INVITE_CAT = q.get("c") || "";
  const NAMES = {};
  // prize names and "how to win" come from the one shared table (ZG.PRIZE_HOUSES)
  ZG.PRIZE_HOUSES.forEach((h) => { if (!NAMES[h.id]) NAMES[h.id] = h.label; });
  const HOW = Object.fromEntries(ZG.PRIZE_HOUSES.map((h) => [h.id, h.how]));
  const howLine = (key) => (HOW[key] ? `<small class="zsmall zhow">${esc(HOW[key])}</small>` : "");
  const getPublic = DEMO ? DEMO.getPublic : async (url) => { let r; try { r = await fetch(url, { cache: "no-store" }); } catch { throw new Error("offline"); } if (!r.ok) throw Object.assign(new Error("http " + r.status), { status: r.status }); return r.json(); };
  const rt = new ZG.PhoneRuntime(EID, DEMO ? { api, getPublic, beacon: DEMO.beacon, verify: DEMO.verify, mono: DEMO.mono, store } : { api, getPublic, beacon: {}, mono: () => performance.now(), store });
  let firstPaint = true, sound = store.get("cbz-sound") !== "off", timer = null, lastStepKey = "";
  if (window.TBAudio) TBAudio.enabled = sound;
  const clock = (s) => { s = Math.max(0, Math.round(s)); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":"); }; // 00:12:34
  const GRACE_SECS = ZG.GRACE_ROUNDS * 3;
  const nickOf = (seat) => "Player " + seat; // nicknames are not available to the page yet: this is the one place to change when they are
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);

  // ---------- the company strip at the top of the page (colour and name set by the organizer; the small picture travels inside the settings) ----------
  const brandStrip = (sndBtn) => {
    const b = INFO.brand; if (!b) return `<div class="zbar"><div class="zbrand zdef" data-bg="#0B5D5B" data-fg="#ffffff"><b><a class="zlogo" href="/" aria-label="Corporate Snakes and Ladders home"><img src="/logo-mark.svg" alt="Corporate Snakes and Ladders logo" width="18" height="18"></a>CORPORATE SNAKES AND LADDERS</b></div>${sndBtn || ""}</div>`; // no company brand set: the page carries our own name in writing
    return `<div class="zbar"><div class="zbrand" data-bg="${esc(b.color)}" data-fg="${esc(b.fg)}">${b.logo ? `<img class="zblogo" alt="" src="${esc(b.logo)}">` : ""}${b.name ? `<b>${esc(b.name)}</b>` : ""}</div>${sndBtn || ""}</div><div class="zpow"><a class="zlogo" href="/" aria-label="Corporate Snakes and Ladders home"><img src="/logo-mark.svg" alt="Corporate Snakes and Ladders logo" width="12" height="12"></a>Powered by Corporate Snakes and Ladders</div>`;
  };
  const paintBrand = () => document.querySelectorAll(".zbrand").forEach((el) => { if (!el.classList.contains("zdef")) el.style.background = el.dataset.bg; el.style.color = el.dataset.fg; }); // our own default strip gets its colours from the stylesheet // set from the script, so a strict style policy never blocks the colour

  // ---------- terms and consent boxes (consent.js): K4 on the join screen, K6 on the "My invites" form. The tick state lives here so a repaint never loses it. ----------
  const K4 = { info: null, state: {}, loading: false, failed: false };
  const K6 = { info: null, state: {}, loading: false, failedAt: -Infinity };
  const CBC = () => window.CBConsent || null;
  const consentLoading = (failed, retryId) => (failed ? `<p class="zsmall">We could not load the terms. Check your connection. <button class="zsnd" id="${retryId}" type="button">Try again</button></p>` : `<p class="zsmall">Loading the terms…</p>`);
  async function loadK4() {
    if (K4.info || K4.loading) return;
    K4.loading = true;
    try { if (!CBC()) throw new Error("no consent.js"); K4.info = await CBC().load("K4", (path) => api("GET", path)); K4.failed = false; } catch { K4.failed = true; }
    K4.loading = false; fillK4();
  }
  function bindK4() {
    const box = document.getElementById("k4box"), go = document.getElementById("go"); if (!box) return;
    if (K4.info && CBC() && go) CBC().bind(box, K4.info, K4.state, go); else if (go) { go.disabled = true; go.setAttribute("aria-disabled", "true"); }
    const again = document.getElementById("k4retry"); if (again) again.onclick = () => { K4.failed = false; fillK4(); loadK4(); };
  }
  /** Redraws only the box area (never the name field), so the terms can arrive while someone is typing. */
  function fillK4() {
    const box = document.getElementById("k4box"); if (!box) return;
    box.innerHTML = K4.info && CBC() ? CBC().html(K4.info, K4.state) : consentLoading(K4.failed, "k4retry");
    bindK4();
  }
  async function loadK6() {
    if (DEMO || !ME.canInvite || K6.info || K6.loading || performance.now() - K6.failedAt < 30000) return;
    K6.loading = true;
    try { if (!CBC()) throw new Error("no consent.js"); K6.info = await CBC().load("K6", (path) => api("GET", path)); } catch { K6.failedAt = performance.now(); }
    K6.loading = false; if (K6.info) paint();
  }

  // ---------- joining: a personal link needs no number; a number may be asked for; a request may have to wait to be let in; a person may have been removed ----------
  const J = { emp: "", mode: "", phone: "", name: "", wid: "", who: "", timer: null, polling: false, note: "", msg: "", consent: null };
  const inviteOf = () => (INVITE_FROM ? { from: INVITE_FROM, cat: INVITE_CAT } : undefined);
  const head = `<div class="zhead"><b>Corporate Snakes and Ladders</b></div>`;
  // What the organizer asked people to give to get in: a mobile number (default), an employee ID, or both. Employees only: no way in without the ID.
  const joinWho = () => {
    const vm = INFO.verify || "mobile", eo = !!INFO.empOnly, pv = esc(J.phone || ""), ev = esc(J.emp || "");
    const phone = (label, hint) => `<label for="ph">${label}</label><input id="ph" inputmode="tel" autocomplete="tel" placeholder="+1 555 010 0100" value="${pv}">${hint ? `<p class="zsmall zflush">${hint}</p>` : ""}`;
    const emp = (label, hint) => `<label for="emp">${label}</label><input id="emp" autocomplete="off" autocapitalize="characters" maxlength="30" value="${ev}">${hint ? `<p class="zsmall zflush">${hint}</p>` : ""}`;
    if (vm === "id") return emp("Your employee ID", eo ? "This game is for employees only." : "") + (eo ? "" : phone("No employee ID? Type your mobile number instead", "Vendors, customers and families use their mobile number."));
    if (vm === "both") return phone("Your mobile number", "") + emp(eo ? "Your employee ID" : "Your employee ID (employees only)", eo ? "This game is for employees only." : "Not an employee? Leave this empty.");
    return phone("Your mobile number", "");
  };
  const BUSY_TRIES = 15;
  const joinView = (msg) => {
    if (J.mode === "removed") return `${brandStrip()}${head}<div class="zcard" role="status"><h2>You are not on this game's list</h2><p class="zsmall zflush">You were removed from this game, so there is no board for you here. If you think this is a mistake, please ask the person who invited you.</p></div>`;
    if (J.mode === "gone") return `${brandStrip()}${head}<div class="zcard" role="status"><h2>This link is not active any more</h2><p class="zsmall zflush">Please ask the person who invited you for a new link.</p></div>`;
    if (J.mode === "closed") return `${brandStrip()}${head}<div class="zcard" role="status"><h2>Sign-up has closed</h2><p class="zsmall zflush">Sign-up for this game has closed. The game is already running.</p></div>`;
    if (J.mode === "busy") return `${brandStrip()}${head}<div class="zcard zwait" role="status"><h2>Many people are joining right now</h2><p class="zflush zgap">Your request is safe. We are trying again for you every few seconds. Keep this page open.</p><p class="zsmall zflush">Try ${J.busyTries} of ${BUSY_TRIES}.</p></div><div class="zagain"><button class="zbtn s alt" id="again" type="button">Stop and try myself</button></div>`; // a whole office joins from one address: the server asks for a short wait, or the answer never comes: the page asks again by itself
    if (J.mode === "waiting") return `${brandStrip()}${head}<div class="zcard zwait" role="status"><h2>Please wait a moment</h2><p class="zflush zgap">${J.note ? esc(J.note) : `Your request to join has gone to ${J.who ? esc(J.who) : "the organizer"}.`}</p><p class="zsmall zflush">Keep this page open. As soon as you are let in, your board appears here.</p></div>`;
    if (J.mode === "declined" || J.mode === "lapsed") return `${brandStrip()}${head}<div class="zcard" role="status"><h2>${J.mode === "declined" ? "Your request was not accepted" : "This request has run out"}</h2><p class="zsmall zflush zgap">${J.mode === "declined" ? "You are not on the list for this game. Please ask the person who invited you." : "Nobody answered in time. You can ask again."}</p>${J.mode === "lapsed" ? `<button class="zbtn s" id="again" type="button">Ask again</button>` : ""}</div>`;
    const personal = !!TOKEN && J.mode !== "needPhone"; // a personal link is made for one person: nothing to type unless the server asks
    const needPhone = J.mode === "needPhone" || INFO.joinPhone || INFO.verify !== "mobile"; // the organizer asked guests to give a mobile number or an employee ID, or the link was already opened elsewhere
    const m = msg || J.msg;
    return `${brandStrip()}${head}
    <div class="zcard zform zjoin"><h2>Join the game</h2>
    <ol class="zsteps" aria-label="How to join"><li><b>1</b><span>Tick the boxes</span></li><li><b>2</b><span>${personal ? "Press Join" : "Type a nickname"}</span></li><li><b>3</b><span>${personal ? "Wait for the start" : "Press Join"}</span></li></ol>
    <p class="zgoalline zflush">Race a board of snakes and ladders. Land on the last square to win. The game plays by itself: nothing to download.</p>${INVITE_FROM ? `<div class="zbanner ok zflush">A colleague invited you. Join with your nickname to get your own board.</div>` : ""}
    ${J.mode === "needPhone" ? `<div class="zbanner info zflush" role="status">${J.note ? esc(J.note) : "This link was already opened on another phone. Please type your mobile number to join."}</div>` : ""}
    <div id="k4box">${K4.info && CBC() ? CBC().html(K4.info, K4.state) : consentLoading(K4.failed, "k4retry")}</div>
    ${personal ? `<p class="zsmall">Your personal link is ready. Tick the boxes and press the button to join.</p>` : ""}
    ${personal ? "" : `<label for="nm">Your nickname</label><input id="nm" autocomplete="off" maxlength="60" value="${esc(J.name)}">`}
    ${personal || !needPhone ? "" : joinWho()}
    ${m ? `<div class="zbanner bad" role="alert">${esc(m)}</div>` : ""}
    <button class="zbtn" id="go" type="button" disabled aria-disabled="true">Join the game</button>
    <p class="spriv">Players are 18 or older. Playing is free: you never pay, and no prize money is held or paid by us.</p>
    <p class="spriv"><a href="/privacy.html" target="_blank" rel="noopener">Privacy Policy</a></p></div>`;
  };
  const cancelledView = () => `${brandStrip()}${head}<div class="zcard" role="status"><h2>This game was cancelled</h2><p class="zsmall zflush">${esc((INFO.cancelled && INFO.cancelled.message) || "The organizer cancelled this game.")} There is nothing to do on this page. Thank you for your interest.</p></div>`;
  const dnsView = () => `${brandStrip()}${head}<div class="zcard" role="status"><h2>This game did not start</h2><p class="zsmall zflush">This game did not start. Your details have been erased. There is nothing to do on this page. Thank you for your interest.</p></div>`;
  const removedView = () => `${brandStrip()}${head}<div class="zcard" role="status"><h2>You have been removed from this game</h2><p class="zsmall zflush">This phone no longer plays in this game. If you think this is a mistake, please ask the person who invited you.</p></div>`;
  // what the server's "me" answer says about this player: removed, and (for a guest invited straight by the organizer's side) whether they may invite
  const ME = { at: -Infinity, role: null, removed: false, canInvite: false, per: 0, used: 0, loaded: false };
  async function pollMe(v) {
    if (DEMO || !v.pid || performance.now() - ME.at < 90000 + (Math.floor(performance.now()) % 30000)) return;
    ME.at = performance.now();
    try {
      const r = await api("GET", `/api/z/${EID}/me?pid=${encodeURIComponent(v.pid)}`);
      ME.loaded = true; ME.removed = r.removed === true || r.state === "removed"; ME.canInvite = r.canInvite === true; ME.per = Number(r.per) || 0; ME.used = Number(r.used) || 0; ME.role = r.role || null;
      if (ME.removed) paint();
    } catch (e) {
      if (e && e.status === 404 && /not a participant/i.test(String(e.message || ""))) { ME.removed = true; paint(); } // removed before the start: the server has deleted the seat, so it no longer knows this player
      /* any other trouble: asked again later */
    }
  }
  // The waiting screen survives a reload: what the person typed and the waiting number are kept on this phone only until they are let in, declined, removed or start again.
  const WAITKEY = "cbz-wait-" + EID;
  const saveWait = () => { try { store.set(WAITKEY, JSON.stringify({ wid: J.wid, who: J.who, note: J.note, phone: J.phone, emp: J.emp, name: J.name, at: Date.now() })); } catch {} };
  const clearWait = () => { try { localStorage.removeItem(WAITKEY); } catch {} try { store.set(WAITKEY, ""); } catch {} };
  function restoreWait() {
    if (DEMO || J.mode) return;
    let w = null; try { w = JSON.parse(store.get(WAITKEY) || "null"); } catch { w = null; }
    if (!w || !w.wid || Date.now() - Number(w.at || 0) > 7 * 86400000) { clearWait(); return; }
    J.mode = "waiting"; J.wid = String(w.wid); J.who = String(w.who || ""); J.note = String(w.note || ""); J.phone = String(w.phone || ""); J.emp = String(w.emp || ""); J.name = String(w.name || "");
    waitPoll();
  }
  function waitPoll() {
    clearInterval(J.timer); J.timer = setInterval(async () => {
      if (J.mode !== "waiting" || !J.wid || J.polling) return;
      J.polling = true;
      try {
        const r = await api("GET", `/api/z/${EID}/me?wid=${encodeURIComponent(J.wid)}`);
        if (r.with) J.who = String(r.with).slice(0, 60);
        if (r.state === "admitted") { clearInterval(J.timer); await doJoin(); }
        else if (r.state === "declined" || r.state === "lapsed" || r.state === "removed") { clearInterval(J.timer); clearWait(); J.mode = r.state === "removed" ? "removed" : r.state; paint(); }
      } catch { /* the next look tries again */ }
      J.polling = false;
    }, 5000);
  }
  /** Joins with what is typed (or just the token). Shows the game, or the calm screen that fits the answer. */
  async function doJoin() {
    const ok = await rt.join(J.phone, J.name, inviteOf(), J.consent || undefined, J.emp);
    if (ok) {
      J.mode = ""; J.msg = ""; clearInterval(J.timer); clearWait();
      if (TOKEN) { try { const u = new URLSearchParams(location.search); u.delete("t"); history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : "")); } catch {} } // the personal token leaves the address bar once it has done its job
      paint(); start(); return true;
    }
    const l = lastJoin || {}, b = l.body || {}, code = l.code || b.code || "";
    if (code === "did-not-start" || b.didNotStart) { INFO.dns = true; rt.error = null; clearInterval(J.timer); }
    else if (code === "consent-required" || code === "terms-changed") {
      if (b.consent && Array.isArray(b.consent.boxes)) K4.info = b.consent; // the fresh wording, drawn again unticked
      K4.state = {}; J.consent = null; rt.error = null; if (J.mode === "waiting") J.mode = "";
      J.msg = code === "terms-changed" ? "The terms have changed. Please read them and tick both boxes again." : "Please tick both boxes to join.";
    }
    else if (code === "closed" || /closed/i.test(String(rt.error || "")) || /closed/i.test(l.message || "")) { J.mode = "closed"; rt.error = null; clearInterval(J.timer); clearWait(); }
    else if (code === "removed") { J.mode = "removed"; rt.error = null; clearInterval(J.timer); }
    else if (code === "waiting" || b.waiting) { J.mode = "waiting"; J.wid = String(b.wid || J.wid || ""); J.who = String(b.with || J.who || "").slice(0, 60); J.note = String(b.error || l.message || "").slice(0, 300) || (code === "invite-full" ? "The person who invited you has used all their invitations, so your request has gone to the organizer." : ""); rt.error = null; saveWait(); waitPoll(); }
    else if (code === "declined" || b.declined) { J.mode = "declined"; rt.error = null; clearInterval(J.timer); }
    else if (code === "link-used" || b.needPhone) { J.mode = "needPhone"; J.note = ""; rt.error = null; }
    else if (code === "link-gone" || /link-gone/.test(l.message || "")) { J.mode = "gone"; rt.error = null; }
    else if ((code === "busy" || (!l.status && !code && !b.error && !b.waiting)) && (J.busyTries || 0) < BUSY_TRIES) { /* a join that timed out or lost its connection (no answer at all) is asked again by itself like a busy answer: joining is safe to repeat, the same phone gets the same card */ J.busyTries = (J.busyTries || 0) + 1; J.mode = "busy"; rt.error = null; clearTimeout(J.retry); J.retry = setTimeout(() => { if (J.mode === "busy") doJoin(); }, Math.round((4 + Math.min(26, J.busyTries * 2)) * 1000 * (0.7 + Math.random() * 0.6))); }
    else if (J.mode === "waiting" || J.mode === "busy") J.mode = ""; // let in, but the join failed another way: show the usual message
    paint(); return false;
  }

  // ---------- the board ----------
  const ordinalName = (k) => ["", "1st", "2nd", "3rd"][k] || k + "th";
  const KEYNAME = (key) => NAMES[key] || key;
  const seatOf = (pid) => { const m = /^(\d+)x/.exec(pid || ""); return m ? Number(m[1]) : 0; };
  const f2 = (n) => Math.round(n * 100) / 100;
  const msOf = (v) => {
    const size = v.board ? v.board.size : 100, m = v.cfg && Array.isArray(v.cfg.milestones) && v.cfg.milestones.length ? v.cfg.milestones : [ZG.DEFAULT_MILESTONE];
    return m.filter((n) => Number.isInteger(n) && n > 1 && n < size);
  };
  const ctr = (s, side) => { const p = ZG.squareXY(s, side); return { x: p.col + 0.5, y: side - 1 - p.row + 0.5 }; }; // row 0 is the BOTTOM row
  function ladderSvg(a, b, side) {
    const p = ctr(a, side), r = ctr(b, side), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 0.13, ny = (dx / len) * 0.13;
    const rl = (c, sx, sy) => `<line class="${c}" x1="${f2(p.x + sx)}" y1="${f2(p.y + sy)}" x2="${f2(r.x + sx)}" y2="${f2(r.y + sy)}"/>`;
    let out = `<g class="lad">${rl("railo", nx, ny)}${rl("railo", -nx, -ny)}${rl("rail", nx, ny)}${rl("rail", -nx, -ny)}`;
    const n = Math.max(2, Math.floor(len / 0.6));
    for (let i = 1; i < n; i++) { const t = i / n, cx = p.x + dx * t, cy = p.y + dy * t; out += `<line class="rung" x1="${f2(cx + nx)}" y1="${f2(cy + ny)}" x2="${f2(cx - nx)}" y2="${f2(cy - ny)}"/>`; }
    return out + "</g>";
  }
  function snakeSvg(head, tail, side, k5) {
    const p = ctr(head, side), r = ctr(tail, side), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1, k = Math.min(1.1, len * 0.28), nx = (-dy / len) * k, ny = (dx / len) * k;
    const c1 = { x: p.x + dx / 3 + nx, y: p.y + dy / 3 + ny }, c2 = { x: p.x + (2 * dx) / 3 - nx, y: p.y + (2 * dy) / 3 - ny };
    const d = `M${f2(p.x)} ${f2(p.y)} C${f2(c1.x)} ${f2(c1.y)} ${f2(c2.x)} ${f2(c2.y)} ${f2(r.x)} ${f2(r.y)}`, ex = (-dy / len) * 0.1, ey = (dx / len) * 0.1; // each snake has its own colour (k5 = 0..4), a pale outline, two eyes
    return `<g class="sn s${k5 % 5}"><path class="snko" d="${d}"/><path class="snk" d="${d}"/><circle class="snkhead" cx="${f2(p.x)}" cy="${f2(p.y)}" r="0.26"/><circle class="snkeye" cx="${f2(p.x + ex)}" cy="${f2(p.y + ey)}" r="0.07"/><circle class="snkeye" cx="${f2(p.x - ex)}" cy="${f2(p.y - ey)}" r="0.07"/><circle class="snkdot" cx="${f2(r.x)}" cy="${f2(r.y)}" r="0.1"/></g>`;
  }
  /** Square cells (classes place them: gcN = column, grN = row from the top) plus an SVG layer for the ladders and snakes. `pawns` maps a square to a list of seats (table mode). */
  function boardHtml(v, pawns, label) {
    const b = v.board, side = b.side, size = b.size, ms = msOf(v), me = v.me ? shownSquare(v) : 0, table = !!pawns;
    let cells = "", lines = "", ov = "";
    for (let s = 1; s <= size; s++) {
      const { col, row } = ZG.squareXY(s, side);
      const lad = b.ladders[s], snk = b.snakes[s], isMs = ms.includes(s), isEnd = s === size, mine = !table && s === me, here = table ? pawns[s] || [] : [];
      const lab = ["Square " + s];
      if (lad !== undefined) lab.push("ladder to " + lad);
      if (snk !== undefined) lab.push("snake to " + snk);
      if (isMs) lab.push("milestone");
      if (isEnd) lab.push("last square");
      if (mine) lab.push("you are here");
      for (const seat of here) lab.push(seat === v.seat ? "you are here" : nickOf(seat) + " is here");
      const cls = ["sq", "gc" + (col + 1), "gr" + (side - row), "h" + (row % 5)]; // h0..h4: a band of colour per row of the board
      if ((col + row) % 2) cls.push("a");
      if (lad !== undefined) cls.push("lb"); if (snk !== undefined) cls.push("sh"); if (isMs) cls.push("ms"); if (isEnd) cls.push("end"); if (mine || here.includes(v.seat)) cls.push("me");
      const marks = (isMs ? `<span class="mk mk1">&#9733;</span>` : "") + (lad !== undefined ? `<span class="mk mk2">&#9650;</span>` : snk !== undefined ? `<span class="mk mk2">&#9660;</span>` : "");
      const pw = mine ? `<i class="pawn me"></i>` : here.slice(0, 2).map((seat) => `<i class="pawn t${seat === v.seat ? " me" : ""}">${seat}</i>`).join("") + (here.length > 2 ? `<i class="pawn t more">+${here.length - 2}</i>` : "");
      cells += `<div class="${cls.join(" ")}" role="listitem" aria-label="${esc(lab.join(", "))}"></div>`;
      ov += `<div class="so gc${col + 1} gr${side - row}${lad !== undefined ? " lb" : ""}${snk !== undefined ? " sh" : ""}${isEnd ? " end" : ""}"><b>${s}</b>${marks}${pw}</div>`; // numbers, marks and pawns sit above the ladders and snakes
    }
    for (const a of Object.keys(b.ladders).map(Number).sort((x, y) => x - y)) lines += ladderSvg(a, b.ladders[a], side);
    Object.keys(b.snakes).map(Number).sort((x, y) => x - y).forEach((h, i) => { lines += snakeSvg(h, b.snakes[h], side, i); });
    return `<div class="sqwrap"><div class="sqgrid g${side}" role="list" aria-label="${esc(label)}">${cells}</div><svg class="sqsvg" viewBox="0 0 ${side} ${side}" aria-hidden="true" focusable="false">${lines}</svg><div class="sqov g${side}" aria-hidden="true">${ov}</div></div>`;
  }
  function boardCard(v) {
    const b = v.board;
    if (!b) return v.phase === "play" && !v.ended && !isWaiting(v) ? `<div class="zcard"><h2>${v.kind === "table" ? "The shared board" : "Your board"}</h2><p class="zsmall zflush">Getting the board ready…</p></div>` : "";
    const table = v.kind === "table" && v.table, ms = msOf(v);
    let pawns = null;
    if (table) { pawns = {}; for (const p of v.table.squares) (pawns[p.square] = pawns[p.square] || []).push(p.seat); }
    const lad = Object.keys(b.ladders).map(Number).sort((x, y) => x - y).map((a) => a + " to " + b.ladders[a]).join(", ");
    const snk = Object.keys(b.snakes).map(Number).sort((x, y) => x - y).map((h) => h + " to " + b.snakes[h]).join(", ");
    let pos = "";
    if (table) {
      const wt = v.table.whoseTurn;
      pos = wt === null || v.ended ? "" : wt === v.seat ? `<b>It is your turn to throw.</b> ` : `It is ${esc(nickOf(wt))}'s turn to throw. `;
      pos += v.me ? `You are on square <b>${v.me.square}</b> of ${b.size}.` : "";
    } else if (v.me) {
      pos = v.me.finishedTurn !== null ? `<b>You are home!</b> You reached square ${b.size} on turn ${v.me.finishedTurn + 1}.` : `You are on square <b>${v.me.square}</b> of ${b.size}`;
    }
    const stats = !table && v.me && v.me.finishedTurn === null ? `<span class="zpill up" role="img" aria-label="${v.me.ladders} ${v.me.ladders === 1 ? "ladder" : "ladders"} climbed">&#129693; ${v.me.ladders}</span><span class="zpill down" role="img" aria-label="${v.me.snakes} ${v.me.snakes === 1 ? "snake" : "snakes"} met">&#128013; ${v.me.snakes}</span>` : "";
    const lab = (table ? "Shared board, " : "Your board, ") + b.size + " squares. Square 1 is at the bottom left and the rows zig-zag upwards.";
    return `<div class="zcard zboardcard"><h2>${table ? "The shared board" : "Your board"}</h2> <span class="zgoalpill">Goal: land exactly on ${b.size}</span>
      ${pos ? `<p class="zpos" role="status"><span>${pos}</span>${stats}</p>` : ""}
      ${boardHtml(v, pawns, lab)}
      <p class="zsmall zleg"><span class="zkey ms">&#9733;</span> milestone ${ms.length ? esc(ms.join(", ")) : "none"} <span class="zkey end">&#127942;</span> last square ${b.size} <span class="zkey up">&#9650;</span> ladder: up <span class="zkey down">&#9660;</span> snake: down${table ? " <span class=\"zkey you\">1</span> numbered dots are players" : ""}</p>
      ${fold("lists", "Show every ladder and snake", `<p class="zsmall zlist2" id="ladlist"><b>Ladders:</b> ${esc(lad || "none")}.</p><p class="zsmall zlist2" id="snklist"><b>Snakes:</b> ${esc(snk || "none")}.</p>`)}</div>`;
  }
  // a fold-away block that keeps its open/closed state when the page redraws itself every second
  const OPENED = new Set();
  const fold = (key, title, inner) => `<details class="zfold" data-fold="${key}"${OPENED.has(key) ? " open" : ""}><summary>${title}</summary>${inner}</details>`;
  function bindFolds() { document.querySelectorAll("details[data-fold]").forEach((d) => { d.ontoggle = () => { if (d.open) OPENED.add(d.dataset.fold); else OPENED.delete(d.dataset.fold); }; }); }

  // ---------- the dice card: countdown ring, the last throw, the Throw button (presence mode) ----------
  const THROW = { busy: false, note: "", turn: -1, lateTurn: -1 };
  const FLASH = { turn: -1, until: 0, first: true }; // a short colour pulse on the dice card when a new turn begins (not on the first look at the page)
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const pipsOf = (face) => Array.from({ length: 9 }, (_, i) => `<i class="pip${(PIPS[face] || []).includes(i) ? " on" : ""}"></i>`).join("");
  /** A real 3D cube: ivory faces with black pips, opposite faces add up to 7 (1/6, 2/5, 3/4). `roll` is the number the game logic decided and is never changed here. The cube is turned so that exactly that face
      looks at you; while it rolls it tumbles on two axes, hops, and slows down onto that face. With "reduce motion" it simply shows the number. */
  const faces = () => [1, 2, 3, 4, 5, 6].map((n) => `<div class="dface df${n}">${pipsOf(n)}</div>`).join("");
  const dieHtml = (roll, mode) => {
    const label = mode === "rolling" ? "Rolling the dice" : mode === "wait" ? "The dice are rolling" : mode === "idle" ? "Your dice" : "You rolled " + roll;
    const cls = mode === "rolling" ? "rolling show" + ROLL.final : mode === "wait" ? "wait" : mode === "idle" ? "idle" : "show" + roll;
    return `<div class="dice3d${mode === "rolling" ? " rolling" : ""}" role="img" aria-label="${label}"><div class="dshadow"></div><div class="dhop"><div class="dtilt"><div class="dcube ${cls}">${faces()}</div></div></div></div>`;
  };
  // ---- the rolling animation (presentation only). It starts when a NEW throw of this player arrives, lasts 1.5 s, and ends on the number the game decided.
  const MOTION = () => { try { return !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const ROLL = { seen: null, t0: 0, dur: 1500, final: 0, from: 0, timer: null, doneAt: -Infinity };
  const rollingNow = () => ROLL.final > 0 && performance.now() - ROLL.t0 < ROLL.dur;
  const landedRecently = () => performance.now() - ROLL.doneAt < 900;
  const shownSquare = (v) => (rollingNow() && v.me && v.me.lastStep ? ROLL.from : v.me.square); // the pawn stays where it was until the die has settled
  function noteRoll(v) {
    const s = v.me && v.me.lastStep; if (!s) return;
    const key = v.me.history.length + ":" + s.from + ":" + s.roll;
    if (key === ROLL.seen) return;
    const first = ROLL.seen === null; ROLL.seen = key;
    if (first || firstPaint || !MOTION()) return; // the page has just opened, or motion is off: show the last throw as it is
    ROLL.final = s.roll; ROLL.from = s.from; ROLL.t0 = performance.now(); ROLL.doneAt = -Infinity;
    clearTimeout(ROLL.timer); tickRoll();
  }
  function tickRoll() {
    const left = ROLL.dur - (performance.now() - ROLL.t0);
    if (left <= 0) { ROLL.doneAt = performance.now(); ROLL.final = 0; paint(); return; }
    ROLL.timer = setTimeout(tickRoll, Math.min(left, 100)); // the cube moves by itself (CSS); this only waits for the end and then draws the result
  }
  /** the time bar: its width is set from the script (the page runs without inline styles) and eases to the new value */
  let lastPct = null;
  function syncTimer() {
    const i = document.querySelector(".ztimer i"); if (!i) { lastPct = null; return; }
    const to = Number(i.dataset.pct);
    if (lastPct !== null && MOTION()) { i.style.transition = "none"; i.style.width = lastPct + "%"; i.getBoundingClientRect(); i.style.transition = "width 1s linear"; }
    i.style.width = to + "%"; lastPct = to;
  }
  /** the pawn slides from the square it was on to the square it is on now (about 0.4 s; nothing with "reduce motion") */
  const PAWN = { sq: 0, x: 0, y: 0 };
  function slidePawn(v) {
    const el = document.querySelector(".sqov .pawn.me"), wrap = document.querySelector(".sqwrap");
    if (!el || !wrap) { PAWN.sq = 0; return; }
    const r = el.getBoundingClientRect(), w = wrap.getBoundingClientRect(), x = r.left - w.left, y = r.top - w.top, sq = v.me ? shownSquare(v) : 0;
    if (PAWN.sq && PAWN.sq !== sq && MOTION() && !firstPaint) {
      const dx = PAWN.x - x, dy = PAWN.y - y;
      el.style.transition = "none"; el.style.transform = `translate(${dx}px,${dy}px)`; el.getBoundingClientRect();
      el.style.transition = "transform 380ms cubic-bezier(.25,.8,.3,1)"; el.style.transform = "";
    }
    PAWN.sq = sq; PAWN.x = x; PAWN.y = y;
  }
  /** after each redraw: a die that is mid-roll carries on from where its movement was, not from the start */
  function syncDie() { const d = -Math.max(0, performance.now() - ROLL.t0) / 1000 + "s"; document.querySelectorAll(".dice3d.rolling, .dice3d.rolling .dshadow, .dice3d.rolling .dhop, .dice3d.rolling .dcube").forEach((el) => { el.style.animationDelay = d; }); }
  function ringHtml(secs, total, label) {
    const R = 20, C = 2 * Math.PI * R, frac = total > 0 && secs !== null ? Math.max(0, Math.min(1, secs / total)) : 1;
    return `<div class="zring" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle class="bg" cx="24" cy="24" r="${R}"/><circle class="fg" cx="24" cy="24" r="${R}" stroke-dasharray="${f2(C * frac)} ${f2(C)}" transform="rotate(-90 24 24)"/></svg><span>${secs === null ? "&ndash;" : secs}</span></div>`;
  }
  function stepText(s) {
    if (!s) return "";
    if (s.kind === "ladder") return `A ladder! You climb from square ${s.landed} up to square ${s.to}.`;
    if (s.kind === "snake") return `A snake! You slide from square ${s.landed} down to square ${s.to}.`;
    if (s.kind === "overshoot") return `Too many for the last square. You stay on square ${s.from}.`;
    if (s.kind === "finish") return "You are home! You landed on the last square.";
    return `You move from square ${s.from} to square ${s.to}.`;
  }
  function diceCard(v) {
    if (v.phase !== "play" || (!v.board && v.kind !== "table" && !v.me)) return "";
    const t = v.turn, presence = v.cfg.play === "presence", me = v.me, s = me && me.lastStep;
    const tableOther = v.kind === "table" && v.table && v.table.whoseTurn !== v.seat;
    const home = !!me && me.finishedTurn !== null;
    let state, ring = "", tone = "wait", chip = "Get ready", sub = "";
    const thrownWait = presence && t.state === "open" && t.thrown && !home && !tableOther;
    const rolling = rollingNow();
    if (v.ended || t.state === "over") { state = "The game is over."; tone = "end"; chip = "Game over"; sub = "Thank you for playing."; }
    else if (t.state === "wait") { state = t.secondsLeft === null ? "Getting ready…" : `Turn ${t.index + 1} opens in ${t.secondsLeft} seconds.`; ring = ringHtml(t.secondsLeft, 0, state); sub = presence ? "Get your thumb ready to roll." : "Nothing to press: your dice roll by themselves."; }
    else if (t.state === "open") {
      ring = ringHtml(t.secondsLeft, t.windowSec, `${t.secondsLeft} seconds left in this turn`);
      if (presence) {
        if (home) { state = "You are home. Nothing left to roll."; tone = "home"; chip = "You are home"; }
        else if (tableOther) { state = "Waiting for the other player to roll."; tone = "wait"; chip = "Wait"; }
        else if (t.thrown) { state = "Rolled! Waiting for the result."; tone = "go"; chip = "Rolled"; }
        else { state = "Your turn: tap the Roll button."; tone = "go"; chip = "Your turn"; sub = `Roll before the clock runs out. A ladder takes you up, a snake takes you down.`; }
      } else { state = `Your dice roll by themselves in ${t.secondsLeft === null ? "a moment" : t.secondsLeft + " seconds"}.`; tone = "soon"; chip = "Rolling soon"; sub = "Nothing to press. Just watch your pawn."; }
    } else { state = `Turn ${t.index + 1} is done.`; ring = ringHtml(t.secondsLeft, 0, `Next turn in ${t.secondsLeft} seconds`); sub = `Next turn in ${t.secondsLeft === null ? "a moment" : t.secondsLeft + " seconds"}.`; chip = "Next turn soon"; }
    if (home && tone !== "end") { tone = "home"; chip = "You are home"; }
    if (v.paused) { tone = "pause"; chip = "Paused"; }
    if (rolling) { state = "Rolling the dice…"; chip = "Rolling"; tone = "go"; sub = ""; }
    if (THROW.turn !== t.index) { THROW.note = ""; THROW.turn = -1; } // a message about an earlier turn goes away with the next event
    const canThrow = presence && t.state === "open" && !t.thrown && !home && !tableOther && !THROW.busy && !v.paused && THROW.lateTurn !== t.index;
    const throwBtn = presence && !v.ended ? `<button class="zbtn zroll" id="throw" type="button"${canThrow ? "" : " disabled"}>${THROW.busy ? "Rolling…" : thrownWait ? "Rolled. Wait for the result" : "Roll the dice"}</button>${THROW.note ? `<div class="zbanner bad" role="alert">${esc(THROW.note)}</div>` : ""}` : "";
    const dieMode = rolling ? "rolling" : (THROW.busy || thrownWait) ? "wait" : s ? "" : "idle";
    const die = v.ended && !s ? "" : `<div class="zdieblk">${dieHtml(s ? s.roll : 0, dieMode)}<div class="dnum${landedRecently() ? " pop" : ""}" aria-hidden="true">${rolling ? "&hellip;" : s ? s.roll : ""}</div></div>`;
    const outcome = s && !rolling ? (s.kind === "ladder" ? "up" : s.kind === "snake" ? "down" : s.kind === "finish" ? "win" : "") : "";
    const last = s ? (rolling ? "" : `<div class="zthrow ${outcome}${landedRecently() ? " zin" : ""}" role="status"><span class="zsteptxt">${esc(stepText(s))}</span></div>`) : (v.ended ? "" : `<p class="zsmall zflush zthrow">${v.turnsPlayed ? "You have not rolled yet." : "Your first roll comes with the first turn."}</p>`);
    const missed = presence && me && me.missed ? `<p class="zsmall zmissed">You missed ${plural(me.missed, "turn", "turns")}.</p>` : "";
    const tableLine = v.kind === "table" && v.table && v.table.whoseTurn !== null && !v.ended ? `<p class="zsmall zflush">${v.table.whoseTurn === v.seat ? "It is your turn." : "It is " + esc(nickOf(v.table.whoseTurn)) + "'s turn."}</p>` : "";
    const turnNo = Math.min(v.turnsPlayed + (v.ended ? 0 : 1), v.turnCap);
    const turnChip = `<span class="zchip2 plain">Turn ${turnNo} of ${v.turnCap}</span>`;
    const secs = t.state === "open" && t.secondsLeft !== null && !home && !v.paused ? t.secondsLeft : null, pct = secs !== null && t.windowSec > 0 ? Math.max(0, Math.min(100, Math.round((secs / t.windowSec) * 100))) : null;
    const flash = FLASH.turn !== t.index ? (FLASH.turn = t.index, FLASH.until = performance.now() + 450, FLASH.first ? (FLASH.first = false, "") : " zflash") : performance.now() < FLASH.until ? " zflash" : "";
    return `<div class="zcard zdice st-${tone}${flash}"><div class="zchiprow"><span class="zchip2 ${tone}">${esc(chip)}${secs !== null && !rolling ? ` &middot; ${secs}s` : ""}</span>${turnChip}</div>
      ${pct !== null ? `<div class="ztimer" role="progressbar" aria-label="Time left in this turn" aria-valuemin="0" aria-valuemax="${t.windowSec}" aria-valuenow="${secs}"><i data-pct="${pct}"></i></div>` : ""}
      <div class="zdicetop">${die}<div class="zstate" role="status"><b>${esc(state)}</b>${sub ? `<div class="zsmall zflush">${esc(sub)}</div>` : ""}</div></div>
      ${tableLine}${throwBtn}${last}${missed}</div>`;
  }

  // ---------- the crowd strip, the standings and the team table ----------
  function crowdCard(v) {
    const c = v.crowd; if (!c || !c.players) return "";
    const size = v.board ? v.board.size : 100, per = size / 10, max = Math.max(1, ...c.bands);
    const mine = v.me && v.kind !== "table" ? Math.min(9, Math.floor((v.me.square - 1) / per)) : -1;
    const bars = c.bands.map((n, i) => {
      const from = Math.floor(i * per) + 1, to = Math.round((i + 1) * per), h = n ? Math.max(1, Math.round((n / max) * 20)) : 0;
      return `<div class="cbar${i === mine ? " me" : ""}" role="img" aria-label="Squares ${from} to ${to}: ${plural(n, "player", "players")}${i === mine ? ", your band" : ""}"><em>${n}</em><span class="bh bh${h}"></span><small>${from}</small></div>`;
    }).join("");
    const ahead = v.kind !== "table" && v.me ? `, you are ahead of <b>${c.ahead}%</b> of players` : "";
    return `<div class="zcard"><h2>The crowd</h2><div class="zcrowd" role="group" aria-label="Where the players are, in ten bands of the board. The number under a bar is the first square of its band.">${bars}</div>
      <p class="zsmall zcrowdtxt">${plural(c.players, "player", "players")}, ${c.finished} home${ahead}.</p></div>`;
  }
  function standingsCard(v) {
    if (!v.top || !v.top.length) return "";
    const rows = v.top.map((r) => `<li class="zrk${r.seat === v.seat ? " you" : ""}"><span class="zr">${r.rank}</span><span class="zn">${esc(nickOf(r.seat))}${r.seat === v.seat ? " <em>(you)</em>" : ""}${r.note ? `<small class="zsmall zflush">${esc(r.note)}</small>` : ""}</span><span class="zq">${r.finishedTurn !== null ? "home, turn " + (r.finishedTurn + 1) : "square " + r.square}</span></li>`).join("");
    const inTop = v.top.some((r) => r.seat === v.seat);
    const mine = v.myRank !== null && v.myRank !== undefined && !inTop ? `<p class="zsmall zmyrank">Your place: <b>${v.myRank}</b>${v.crowd ? " of " + v.crowd.players : ""}.</p>` : "";
    return `<div class="zcard"><h2>Standings</h2><ol class="zstand">${rows}</ol>${mine}</div>`;
  }
  function teamCard(v) {
    if (v.kind !== "team" || !v.team || !v.team.rows || !v.team.rows.length) return "";
    const rows = v.team.rows.slice().sort((a, b) => a.rank - b.rank).map((r) => `<tr class="${v.team.mine === r.team ? "you" : ""}"><th scope="row">Team ${r.team + 1}${v.team.mine === r.team ? " (yours)" : ""}</th><td>${r.members.length}</td><td>${(Math.round(r.avgSquare * 10) / 10).toFixed(1)}</td><td>${r.finishedTurn !== null ? "turn " + (r.finishedTurn + 1) : "&ndash;"}</td></tr>`).join("");
    return `<div class="zcard"><h2>Team race</h2>${v.team.mine !== null && v.team.mine !== undefined ? `<p class="zsmall zflush zgap">Your team: <b>${v.team.mine + 1}</b></p>` : ""}<table class="ztable"><thead><tr><th scope="col">Team</th><th scope="col">Players</th><th scope="col">Average square</th><th scope="col">Home</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  // ---------- prizes: what can be won, and what is decided ----------
  const lineName = (cfg, key, ordinal) => (ZG.linesFor(cfg.rewards, key).length > 1 ? ordinalName(ordinal) + " " : "") + KEYNAME(key);
  function howFor(v, key, line) {
    if (key === "milestone") { const sq = msOf(v)[line.ordinal - 1]; if (sq) return `The first player on or past square ${sq}.`; }
    if (key === "finish") return `Land exactly on the last square${v.board ? " (" + v.board.size + ")" : ""}. The first five players home win 1st to 5th.`;
    return HOW[key] || "";
  }
  function prizeList(v) {
    const out = [];
    for (const key of ZG.keysInPlay(v.cfg.rewards)) for (const line of ZG.linesFor(v.cfg.rewards, key)) out.push({ key, line, name: lineName(v.cfg, key, line.ordinal), how: howFor(v, key, line), text: line.text || "" });
    return out;
  }
  function prizesStatusCard(v) {
    const list = prizeList(v); if (!list.length) return "";
    const rows = list.map((p) => {
      const res = (v.results || []).find((r) => r.pattern === p.key && r.ordinal === p.line.ordinal);
      const right = res && res.winners && res.winners.length ? ((res.winners || []).includes(v.pid) ? `<em class="zwonchip">You won!${res.tied > 1 ? " &middot; decided by chance" : ""}</em>` : `<i class="zdonechip">Awarded</i>`) : `<i class="zopenchip">Up for grabs</i>`;
      return `<div class="zrow zprize"><span class="ztrophy" aria-hidden="true">&#127942;</span><span class="zpname"><b>${p.text ? esc(p.text) : esc(p.name)}</b>${p.text ? `<small class="zsmall zflush">${esc(p.name)}</small>` : ""}${p.how ? `<small class="zsmall zflush zhow">${esc(p.how)}</small>` : ""}</span>${right}</div>`;
    }).join("");
    return `<div class="zcard zprizecard"><h2>What you can win</h2>${rows}</div>`;
  }

  // A lucky draw is the same fair draw whatever it looks like (the winners are fixed by public values before anyone scratches); only the reveal differs.
  const scratched = new Set(), seenAt = {};
  function luckyCard(v) {
    if (!v.lucky.length) return "";
    const scr = v.lucky.some((l) => l.style === "scratch");
    const rows = v.lucky.map((l) => {
      let right;
      if (!l.published) right = `<i>at the end of the break</i>`;
      else if (l.style === "scratch") {
        seenAt[l.ordinal] = seenAt[l.ordinal] || Date.now();
        const open = scratched.has(l.ordinal) || Date.now() - seenAt[l.ordinal] > 45000; // it opens by itself after 45 seconds
        right = open ? (l.won ? `<em>You won!</em>` : `<i>Not this time</i>`) : `<button class="zscratch" data-scr="${l.ordinal}" aria-label="Scratch to reveal">Scratch here</button>`;
      } else right = l.won ? `<em>You won!</em>` : `<i>Not this time</i>`;
      return `<div class="zrow"><span>${esc(l.title)}<br><small class="zsmall zflush">${l.winners} ${l.winners === 1 ? "person is" : "people are"} picked at random${l.style === "scratch" ? " &middot; scratch card" : ""}</small></span>${right}</div>`;
    }).join("");
    return `<div class="zcard"><h2>${scr ? "Scratch card" : "Lucky draw"}</h2>${rows}</div>`;
  }
  function icsFor(v) {
    const ms = (1692803367 + (v.scheduledRound - 1) * 3) * 1000, f = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Corporate Snakes and Ladders//EN", "BEGIN:VEVENT", "UID:" + EID + "@corporate-snakes-and-ladders", "DTSTAMP:" + f(Date.now()), "DTSTART:" + f(ms), "DTEND:" + f(ms + 45 * 60000), "SUMMARY:Corporate Snakes and Ladders game", "DESCRIPTION:Open " + location.origin + "/z?e=" + EID + " a few minutes early.", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    return "data:text/calendar;charset=utf-8," + encodeURIComponent(text);
  }
  /** True while the first turn has not opened yet (and no break or hold is showing): the waiting room is shown instead of the dice. */
  const isWaiting = (v) => v.phase === "play" && !v.locked && !v.brk && v.turnsPlayed === 0 && v.turn.state === "wait" && v.turn.secondsLeft !== null && v.turn.secondsLeft > 0;
  /** Before the first turn: what to expect, what can be won, the rules, a sound check and a calendar entry. Everything here is known at boot, so it costs no extra requests. */
  function waitingRoom(v) {
    if (!isWaiting(v)) return "";
    const ms = (1692803367 + (v.scheduledRound - 1) * 3) * 1000;
    const when = new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
    const prizes = prizeList(v).map((p) => `<div class="zrow zprize"><span class="ztrophy" aria-hidden="true">&#127942;</span><span class="zpname"><b>${p.text ? esc(p.text) : esc(p.name)}</b>${p.text ? `<small class="zsmall zflush">${esc(p.name)}</small>` : ""}${p.how ? `<small class="zsmall zflush zhow">${esc(p.how)}</small>` : ""}</span></div>`).join("");
    const toFirst = v.turn.secondsLeft, setup = toFirst <= GRACE_SECS;
    const top = setup
      ? `<h2>Your game is setting up</h2><div class="zsetup">Sign-up has closed. The first turn comes in a moment.</div><div class="zcount" aria-live="off" id="cd">${clock(toFirst)}</div><p class="zsmall zflush">until the first turn. Keep this page open: the game moves by itself.</p>`
      : `<h2>You are in. See you at ${esc(when)}</h2><div class="zsmall zflush">Starting in</div><div class="zcount" aria-live="off" id="cd">${clock(toFirst - GRACE_SECS)}</div><p class="zsmall zflush">hours : minutes : seconds. Keep this page open: the game moves by itself.</p>`;
    const secs = v.callSeconds || 20;
    const rules = [v.kind === "table" ? "1. Everyone plays on one shared board and takes turns." : "1. You have your own board. Nobody else has the same one.", `2. Every turn lasts about ${secs} seconds. Your throw is the dice for that turn.`, "3. Snakes take you down. Ladders take you up.", "4. To finish you need the exact number to land on the last square.", "5. The software checks everything. Nobody can change a result."];
    return `<div class="zcard zwait">${top}
      <div class="zdo"><b>What to do:</b> nothing yet. Keep this page open. ${v.cfg.play === "presence" ? "When the first turn opens, tap the Roll button." : "Your rolls happen by themselves."}</div>
      ${prizes ? `<h3>What you can win</h3><div class="zprizes2">${prizes}</div>` : ""}
      <h3>The rules</h3><ul class="zlist zrules">${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
      <button class="zbtn s alt" id="soundtest" type="button">Check my sound</button><a class="zbtn s alt" id="addcal" download="game.ics" href="${icsFor(v)}">Add to my calendar</a></div>`;
  }

  // ---------- winners: a prize record that stays on this phone, the hurray, the final thank-you ----------
  const prizeKey = "cbz-prizes:" + EID;
  const readJson = (k, d) => { try { const v = JSON.parse(store.get(k) || ""); return v || d; } catch { return d; } };
  const winId = (w) => w.round + ":" + w.pattern + ":" + w.ordinal;
  let PRIZES = [];
  const celebrated = new Set();
  function syncPrizes(v) {
    const have = readJson(prizeKey, []), ids = new Set(have.map(winId)), fresh = [];
    const add = (w) => { if (!ids.has(winId(w))) { ids.add(winId(w)); have.push(w); if (!celebrated.has(winId(w))) fresh.push(w); celebrated.add(winId(w)); } };
    for (const w of v.won) add({ round: w.round, pattern: w.pattern, ordinal: w.ordinal, text: w.text, name: lineName(v.cfg, w.pattern, w.ordinal) });
    for (const l of v.lucky) if (l.won) add({ round: 1, pattern: "lucky", ordinal: l.ordinal, text: l.title, name: l.title });
    if (fresh.length) store.set(prizeKey, JSON.stringify(have));
    PRIZES = have;
    return fresh;
  }
  function confetti(canvas) {
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = (canvas.width = innerWidth), H = (canvas.height = innerHeight), cols = ["#FFC93C", "#1D7CF2", "#E4572E", "#2E9E6B", "#E63977", "#7B3FE4"];
    const ps = Array.from({ length: 140 }, () => ({ x: Math.random() * W, y: -20 - Math.random() * H * 0.6, r: 4 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0], vy: 2 + Math.random() * 3.5, vx: -1.5 + Math.random() * 3, a: Math.random() * 6.28, va: -0.2 + Math.random() * 0.4 }));
    const t0 = performance.now();
    (function f(t) {
      ctx.clearRect(0, 0, W, H);
      for (const q of ps) { q.x += q.vx; q.y += q.vy; q.a += q.va; ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.a); ctx.fillStyle = q.c; ctx.fillRect(-q.r / 2, -q.r / 2, q.r, q.r * 1.6); ctx.restore(); }
      if (t - t0 < 6000 && canvas.isConnected) requestAnimationFrame(f); else ctx.clearRect(0, 0, W, H);
    })(t0);
  }
  function showHurray(list) {
    const old = document.getElementById("hurray"); if (old) old.remove();
    const box = document.createElement("div"); box.id = "hurray"; box.className = "zhurray"; box.setAttribute("role", "alertdialog"); box.setAttribute("aria-live", "assertive");
    const what = list.map((w) => esc(w.name)).join(", ");
    const prize = list.filter((w) => w.text).map((w) => `<div class="zhp">${esc(w.text)}</div>`).join("");
    box.innerHTML = `<canvas class="zconf" aria-hidden="true"></canvas><div class="zhcard"><div class="zhbig">Hurray!</div><div class="zhsub">Congratulations, you won</div><div class="zhwhat">${what}</div>${list.length === 1 && HOW[list[0].pattern] ? `<div class="zhsub">${esc(HOW[list[0].pattern])}</div>` : ""}${prize}<button class="zbtn" id="hurok">Wonderful</button></div>`;
    document.body.appendChild(box);
    const done = () => { if (box.isConnected) box.remove(); };
    box.querySelector("#hurok").onclick = done; setTimeout(done, 15000);
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) confetti(box.querySelector("canvas"));
    try { navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 400]); } catch {}
    if (sound && window.TBAudio) TBAudio.say("Congratulations! You won " + list.map((w) => w.name).join(", ") + "!");
  }
  // ---------- tell our store that the game is over for this phone, once (tiny): the end-of-game clock relies on it. Winners are reported by the game code itself, and only count when several phones agree.
  const overKey = "cbz-over:" + EID;
  let overPending = false;
  async function reportToStore(v) {
    if (!v.pid || DEMO) return;
    try {
      if (v.phase === "ended" && !store.get(overKey) && !overPending) {
        overPending = true; // spread over a little time so a big crowd does not ask at the same second
        setTimeout(async () => { try { await api("POST", `/api/z/${EID}/over`, { pid: v.pid, device: myDevice() }); store.set(overKey, "1"); } catch { /* tried again later */ } overPending = false; }, Math.floor(Math.random() * 45000));
      }
    } catch { /* never in the way of the game */ }
  }
  // ---------- after the game, a winner confirms the name the prize goes to (the organizer and co-host see any change, with the original) ----------
  const CF = { loaded: false, loading: false, name: "", phone: "", confirmed: false, editing: false, edited: false, prizes: [], note: "", last: 0, busy: false };
  const myDevice = () => store.get("cbz:device") || "";
  async function loadCf(v) {
    if (DEMO || v.phase !== "ended" || !PRIZES.length || !v.pid || CF.loading || (CF.loaded && CF.confirmed) || Date.now() - CF.last < 15000) return;
    CF.last = Date.now(); CF.loading = true;
    try {
      const r = await api("GET", `/api/z/${EID}/myprizes?pid=${encodeURIComponent(v.pid)}&device=${encodeURIComponent(myDevice())}`);
      CF.prizes = r.prizes || []; if (!CF.edited) { CF.name = r.name || ""; CF.phone = r.phone || ""; } CF.confirmed = !!r.confirmed; CF.loaded = CF.prizes.length > 0;
    } catch { /* tried again shortly */ }
    CF.loading = false;
  }
  function confirmCard(v) {
    if (DEMO || v.phase !== "ended" || !PRIZES.length) return "";
    if (!CF.loaded) return `<div class="zcard"><h2>Confirm where your prize goes</h2><p class="zsmall">Waiting for your result to be confirmed by the other phones. This takes a moment.</p></div>`;
    if (CF.confirmed && !CF.editing) return `<div class="zcard"><h2>Details confirmed</h2><p class="zgap"><b>${esc(CF.name)}</b> &middot; ${esc(CF.phone)}</p><p class="zsmall">Your organizer has these details. <button class="zsnd" id="cfedit">Change</button></p></div>`;
    return `<div class="zcard zform"><h2>Confirm your prize details</h2>
      <p class="zsmall zflush zgap">Your organizer will use this name to hand over your prize. Please check them and correct anything that is wrong. If you change them, your organizer and co-host will see both what you joined with and what you changed it to.</p>
      <label for="cfnm">Your name</label><input id="cfnm" autocomplete="name" maxlength="60" value="${esc(CF.name)}">
      <label for="cfph">Your mobile number (optional)</label><input id="cfph" inputmode="tel" autocomplete="tel" value="${esc(CF.phone)}">
      ${CF.note ? `<div class="zbanner ${CF.note.startsWith("Thank") ? "ok" : "bad"}" role="alert">${esc(CF.note)}</div>` : ""}
      <button class="zbtn" id="cfgo"${CF.busy ? " disabled" : ""}>Confirm</button></div>`;
  }
  function bindConfirm(v) {
    const nm = document.getElementById("cfnm"), ph = document.getElementById("cfph"), go = document.getElementById("cfgo"), ed = document.getElementById("cfedit");
    if (ed) ed.onclick = () => { CF.editing = true; CF.note = ""; paint(); };
    if (nm) nm.oninput = () => { CF.name = nm.value; CF.edited = true; };
    if (ph) ph.oninput = () => { CF.phone = ph.value; CF.edited = true; };
    if (go) go.onclick = async () => {
      CF.busy = true; CF.note = ""; paint();
      try { await api("POST", `/api/z/${EID}/confirm`, { pid: v.pid, device: myDevice(), name: CF.name, phone: CF.phone }); CF.confirmed = true; CF.editing = false; CF.edited = false; CF.note = ""; CF.last = 0; }
      catch (e) { CF.note = (e && e.message) || "Could not save. Please try again."; }
      CF.busy = false; paint();
    };
  }
  function prizesCard() {
    if (!PRIZES.length) return "";
    const rows = PRIZES.slice().sort((a, b) => a.round - b.round).map((w) => `<div class="zrow"><span>${esc(w.name)}${w.text ? `<br><small class="zsmall zflush">${esc(w.text)}</small>` : ""}${HOW[w.pattern] ? "<br>" + howLine(w.pattern) : ""}</span><em>${w.pattern === "lucky" ? "Lucky draw" : "Prize"}</em></div>`).join("");
    return `<div class="zcard zprizes"><h2>Your prizes</h2>${rows}<p class="zsmall">Saved on this phone. Show this to your organizer to collect.</p></div>`;
  }
  let shareLink = location.origin + "/";
  try { localStorage.removeItem("cbz-phone"); } catch {} // older versions saved the participant's own number on the phone: it is not kept any more
  function finalCard(v) {
    const n = PRIZES.length;
    const place = v.me && v.me.finishedTurn !== null ? `You reached the last square on turn ${v.me.finishedTurn + 1}.` : v.me ? `You finished on square ${v.me.square}.` : "";
    const medal = v.myRank === 1 ? "&#129351;" : v.myRank === 2 ? "&#129352;" : v.myRank === 3 ? "&#129353;" : n ? "&#127942;" : "&#127922;";
    return `<div class="zcard zfinal"><h2>Game complete</h2>
      <div class="zmedal" aria-hidden="true">${medal}</div>
      <div class="zfbig">${n ? "You won " + n + (n === 1 ? " prize!" : " prizes!") : v.myRank ? "You finished number " + v.myRank + (v.crowd ? " of " + v.crowd.players : "") + "." : "Well played!"}</div>
      <p class="zsmall zthanks">Thank you for joining our extended family of Corporate Snakes and Ladders.</p>
      <p class="zsmall zbigger">${place} ${n ? "Your prizes are listed below and stay on this phone. Show them to your organizer to collect." : "No prize this time. Every game is a good game, and the next one is another chance."}</p>
      <button class="zbtn" id="shr">Share with friends and colleagues</button>
      <a class="zbtn s alt zlinkbtn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent("I just played Corporate Snakes and Ladders with my team. Bring it to your company: " + shareLink)}">WhatsApp</a>
      <p class="zsmall"><a href="/partner.html?from=card">Earn 50% by sharing: Refer &amp; earn</a></p></div>`;
  }
  function bindShare() {
    const b = document.getElementById("shr"); if (!b) return;
    b.onclick = async () => {
      const data = { title: "Corporate Snakes and Ladders", text: "I just played Corporate Snakes and Ladders with my team. Bring it to your company:", url: shareLink };
      try { if (navigator.share) { await navigator.share(data); return; } } catch { return; }
      try { await navigator.clipboard.writeText(data.text + " " + data.url); b.textContent = "Link copied"; } catch { b.textContent = shareLink; }
    };
  }

  // ---------- break media plays inside the page (YouTube, video and audio files); anything else stays a link ----------
  const mediaHost = document.createElement("div");
  mediaHost.id = "cbmedia"; mediaHost.style.cssText = "position:absolute;z-index:30;display:none;background:#000;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.3)";
  document.body.appendChild(mediaHost);
  let mediaKey = "";
  const ytId = (u) => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/))([A-Za-z0-9_-]{11})/.exec(u || ""); return m ? m[1] : null; };
  const mediaKind = (b) => {
    if (!b || !b.mediaUrl) return null;
    if (ytId(b.mediaUrl)) return "yt";
    if (b.kind === "youtube") return null;
    if (/\.(mp4|webm|m4v|mov|ogv)([?#]|$)/i.test(b.mediaUrl)) return "video";
    if (/\.(mp3|m4a|aac|wav|ogg|oga)([?#]|$)/i.test(b.mediaUrl)) return "audio";
    return null;
  };
  function soundButton(onTap) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = "Tap for sound";
    b.style.cssText = "position:absolute;right:8px;bottom:8px;z-index:2;background:#FFC93C;color:#1b1b1b;border:0;border-radius:8px;padding:6px 12px;font:700 13px system-ui,sans-serif";
    b.onclick = () => { try { onTap(); } catch {} b.remove(); };
    mediaHost.appendChild(b);
  }
  function startMedia(b, kind) {
    const elapsed = Math.max(0, Math.min((b.seconds || 0) - (b.secondsLeft || 0), 3600));
    if (kind === "yt") {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), canSound = !ios && navigator.userActivation && navigator.userActivation.hasBeenActive;
      const f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + ytId(b.mediaUrl) + "?autoplay=1&mute=" + (canSound ? 0 : 1) + "&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&start=" + Math.round(elapsed) + "&origin=" + encodeURIComponent(location.origin);
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen"; f.title = b.title; f.setAttribute("allowfullscreen", ""); f.referrerPolicy = "strict-origin-when-cross-origin";
      f.style.cssText = "width:100%;height:100%;border:0"; mediaHost.appendChild(f);
      if (!canSound) soundButton(() => f.contentWindow.postMessage(JSON.stringify({ event: "command", func: "unMute", args: [] }), "https://www.youtube-nocookie.com"));
      return;
    }
    const el = document.createElement(kind === "video" ? "video" : "audio");
    el.src = b.mediaUrl; el.controls = true; el.autoplay = true; el.setAttribute("playsinline", ""); el.preload = "auto";
    el.style.cssText = kind === "video" ? "width:100%;height:100%;background:#000" : "position:absolute;left:8px;right:8px;top:50%;transform:translateY(-50%);width:calc(100% - 16px)";
    if (kind === "audio") { mediaHost.style.background = "#0B5D5B"; const t = document.createElement("div"); t.textContent = b.title; t.style.cssText = "position:absolute;left:0;right:0;top:18%;text-align:center;color:#fff;font:700 18px system-ui,sans-serif;padding:0 12px"; mediaHost.appendChild(t); } else mediaHost.style.background = "#000";
    el.addEventListener("loadedmetadata", () => { try { if (elapsed && el.duration > elapsed + 1) el.currentTime = elapsed; } catch {} });
    mediaHost.appendChild(el);
    const p = typeof el.play === "function" ? el.play() : null; if (p && p.catch) p.catch(() => { el.muted = true; const q = el.play(); if (q && q.catch) q.catch(() => {}); soundButton(() => { el.muted = false; }); });
  }
  function placeMedia() {
    if (!mediaKey) return;
    const slot = document.getElementById("mslot");
    if (!slot) { mediaHost.style.display = "none"; return; }
    const r = slot.getBoundingClientRect();
    mediaHost.style.display = "block"; mediaHost.style.left = r.left + scrollX + "px"; mediaHost.style.top = r.top + scrollY + "px"; mediaHost.style.width = r.width + "px"; mediaHost.style.height = r.height + "px";
  }
  function syncMedia(v) {
    const b = slotNow(v), kind = b ? mediaKind(b) : null, key = b && kind ? b.title + "|" + b.mediaUrl : "";
    if (key !== mediaKey) {
      mediaHost.textContent = ""; mediaHost.style.display = "none"; mediaHost.style.background = "#000"; mediaKey = key;
      if (key) startMedia(b, kind);
    }
    placeMedia();
  }
  addEventListener("resize", placeMedia);

  // ---------- invite your colleagues / family members (when the organizer allows it) ----------
  let inviteCat = "", inviteInfo = null, inviteAt = -Infinity;
  async function loadInvites(v) {
    if (!v.pid || !(v.cfg.invites && v.cfg.invites.on) || performance.now() - inviteAt < 45000) return;
    inviteAt = performance.now();
    try { inviteInfo = await api("GET", `/api/z/${EID}/invites?pid=${encodeURIComponent(v.pid)}`); } catch { /* shown next time */ }
  }
  const inviteLink = (v) => `${location.origin}/z.html?e=${encodeURIComponent(EID)}&from=${seatOf(v.pid)}${inviteCat ? "&c=" + encodeURIComponent(inviteCat) : ""}`;
  function inviteCard(v) {
    const iv = v.cfg.invites;
    if (!iv || !iv.on || !seatOf(v.pid)) return "";
    if (inviteInfo && inviteInfo.canInvite === false) return ""; // invited by a participant: plays, but has no invite link (two levels only)
    const cats = (ZG.INVITE_CATEGORIES || []).filter((c) => iv.cats.includes(c.id));
    if (!cats.length) return "";
    if (!inviteCat || !cats.some((c) => c.id === inviteCat)) inviteCat = cats[0].id;
    const used = inviteInfo ? inviteInfo.used : 0, unl = inviteInfo && inviteInfo.unlimited, left = Math.max(0, iv.per - used);
    const counter = unl ? "You can invite as many people as you like." : `You can invite up to <b>${iv.per}</b> people. You have invited <b>${used}</b>${left ? `, so <b>${left}</b> ${left === 1 ? "invitation is" : "invitations are"} left` : ". You have used all your invitations"}.`;
    const chips = cats.map((c) => `<button type="button" class="zchip${c.id === inviteCat ? " on" : ""}" data-icat="${esc(c.id)}">${esc(c.label)}</button>`).join("");
    const link = inviteLink(v), kind = (cats.find((c) => c.id === inviteCat) || cats[0]).label.toLowerCase();
    const text = "Join me for Corporate Snakes and Ladders! Open this link, enter your nickname and you get your own board: " + link;
    return `<div class="zcard zinvite"><h2>Invite your colleagues / family members</h2>
      <p class="zsmall zflush zgap">${counter}</p>
      ${!unl && !left ? "" : `<div class="zsmall zflush">Who are you inviting?</div><div class="zchips">${chips}</div>
      <div class="zlink" id="invlink">${esc(link)}</div>
      <button class="zbtn s" id="invshare">Share invitation (${esc(kind)})</button>
      <a class="zbtn s alt zlinkbtn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">WhatsApp</a>
      <button class="zbtn s alt" id="invcopy">Copy link</button>
      <p class="zsmall">Your guest joins with their own nickname and gets their own board. ${unl ? "" : `Your link stops working after ${iv.per} people have joined through it.`}</p>`}</div>`;
  }
  function bindInvite(v) {
    document.querySelectorAll("[data-icat]").forEach((b) => (b.onclick = () => { inviteCat = b.dataset.icat; paint(); }));
    const sh = document.getElementById("invshare"); if (sh) sh.onclick = async () => { const data = { title: "Corporate Snakes and Ladders", text: "Join me for Corporate Snakes and Ladders! Open this link, enter your nickname and you get your own board:", url: inviteLink(v) }; try { if (navigator.share) { await navigator.share(data); return; } } catch { return; } try { await navigator.clipboard.writeText(data.text + " " + data.url); sh.textContent = "Link copied"; } catch { sh.textContent = data.url; } };
    const cp = document.getElementById("invcopy"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(inviteLink(v)); cp.textContent = "Copied"; } catch { cp.textContent = "Press and hold the link above to copy"; } };
  }
  // ---------- My invites: for a guest who may invite (level 1) only. Their own small list: add, send on WhatsApp, resend, remove. A guest invited by a guest sees nothing. ----------
  const MI = { k6: {}, people: [], limit: 0, used: 0, loaded: false, at: -Infinity, busy: false, note: "", bad: false, ask: "", name: "", phone: "" };
  const miQ = (v) => `?me=${encodeURIComponent(v.pid)}&device=${encodeURIComponent(myDevice())}`; // the card id is public: the people calls also carry the phone's own device id
  async function loadMine(v, force) {
    if (DEMO || !ME.canInvite || !v.pid || MI.busy) return;
    if (!force && performance.now() - MI.at < 60000) return;
    MI.at = performance.now();
    try {
      const r = await api("GET", `/api/z/${EID}/people${miQ(v)}`);
      MI.people = Array.isArray(r.people) ? r.people : []; MI.limit = Number(r.limit) || 0; MI.used = Number(r.used) || 0; MI.loaded = true;
      if (force) paint();
    } catch (e) { if (e && e.status === 403) { ME.canInvite = false; paint(); } } // the organizer switched invitations off, or this guest may not invite
  }
  const waOk = (u) => (typeof u === "string" && /^https:\/\/wa\.me\//.test(u) ? u : "");
  function mineCard(v) {
    if (DEMO || !ME.canInvite) return "";
    const left = Math.max(0, MI.limit - MI.used);
    const counter = !MI.loaded ? "Getting your list…" : MI.limit ? `You can invite up to <b>${MI.limit}</b> people. You have invited <b>${MI.used}</b>${left ? `, so <b>${left}</b> ${left === 1 ? "place is" : "places are"} left` : ". You have used all your places"}.` : "";
    const started = v.turnsPlayed > 0 || v.phase === "ended"; // a guest can take a name off their list only before the game starts
    const rows = MI.people.map((p) => {
      const wa = waOk(p.waLink), gone = p.status === "removed";
      return `<div class="zrow zmi"><span>${esc(p.name || "Guest")}<br><small class="zsmall zflush">${esc(p.maskedPhone || "")} &middot; ${gone ? "Removed" : p.status === "joined" ? "Joined" : "Invited"}</small></span>
        <span class="zmia">${!gone && p.status !== "joined" && wa ? `<a class="zbtn s zlinkbtn" target="_blank" rel="noopener" href="${esc(wa)}">Send on WhatsApp</a>` : ""}
        ${!gone && p.status !== "joined" ? `<button class="zbtn s alt" type="button" data-mire="${esc(p.id)}">Send a new link</button>` : ""}
        ${!gone && !started ? (MI.ask === p.id ? `<button class="zbtn s" type="button" data-miyes="${esc(p.id)}">Yes, remove</button><button class="zbtn s alt" type="button" data-mino="1">No</button>` : `<button class="zbtn s alt" type="button" data-mirm="${esc(p.id)}">Remove</button>`) : ""}</span></div>`;
    }).join("");
    const k6 = K6.info && CBC() ? CBC().html(K6.info, K6.state) : consentLoading(K6.failedAt > -Infinity && !K6.loading && !K6.info, "k6retry");
    return `<div class="zcard zinvite" id="mine"><h2>My invites</h2><p class="zsmall zflush zgap">${counter}</p>${rows}
      ${MI.loaded && !left && MI.limit ? "" : `<div class="zform"><label for="mi-name">Name</label><input id="mi-name" autocomplete="off" maxlength="60" value="${esc(MI.name)}"><label for="mi-phone">Mobile number</label><input id="mi-phone" inputmode="tel" autocomplete="off" value="${esc(MI.phone)}" placeholder="98765 43210"><div id="k6box">${k6}</div><button class="zbtn s" id="mi-add" type="button" disabled aria-disabled="true">Add to my invites</button></div>`}
      ${MI.note ? `<div class="zbanner ${MI.bad ? "bad" : "ok"}" role="status">${esc(MI.note)}</div>` : ""}</div>`;
  }
  function bindMine(v) {
    if (!document.getElementById("mine")) return;
    const nm = document.getElementById("mi-name"), ph = document.getElementById("mi-phone"), add = document.getElementById("mi-add"), box = document.getElementById("k6box");
    if (nm) nm.oninput = () => { MI.name = nm.value; };
    if (ph) ph.oninput = () => { MI.phone = ph.value; };
    if (add) {
      if (K6.info && CBC() && box) CBC().bind(box, K6.info, K6.state, add); // the Add button stays disabled until the box is ticked
      if (MI.busy) add.disabled = true;
    }
    const retry = document.getElementById("k6retry"); if (retry) retry.onclick = () => { K6.failedAt = -Infinity; loadK6(); };
    const act = async (fn, okNote) => {
      MI.busy = true; MI.note = ""; MI.bad = false; paint();
      try { await fn(); MI.note = okNote || ""; } catch (e) { MI.bad = true; MI.note = (e && e.status !== 0 && e.message && !/^http \d+$|^offline$/.test(e.message) ? e.message : "Could not do that. Please try again."); }
      MI.busy = false; await loadMine(v, true); paint();
    };
    if (add) add.onclick = () => {
      const name = (nm.value || "").trim(), phone = (ph.value || "").trim(), consent = K6.info && CBC() ? CBC().payload(K6.info, K6.state) : null;
      if (!consent) return;
      if (name.length < 2) { MI.bad = true; MI.note = "Please type their name."; return paint(); }
      if (phone.replace(/\D/g, "").length < 10) { MI.bad = true; MI.note = "Please type their mobile number."; return paint(); }
      act(async () => {
        let r;
        try { r = await api("POST", `/api/z/${EID}/people${miQ(v)}`, { people: [{ name, phone }], me: v.pid, consent }); }
        catch (e) {
          if (e && (e.code === "consent-required" || e.code === "terms-changed")) { if (e.body && e.body.consent && Array.isArray(e.body.consent.boxes)) K6.info = e.body.consent; K6.state = {}; throw new Error("Please read the box again, tick it, and press Add once more."); }
          throw e;
        }
        if (r.invalid && r.invalid.length) throw new Error("That number does not look right. Please check it.");
        if (r.duplicates) throw new Error("That number is already invited.");
        MI.name = ""; MI.phone = ""; K6.state = {};
      }, "Added. Press Send on WhatsApp next to their name.");
    };
    document.querySelectorAll("[data-mire]").forEach((b) => (b.onclick = () => act(async () => { await api("POST", `/api/z/${EID}/people/${encodeURIComponent(b.dataset.mire)}/resend${miQ(v)}`, { me: v.pid }); }, "A new link is ready. Press Send on WhatsApp.")));
    document.querySelectorAll("[data-mirm]").forEach((b) => (b.onclick = () => { MI.ask = b.dataset.mirm; paint(); }));
    document.querySelectorAll("[data-mino]").forEach((b) => (b.onclick = () => { MI.ask = ""; paint(); }));
    document.querySelectorAll("[data-miyes]").forEach((b) => (b.onclick = () => { const id = b.dataset.miyes; MI.ask = ""; act(async () => { await api("POST", `/api/z/${EID}/people/${encodeURIComponent(id)}/remove${miQ(v)}`, { me: v.pid }); }, "Removed. Your place is free again."); }));
  }
  function mediaAct(b) {
    const inPage = !!mediaKind(b);
    return b.mediaUrl ? (inPage ? `<div id="mslot" class="zmslot"></div><a class="zsmall" target="_blank" rel="noopener noreferrer" href="${esc(b.mediaUrl)}">Trouble playing? Open it in a new tab</a>` : `<a class="zbtn s zlinkbtn zmt" target="_blank" rel="noopener noreferrer" href="${esc(b.mediaUrl)}">${b.kind === "youtube" ? "Watch the video" : "Open"}</a>`) : "";
  }
  // ---------- the OPENING plays while everyone waits for the first turn; the CLOSING plays on the final screen ----------
  let closingIdx = 0;
  function openingNow(v) {
    const list = (v.cfg && v.cfg.opening) || [];
    if (!list.length || v.phase !== "play" || v.locked || v.stopped || v.paused || v.brk || v.turnsPlayed > 0 || v.turn.state !== "wait" || v.turn.secondsLeft === null || v.turn.secondsLeft > GRACE_SECS) return null;
    const elapsed = GRACE_SECS - v.turn.secondsLeft; let from = 0; // the openings follow one another inside the 2 minutes before the first turn
    for (const o of list) { const len = o.seconds || 60; if (elapsed < from + len) return Object.assign({}, o, { seconds: len, secondsLeft: Math.max(1, Math.round(from + len - elapsed)) }); from += len; }
    return null;
  }
  function closingNow(v) {
    const list = (v.cfg && v.cfg.closing) || [];
    if (!list.length || v.phase !== "ended") return null;
    const i = Math.min(closingIdx, list.length - 1);
    return Object.assign({}, list[i], { seconds: 0, secondsLeft: 0, n: i + 1, of: list.length });
  }
  const slotNow = (v) => v.brk || openingNow(v) || closingNow(v);
  const slotWhat = (b) => (b.kind === "speech" ? "Please listen to the host." : b.kind === "slides" ? "Please look at the screen." : "");
  function openingCard(v) {
    const b = openingNow(v); if (!b) return "";
    return `<div class="zcard zbreak" role="status"><h2>A message from your organizer</h2><div class="zbigline">${esc(b.title)}</div><div class="zsmall zflush">${slotWhat(b)} The game starts in a moment.</div>${mediaAct(b)}</div>`;
  }
  function closingCard(v) {
    const b = closingNow(v); if (!b) return "";
    return `<div class="zcard zbreak" role="status"><h2>Thank you from your organizer</h2><div class="zbigline">${esc(b.title)}</div><div class="zsmall zflush">${slotWhat(b)}</div>${mediaAct(b)}${b.n < b.of ? `<button class="zbtn s alt zmt" id="cnext" type="button">Next message (${b.n} of ${b.of})</button>` : ""}</div>`;
  }
  function breakCard(b) {
    const act = mediaAct(b);
    const what = b.kind === "lucky" ? `${b.winners || 3} ${b.winners === 1 ? "person is" : "people are"} picked at random when this break ends. Everyone has an equal chance.` : b.kind === "speech" ? "Please listen to the host." : b.kind === "slides" ? "Please look at the screen." : "";
    return `<div class="zcard zbreak" role="status"><h2>A short break</h2><div class="zbigline">${esc(b.title)}</div><div class="zsmall zflush">${what} The game continues in ${b.secondsLeft}s.</div>${act}</div>`;
  }

  let annSeen = null, annSpoken = null;
  function annBanner(v) {
    const a = v.announcement;
    if (!a || a.id === annSeen) return "";
    return `<div class="zbanner info zann" role="alert"><b>Message from the organizer</b><br>${esc(a.text)} <button class="zsnd" id="annok">OK</button></div>`;
  }
  function playView(v) {
    const banners = [];
    if (v.error) banners.push(`<div class="zbanner warn" role="alert">${esc(v.error)}</div>`);
    if (v.locked) banners.push(ME.role === "organizer" || ME.role === "host" ? `<div class="zbanner warn" role="status"><b>Payment pending for this game.</b> The game starts 2 minutes after the payment is confirmed. Open your console to pay. Your place is safe. Keep this page open.</div>` : `<div class="zbanner warn" role="status"><b>Waiting for the Organizer or Host to start the game.</b> Your place is safe. Keep this page open: it begins as soon as they are done.</div>`);
    else if (v.stopped) banners.push(`<div class="zbanner info">The organizer has ended this game.</div>`);
    else if (v.paused) banners.push(`<div class="zbanner info">Paused by the organizer. It will carry on shortly.</div>`);
    else if (v.mode === "hold" && v.nowRound !== null) banners.push(`<div class="zbanner warn">Checking with the organizer… the game will continue in a moment.</div>`);
    else if (v.mode === "blind") banners.push(`<div class="zbanner warn">Cannot reach the organizer's controls right now. Play continues; a pause may appear late.</div>`);
    if (v.phase === "ended" && !v.stopped) banners.push(`<div class="zbanner ok">${v.endedByPrizes ? "All the end prizes have been awarded." : "The game is over."} Thank you for taking part.</div>`);
    const chk = v.pendingChecks > 0 ? `<p class="zsmall">Double-checking ${plural(v.pendingChecks, "earlier result", "earlier results")} in the background.</p>` : "";
    const curWins = v.won || [];
    const ribbon = curWins.length ? `<div class="zwin" role="status">&#127881; Congratulations! You won ${curWins.map((w) => esc(lineName(v.cfg, w.pattern, w.ordinal))).join(", ")}${curWins.some((w) => w.text) ? " &middot; " + curWins.filter((w) => w.text).map((w) => esc(w.text)).join(", ") : ""}</div>` : "";
    const waiting = isWaiting(v);
    const sndBtn = `<button class="zsnd zsndin" id="snd" aria-pressed="${sound}">${sound ? "&#128266; Sound on" : "&#128263; Sound off"}</button>`;
    return `${brandStrip(sndBtn)}
      ${annBanner(v)}${banners.join("")}
      ${v.phase === "ended" ? finalCard(v) + closingCard(v) + confirmCard(v) + prizesCard() : ""}
      ${waitingRoom(v)}
      ${openingCard(v)}
      ${v.brk ? breakCard(v.brk) : ""}
      ${ribbon ? `<div class="zcard zwon">${ribbon}</div>` : ""}
      ${waiting || v.phase === "ended" ? "" : diceCard(v)}
      ${boardCard(v)}
      ${waiting ? "" : crowdCard(v)}
      ${teamCard(v)}
      ${standingsCard(v)}
      ${waiting ? "" : prizesStatusCard(v)}
      ${v.phase === "ended" ? "" : prizesCard()}
      ${mineCard(v)}${inviteCard(v)}
      ${luckyCard(v)}
      ${chk}<a class="zref" href="/partner.html?from=card">Refer &amp; earn</a>`;
  }

  const focusGuard = (ids) => { const af = document.activeElement; return !!af && (ids.includes(af.id) || (af.classList && af.classList.contains("cbc-tick"))); };
  function speakStep(v) {
    const s = v.me && v.me.lastStep, key = s ? v.me.history.length + ":" + s.from + ":" + s.roll : "";
    if (!firstPaint && key && key !== lastStepKey && sound && window.TBAudio) TBAudio.roll(s.roll, s.kind, s.to);
    lastStepKey = key;
  }
  function paint() {
    const v = rt.view();
    if (window.ctzView) window.ctzView(v); // the flight recorder (blackbox.js) learns which stage the game is in
    if (!v.won) v.won = []; // an older saved copy of the game code during an update: never break the screen
    if (INFO.dns) { if (timer) { clearInterval(timer); timer = null; } clearInterval(J.timer); mediaHost.style.display = "none"; $app.innerHTML = dnsView(); window.__cbzOff = v.phase === "boot"; paintBrand(); return; } // a game that did not start: one calm screen, nobody can join or pay
    if (v.phase === "missing" || v.phase === "boot") { $app.innerHTML = (INFO.brand || v.phase === "boot" ? brandStrip() : "") + `<p class="zmsg">${esc(v.phase === "boot" && !navigator.onLine ? "No connection right now. Your place is safe on this phone. This page opens the game by itself when you are back online." : v.error || "Loading…")}</p>`; paintBrand(); return; }
    if (INFO.cancelled) { if (timer) { clearInterval(timer); timer = null; } clearInterval(J.timer); mediaHost.style.display = "none"; $app.innerHTML = cancelledView(); paintBrand(); return; } // a cancelled game: one calm screen, nothing else
    if (v.phase === "join") { if (focusGuard(["ph", "nm", "emp"])) return; $app.innerHTML = joinView(J.mode ? null : v.error); paintBrand(); bindJoin(); return; }
    if (ME.removed) { if (timer) { clearInterval(timer); timer = null; } mediaHost.style.display = "none"; $app.innerHTML = removedView(); paintBrand(); return; } // taken off the list: the phone stops
    const fresh = syncPrizes(v); reportToStore(v); loadCf(v); pollMe(v); loadK6();
    if (focusGuard(["cfnm", "cfph", "mi-name", "mi-phone"])) return; // never wipe a form someone is typing in
    noteRoll(v);
    $app.innerHTML = playView(v);
    paintBrand(); syncDie(); syncTimer(); slidePawn(v); bindFolds(); syncMedia(v); bindShare(); bindConfirm(v); loadInvites(v); bindInvite(v); loadMine(v); bindMine(v);
    if (fresh.length) showHurray(fresh);
    const s = document.getElementById("snd");
    if (s) s.onclick = async () => { sound = !sound; store.set("cbz-sound", sound ? "on" : "off"); if (window.TBAudio) { TBAudio.enabled = sound; if (sound) await TBAudio.unlock(); } paint(); };
    const tb = document.getElementById("throw");
    if (tb) tb.onclick = async () => {
      if (THROW.busy) return;
      THROW.busy = true; THROW.note = ""; tb.disabled = true;
      let ok = false; try { ok = await rt.throwNow(); } catch { ok = false; }
      THROW.busy = false; const lr = rt.lastThrowRefusal;
      if (!ok && lr && lr.code === "late-move") { THROW.lateTurn = lr.turn; THROW.note = lr.message || "Ohooo! \u{1F60A} Sorry, you moved after your turn ended. This move cannot be made."; } // too late on the server clock: the button stays off for this turn, nothing was recorded
      else THROW.note = ok ? "" : "Your throw could not be sent. Please try again while the window is open.";
      THROW.turn = ok ? -1 : (lr ? lr.turn : -1);
      paint();
    };
    speakStep(v);
    firstPaint = false;
    const cn = document.getElementById("cnext"); if (cn) cn.onclick = () => { closingIdx += 1; paint(); };
    const ok = document.getElementById("annok"); if (ok) ok.onclick = () => { annSeen = v.announcement.id; paint(); };
    if (v.announcement && v.announcement.id !== annSpoken) { annSpoken = v.announcement.id; if (sound && window.TBAudio) TBAudio.say(v.announcement.text); try { navigator.vibrate && navigator.vibrate(120); } catch {} }
    document.querySelectorAll("[data-scr]").forEach((b) => (b.onclick = () => { scratched.add(Number(b.dataset.scr)); paint(); }));
    const st = document.getElementById("soundtest"); if (st) st.onclick = async () => { if (window.TBAudio) { TBAudio.enabled = true; await TBAudio.unlock(); TBAudio.test(); } };
  }
  function bindJoin() {
    const again = document.getElementById("again"); if (again) again.onclick = () => { clearTimeout(J.retry); J.busyTries = 0; J.mode = ""; J.wid = ""; clearWait(); paint(); };
    const go = document.getElementById("go"); if (!go) return;
    const nm = document.getElementById("nm"), ph = document.getElementById("ph"), em = document.getElementById("emp");
    if (nm) nm.oninput = () => { J.name = nm.value; };
    if (em) em.oninput = () => { J.emp = em.value; };
    if (ph) ph.oninput = () => { J.phone = ph.value; };
    bindK4(); // the button stays disabled until both boxes are ticked
    if (!K4.info && !K4.loading && !K4.failed) loadK4();
    go.onclick = async () => {
      const consent = K4.info && CBC() ? CBC().payload(K4.info, K4.state) : null;
      if (!consent) return;
      J.consent = consent; J.msg = "";
      go.disabled = true;
      if (window.TBAudio) TBAudio.unlock();
      J.phone = ph ? ph.value : J.phone; J.name = nm ? nm.value.trim() : J.name; J.emp = em ? em.value.trim() : J.emp;
      await doJoin(); // shows the game at once on success: the first tick may take a few seconds on a slow network
    };
  }
  async function loop() { try { await rt.tick(); } catch { /* the loop must never die */ } paint(); }
  function start() { if (timer) return; loop(); timer = setInterval(loop, 1000); }

  if (!EID) { $app.innerHTML = `<p class="zmsg">This link is incomplete. Please ask your organizer for the game link.</p>`; return; }
  rt.boot().then(() => { if (rt.phase === "play") clearWait(); else restoreWait(); paint(); if (rt.phase === "play") start(); });
  window.__rt = rt;
})();
