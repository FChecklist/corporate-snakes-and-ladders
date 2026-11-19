// Snakes 1.4.1 audit, screen items 2, 3, 5, 6, 9 (phone join box, organizer console step 2, ends-when text). The REAL z.js and zc.js run in a DOM against the REAL Worker.
// Every "deliberate break" runs the same check on a copy of the page folder with ONE line of the page changed (pub override of the harness) and expects the check to fail.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";

setDefaultTimeout(60_000);
const PUB = join(import.meta.dir, "../public");
const WHERE = new URL("../public/", import.meta.url).pathname;
let open: Page[] = [], temps: string[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; for (const t of temps) rmSync(t, { recursive: true, force: true }); temps = []; });

/** A copy of apps/web/public with ONE exact piece of one file replaced. Fails loudly if the piece is not found exactly once (so a break can never silently do nothing). */
export function mutated(file: string, from: string, to: string): string {
  const src = readFileSync(join(PUB, file), "utf8"); const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`break check: "${from.slice(0, 60)}" occurs ${n} times in ${file}, expected exactly 1`);
  const dir = mkdtempSync(join(tmpdir(), "pub141-")); temps.push(dir);
  cpSync(PUB, dir, { recursive: true }); writeFileSync(join(dir, file), src.replace(from, () => to));
  return dir;
}
const CLEAN_MS = 4102444800001;

/** A published game with the given settings; `clean` makes it a game on the new reading of an ID. */
async function world(settings: Record<string, unknown>, clean: boolean, id = "AUD-141", over: Record<string, unknown> = {}) {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  expect((await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 20, cap: 100, ...over }, s.aiKey)).status).toBe(200);
  expect((await w.api("POST", `/api/z/${id}/publish`, { email: "boss@acme.com", phone: "98765 43210" }, s.token)).status).toBe(200);
  if (Object.keys(settings).length) expect((await w.api("PATCH", `/api/z/${id}/settings`, settings, s.token)).status).toBe(200);
  if (clean) w.world.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(CLEAN_MS, id);
  return { w, s, id };
}
async function phone(w: Awaited<ReturnType<typeof world>>, pub?: string) {
  const p = await openPage(w.w.world, { url: `http://localhost/z.html?e=${w.id}`, html: "z.html", scripts: ["audio.js", "zgame.js", "z.js"], pub });
  open.push(p); await p.waitFor((x) => /employee ID|Email ID|mobile number/i.test(x), 20000); return p;
}
/** Types into the ID box exactly as a person does and returns what the box's hint line says. */
function typeId(p: Page, text: string): string {
  const el = p.$("#emp"); el.value = text; el.dispatchEvent(new p.win.Event("input", { bubbles: true }));
  return String(p.$("#empread").textContent);
}
const READ = /read this as/i;
const ATSIGN = "This looks like an Email ID. This game asks for an employee ID: letters and numbers only.";

