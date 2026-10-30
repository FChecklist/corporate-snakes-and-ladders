// The screens for "what a person must give to get in" (mobile / employee ID / both, employees only), the PDF list upload, and the console's hints and tints.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PUB = join(import.meta.dir, "../public");
const read = (f: string) => readFileSync(join(PUB, f), "utf8");
const zc = read("zc.js"), z = read("z.js"), css = read("zc.css");

describe("the console", () => {
  test("step 2 offers 'only my employees' and the three choices; invitations and the open-link choice are hidden once employees only is ticked", () => {
    expect(zc).toContain('bchip("emp", "Only my employees (nobody can invite anyone)")');
    expect(zc).toContain('[["mobile", "Mobile number"], ["id", "Employee ID"], ["both", "Mobile number and employee ID"]]');
    expect(zc).toMatch(/\(f\.emp \? "" : `<span class="zc-lbl zc-sec zc-sub">Who can join<\/span>`/);
    expect(zc).toMatch(/\(f\.emp \? "" : `<span class="zc-lbl zc-sec zc-sub">Guests bringing their own people/);
    expect(zc).toContain("verify: f.ver === \"id\" || f.ver === \"both\" ? f.ver : \"mobile\", employeesOnly: !!f.emp");
  });
  test("every group and every tick box has a small hint line, and the open section is tinted in its own colour", () => {
    expect(zc).toContain("const HINTS = {"); expect(zc).toContain('<span class="zc-hint2">'); expect(css).toContain(".zc-hint2{");
    for (const k of ["emp", "ver", "who", "inv", "ex", "gm", "pl"]) expect(zc).toMatch(new RegExp(`\\b${k}: "`));
    expect(zc).toMatch(/class="zc-secb" id="secb\$\{n\}" style="border-left:5px solid var\(--text-tint-\$\{c\}\);background-color:var\(--bg-tint-\$\{c\}\)"/);
  });
  test("the AI work link and AI prompt boxes are not shown to the organizer or the host", () => {
    expect(zc).toMatch(/function aiStrip\(\) \{\s*return "";/); expect(zc).toMatch(/function aiBlock\(\) \{\s*return "";/);
  });
  test("the people list: an Employee ID column in the sheet, the ID in the rows and in the waiting list, a PDF upload with a preview before anyone is added", () => {
    expect(zc).toContain('["pdf", "Upload a PDF"]'); expect(zc).toContain("vendor/pdfjs/pdf.min.mjs"); expect(zc).toContain('id="pdfgo"'); expect(zc).toContain("found in your PDF");
    expect(zc).toContain('"Name,Mobile," + idLbl() + ",Personal link'); expect(zc).toContain('idLbl = () =>'); expect(zc).toContain('"Employee ID"'); // the sheet header follows the game's kind of ID (1.4.1): "Employee ID" or "Email ID" expect(zc).toContain("p.empId"); expect(zc).toContain("w.empId");
    for (const f of ["pdf.min.mjs", "pdf.worker.min.mjs", "LICENSE.txt"]) expect(existsSync(join(PUB, "vendor/pdfjs", f))).toBe(true);
    expect(readFileSync(join(import.meta.dir, "../../../pages/build.mjs"), "utf8")).toMatch(/\["fonts", "img", "vendor"\]/); // the library is shipped with the site
  });
});

describe("the join screen", () => {
  test("asks for the mobile number, the employee ID or both as the organizer chose, and sends the ID with the join", () => {
    expect(z).toContain("const joinWho = () =>"); expect(z).toContain('id="emp"'); expect(z).toContain("This game is for employees only.");
    expect(z).toMatch(/rt\.join\(J\.phone, J\.name, inviteOf\(\), J\.consent \|\| undefined, J\.emp\)/);
    expect(read("zgame.js")).toContain("need-id"); // the built phone script carries the new join
  });
});
