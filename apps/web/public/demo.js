// The free demo: a short practice game on a real board (made by the same board code as the live game), you against three colleagues.
// It runs only in this page: nothing is sent anywhere, nothing is saved, there are no prizes. The practice rolls are ordinary random numbers: a live game's rolls come from the public beacon.
// Setting __CB_DEMO_STUB tells z.js (loaded right after this file) to leave the page alone.
(function () {
  "use strict";
  window.__CB_DEMO_STUB = true;
  const app = document.getElementById("app");
  const ZG = window.ZG;
  if (!app) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const f2 = (n) => Math.round(n * 100) / 100;
  const MOTION = () => { try { return !matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const pips = (face) => Array.from({ length: 9 }, (_, i) => `<i class="pip${(PIPS[face] || []).includes(i) ? " on" : ""}"></i>`).join("");
  // the same real 3D cube as the live game: ivory, black pips, opposite faces add up to 7; it tumbles on two axes and settles on the number
  const faces = () => [1, 2, 3, 4, 5, 6].map((n) => `<div class="dface df${n}">${pips(n)}</div>`).join("");
  const cube = (mode, n) => `<div class="dice3d${mode === "rolling" ? " rolling" : ""}" role="img" aria-label="${mode === "rolling" ? "Rolling the dice" : n ? "Last roll " + n : "Your dice"}"><div class="dshadow"></div><div class="dhop"><div class="dtilt"><div class="dcube ${mode === "rolling" ? "rolling show" + n : n ? "show" + n : "idle"}">${faces()}</div></div></div></div>`;
  const PLAYERS = [{ name: "You", cls: "me" }, { name: "Maya", cls: "p1" }, { name: "Ravi", cls: "p2" }, { name: "Zoya", cls: "p3" }];
  const START = 60; // the demo starts near the end so a game takes about a minute
  let board = null;
  try { board = ZG.generateBoard("DEMO", 1, "9f2c4a7e1d3b5860a1c3e5f7092b4d6e8f0a1b2c3d4e5f60718293a4b5c6d7e8", { size: 100, snakes: 9, ladders: 9, finish: "exact" }); } catch { board = null; }
  if (!board) { app.innerHTML = '<div class="zcard" role="status"><h2>Free demo</h2><p class="zsmall zflush zgap">The demo could not start in this browser. Please try again.</p><a class="zbtn" href="/">Create my game</a></div>'; return; }

  const S = { pending: 0, landed: false, pos: PLAYERS.map((_, i) => START + i), turn: 0, busy: false, last: null, who: 0, rolls: 0, done: null, auto: false, face: 0, msg: "", tone: "go" };
  const ctr = (s, side) => { const p = ZG.squareXY(s, side); return { x: p.col + 0.5, y: side - 1 - p.row + 0.5 }; };
  function ladderSvg(a, b) {
    const side = board.side, p = ctr(a, side), r = ctr(b, side), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1, nx = (-dy / len) * 0.13, ny = (dx / len) * 0.13;
    const rl = (c, sx, sy) => `<line class="${c}" x1="${f2(p.x + sx)}" y1="${f2(p.y + sy)}" x2="${f2(r.x + sx)}" y2="${f2(r.y + sy)}"/>`;
    let out = `<g class="lad">${rl("railo", nx, ny)}${rl("railo", -nx, -ny)}${rl("rail", nx, ny)}${rl("rail", -nx, -ny)}`;
    const n = Math.max(2, Math.floor(len / 0.6));
    for (let i = 1; i < n; i++) { const t = i / n, cx = p.x + dx * t, cy = p.y + dy * t; out += `<line class="rung" x1="${f2(cx + nx)}" y1="${f2(cy + ny)}" x2="${f2(cx - nx)}" y2="${f2(cy - ny)}"/>`; }
    return out + "</g>";
  }
  function snakeSvg(head, tail, k5) {
    const side = board.side, p = ctr(head, side), r = ctr(tail, side), dx = r.x - p.x, dy = r.y - p.y, len = Math.hypot(dx, dy) || 1, k = Math.min(1.1, len * 0.28), nx = (-dy / len) * k, ny = (dx / len) * k;
    const c1 = { x: p.x + dx / 3 + nx, y: p.y + dy / 3 + ny }, c2 = { x: p.x + (2 * dx) / 3 - nx, y: p.y + (2 * dy) / 3 - ny };
    const d = `M${f2(p.x)} ${f2(p.y)} C${f2(c1.x)} ${f2(c1.y)} ${f2(c2.x)} ${f2(c2.y)} ${f2(r.x)} ${f2(r.y)}`, ex = (-dy / len) * 0.1, ey = (dx / len) * 0.1;
    return `<g class="sn s${k5 % 5}"><path class="snko" d="${d}"/><path class="snk" d="${d}"/><circle class="snkhead" cx="${f2(p.x)}" cy="${f2(p.y)}" r="0.26"/><circle class="snkeye" cx="${f2(p.x + ex)}" cy="${f2(p.y + ey)}" r="0.07"/><circle class="snkeye" cx="${f2(p.x - ex)}" cy="${f2(p.y - ey)}" r="0.07"/><circle class="snkdot" cx="${f2(r.x)}" cy="${f2(r.y)}" r="0.1"/></g>`;
  }
  function boardHtml() {
    const side = board.side, size = board.size;
    let cells = "", ov = "", lines = "";
    for (let s = 1; s <= size; s++) {
      const { col, row } = ZG.squareXY(s, side), lad = board.ladders[s], snk = board.snakes[s], isEnd = s === size;
      const here = PLAYERS.map((p, i) => ({ p, i })).filter((x) => S.pos[x.i] === s);
      const lab = ["Square " + s]; if (lad !== undefined) lab.push("ladder to " + lad); if (snk !== undefined) lab.push("snake to " + snk); if (isEnd) lab.push("last square"); for (const h of here) lab.push(h.p.name + (h.i === 0 ? " are here" : " is here"));
      const cls = ["sq", "gc" + (col + 1), "gr" + (side - row), "h" + (row % 5)]; if ((col + row) % 2) cls.push("a"); if (lad !== undefined) cls.push("lb"); if (snk !== undefined) cls.push("sh"); if (isEnd) cls.push("end"); if (here.some((h) => h.i === 0)) cls.push("me");
      cells += `<div class="${cls.join(" ")}" role="listitem" aria-label="${esc(lab.join(", "))}"></div>`;
      const marks = "" + (lad !== undefined ? `<span class="mk mk2">&#9650;</span>` : snk !== undefined ? `<span class="mk mk2">&#9660;</span>` : "");
      const pw = here.slice(0, 2).map((h) => `<i class="pawn t ${h.p.cls}"></i>`).join("") + (here.length > 2 ? `<i class="pawn t more"></i>` : "");
      ov += `<div class="so gc${col + 1} gr${side - row}${lad !== undefined ? " lb" : ""}${snk !== undefined ? " sh" : ""}${isEnd ? " end" : ""}"><b>${s}</b>${marks}${pw}</div>`;
    }
    for (const a of Object.keys(board.ladders).map(Number).sort((x, y) => x - y)) lines += ladderSvg(a, board.ladders[a]);
    Object.keys(board.snakes).map(Number).sort((x, y) => x - y).forEach((h, i) => { lines += snakeSvg(h, board.snakes[h], i); });
    return `<div class="sqwrap"><div class="sqgrid g${side}" role="list" aria-label="Practice board, ${size} squares. Square 1 is at the bottom left and the rows zig-zag upwards.">${cells}</div><svg class="sqsvg" viewBox="0 0 ${side} ${side}" aria-hidden="true" focusable="false">${lines}</svg><div class="sqov g${side}" aria-hidden="true">${ov}</div></div>`;
  }
  const stepText = (who, s) => {
    const n = who === 0 ? "You" : PLAYERS[who].name;
    if (s.kind === "ladder") return `${n} rolled ${s.roll}: a ladder! Up from square ${s.landed} to ${s.to}.`;
    if (s.kind === "snake") return `${n} rolled ${s.roll}: a snake! Down from square ${s.landed} to ${s.to}.`;
    if (s.kind === "overshoot") return `${n} rolled ${s.roll}: too many for the last square, so ${n === "You" ? "you stay" : "stays"} on ${s.from}.`;
    if (s.kind === "finish") return `${n} rolled ${s.roll} and ${n === "You" ? "are" : "is"} home on square ${s.to}!`;
    return `${n} rolled ${s.roll}: from square ${s.from} to ${s.to}.`;
  };
  function view() {
    const yourTurn = S.turn === 0 && !S.busy && !S.done;
    const state = S.done ? (S.done === "you" ? "You made it home!" : `${PLAYERS[S.who].name} got home first.`) : S.busy ? (S.turn === 0 ? "Rolling the dice…" : `${PLAYERS[S.turn].name} is rolling…`) : yourTurn ? "Your turn: tap the Roll button." : `${PLAYERS[S.turn].name} is next…`;
    const chipTone = S.done ? "end" : yourTurn ? "go" : "wait", chip = S.done ? "Game over" : yourTurn ? "Your turn" : "Wait";
    const die = `<div class="zdieblk">${cube(S.busy && MOTION() ? "rolling" : "", S.busy ? S.pending : S.face)}<div class="dnum${S.landed ? " pop" : ""}" aria-hidden="true">${S.busy ? "&hellip;" : S.face || ""}</div></div>`;
    const legend = PLAYERS.map((p, i) => `<span class="zlg"><i class="pawn t ${p.cls}"></i>${esc(p.name)} <b>${S.pos[i]}</b></span>`).join("");
    const last = S.last ? `<div class="zthrow ${S.last.s.kind === "ladder" ? "up" : S.last.s.kind === "snake" ? "down" : S.last.s.kind === "finish" ? "win" : ""}" role="status"><span class="zsteptxt">${esc(stepText(S.last.who, S.last.s))}</span></div>` : "";
    const end = S.done ? `<div class="zcard zfinal"><div class="zmedal" aria-hidden="true">${S.done === "you" ? "&#127942;" : "&#127922;"}</div><div class="zfbig">${S.done === "you" ? "You won the practice game!" : "Nice try! Play again?"}</div><p class="zsmall zbigger">This was only practice: no prizes and nothing was saved. In a real game everyone gets their own board and the prizes are set by your organizer.</p><button class="zbtn" id="dagain" type="button">Play again</button><a class="zbtn alt" href="/">Create my game</a></div>` : "";
    return `<div class="zbrand zdef" data-bg="#0B5D5B" data-fg="#ffffff"><b><a class="zlogo" href="/" aria-label="Corporate Snakes and Ladders home"><img src="/logo-mark.svg" alt="Corporate Snakes and Ladders logo" width="18" height="18"></a>CORPORATE SNAKES AND LADDERS</b><span class="zdemotag">FREE DEMO</span></div>
      <p class="zdemoinfo zgoalline zflush"><b>Practice game.</b> In a real game the dice roll by themselves; here you can press Roll or use Auto roll. A ladder takes you up, a snake takes you down. Land exactly on 100. You start on ${START} to keep it quick.</p>
      <div class="zcard zdice st-${chipTone}"><div class="zchiprow"><span class="zchip2 ${chipTone}">${chip}</span><span class="zchip2 plain">Roll ${S.rolls + (S.done ? 0 : 1)} &middot; Square ${S.pos[0]}</span></div>
        <div class="zdicetop">${die}<div class="zstate" role="status"><b>${esc(state)}</b></div></div>
        ${S.done ? "" : `<div class="zbtnrow"><button class="zbtn zroll" id="droll" type="button"${yourTurn ? "" : " disabled"}>${S.busy && S.turn === 0 ? "Rolling…" : "Roll the dice"}</button><button class="zbtn alt" id="dauto" type="button" aria-pressed="${S.auto}">${S.auto ? "Stop auto" : "Auto roll"}</button></div>`}${S.busy ? "" : last}</div>
      <div class="zcard zboardcard"><h2>The board</h2> <span class="zgoalpill">Goal: land exactly on 100</span><div class="zlegend2">${legend}</div>${boardHtml()}
        <p class="zsmall zleg"><span class="zkey end">&#127942;</span> last square 100 <span class="zkey up">&#9650;</span> ladder: up <span class="zkey down">&#9660;</span> snake: down</p></div>
      ${end}
      <div class="zcard"><h2>Ready for your own game?</h2><p class="zsmall zflush zgap">Share one link. Everyone plays on their own phone. The software checks every result.</p><a class="zbtn" href="/">Create my game</a></div>`;
  }
  /** the pawns slide from their old squares to the new ones (about 0.4 s; none with "reduce motion") */
  const rectsOf = () => { const w = document.querySelector(".sqwrap"), m = {}; if (!w) return m; const wr = w.getBoundingClientRect(); document.querySelectorAll(".sqov .pawn.t").forEach((el) => { const k = ["me", "p1", "p2", "p3"].find((c) => el.classList.contains(c)); if (k && !m[k]) { const r = el.getBoundingClientRect(); m[k] = { x: r.left - wr.left, y: r.top - wr.top }; } }); return m; };
  function paint() {
    const before = MOTION() ? rectsOf() : {};
    app.innerHTML = view();
    if (MOTION() && Object.keys(before).length) {
      const after = rectsOf();
      document.querySelectorAll(".sqov .pawn.t").forEach((el) => {
        const k = ["me", "p1", "p2", "p3"].find((c) => el.classList.contains(c)); if (!k || !before[k] || !after[k]) return;
        const dx = before[k].x - after[k].x, dy = before[k].y - after[k].y; if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        el.style.transition = "none"; el.style.transform = `translate(${dx}px,${dy}px)`; el.getBoundingClientRect();
        el.style.transition = "transform 380ms cubic-bezier(.25,.8,.3,1)"; el.style.transform = "";
      });
    }
    document.querySelectorAll(".zbrand").forEach((el) => { el.style.color = el.dataset.fg; });
    const go = document.getElementById("droll"); if (go) go.onclick = () => roll(0);
    const au = document.getElementById("dauto"); if (au) au.onclick = () => { S.auto = !S.auto; paint(); if (S.auto && S.turn === 0 && !S.busy) setTimeout(() => { if (S.auto && S.turn === 0 && !S.busy && !S.done) roll(0); }, 500); };
    const ag = document.getElementById("dagain"); if (ag) ag.onclick = () => { S.pos = PLAYERS.map((_, i) => START + i); S.turn = 0; S.busy = false; S.last = null; S.rolls = 0; S.done = null; S.face = 0; paint(); window.scrollTo(0, 0); };
  }
  function roll(who) {
    if (S.busy || S.done || S.turn !== who) return;
    const value = 1 + Math.floor(Math.random() * 6);
    S.busy = true; S.pending = value; S.landed = false; paint();
    const dur = MOTION() ? 1400 : 0;
    setTimeout(() => land(who, value), dur);
  }
  function land(who, value) {
    const s = ZG.step(board, S.pos[who], value, "exact");
    S.pos[who] = s.to; S.face = value; S.last = { who, s }; S.busy = false; S.landed = true;
    if (who === 0) S.rolls++;
    if (s.kind === "finish") { S.done = who === 0 ? "you" : "bot"; S.who = who; paint(); return; }
    S.turn = (who + 1) % PLAYERS.length; paint();
    if (S.turn !== 0) setTimeout(() => roll(S.turn), S.auto ? 350 : 900);
    else if (S.auto) setTimeout(() => { if (S.auto && S.turn === 0 && !S.busy && !S.done) roll(0); }, 600);
  }
  paint();
})();
