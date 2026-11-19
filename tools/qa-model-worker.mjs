// QA MODEL, part 4: the REAL worker (apps/edge/src/worker.ts) on the in-memory SQLite stand-in for D1, driven through its public endpoints.
// Imported by tools/qa-model.mjs. It enumerates: site mode (TEST / LIVE) x sign-in kind, free / paid / demo x head-count, guest-list shapes x who can join,
// turn windows x instants (the late-move rule), and roles x actions. Every expectation is written from docs/boss/*.md and the owner's order, not from what the code did.
import { makeD1 } from "../apps/edge/test/d1-sqlite.ts";
import { handle } from "../apps/edge/test/with-terms.ts";
import { withDevice } from "../apps/edge/test/device.ts";
import { setMode } from "../apps/edge/src/mode.ts";
import { resetRate } from "../apps/edge/src/visits.ts";
import { lazyTickReset } from "../apps/edge/src/worker.ts";

const T = Date.UTC(2026, 9, 1, 10, 0, 0), GEN = 1692803367, HOUR = 3_600_000;
const roundAt = (ms) => Math.floor((ms / 1000 - GEN) / 3) + 1;
const roundMs = (r) => (GEN + (r - 1) * 3) * 1000;
const LATE_MSG = "Ohooo! \u{1F60A} Sorry, you moved after your turn ended. This move cannot be made.";
const mob = (i) => "9" + String(100000000 + i);
const dev = (i) => (String(i).padStart(2, "0") + "b".repeat(32)).slice(0, 32);

let ipn = 0;
export function world(opts = {}) {
  const d = makeD1(); resetRate(); lazyTickReset();
  const env = { DB: d.db, ORGANIZER_SECRET: "plat", DAILY_WRITE_BUDGET: "100000000", DATA_KEY: "dk", PHONE_SALT: "salt", PUBLIC_ORIGIN: "https://snakesladders.test", ...(opts.env ?? {}) };
  const call = (method, path, body, headers = {}, now = T) => handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env, now);
  const j = async (r) => (await r.json().catch(() => ({})));
  const q = (sql, ...a) => d.raw.prepare(sql).all(...a);
  const one = (sql, ...a) => d.raw.prepare(sql).get(...a);
  const w = { env, call, j, q, one, raw: d.raw, mode: async (m) => { await setMode(env, m, "qa-model", T); } };
  w.organizer = async (email) => { const r = await call("POST", "/api/start", { email }, { "cf-connecting-ip": `9.9.${Math.floor(ipn / 250)}.${(++ipn % 250) + 1}` }); const b = await j(r); return { status: r.status, key: b.token, ai: b.aiKey, h: b.token ? { "x-organizer": b.token } : {}, body: b }; };
  return w;
}
export const startIn = (ms) => roundAt(T + ms);
const mkGame = (id, over = {}) => ({ id, startRound: startIn(2 * HOUR), callSeconds: 20, cap: 100, ...over });

