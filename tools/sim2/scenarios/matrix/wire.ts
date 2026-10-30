// M4 of the matrix: real requests to the real Worker (handle) on an in-memory database. One scenario = one chain of requests with its own person, so scenarios never leak into each other.
// Verification mode x era x payment x ID or phone spelling x listed/unlisted x device x time x approval. The expected answer comes from the rules written in docs/TEST_HANDOFF.md and the join rules:
//   bad ID or missing ID -> 400 (asked before anything else); then a person who already holds a seat is let back in (200 again); then an unpaid game after its start is 'locked' (403) and a paid one is 'closed' (410);
//   then a listed ID or number gets the card (200), an unlisted ID waits for the organizer (403 waiting); one card plays on one phone (423 on a second phone).
import { type World, START, api, closeWorld, dev, joinGame, json, mob, newWorld, rows, setupGame, addPeople, roundMs } from "../../../../apps/edge/test/t30-helpers";
import { newCounts, record, type Counts } from "./run";

const LATE = roundMs(START) + 60_000, T0 = Date.UTC(2026, 9, 1, 10, 0, 0);
const toFull = (s: string) => Array.from(s, (ch) => (ch === " " ? "　" : ch.charCodeAt(0) >= 0x21 && ch.charCodeAt(0) <= 0x7e ? String.fromCharCode(ch.charCodeAt(0) + 0xfee0) : ch)).join("");
const SEPS: [string, string][] = [["none", ""], ["space", " "], ["dash", "-"], ["slash", "/"], ["dot", "."], ["underscore", "_"]];
let k = 0;
const ipOf = () => `10.${(k >> 8) & 255}.${k & 255}.1`; // the wrong-ID guess limit is per network address: each scenario comes from its own address

export async function runWire(): Promise<Counts> {
  const c = newCounts();
  for (const mode of ["id", "mobile"] as const) for (const era of mode === "id" ? (["old", "new"] as const) : (["new"] as const)) for (const pay of ["paid", "unpaid"] as const) {
    const w = newWorld();
    try {
      const g = await setupGame(w, { id: `MX-${mode}-${era}-${pay}`, verify: mode, employeesOnly: mode === "id" ? true : undefined, era, cap: 5000, paid: pay === "paid" });
      if (mode === "id") await idScenarios(w, g, era, pay, c); else await phoneScenarios(w, g, pay, c);
    } finally { closeWorld(w); }
  }
  return c;
}
type G = { key: string; id: string };

async function idScenarios(w: World, g: G, era: "old" | "new", pay: "paid" | "unpaid", c: Counts) {
  const dims = ["validation-mode", "employee-id-format", "game-era", "payment-state", "start-time", "device", "approval"];
  const code = () => { k++; return String(k).padStart(4, "0"); };
  const label = (what: string, o: Record<string, unknown>) => () => `M4 id era=${era} pay=${pay} ${what} ${JSON.stringify(o)}`;
  // listed person, spelled in many ways
  for (const [sepName, sep] of SEPS) for (const cs of ["upper", "lower"] as const) for (const width of ["ascii", "full"] as const) for (const time of ["before", "after-new", "after-return"] as const) for (const device of ["first", "second"] as const) {
    const n = code(), pre = "U" + n, num = n; const listed = `${pre}-${num}`;
    let text = pre + sep + num; text = cs === "lower" ? text.toLowerCase() : text; if (width === "full") text = toFull(text);
    const matches = era === "new" || (width === "ascii" && sep === "-"); // the old reading keeps the dash and refuses full-width; the new reading ignores separators, case and width (full-width letters read as plain ones)
    const refused = width === "full" && era === "old";
    if (time === "after-return" && !matches) continue; // only someone who joined before the start can return after it
    const bad: [string, string][] = [];
    const add = await json(await addPeople(w, g.key, g.id, [{ name: "L" + n, empId: listed }]));
    if (add.added !== 1) bad.push(["employee-id-format", `the list upload of ${listed} added ${add.added}`]);
    const body = (d: number) => ({ empId: text, name: "L" + n, device: dev(d) });
    const d1 = 100 + k * 2, d2 = d1 + 1;
    if (time === "after-return") { const first = await joinGame(w, g.id, { empId: listed, name: "L" + n, device: dev(d1) }); if (first.status !== 200) bad.push(["start-time", `joining before the start gave ${first.status}`]); }
    const now = time === "before" ? T0 : LATE;
    const r1 = await joinGame(w, g.id, body(device === "first" || time === "after-return" ? d1 : d2), now); const b1 = await json(r1);
    let want: number, wantCode: string | undefined;
    if (refused) { want = 400; wantCode = "bad-id"; }
    else if (time === "after-return") { want = 200; }
    else if (time === "after-new") { if (pay === "paid") { want = 410; wantCode = "closed"; } else { want = 403; wantCode = "locked"; } }
    else if (matches) want = 200; else { want = 403; wantCode = "waiting"; }
    if (r1.status !== want || (wantCode && b1.code !== wantCode)) bad.push(["employee-id-format", `join as ${JSON.stringify(text)} ${time}: got ${r1.status}/${b1.code}, wanted ${want}/${wantCode ?? "-"}`]);
    if (want === 200 && time === "before" && device === "first") {
      const r2 = await joinGame(w, g.id, body(d2), now); const b2 = await json(r2); // a second phone with the same ID
      if (r2.status !== 423 || b2.code !== "id-used") bad.push(["device", `second phone gave ${r2.status}/${b2.code}, wanted 423/id-used`]);
    }
    if (want === 200 && time === "before" && device === "second") { /* a second device that comes FIRST just holds the card: same outcome */ }
    const seat = rows(w, "SELECT COUNT(*) c FROM participant WHERE eid=? AND phone_hash IN (SELECT ph FROM person WHERE eid=? )", g.id, g.id)[0]?.c;
    void seat;
    record(c, 3, dims, bad, label("listed", { sepName, cs, width, time, device }));
  }
  // not on the list: waits; the organizer may admit or decline; refusals for bad IDs
  for (const kind of ["unlisted-ascii", "unlisted-spaced", "symbols-only", "emoji-only", "blank", "long"] as const) for (const time of ["before", "after-new"] as const) for (const device of ["first", "second"] as const) for (const approval of kind.startsWith("unlisted") && time === "before" ? (["none", "admit", "decline"] as const) : (["none"] as const)) {
    const n = code(); const text = kind === "unlisted-ascii" ? `N${n}-${n}` : kind === "unlisted-spaced" ? `n${n} ${n}` : kind === "symbols-only" ? "---//" : kind === "emoji-only" ? "\u{1F600}\u{1F600}" : kind === "blank" ? "  " : "Z".repeat(31);
    const bad: [string, string][] = []; const d = 500 + k * 2 + (device === "second" ? 1 : 0); const now = time === "before" ? T0 : LATE;
    const r = await joinGame(w, g.id, { empId: text, name: "N" + n, device: dev(d) }, now, ipOf()); const b = await json(r);
    const wantBad = kind === "symbols-only" || kind === "emoji-only" || kind === "long" ? [400, "bad-id"] : kind === "blank" ? [400, "need-id"] : null;
    if (wantBad) { if (r.status !== wantBad[0] || b.code !== wantBad[1]) bad.push(["employee-id-format", `${kind} gave ${r.status}/${b.code}, wanted ${wantBad[0]}/${wantBad[1]}`]); }
    else if (time === "after-new") { const [ws, wc] = pay === "paid" ? [410, "closed"] : [403, "locked"]; if (r.status !== ws || b.code !== wc) bad.push(["payment-state", `${kind} after the start gave ${r.status}/${b.code}, wanted ${ws}/${wc}`]); }
    else {
      if (r.status !== 403 || b.code !== "waiting" || !b.wid) bad.push(["employee-id-format", `${kind} gave ${r.status}/${b.code}, wanted 403/waiting`]);
      else if (approval !== "none") {
        const dec = await api(w, "POST", `/api/z/${g.id}/waiting/${b.wid}`, { decision: approval === "admit" ? "admit" : "decline" }, g.key); if (dec.status !== 200) bad.push(["approval", `deciding gave ${dec.status}`]);
        const again = await joinGame(w, g.id, { empId: text, name: "N" + n, device: dev(d) }, now, ipOf());
        if (approval === "admit" && again.status !== 200) bad.push(["approval", `after admit the person got ${again.status}`]);
        if (approval === "decline" && again.status === 200) bad.push(["approval", "after decline the person got a card"]);
      }
    }
    record(c, 2, dims, bad, label(kind, { time, device, approval }));
  }
}

