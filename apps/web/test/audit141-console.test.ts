// Snakes 1.4.1 audit, console items 2, 3, 5, 6, 10 (old organizer console zc.js and the ends-when texts). Real zc.js / z.js in a DOM against the real Worker.
// Breaks: the same check on a copy of the page folder with one line changed (harness `pub`), expected to fail.
import { afterEach, describe, expect, setDefaultTimeout, test } from "bun:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newWorld, openPage, roundAt, T, type Page } from "./harness";

setDefaultTimeout(60_000);
const PUB = join(import.meta.dir, "../public");
let open: Page[] = [], temps: string[] = [];
afterEach(async () => { for (const p of open) await p.close(); open = []; for (const t of temps) rmSync(t, { recursive: true, force: true }); temps = []; });
function mutated(file: string, from: string, to: string): string {
  const src = readFileSync(join(PUB, file), "utf8"); const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`break check: "${from.slice(0, 60)}" occurs ${n} times in ${file}, expected exactly 1`);
  const dir = mkdtempSync(join(tmpdir(), "pub141c-")); temps.push(dir); cpSync(PUB, dir, { recursive: true }); writeFileSync(join(dir, file), src.replace(from, () => to)); return dir;
}
const CLEAN_MS = 4102444800001;
async function consoleFor(id: string, o: { settings?: Record<string, unknown>; over?: Record<string, unknown>; clean?: boolean; people?: unknown[]; pub?: string } = {}) {
  const w = newWorld(); w.world.now = T;
  const s = await w.json(await w.api("POST", "/api/start", { email: "boss@acme.com" }));
  expect((await w.api("POST", "/api/z", { id, startRound: roundAt(T) + 1200, callSeconds: 20, cap: 100, ...(o.over ?? {}) }, s.aiKey)).status).toBe(200);
  if (o.settings) expect((await w.api("PATCH", `/api/z/${id}/settings`, o.settings, s.token)).status).toBe(200);
  if (o.people) expect((await w.api("POST", `/api/z/${id}/people`, { people: o.people }, s.token)).status).toBe(200);
  if (o.clean) w.world.raw.prepare("UPDATE engagement SET created_ms=? WHERE id=?").run(CLEAN_MS, id);
  const p = await openPage(w.world, { url: `http://localhost/zc.html?e=${id}`, html: "zc.html", scripts: ["zgame.js", "zc.js"], session: { "cbz-org": s.token }, pub: o.pub });
  open.push(p); await p.waitFor((x) => /Check and publish/.test(x), 20000);
  return { p, w, s };
}
const openStep = async (p: Page, n: number, until: RegExp) => { p.click(`.zc-sech[data-open="${n}"]`); await p.waitFor((x) => until.test(x), 20000); return p.text(); };
const DASH = "Dashes and spaces are ignored";
/** Opens the step that holds "My people" and the Paste from Excel box. */
async function openPaste(p: Page) {
  for (const n of [6, 5, 7, 4, 3]) { p.click(`.zc-sech[data-open="${n}"]`); await new Promise((r) => setTimeout(r, 400)); if (p.$('[data-mode="paste"]')) break; }
  if (!p.$('[data-mode="paste"]')) throw new Error("no My people box found; page says: " + p.text().slice(0, 600));
  p.click('[data-mode="paste"]'); await p.waitFor((x) => /Paste one person per line/.test(x), 10000);
}

describe("item 2 + 5: step 2 of the old console", () => {
  const seen = async (id: string, o: Parameters<typeof consoleFor>[1]) => { const { p } = await consoleFor(id, o); const t = await openStep(p, 2, /How many players/); return { t, radio: !!p.$('[data-ck="idk"]') }; };
  test("'Which ID?' is shown only when a person must give an ID (not for 'Mobile number')", async () => {
    expect((await seen("CON-MOB", {})).radio).toBe(false);
    expect((await seen("CON-ID", { settings: { verify: "id" } })).radio).toBe(true);
    expect((await seen("CON-BOTH", { settings: { verify: "both" } })).radio).toBe(true);
    expect((await seen("CON-MOB", {})).t).not.toContain("Which ID?");
  });
  test("'Dashes and spaces are ignored' appears only for a game the server reads the new way (idClean)", async () => {
    expect((await seen("CON-OLD", { settings: { verify: "id" } })).t).not.toContain(DASH);
    expect((await seen("CON-NEW", { settings: { verify: "id" }, clean: true })).t).toContain(DASH);
    expect((await seen("CON-NEW2", { settings: { verify: "id" }, clean: true })).t).toContain("Your list has an employee ID for each person.");
  });
  test("DELIBERATE BREAK: promising dashes ignored without asking the server is caught", async () => {
    const pub = mutated("zc.js", '(S.info && S.info.idClean ? " Dashes and spaces are ignored." : "")', '" Dashes and spaces are ignored."');
    expect((await seen("CON-BR", { settings: { verify: "id" }, pub })).t).toContain(DASH); // the old-reading game now (wrongly) makes the promise: the check above would fail
  });
  test("DELIBERATE BREAK: 'Which ID?' shown for a mobile-number game is caught", async () => {
    const pub = mutated("zc.js", '(f.ver === "mobile" ? "" : grp("idk", "Which ID?"', '(false ? "" : grp("idk", "Which ID?"');
    expect((await seen("CON-BR2", { pub })).radio).toBe(true);
  });
});