describe("item 2 and 3: the phone join box (z.js showRead) follows what the server really does", () => {
  const checks = async (pub?: string) => {
    const out: Record<string, string> = {};
    const old = await world({ verify: "id" }, false, "OLD-1"); const po = await phone(old, pub);
    out.oldDashes = typeId(po, "1b-678"); out.oldEmail = typeId(po, "a@b.com"); out.oldFull = typeId(po, "a＠b.com");
    const nw = await world({ verify: "id" }, true, "NEW-1"); const pn = await phone(nw, pub);
    out.newDashes = typeId(pn, "1b-678"); out.newSpaces = typeId(pn, "1B 678"); out.newClean = typeId(pn, "1B678"); out.newEmail = typeId(pn, "a@b.com"); out.newFull = typeId(pn, "RAJAT1＠DEMO.COM"); out.newLong = typeId(pn, "A".repeat(31));
    out.newDashedLong = typeId(pn, "AB-".repeat(13) + "AB");
    const em = await world({ verify: "id", idKind: "email" }, false, "EM-1"); const pe = await phone(em, pub);
    out.emailCase = typeId(pe, "RAJAT1＠DEMO.COM"); out.emailSpace = typeId(pe, "ab c＠x.com"); out.emailPlain = typeId(pe, "rajat1@demo.com");
    return out;
  };
  test("an old-reading game never promises a cleaned ID: no 'read this as' for 1b-678 (the server keeps 1B-678 there)", async () => {
    const o = await checks();
    expect(o.oldDashes).toBe("");
  });
  test("a new-reading game says 'The system will read this as 1B678' for 1b-678 and for '1B 678', nothing when already clean", async () => {
    const o = await checks();
    expect(o.newDashes).toBe("The system will read this as 1B678");
    expect(o.newSpaces).toBe("The system will read this as 1B678");
    expect(o.newClean).toBe("");
  });
  test("item 3: an email in an employee-ID box (either reading, even with a full-width at sign) never shows 'read this as', only the plain refusal", async () => {
    const o = await checks();
    for (const k of ["oldEmail", "oldFull", "newEmail"]) expect([k, o[k]]).toEqual([k, ATSIGN]);
    for (const k of ["oldEmail", "oldFull", "newEmail"]) expect(READ.test(o[k]!)).toBe(false);
  });
  test("an Email ID game keeps its own read-as hint (lower case, spaces removed) and says nothing for an address already clean", async () => {
    const o = await checks();
    expect(o.emailCase).toBe("The system will read this as rajat1@demo.com");
    expect(o.emailSpace).toBe("The system will read this as abc@x.com");
    expect(o.emailPlain).toBe("");
  });
  test("item 9 (screen): over 30 characters AFTER cleaning gives the plain refusal and no 'read this as'; 41 characters that clean to 28 are read as the cleaned form", async () => {
    const o = await checks();
    expect(o.newLong).toBe("An employee ID has letters and numbers only (up to 30).");
    expect(o.newDashedLong).toBe("The system will read this as " + "AB".repeat(14));
  });
  test("DELIBERATE BREAK: showing the read-as hint without asking the server (idClean) is caught", async () => {
    const pub = mutated("z.js", "else if (INFO.idClean) {", "else if (true) {");
    const o = await checks(pub);
    expect(o.oldDashes).not.toBe(""); // the check would fail on the old-reading game
  });
  test("DELIBERATE BREAK: an email in the ID box falling through to the read-as hint is caught", async () => {
    const pub = mutated("z.js", 'else if (nf.includes("@")) msg =', 'else if (false) msg =');
    const o = await checks(pub);
    expect(o.newEmail).not.toBe(ATSIGN);
  });
});

describe("item 9 (screen): no maxlength cuts the ID box", () => {
  test("employee-ID box has no maxlength; the Email ID box keeps 254; typing 40 characters keeps all 40", async () => {
    const g = await world({ verify: "id" }, true, "ML-1"); const p = await phone(g);
    expect(p.$("#emp").getAttribute("maxlength")).toBeNull();
    typeId(p, "A-".repeat(20)); expect(p.$("#emp").value).toHaveLength(40);
    const e = await world({ verify: "id", idKind: "email" }, false, "ML-2"); const pe = await phone(e);
    expect(pe.$("#emp").getAttribute("maxlength")).toBe("254");
  });
  test("DELIBERATE BREAK: the old maxlength=30 put back is caught", async () => {
    const pub = mutated("z.js", `'autocomplete="off" autocapitalize="characters"'`, `'autocomplete="off" autocapitalize="characters" maxlength="30"'`);
    const g = await world({ verify: "id" }, true, "ML-3"); const p = await phone(g, pub);
    expect(p.$("#emp").getAttribute("maxlength")).toBe("30");
  });
  test("pressing Join with 31 letters shows the server's plain refusal in the page (nothing is cut first)", async () => {
    const g = await world({ verify: "id" }, true, "ML-4"); const p = await phone(g);
    typeId(p, "A".repeat(31)); p.$("#emp").oninput?.({ target: p.$("#emp") });
    const nm = p.$("#nm"); if (nm) { nm.value = "Asha"; nm.oninput?.(); }
    for (const b of p.win.document.querySelectorAll("input.cbc-tick")) b.checked = true;
    p.click("#go");
    await p.waitFor((x) => /letters and numbers only/i.test(x), 20000);
    expect(p.text()).toContain("An employee ID has letters and numbers only (up to 30).");
    expect(READ.test(p.text())).toBe(false);
  });
});
