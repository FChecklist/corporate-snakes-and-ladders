/* Corporate Snakes and Ladders big screen: shows the game to a room on a projector or TV. No sign-in and no personal data: it reads only the public values
   (the same ones every phone uses) and the public seat list. It never joins the game, never throws and never reports anything: its connection to our store is
   read-only (every request that is not a plain GET is refused here, before it leaves the page).
   It runs the same game code as a phone (ZG.PhoneRuntime) as a silent onlooker: the onlooker's own pawn is never shown, only counts, the top-10 list and the winners. */
(function () {
  const ZG = window.ZG;
  const $app = document.getElementById("app");
  const q = new URLSearchParams(location.search);
  const EID = (q.get("e") || "").trim();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NAMES = { lucky: "Lucky draw" };
  (ZG.PRIZE_HOUSES || []).forEach((h) => { if (!NAMES[h.id]) NAMES[h.id] = h.label; }); // every prize name comes from the shared table
  const ORD = (k) => ["", "1st", "2nd", "3rd"][k] || k + "th";
  const nickOf = (seat) => "Player " + seat; // nicknames are not available yet: the one place to change when they are
  const seatOf = (pid) => { const m = /^(\d+)x/.exec(pid || ""); return m ? Number(m[1]) : 0; };
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many);
  const f2 = (n) => Math.round(n * 100) / 100;
  const hms = (s) => { s = Math.max(0, Math.round(s)); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, "0")).join(":"); };
  const mmss = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(x).padStart(2, "0"); };
  const GRACE_SECS = ZG.GRACE_ROUNDS * 3;
  const S = { info: null, ctl: null, infoAt: -Infinity, bootAt: -Infinity, lastOk: Date.now(), noAnswer: false };
  /** Connection lost: no answer at all from our site for 15 seconds (a refusal is an answer). The numbers on the screen may then be late, and the screen says so. */
  const answered = () => { S.lastOk = Date.now(); S.noAnswer = false; };
  const unanswered = () => { S.noAnswer = true; };
  const lostBar = () => (S.noAnswer && Date.now() - S.lastOk > (window.__lostMs ?? 15000) ? `<div class="lostbar" role="alert">Connection lost. What is on this screen may be late. Reconnecting...</div>` : "");

  // a read-only line to our store, and a silent onlooker's identity (a seat that never exists; nothing is ever sent with it)
  const api = async (method, path) => {
    if (method !== "GET") throw new Error("read only");
    let r;
    try { r = await fetch(path, { cache: "no-store" }); answered(); } catch { unanswered(); throw new Error("offline"); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || "http " + r.status), { status: r.status, code: j.code, body: j });
    if (/\/info$/.test(path)) S.info = j;
    return j;
  };
  const getPublic = async (url) => { let r; try { r = await fetch(url, { cache: "no-store" }); answered(); } catch { unanswered(); throw new Error("offline"); } if (!r.ok) throw Object.assign(new Error("http " + r.status), { status: r.status }); return r.json(); };
  const mem = new Map([["cbz:" + EID + ":pid", "1x00000000"]]);
  const store = { get: (k) => (mem.has(k) ? mem.get(k) : null), set: (k, v) => { mem.set(k, String(v)); } };
  const rt = new ZG.PhoneRuntime(EID, { api, getPublic, beacon: {}, mono: () => performance.now(), store });

  /** Cancelled, did-not-start: read from the game's public settings and the control file, every 20 seconds. */
  async function refresh() {
    const m = performance.now(); if (m - S.infoAt < 20000) return; S.infoAt = m;
    try { await api("GET", `/api/z/${EID}/info`); } catch { /* the runtime reports a missing game itself */ }
    try { const r = await fetch(`/api/z/${EID}/control`, { cache: "no-store" }); answered(); S.ctl = r.ok ? await r.json() : null; } catch { unanswered(); /* kept as it was */ }
  }
  const cancelled = () => !!((S.info && S.info.cancelled) || (S.ctl && S.ctl.cancelled));
  const dns = () => !!((S.info && S.info.didNotStart === true) || (S.ctl && S.ctl.didNotStart));

  // ---------- the shared board (table mode only: in a race every player has a different board, so no single board is shown) ----------
  const ctr = (s, side) => { const p = ZG.squareXY(s, side); return { x: p.col + 0.5, y: side - 1 - p.row + 0.5 }; };
  function ladderSvg(a, b, side) {
    const p = ctr(a, side), r = ctr(b, side), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 0.13, ny = (dx / len) * 0.13;
    let out = `<line class="rail" x1="${f2(p.x + nx)}" y1="${f2(p.y + ny)}" x2="${f2(r.x + nx)}" y2="${f2(r.y + ny)}"/><line class="rail" x1="${f2(p.x - nx)}" y1="${f2(p.y - ny)}" x2="${f2(r.x - nx)}" y2="${f2(r.y - ny)}"/>`;
    const n = Math.max(2, Math.floor(len / 0.6));
    for (let i = 1; i < n; i++) { const t = i / n, cx = p.x + dx * t, cy = p.y + dy * t; out += `<line class="rung" x1="${f2(cx + nx)}" y1="${f2(cy + ny)}" x2="${f2(cx - nx)}" y2="${f2(cy - ny)}"/>`; }
    return out;
  }
  function snakeSvg(head, tail, side, k5) {
    const p = ctr(head, side), r = ctr(tail, side), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1, k = Math.min(1.1, len * 0.28), nx = (-dy / len) * k, ny = (dx / len) * k;
    const c1 = { x: p.x + dx / 3 + nx, y: p.y + dy / 3 + ny }, c2 = { x: p.x + (2 * dx) / 3 - nx, y: p.y + (2 * dy) / 3 - ny };
    const d = `M${f2(p.x)} ${f2(p.y)} C${f2(c1.x)} ${f2(c1.y)} ${f2(c2.x)} ${f2(c2.y)} ${f2(r.x)} ${f2(r.y)}`;
    return `<g class="sn s${k5 % 5}"><path class="snk" d="${d}"/><circle class="snkhead" cx="${f2(p.x)}" cy="${f2(p.y)}" r="0.24"/><circle class="snkdot" cx="${f2(r.x)}" cy="${f2(r.y)}" r="0.1"/></g>`;
  }
  function tableBoard(v) {
    const b = v.board, side = b.side, size = b.size, pawns = {};
    for (const p of v.table.squares) (pawns[p.square] = pawns[p.square] || []).push(p.seat);
    const turnSeat = v.table.whoseTurn;
    let cells = "", lines = "";
    for (let s = 1; s <= size; s++) {
      const { col, row } = ZG.squareXY(s, side), lad = b.ladders[s], snk = b.snakes[s], here = pawns[s] || [];
      const lab = ["Square " + s]; if (lad !== undefined) lab.push("ladder to " + lad); if (snk !== undefined) lab.push("snake to " + snk); if (s === size) lab.push("last square");
      for (const seat of here) lab.push(nickOf(seat) + " is here");
      const cls = ["sq", "gc" + (col + 1), "gr" + (side - row)];
      if ((col + row) % 2) cls.push("a"); if (lad !== undefined) cls.push("lb"); if (snk !== undefined) cls.push("sh"); if (s === size) cls.push("end");
      cells += `<div class="${cls.join(" ")}" role="listitem" aria-label="${esc(lab.join(", "))}"><b>${s}</b>${here.slice(0, 2).map((seat) => `<i class="pawn${seat === turnSeat ? " turn" : ""}">${seat}</i>`).join("")}${here.length > 2 ? `<i class="pawn more">+${here.length - 2}</i>` : ""}</div>`;
    }
    for (const a of Object.keys(b.ladders).map(Number).sort((x, y) => x - y)) lines += ladderSvg(a, b.ladders[a], side);
    Object.keys(b.snakes).map(Number).sort((x, y) => x - y).forEach((h, i) => { lines += snakeSvg(h, b.snakes[h], side, i); });
    return `<div class="sqwrap"><div class="sqgrid g${side}" role="list" aria-label="The shared board, ${size} squares. Numbered dots are players.">${cells}</div><svg class="sqsvg" viewBox="0 0 ${side} ${side}" aria-hidden="true" focusable="false">${lines}</svg></div>`;
  }

  // ---------- the crowd chart: ten bars, one per band of the board (race and team race) ----------
  function crowdChart(v) {
    const c = v.crowd, size = v.board ? v.board.size : 100, per = size / 10, max = Math.max(1, ...c.bands);
    const bars = c.bands.map((n, i) => {
      const from = Math.floor(i * per) + 1, to = Math.round((i + 1) * per), h = n ? Math.max(1, Math.round((n / max) * 20)) : 0;
      return `<div class="cbar" role="img" aria-label="Squares ${from} to ${to}: ${plural(n, "player", "players")}"><em>${n}</em><span class="bh bh${h}"></span><small>${from}</small></div>`;
    }).join("");
    return `<div class="crowd"><div class="lbl">Where the players are</div><div class="cbars" role="group" aria-label="Where the players are, in ten bands of the board. The number under a bar is the first square of its band.">${bars}</div><div class="lbl small">Squares 1 to ${size}, left to right</div></div>`;
  }

  // ---------- the turn: a big countdown ring and one plain sentence ----------
  function ringHtml(secs, total, label) {
    const R = 20, C = 2 * Math.PI * R, frac = total > 0 && secs !== null ? Math.max(0, Math.min(1, secs / total)) : 1;
    return `<div class="ring" role="img" aria-label="${esc(label)}"><svg viewBox="0 0 48 48" aria-hidden="true" focusable="false"><circle class="bg" cx="24" cy="24" r="${R}"/><circle class="fg" cx="24" cy="24" r="${R}" stroke-dasharray="${f2(C * frac)} ${f2(C)}" transform="rotate(-90 24 24)"/></svg><span>${secs === null ? "&ndash;" : secs}</span></div>`;
  }
  function turnBox(v) {
    const t = v.turn, presence = v.cfg.play === "presence";
    let title, line, ring = "";
    if (v.ended || v.phase === "ended" || t.state === "over") { title = "Game over"; line = "Thank you for playing."; }
    else if (t.state === "wait") { title = "Turn " + (t.index + 1); line = t.secondsLeft === null ? "Getting ready…" : `Opens in ${t.secondsLeft} seconds.`; ring = ringHtml(t.secondsLeft, 0, line); }
    else if (t.state === "open") { title = "Turn " + (t.index + 1); line = presence ? "Throw now! Open your phone and press Throw." : "The dice are thrown when the window closes."; ring = ringHtml(t.secondsLeft, t.windowSec, `${t.secondsLeft} seconds left in this turn`); }
    else { title = "Turn " + (t.index + 1); line = "The dice are thrown."; ring = ringHtml(t.secondsLeft, 0, `Next turn in ${t.secondsLeft} seconds`); }
    const who = v.kind === "table" && v.table && v.table.whoseTurn !== null && !v.ended ? `<div class="whose">${esc(nickOf(v.table.whoseTurn))} throws</div>` : "";
    return `<div class="turnbox"><div class="lbl">${esc(title)}</div>${ring}<div class="state" role="status">${esc(line)}</div>${who}</div>`;
  }

  // ---------- the top-10 list and the winners ----------
  const lineName = (cfg, key, ordinal) => (key === "lucky" ? "Lucky draw" : (ZG.linesFor(cfg.rewards, key).length > 1 ? ORD(ordinal) + " " : "") + (NAMES[key] || key));
  function topTen(v) {
    if (!v.top || !v.top.length) return `<div class="panel"><div class="lbl">Top ten</div><p class="quiet">The list appears after the first turn.</p></div>`;
    const rows = v.top.map((r) => `<li><span class="r">${r.rank}</span><span class="n">${esc(nickOf(r.seat))}</span><span class="q">${r.finishedTurn !== null ? "home" : "square " + r.square}</span></li>`).join("");
    return `<div class="panel"><div class="lbl">Top ten</div><ol class="topten">${rows}</ol></div>`;
  }
  function winners(v) {
    const out = [];
    for (const r of v.results || []) {
      if (!r.winners || !r.winners.length) continue;
      const names = r.winners.map((p) => nickOf(seatOf(p))).join(", ");
      const nm = r.pattern === "lucky" ? ((v.lucky[r.ordinal - 1] && v.lucky[r.ordinal - 1].title) || "Lucky draw") : lineName(v.cfg, r.pattern, r.ordinal);
      out.push(`<span><b>${esc(nm)}</b> &middot; ${esc(names)}${r.tied > 1 ? " &middot; decided by chance" : ""}</span>`);
    }
    return out.length ? `<div class="wins" aria-label="Winners so far">${out.join("")}</div>` : "";
  }

  function frame(inner, v, extra) {
    const bd = S.info && S.info.brand && typeof S.info.brand === "object" ? S.info.brand : null, bLogo = bd && typeof bd.logo === "string" && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(bd.logo) ? bd.logo : ""; // the organizer's own logo and name, or ours in writing
    const ann = v && v.announcement ? `<div class="annbar" role="alert">${esc(v.announcement.text)}</div>` : "";
    return `<header>${lostBar()}${ann}<div class="top"><div class="brand">${bLogo ? `<img class="blogo" alt="" src="${esc(bLogo)}">` : ""}${esc(bd && bd.name ? bd.name : "Corporate Snakes and Ladders")}</div><div class="meta">${extra || ""}</div></div></header><div class="stage">${inner}</div><div class="foot">Join: ${esc(location.host)}/z?e=${esc(EID)}</div>`;
  }
  const plain = (title, text) => `<header><div class="top"><div class="brand"><a href="/" aria-label="Corporate Snakes and Ladders home" style="display:inline-flex;line-height:0"><img src="/logo-mark.svg" alt="Corporate Snakes and Ladders logo" width="26" height="26" style="border-radius:6px"></a>Corporate Snakes and Ladders</div></div></header><div class="stage"><div class="big"><h1>${esc(title)}</h1><p>${esc(text)}</p></div></div><div class="foot">${esc(location.host)}/z?e=${esc(EID)}</div>`;

  function draw() {
    const v = rt.view();
    if (v.phase === "missing" || v.phase === "boot") return ($app.innerHTML = `${lostBar()}<p class="msg">${esc(v.error || "Loading…")}</p>`);
    if (dns()) return ($app.innerHTML = plain("This game did not start", "This game did not start. Your details have been erased."));
    if (cancelled()) return ($app.innerHTML = plain("This game was cancelled", "This game was cancelled by the organizer."));
    if (v.locked) return ($app.innerHTML = plain("Waiting for the Organizer or Host", "Waiting for the Organizer or Host to start the game.")); // held for non-payment: nothing is shown
    if (v.brk) return ($app.innerHTML = frame(`<div class="big"><h1>A short break</h1><p>${esc(v.brk.title)}</p><div class="cd">${v.brk.secondsLeft}</div><p>The game continues in ${v.brk.secondsLeft} seconds.</p></div>`, v, ""));
    const waiting = v.turnsPlayed === 0 && v.phase === "play" && v.turn.state === "wait" && v.turn.secondsLeft !== null && v.turn.secondsLeft > 0;
    if (waiting) {
      const sec = v.turn.secondsLeft, secs = v.callSeconds || 20;
      const top = sec > GRACE_SECS ? `<p>The game starts in</p><div class="cd">${hms(sec - GRACE_SECS)}</div><p>Open the link on your phone and join.</p>` : `<h1>Your game is setting up</h1><p>Sign-up has closed. The first turn comes in a moment.</p><div class="cd">${mmss(sec)}</div>`;
      const rules = [v.kind === "table" ? "1. Everyone plays on one shared board and takes turns." : "1. You have your own board. Nobody else has the same one.", `2. Every turn lasts about ${secs} seconds. Your throw is the dice for that turn.`, "3. Snakes take you down. Ladders take you up.", "4. To finish you need the exact number to land on the last square.", "5. The software checks everything. Nobody can change a result."];
      return ($app.innerHTML = frame(`<div class="big">${top}<ul class="rules">${rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul></div>`, v, ""));
    }
    const paused = v.paused ? `<div class="big note"><h1>Paused</h1><p>The organizer has paused the game. It will resume shortly.</p></div>` : "";
    const c = v.crowd, home = c ? c.finished : 0;
    const meta = `${c ? plural(c.players, "player", "players") + " &middot; " + home + " home &middot; " : ""}Turn ${Math.min(v.turnsPlayed + (v.ended ? 0 : 1), v.turnCap)}${v.kind === "table" ? ` of at most ${v.turnCap}` : ` of at most ${v.turnCap} &middot; ends sooner when ${v.kind === "team" ? "the first whole team is" : v.endPrizes + (v.endPrizes === 1 ? " player is" : " players are")} home`}`;
    const viz = v.kind === "table" && v.board && v.table ? tableBoard(v) : c ? crowdChart(v) : `<div class="crowd"><p class="quiet">The picture appears after the first turn.</p></div>`;
    const teams = v.kind === "team" && v.team && v.team.rows && v.team.rows.length ? `<div class="panel"><div class="lbl">Teams</div><ol class="topten">${v.team.rows.slice().sort((a, b) => a.rank - b.rank).slice(0, 5).map((r) => `<li><span class="r">${r.rank}</span><span class="n">Team ${r.team + 1}</span><span class="q">${r.finishedTurn !== null ? "home" : "average " + (Math.round(r.avgSquare * 10) / 10).toFixed(1)}</span></li>`).join("")}</ol></div>` : "";
    $app.innerHTML = frame(`${paused}<div class="main">${turnBox(v)}<div class="viz">${viz}</div></div><div class="lists">${topTen(v)}${teams}${winners(v)}</div>`, v, meta);
  }

  if (!EID) { $app.innerHTML = `<p class="msg">No game was chosen.</p>`; return; }
  async function loop() {
    try {
      if (rt.phase === "boot" && performance.now() - S.bootAt > 5000) { S.bootAt = performance.now(); await rt.boot(); }
      if (rt.phase === "play" || rt.phase === "ended") { await refresh(); await rt.tick(); } else if (rt.phase === "missing") await refresh();
    } catch { /* the loop must never die */ }
    draw();
  }
  S.bootAt = performance.now();
  rt.boot().then(() => { loop(); setInterval(loop, 1000); });
})();