describe("the other words of the old console follow the game's kind of ID", () => {
  test("an Email ID game: the template columns in the PDF help and the CSV file help say Email ID, not employee ID", async () => {
    const { p } = await consoleFor("CON-EM1", { settings: { verify: "id", idKind: "email" }, over: {} });
    await openPaste(p);
    p.click('[data-mode="file"]'); await p.waitFor((x) => /Choose a CSV file/.test(x), 10000);
    expect(p.text()).toMatch(/Choose a CSV file: name, mobile number, Email ID/);
    p.click('[data-mode="pdf"]'); await p.waitFor((x) => /Save as, PDF/.test(x), 10000);
    expect(p.text()).toContain("Name, Mobile (optional), Email ID");
    expect(p.text()).not.toMatch(/Fill it in \([^)]*Employee ID/);
  });
  // PB-5b (fixed in 1.4.1 round 2): for "both" (mobile number and ID) the paste help is still the fixed words "name, mobile number, employee ID", whatever kind of ID the game asks for.
  test("an Email ID game that asks for mobile AND ID: the paste help says Email ID", async () => {
    const { p } = await consoleFor("CON-EM3", { settings: { verify: "both", idKind: "email" } });
    await openPaste(p);
    expect(p.text()).toMatch(/Paste one person per line: name, mobile number, Email ID/);
  });
  // PB-5 (fixed in 1.4.1 round 2): the "id" paste line is a plain "..." string that still holds the text ${idLow()}, so the organizer reads the code, not the word.
  test("the paste help of an Employee ID game reads 'name, employee ID', never a raw ${...}", async () => {
    const { p } = await consoleFor("CON-EM2", { settings: { verify: "id" } });
    await openPaste(p);
    expect(p.text()).not.toContain("${");
    expect(p.text()).toMatch(/Paste one person per line: name, employee ID/);
  });
});

describe("item 10 (console): the add-people summary names the duplicates (up to five)", () => {
  test("paste three spellings of one employee ID: '2 duplicates removed' with their names", async () => {
    const { p } = await consoleFor("CON-DU1", { settings: { verify: "id" }, clean: true });
    await openPaste(p);
    const ta = p.$("#rosterTxt"); ta.value = "Asha Rao, 1B-678\nBala Nair, 1b 678\nChitra Das, 1B/678\nDev Roy, E9"; ta.dispatchEvent(new p.win.Event("input", { bubbles: true }));
    p.click("#rosterGo"); await p.waitFor((x) => /duplicate/.test(x), 20000);
    const t = p.$("#cleansum").textContent;
    expect(t).toMatch(/2 good, 2 duplicates removed/);
    expect(t).toContain("1B678"); expect(t).toContain("1B/678"); // 1.4.1 round 2: each duplicate is named by the ID as typed (the console shows it with the cleaner's case and spacing)
  });
  test("DELIBERATE BREAK: dropping the names from the summary is caught", async () => {
    const pub = mutated("zc.js", 'for (const x of r.duplicateRows || []) dupNames.push(String(x.raw || "").slice(0, 60));', "");
    const { p } = await consoleFor("CON-DU2", { settings: { verify: "id" }, clean: true, pub });
    await openPaste(p);
    const ta = p.$("#rosterTxt"); ta.value = "Asha Rao, 1B-678\nBala Nair, 1b 678"; ta.dispatchEvent(new p.win.Event("input", { bubbles: true }));
    p.click("#rosterGo"); await p.waitFor((x) => /duplicate/.test(x), 20000);
    expect(p.$("#cleansum").textContent).not.toContain("Bala Nair");
  });
});