async function phoneScenarios(w: World, g: G, pay: "paid" | "unpaid", c: Counts) {
  const dims = ["validation-mode", "payment-state", "start-time", "device"];
  const spell: [string, (p: string) => string, boolean][] = [["plain", (p) => p, true], ["plus91 spaced", (p) => `+91 ${p.slice(0, 5)} ${p.slice(5)}`, true], ["zero prefix", (p) => `0${p.slice(0, 5)} ${p.slice(5)}`, true], ["dash", (p) => `${p.slice(0, 5)}-${p.slice(5)}`, true], ["plus91 joined", (p) => `+91${p}`, true],
    ["short", () => "12345", false], ["letters", () => "abcdefghij", false], ["zeros", () => "0000000000", false], ["five digits", () => "98765", false]];
  for (const [name, f, valid] of spell) for (const time of ["before", "after-new", "after-return"] as const) for (const device of ["first", "second"] as const) {
    if (time === "after-return" && !valid) continue;
    k++; const phone = mob(k), typed = f(phone), bad: [string, string][] = [], d1 = 900 + k * 2, d2 = d1 + 1;
    if (time === "after-return") { const first = await joinGame(w, g.id, { phone, name: "P" + k, device: dev(d1) }); if (first.status !== 200) bad.push(["start-time", `joining before the start gave ${first.status}`]); }
    const now = time === "before" ? T0 : LATE, useDev = device === "first" || time === "after-return" ? d1 : d2;
    const r = await joinGame(w, g.id, { phone: typed, name: "P" + k, device: dev(useDev) }, now); const b = await json(r);
    let want: number, wc: string | undefined;
    if (!valid) { want = 400; } else if (time === "after-return") want = 200; else if (time === "after-new") { if (pay === "paid") { want = 410; wc = "closed"; } else { want = 403; wc = "locked"; } } else want = 200;
    if (r.status !== want || (wc && b.code !== wc)) bad.push(["validation-mode", `phone ${name} ${JSON.stringify(typed)} ${time}: got ${r.status}/${b.code}, wanted ${want}/${wc ?? "-"}`]);
    if (want === 200 && time === "before" && device === "first") {
      const r2 = await joinGame(w, g.id, { phone: typed, name: "P" + k, device: dev(d2) }, now); const b2 = await json(r2); if (r2.status !== 423 || b2.code !== "other-phone") bad.push(["device", `second phone gave ${r2.status}/${b2.code}, wanted 423/other-phone`]);
      const same = await joinGame(w, g.id, { phone: typed, name: "P" + k, device: dev(d1) }, now); const bs = await json(same); if (same.status !== 200 || bs.again !== true || bs.pid !== b.pid) bad.push(["device", "the same phone again did not return the same card"]);
    }
    record(c, 3, dims, bad, () => `M4 mobile pay=${pay} ${name} ${time} ${device}`);
  }
}
