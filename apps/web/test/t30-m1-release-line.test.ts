// TEST_HANDOFF Milestone 1, item 3: release-line.js writes "Version 1.4.0" (no date while releasedAtIST starts with "pending"); with a real IST string it adds ", released <IST> IST"; a failed fetch shows nothing and no error.
// The real release-line.js runs in a DOM with a stand-in fetch.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

const PUB = join(import.meta.dir, "../public");
const CODE = readFileSync(join(PUB, "release-line.js"), "utf8");
const REAL = JSON.parse(readFileSync(join(PUB, "release.json"), "utf8"));
const tick = () => new Promise((r) => setTimeout(r, 15));

async function run(fetchImpl: (u: string, init?: any) => Promise<any>, html = '<body><main>x</main><footer><p id="relline"></p></footer></body>') {
  const win: any = new Window({ url: "https://snakes.test/" });
  win.document.write(html);
  const errors: string[] = [], asked: string[] = [];
  win.addEventListener("error", (e: any) => errors.push(String(e?.message ?? e)));
  win.addEventListener("unhandledrejection", (e: any) => errors.push(String(e?.reason?.message ?? e?.reason ?? e)));
  win.fetch = (u: string, init?: any) => { asked.push(String(u)); return fetchImpl(u, init); };
  new Function("window", `with (window) { ${CODE}\n}`).call(win, win);
  await tick(); await tick();
  const line = (win.document.getElementById("relline")?.textContent ?? "") as string;
  const foot = (win.document.querySelector("footer")?.textContent ?? "") as string;
  await win.happyDOM.close();
  return { line, foot, errors, asked };
}
const ok = (j: unknown) => async () => ({ ok: true, json: async () => j });

describe("release-line.js writes the version line into the footer", () => {
  test("a release.json whose date starts with 'pending' gives exactly 'Version 1.4.0' (no date, no 'released')", async () => {
    const r = await run(ok({ version: "1.4.0", releasedAtIST: "pending (set by the boss at release)" }));
    expect(r.line).toBe("Version 1.4.0"); expect(r.line).not.toContain("released"); expect(r.line).not.toContain("IST"); expect(r.errors).toEqual([]);
  });
  test("a real IST string gives 'Version 1.4.0, released <IST> IST'", async () => {
    const r = await run(ok({ version: "1.4.0", releasedAtIST: "31 Oct 2026, 10:15" }));
    expect(r.line).toBe("Version 1.4.0, released 31 Oct 2026, 10:15 IST");
  });
  test("a missing date gives the version only", async () => { expect((await run(ok({ version: "1.4.0" }))).line).toBe("Version 1.4.0"); expect((await run(ok({ version: "1.4.0", releasedAtIST: "" }))).line).toBe("Version 1.4.0"); });
  test("the version shown is the version in the file (not a fixed text)", async () => { expect((await run(ok({ version: "9.8.7", releasedAtIST: "pending" }))).line).toBe("Version 9.8.7"); });
  test("the word 'pending' only at the START hides the date: 'not pending' is a date", async () => { expect((await run(ok({ version: "1.4.0", releasedAtIST: "was pending, now 1 Nov" }))).line).toBe("Version 1.4.0, released was pending, now 1 Nov IST"); });
  test("a failed fetch (network error) shows nothing in the line and raises no error", async () => {
    const r = await run(async () => { throw new Error("offline"); }); expect(r.line).toBe(""); expect(r.errors).toEqual([]);
  });
  test("a page that is not JSON (HTML error page) shows nothing and raises no error", async () => {
    const r = await run(async () => ({ ok: true, json: async () => { throw new SyntaxError("Unexpected token <"); } })); expect(r.line).toBe(""); expect(r.errors).toEqual([]);
  });
  test("no #relline slot: a line is added to the footer; with a slot the slot is used and not duplicated", async () => {
    const noSlot = await run(ok({ version: "1.4.0", releasedAtIST: "pending" }), "<body><footer><span>kit</span></footer></body>");
    expect(noSlot.foot).toContain("Version 1.4.0");
    const slot = await run(ok({ version: "1.4.0", releasedAtIST: "pending" })); expect(slot.foot.match(/Version 1\.4\.0/g)).toHaveLength(1);
  });
  test("it asks only for /release.json (nothing personal, no other address)", async () => { const r = await run(ok({ version: "1.4.0" })); expect(r.asked).toEqual(["/release.json"]); });
  test("the shipped release.json is version 1.4.0 and still pending (the boss sets the date at release)", () => { expect(REAL.version).toBe("1.4.0"); expect(String(REAL.releasedAtIST).startsWith("pending")).toBe(true); });
});