describe("item 6: 'Ends when N players are home' is true", () => {
  test("the console duration line, race game: 'as soon as 5 players are home', and the 60-turn cap is named", async () => {
    const { p } = await consoleFor("CON-RC1");
    const t = await openStep(p, 2, /How many players/);
    expect(t).toContain("A game lasts at most 20 minutes (60 turns of 20 seconds)");
    expect(t).toContain("It ends sooner, as soon as 5 players are home. Whatever happens, it stops after 60 turns.");
    expect(t).toContain("The game ends when this many players are home");
  });
  test("the console duration line, team game: 'the first whole team is home', never a player count; label follows", async () => {
    const { p } = await consoleFor("CON-TM1", { over: { mode: "team", teams: 3 } });
    const t = await openStep(p, 2, /How many players/);
    expect(t).toContain("It ends sooner, as soon as the first whole team is home. Whatever happens, it stops after 60 turns.");
    expect(t).not.toMatch(/as soon as \d+ players? (is|are) home/);
    expect(t).toContain("The game ends when the first whole team is home");
  });
  // PB-3b (fixed in 1.4.1 round 2): the help line under that choice (zc.js:246, a fixed text) still says "this many players" in a team game.
  test("the help line under the choice does not say 'this many players are home' in a team game", async () => {
    const { p } = await consoleFor("CON-TM3", { over: { mode: "team", teams: 3 } });
    const t = await openStep(p, 2, /How many players/);
    expect(t).not.toContain("The game ends when this many players are home.");
  });
  test("the cap follows the setting (a 30-turn game says 30 turns and 10 minutes)", async () => {
    const { p } = await consoleFor("CON-RC2", { over: { turnCap: 30 } });
    const t = await openStep(p, 2, /How many players/);
    expect(t).toContain("at most 10 minutes (30 turns of 20 seconds)"); expect(t).toContain("it stops after 30 turns");
  });
  test("DELIBERATE BREAK: the old line (no team rule, no cap) is caught", async () => {
    const pub = mutated("zc.js", '${f.gm === "team" ? "the first whole team is" : ep + (ep === 1 ? " player is" : " players are")} home. Whatever happens, it stops after ${tc} turns.', '${ep} ${ep === 1 ? "player is" : "players are"} home.');
    const { p } = await consoleFor("CON-TM2", { over: { mode: "team", teams: 3 }, pub });
    const t = await openStep(p, 2, /How many players/);
    expect(t).not.toContain("the first whole team is home. Whatever happens");
  });
  // z.js: the player chip. The template line is run as it stands in the page (no game needed), with the numbers a running game gives it.
  const chipOf = (src: string) => { const m = /const turnChip = (`[\s\S]*?`);/.exec(src); if (!m) throw new Error("turnChip line not found"); return new Function("v", "turnNo", "return " + m[1]!) as (v: any, n: number) => string; };
  const plain = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&middot;/g, "·").replace(/\s+/g, " ").trim();
  test("the player chip: race 'Turn 3 of 60 · ends sooner when 5 players are home' (1 player: 'player is'), team 'the first whole team is home', table 'Turn 3 of 60'", () => {
    const chip = chipOf(readFileSync(join(PUB, "z.js"), "utf8"));
    expect(plain(chip({ kind: "race", turnCap: 60, endPrizes: 5 }, 3))).toBe("Turn 3 of 60 · ends sooner when 5 players are home");
    expect(plain(chip({ kind: "race", turnCap: 40, endPrizes: 1 }, 3))).toBe("Turn 3 of 40 · ends sooner when 1 player is home");
    expect(plain(chip({ kind: "team", turnCap: 60, endPrizes: 5 }, 3))).toBe("Turn 3 of 60 · ends sooner when the first whole team is home");
    expect(plain(chip({ kind: "table", turnCap: 60, endPrizes: 5 }, 3))).toBe("Turn 3 of 60");
  });
  test("DELIBERATE BREAK: the old chip (no cap, team shown with a player count) is caught", () => {
    const old = (v: any, n: number) => v.kind === "table" ? `Turn ${n} of ${v.turnCap}` : `Turn ${n} &middot; ends when ${v.endPrizes} ${v.endPrizes === 1 ? "player is" : "players are"} home`;
    expect(plain(old({ kind: "team", turnCap: 60, endPrizes: 5 }, 3))).not.toBe("Turn 3 of 60 · ends sooner when the first whole team is home");
  });
  // PB-3 (fixed in 1.4.1 round 2): the projector page big.js still says "ends when N players are home" (no cap, no team rule) for the same games.
  test("the projector page (big.js) tells the same true thing as the phone: team games say the first whole team, and the turn cap is shown", () => {
    const big = readFileSync(join(PUB, "big.js"), "utf8");
    expect(big).toContain("first whole team");
    expect(big).toMatch(/ends sooner/);
  });
});

describe("PB-4: an Email ID game is still an Email ID game when the console is opened again", () => {
  // PB-4 (fixed in 1.4.1 round 2): zc.js built its settings (S.cfg) from the server record but left idKind out, so the form showed 'Employee ID' and a plain "Save" in step 2 sent idKind "emp" back,
  // which the new lock refuses with 'You already have people listed...'. The organizer changed nothing.
  test("Email game with a listed person: step 2 shows Email ID chosen and Save works", async () => {
    const { p, w } = await consoleFor("CON-P4A", { settings: { verify: "id", idKind: "email" }, people: [{ name: "Asha", empId: "a@x.com" }] });
    const t = await openStep(p, 2, /Which ID/);
    expect(t).toContain("Your list has an Email ID for each person.");
    p.click('[data-save="2"]'); await new Promise((r) => setTimeout(r, 2500));
    expect(p.text()).not.toContain("already have people listed");
    void w;
  });
});