export async function run({ add, mk, hit, log, QUICK }) {
  const out = {};
  /* ---------------- W-A: the owner's demo sign-ins work ONLY in TEST mode ---------------- */
  {
    const C = { login: mk(), grant: mk(), testOk: mk(), others: mk() };
    for (const mode of ["LIVE", "TEST"]) for (const mail of ["demo1@xyz.in", "demo2@xyz.in", "demo3@xyz.in", "real.person@acme.com"]) {
      const isDemoMail = /^demo[123]@xyz\.in$/.test(mail);
      { // (1) the always-123456 code
        const w = world(); await w.mode(mode);
        const r = await w.call("POST", "/api/auth/verify", { email: mail, code: "123456" }, { "cf-connecting-ip": "1.2.3.4" });
        const signedIn = r.status === 200 && !!(await w.j(r)).token;
        if (isDemoMail) {
          if (mode === "LIVE") hit(C.login, !signedIn, `LIVE mode: ${mail} + 123456 signed in (HTTP ${r.status})`);
          else hit(C.testOk, signedIn, `TEST mode: ${mail} + 123456 did not sign in (HTTP ${r.status})`);
        } else hit(C.others, !signedIn, `${mode}: a normal address signed in with 123456`);
      }
      { // (2) the free test pack of demo1: a 250-person game made by this account is "paid" (not a draft) only in TEST mode (a fresh site, so /api/start makes the account)
        const w = world(); await w.mode(mode);
        const o = await w.organizer(mail);
        if (o.key) {
          const g = await w.call("POST", "/api/z", mkGame("QA-W-" + mode + mail.slice(0, 5), { cap: 250 }), o.h);
          const body = await w.j(g);
          const free = body.draft === false;
          if (mail === "demo1@xyz.in") { if (mode === "LIVE") hit(C.grant, !free, `LIVE mode: demo1@xyz.in got a free 250-person game (draft=${body.draft})`); else hit(C.testOk, free, `TEST mode: demo1@xyz.in did not get its free test game (draft=${body.draft})`); }
          else hit(C.others, !free, `${mode}: ${mail} got a free 250-person game`);
        } else if (isDemoMail && mode === "LIVE") hit(C.grant, true, ""); // refused at the start: nobody can open the owner's test addresses on the live site
        else hit(C.others, false, `${mode}: /api/start for ${mail} gave no key (HTTP ${o.status})`);
      }
    }
    add("W-01", "worker", "the demo1/demo2/demo3@xyz.in sign-in (code 123456) works ONLY while the site is in TEST mode", C.login.cases, C.login.bad, C.login.ex, "apps/edge/src/worker.ts:973 (`TEST_LOGINS.has(email) && code === TEST_LOGIN_CODE` has no mode check) and :882 (`/api/auth/email`)", "FAIL");
    add("W-02", "worker", "the free 250-person test game of demo1@xyz.in exists ONLY while the site is in TEST mode, and nobody can open the three test addresses as accounts on the live site", C.grant.cases, C.grant.bad, C.grant.ex, "apps/edge/src/worker.ts:1370 and :334 ownerTestGrant (no mode check; anyone can create demo1@xyz.in with POST /api/start)", "FAIL");
    add("W-03", "worker", "in TEST mode the three test sign-ins and the demo1 free test game keep working; ordinary addresses never get either", C.testOk.cases + C.others.cases, C.testOk.bad + C.others.bad, C.testOk.ex || C.others.ex, "apps/edge/src/worker.ts:973");
  }

  /* ---------------- W-B: free / paid / demo x head-count ---------------- */
  {
    const C = { demoFree: mk(), demoCap: mk(), notFreeOther: mk(), demo11: mk(), demoNoLock: mk(), settingsCap: mk(), copy: mk(), cleanDemo: mk() };
    const caps = QUICK ? [10, 11, 100] : [1, 5, 10, 11, 100];
    for (const cap of caps) for (const demoFlag of [false, true]) for (const freeLaunch of [false, true]) {
      const w = world({ env: freeLaunch ? { FREE_LAUNCH: "1" } : {} });
      const o = await w.organizer(`cust${cap}${demoFlag}${freeLaunch}@acme.com`);
      const id = `QA-F-${cap}-${demoFlag ? "D" : "N"}-${freeLaunch ? "L" : "M"}`;
      const c = await w.call("POST", "/api/z", mkGame(id, { cap, ...(demoFlag ? { demo: true } : {}) }), o.h);
      const cb = await w.j(c);
      if (demoFlag && cap > 10) { hit(C.demoCap, c.status === 400 && /10 people/.test(cb.error ?? ""), () => `demo game with ${cap} people: HTTP ${c.status} ${cb.error ?? "accepted"}`); continue; }
      if (c.status !== 200) continue;
      const p = await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
      const pb = await w.j(p);
      if (demoFlag && cap <= 10) {
        hit(C.demoFree, p.status === 200 && pb.paid === true && pb.demo === true, () => `customer demo game (${cap} people, nothing paid): publish HTTP ${p.status}, paid=${pb.paid}, demo=${pb.demo}`);
        // at the start time the free game must begin: it is not held for payment
        const startMs = roundMs(startIn(2 * HOUR));
        const info = await w.j(await w.call("GET", `/api/z/${id}/info`, undefined, {}, startMs + 5 * 60_000));
        hit(C.demoNoLock, !info.locked && !info.waitingFor, () => `demo game at its start time: locked=${info.locked}`);
        // 10 join (name only), 11th refused, a phone that joins twice keeps one seat
        let okJoins = 0, last = null; const pids = new Set();
        for (let i = 1; i <= cap + 1; i++) { const r = await w.call("POST", `/api/z/${id}/join`, { name: "Player " + i, device: dev(i) }, { "cf-connecting-ip": `10.1.${cap}.${i}` }); const b = await w.j(r); if (r.status === 200) { okJoins++; pids.add(b.pid); } else last = { status: r.status, error: b.error }; }
        hit(C.demo11, okJoins === cap && last && last.status >= 400 && /full|limit|10/i.test(last.error ?? ""), () => `demo game (${cap}): ${okJoins} joined, the next one got ${JSON.stringify(last)}`);
      } else if (!demoFlag && !freeLaunch) {
        // a game of up to 10 people with no demo flag is an ordinary game: not free (RULES: only the demo is free)
        hit(C.notFreeOther, pb.paid === false, () => `ordinary ${cap}-person game published with nothing paid: paid=${pb.paid}`);
      }
    }
    // the demo cap also holds when the organizer changes the settings later, and a copy of a demo is an ordinary draft unless asked
    {
      const w = world(); const o = await w.organizer("demoedit@acme.com"); const id = "QA-F-EDIT";
      const c = await w.call("POST", "/api/z", mkGame(id, { cap: 10, demo: true }), o.h);
      if (c.status === 200) {
        const s = await w.call("PATCH", `/api/z/${id}/settings`, { cap: 50 }, o.h);
        hit(C.settingsCap, s.status === 400 && /10 people/.test((await w.j(s)).error ?? ""), () => `raising a demo game to 50 people: HTTP ${s.status}`);
        await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
        const cl = await w.j(await w.call("POST", `/api/z/${id}/clone`, {}, o.h, T));
        if (cl.id) { const inf = await w.j(await w.call("GET", `/api/z/${cl.id}/info`, undefined, o.h)); hit(C.copy, !inf.demo, () => `a copy of a demo game is still a demo (demo=${inf.demo}) although 'Make a copy and choose a bigger size' is the upgrade path`); }
      } else hit(C.settingsCap, false, () => `a demo game with 10 people could not be created: HTTP ${c.status}`);
    }
    add("W-04", "worker", "a customer can make a FREE 10-person demo game (Rs 0, publishes without payment, shows paid, never held for payment)", C.demoFree.cases, C.demoFree.bad, C.demoFree.ex, "apps/edge/src/worker.ts POST /api/z and POST publish (no demo flag, no DEMO_CAP; only the owner's test account and FREE_LAUNCH=1 (up to 100) publish without payment). packages/beacon/src/config.ts has no `demo` setting", "FAIL");
    add("W-05", "worker", "a demo game is never locked for payment at its start time", C.demoNoLock.cases, C.demoNoLock.bad, C.demoNoLock.ex, "apps/edge/src/worker.ts `locked` (unpaid && start - LOCK_LEAD_MS <= now)", "FAIL");
    add("W-06", "worker", "demo game: exactly 10 people can join, the 11th is refused with a plain sentence", C.demo11.cases, C.demo11.bad, C.demo11.ex, "apps/edge/src/worker.ts join (cap) / DEMO_CAP missing", "FAIL");
    add("W-07", "worker", "a demo game cannot be made bigger than 10 people (create or settings)", C.demoCap.cases + C.settingsCap.cases, C.demoCap.bad + C.settingsCap.bad, C.demoCap.ex || C.settingsCap.ex, "apps/edge/src/worker.ts POST /api/z, PATCH settings", "FAIL");
    add("W-08", "worker", "only the demo is free: an ordinary game of 10 people (or fewer) still needs payment", C.notFreeOther.cases, C.notFreeOther.bad, C.notFreeOther.ex, "apps/edge/src/worker.ts publish");
    add("W-09", "worker", "'Make a copy' of a demo game gives an ordinary draft (the upgrade path in the console spec 5.2 step 8)", C.copy.cases, C.copy.bad, C.copy.ex, "apps/edge/src/clone.ts", "GAP");
  }

  /* ---------------- W-B2: the demo as a state machine (every route that could make it free by mistake, or stuck) ---------------- */
  {
    const C = { late: mk(), dates: mk(), pack: mk(), link: mk(), stays: mk(), table: mk() };
    const w = world(); const o = await w.organizer("states@acme.com"); const pubBody = { email: "boss@acme.com", phone: "98765 43210" };
    const far = startIn(200 * 24 * HOUR);
    // an ordinary published game cannot become a demo
    await w.call("POST", "/api/z", mkGame("QA-S-ORD", { cap: 8 }), o.h); await w.call("POST", "/api/z/QA-S-ORD/publish", pubBody, o.h);
    const late = await w.call("PATCH", "/api/z/QA-S-ORD/settings", { demo: true }, o.h); hit(C.late, late.status === 409, () => `a published ordinary game was switched to a demo (HTTP ${late.status})`);
    // a published demo: dates like an unpaid game, room for 10 whatever the size it was made with, never switched back, no pay link
    await w.call("POST", "/api/z", mkGame("QA-S-DEMO", { cap: 3, demo: true }), o.h);
    const pl0 = await w.call("POST", "/api/z/QA-S-DEMO/paylink", {}, o.h); hit(C.link, pl0.status === 409, () => `a pay link was made for a demo draft (HTTP ${pl0.status})`);
    await w.call("POST", "/api/z/QA-S-DEMO/publish", pubBody, o.h);
    hit(C.pack, w.one("SELECT pack FROM engagement WHERE id='QA-S-DEMO'").pack === 10, () => `a demo made for 3 people is published with pack ${w.one("SELECT pack FROM engagement WHERE id='QA-S-DEMO'").pack}`);
    const raise = await w.call("PATCH", "/api/z/QA-S-DEMO/settings", { cap: 10 }, o.h); hit(C.pack, raise.status === 200, () => `raising a published demo from 3 to 10 gave HTTP ${raise.status}`);
    const farMove = await w.call("PATCH", "/api/z/QA-S-DEMO/settings", { startRound: far }, o.h); hit(C.dates, farMove.status === 400, () => `a published demo was moved 200 days ahead (HTTP ${farMove.status})`);
    const off = await w.call("PATCH", "/api/z/QA-S-DEMO/settings", { demo: false }, o.h); hit(C.stays, off.status === 409, () => `a published demo was switched back to an ordinary game (HTTP ${off.status})`);
    // a table game cannot be set up for more people than the table can play
    for (const cap of [2, 20, 21, 100]) { const r = await w.call("POST", "/api/z", mkGame("QA-S-TBL" + cap, { cap, mode: "table" }), o.h); hit(C.table, (cap <= 20) === (r.status === 200), () => `a table game for ${cap} people gave HTTP ${r.status}`); }
    await w.call("POST", "/api/z", mkGame("QA-S-RACE", { cap: 100 }), o.h);
    const toTable = await w.call("PATCH", "/api/z/QA-S-RACE/settings", { mode: "table" }, o.h); hit(C.table, toTable.status === 400, () => `a 100-person race was switched to a table (HTTP ${toTable.status})`);
    add("W-19", "worker", "a table game cannot be set up for more people than the table can play (create, switch to table, make bigger)", C.table.cases, C.table.bad, C.table.ex, "apps/edge/src/worker.ts POST /api/z and settings (TABLE_MAX_PLAYERS)", "FAIL");
    add("W-20", "worker", "a published game cannot become a demo; a published demo cannot be switched back", C.late.cases + C.stays.cases, C.late.bad + C.stays.bad, C.late.ex || C.stays.ex, "apps/edge/src/worker.ts settings", "FAIL");
    add("W-21", "worker", "a demo is dated like an unpaid game, is published with room for 10, and has no pay link", C.dates.cases + C.pack.cases + C.link.cases, C.dates.bad + C.pack.bad + C.link.bad, C.dates.ex || C.pack.ex || C.link.ex, "apps/edge/src/worker.ts maxAheadFor / publish / paylink", "FAIL");
  }

  /* ---------------- W-C: head-count and guest-list shapes ---------------- */
  {
    const C = { cap: mk(), contiguous: mk(), once: mk(), listSeats: mk(), draft: mk(), device: mk(), closedList: mk() };
    const caps = QUICK ? [2, 10] : [2, 3, 10];
    for (const cap of caps) {
      // test accounts play the real worker in TEST mode so the game is paid without a payment step
      const w = world(); await w.mode("TEST"); const o = await w.organizer("demo1@xyz.in"); const id = `QA-J-${cap}`;
      await w.call("POST", "/api/z", mkGame(id, { cap }), o.h);
      // before it is published nobody can join
      { const w2 = world(); const o2 = await w2.organizer("draft@acme.com"); await w2.call("POST", "/api/z", mkGame("QA-DRAFT", { cap }), o2.h); const early = await w2.call("POST", "/api/z/QA-DRAFT/join", { name: "Early bird", device: dev(90) }); hit(C.draft, early.status >= 400, "a draft game accepted a join"); }
      await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
      const pids = [];
      for (let i = 1; i <= cap + 2; i++) { const r = await w.call("POST", `/api/z/${id}/join`, { name: "Guest " + i, device: dev(i) }, { "cf-connecting-ip": `11.0.${cap}.${i}` }); const b = await w.j(r); pids.push([r.status, b]); }
      const ok = pids.filter(([s]) => s === 200);
      hit(C.cap, ok.length === cap, () => `cap ${cap}: ${ok.length} people got a seat`);
      hit(C.cap, pids.slice(cap).every(([s, b]) => s >= 400 && typeof b.error === "string" && b.error.length > 8), () => `cap ${cap}: refusal is not a plain sentence: ${JSON.stringify(pids.slice(cap).map(([s, b]) => [s, b.error]))}`);
      const seats = w.q("SELECT seq FROM seat WHERE eid=? ORDER BY seq", id).map((r) => r.seq);
      hit(C.contiguous, seats.join() === Array.from({ length: cap }, (_, i) => i + 1).join(), () => `seat numbers: ${seats}`);
      // the same phone again: same pawn; a second phone cannot take the first phone's name
      const again = await w.j(await w.call("POST", `/api/z/${id}/join`, { name: "Guest 1", device: dev(1) }, { "cf-connecting-ip": `11.0.${cap}.1` }));
      hit(C.once, again.pid === ok[0][1].pid, () => `same phone joined again and got another pawn (${again.pid} vs ${ok[0][1].pid})`);
    }
    // a list of invited people holds their seats even when strangers arrive first
    for (const [cap, listed] of [[5, 3], [5, 5], [5, 6]]) {
      const w = world(); await w.mode("TEST"); const o = await w.organizer("demo1@xyz.in"); const id = `QA-L-${cap}-${listed}`;
      await w.call("POST", "/api/z", mkGame(id, { cap }), o.h);
      await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
      const added = await w.call("POST", `/api/z/${id}/people`, { people: Array.from({ length: listed }, (_, i) => ({ name: "Listed " + i, phone: mob(500 + i) })) }, o.h);
      // strangers first, with a mobile number (join "phone")
      let strangers = 0; for (let i = 0; i < cap; i++) { const r = await w.call("POST", `/api/z/${id}/join`, { name: "Stranger " + i, phone: mob(900 + i), device: dev(40 + i) }, { "cf-connecting-ip": `12.0.${cap}.${i}` }); if (r.status === 200) strangers++; }
      let listedIn = 0; for (let i = 0; i < Math.min(listed, cap); i++) { const r = await w.call("POST", `/api/z/${id}/join`, { name: "Listed " + i, phone: mob(500 + i), device: dev(70 + i) }, { "cf-connecting-ip": `13.0.${cap}.${i}` }); if (r.status === 200) listedIn++; }
      if (added.status === 200) {
        hit(C.listSeats, listedIn === Math.min(listed, cap), () => `cap ${cap}, ${listed} listed: only ${listedIn} listed people got in after ${strangers} strangers came first`);
        hit(C.listSeats, strangers + listedIn <= cap, () => `cap ${cap}: ${strangers + listedIn} seats given`);
      }
    }
    add("W-10", "worker", "head-count: exactly `cap` people get a seat, the rest are refused in a plain sentence; seat numbers are 1..cap with no gaps", C.cap.cases + C.contiguous.cases, C.cap.bad + C.contiguous.bad, C.cap.ex || C.contiguous.ex, "apps/edge/src/worker.ts addSeat");
    add("W-11", "worker", "the same phone joining twice keeps one pawn; a draft game takes no joins", C.once.cases + C.draft.cases, C.once.bad + C.draft.bad, C.once.ex || C.draft.ex, "apps/edge/src/worker.ts join");
    add("W-12", "worker", "listed people keep their seats even when strangers join first (list sizes below, at and above the head-count)", C.listSeats.cases, C.listSeats.bad, C.listSeats.ex, "apps/edge/src/worker.ts addSeat (invited people are counted against cap)");
  }

  /* ---------------- W-D: the late-move rule (RULES 4 and 11) for every turn window ---------------- */
  {
    const C = { win: mk(), msg: mk(), auto: mk(), other: mk(), notpart: mk(), badTurn: mk() };
    for (const win of [15, 20, 25, 30]) for (const turn of [0, 1, 7]) {
      const w = world(); await w.mode("TEST"); const o = await w.organizer("demo1@xyz.in"); const id = `QA-T-${win}-${turn}`;
      const start = startIn(2 * HOUR);
      await w.call("POST", "/api/z", mkGame(id, { cap: 10, callSeconds: win, play: "presence", startRound: start }), o.h);
      await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
      const j1 = await w.j(await w.call("POST", `/api/z/${id}/join`, { name: "Guest A", device: dev(1) }));
      const turnRounds = Math.floor(win / 3) + 1 + 2; // window + reveal, from schedule.ts
      const open = roundMs(start + 40 + turn * turnRounds), close = open + win * 1000;
      const send = (at, body = {}) => w.call("POST", `/api/z/${id}/throw`, { pid: j1.pid, device: dev(1), turn, ...body }, {}, at);
      const cases = [[open - 1, 409, "not-open"], [open, 200], [close - 1, 200], [close, 409, "late-move"], [close + 1, 409, "late-move"], [close + 60_000, 409, "late-move"]];
      for (const [at, status, code] of cases) { const r = await send(at); const b = await w.j(r); hit(C.win, r.status === status && (!code || b.code === code), () => `window ${win}s turn ${turn}: throw at ${at - open >= 0 ? "+" : ""}${at - open} ms from the opening gave HTTP ${r.status} ${b.code ?? ""}, expected ${status} ${code ?? ""}`); if (code === "late-move") hit(C.msg, b.error === LATE_MSG, () => `late-move wording: "${b.error}"`); }
      const stored = w.q("SELECT k FROM kv WHERE k LIKE ?", `thr/${id}/%`).length; hit(C.win, stored === 1, () => `window ${win}s turn ${turn}: ${stored} throws recorded, expected 1`);
      hit(C.other, (await send(open + 1, { device: dev(2) })).status === 403, "a throw from another phone was accepted");
      hit(C.notpart, (await send(open + 1, { pid: "9x" + "0".repeat(10) })).status === 403, "a throw from a non-player was accepted");
      hit(C.badTurn, (await send(open + 1, { turn: -1 })).status === 400 && (await send(open + 1, { turn: 1.5 })).status === 400, "a bad turn number was accepted");
    }
    { // automatic play: nothing to throw
      const w = world(); await w.mode("TEST"); const o = await w.organizer("demo1@xyz.in"); const id = "QA-T-FATE";
      await w.call("POST", "/api/z", mkGame(id, { cap: 10 }), o.h); await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
      const j1 = await w.j(await w.call("POST", `/api/z/${id}/join`, { name: "Guest A", device: dev(1) }));
      const r = await w.call("POST", `/api/z/${id}/throw`, { pid: j1.pid, device: dev(1), turn: 0 }, {}, roundMs(startIn(2 * HOUR) + 41)); hit(C.auto, r.status === 409, "automatic play accepted a throw");
    }
    add("W-13", "worker", "late-move rule: a throw counts only inside its window (server clock), for windows of 15/20/25/30 s and any turn; exactly one throw is stored", C.win.cases, C.win.bad, C.win.ex, "apps/edge/src/throws.ts acceptThrow / apps/edge/src/lifecycle.ts turnWindowMs");
    add("W-14", "worker", "late-move answer uses the owner-approved wording word for word", C.msg.cases, C.msg.bad, C.msg.ex, "apps/edge/src/throws.ts LATE_MOVE_MSG");
    add("W-15", "worker", "a throw from another phone, from a non-player, with a bad turn number, or in automatic play is refused", C.other.cases + C.notpart.cases + C.badTurn.cases + C.auto.cases, C.other.bad + C.notpart.bad + C.badTurn.bad + C.auto.bad, C.other.ex || C.notpart.ex || C.badTurn.ex || C.auto.ex, "apps/edge/src/throws.ts");
  }

  /* ---------------- W-E: roles x actions ---------------- */
  {
    const C = { anon: mk(), part: mk(), leak: mk(), cohost: mk(), host: mk(), org: mk(), other: mk() };
    const w = world(); await w.mode("TEST"); const o = await w.organizer("demo1@xyz.in"); const id = "QA-R-1";
    await w.call("POST", "/api/z", mkGame(id, { cap: 10 }), o.h); await w.call("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, o.h);
    const me = await w.j(await w.call("POST", `/api/z/${id}/join`, { name: "Secret Name", device: dev(1) }));
    const other = await w.organizer("stranger@acme.com");
    const hostR = await w.call("POST", "/api/org/host", { label: "H1", email: "h1@acme.com" }, o.h); const hostB = await w.j(hostR); const hostH = hostB.hostKey ? { "x-organizer": hostB.hostKey } : null;
    const coR = await w.call("POST", `/api/org/cohost`, { label: "C1", eid: id, mobile: "9876500001", name: "Co One" }, o.h); const coB = await w.j(coR); const coKey = coB.cohostKey ?? coB.key ?? coB.token; const coH = coKey ? { "x-organizer": coKey } : null;
    let tick = 0;
    const actions = [
      ["GET", `/api/z/${id}/participants`, undefined, "organizer"],
      ["GET", `/api/z/${id}/summary`, undefined, "organizer"],
      ["GET", `/api/z/${id}/names?pids=${me.pid}`, undefined, "organizer"],
      ["PATCH", `/api/z/${id}/settings`, { name: "X" }, "organizer"],
      ["POST", `/api/z/${id}/clone`, {}, "organizer"],
      ["GET", `/api/z/${id}/cancel-preview`, undefined, "organizer"],
      ["POST", `/api/z/${id}/announce`, { text: "Hello" }, "organizer"],
    ];
    const roles = [["anonymous", {}], ["participant", {}], ["other organizer", other.h], ["organizer", o.h], ...(hostH ? [["host", hostH]] : []), ...(coH ? [["co-host", coH]] : [])];
    const expectAllow = (role, action) => {
      const [m, p] = action; if (role === "organizer") return true; if (role === "host") return true;
      if (role === "co-host") return /announce$/.test(p); // a Co-host sees the small header, can send a message; never the people list, names, settings
      return false;
    };
    for (const [role, hdr] of roles) for (const a of actions) {
      const r = await w.call(a[0], a[1], a[2], hdr, T + 1000 + (++tick) * 120_000);
      const allowed = r.status < 400; const exp = expectAllow(role, a);
      const bucket = role === "organizer" ? C.org : role === "host" ? C.host : role === "co-host" ? C.cohost : role === "anonymous" ? C.anon : role === "participant" ? C.part : C.other;
      hit(bucket, allowed === exp, () => `${role} ${a[0]} ${a[1].replace(id, ":id")}: HTTP ${r.status}, expected ${exp ? "allowed" : "refused"}`);
    }
    // nothing a stranger can read may carry a name or a number
    for (const p of [`/api/z/${id}/info`, `/api/z/${id}/seats`, `/api/z/${id}/results`, `/api/z/${id}/throws?from=0&to=5`]) {
      const t = await (await w.call("GET", p, undefined, {}, T + 1000)).text();
      hit(C.leak, !/Secret Name|9876500001|boss@acme\.com|98765 ?43210/.test(t), () => `public ${p.replace(id, ":id")} shows a name, mobile number or e-mail`);
    }
    add("W-16", "worker", "roles: a stranger, a player or another organizer can read or change nothing of an organizer's game", C.anon.cases + C.part.cases + C.other.cases, C.anon.bad + C.part.bad + C.other.bad, C.anon.ex || C.part.ex || C.other.ex, "apps/edge/src/worker.ts can()/deny()");
    add("W-17", "worker", "roles: the organizer and a Host (equal rights) may use every organizer action; a Co-host only the header and messages", C.org.cases + C.host.cases + C.cohost.cases, C.org.bad + C.host.bad + C.cohost.bad, C.org.ex || C.host.ex || C.cohost.ex, "apps/edge/src/worker.ts can()");
    add("W-18", "worker", "public pages never show a player's name, mobile number or the organizer's e-mail/mobile", C.leak.cases, C.leak.bad, C.leak.ex, "apps/edge/src/worker.ts pub()", "FAIL");
  }
  return out;
}
