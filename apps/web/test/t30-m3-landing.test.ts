// TEST_HANDOFF Milestone 3: the landing page shows the brand-kit header (six menu items), theme dots, a Menu button, the kit footer with a Version line; the old header (.snav) is gone; menu and footer links go to this site's own pages.
// Static checks on the real index.html plus the real brandkit.js running in a DOM.
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

const PUB = join(import.meta.dir, "../public");
const HTML = readFileSync(join(PUB, "index.html"), "utf8");
const KIT = readFileSync(join(PUB, "brandkit.js"), "utf8");
const doc = (html = HTML) => { const win: any = new Window({ url: "https://snakes.test/", settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } }); win.document.write(html.replace(/<script[\s\S]*?<\/script>/g, "")); return win; };

describe("landing: kit header", () => {
  const win = doc(), d = win.document;
  test("the main menu has exactly the six items, in order, with the right links", () => {
    const links = [...d.querySelectorAll("#ck-nav > a")].map((a: any) => [a.textContent.trim(), a.getAttribute("href")]);
    expect(links).toEqual([["How it works", "/#how"], ["Free demo game", "/demo.html"], ["Guide", "/organizer-guide.html"], ["Brochure", "/brochure.html"], ["Refer & earn", "/partner.html"], ["Log in", "/zc.html"]]);
  });
  test("three theme dots (blue, maroon, emerald) with labels; blue is pressed at first", () => {
    const dots = [...d.querySelectorAll(".ck-dots button")]; expect(dots.map((b: any) => b.getAttribute("data-t"))).toEqual(["blue", "maroon", "emerald"]);
    for (const b of dots) expect(String((b as any).getAttribute("aria-label")).length).toBeGreaterThan(3);
    expect(dots.map((b: any) => b.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"]);
  });
  test("a Menu button controls the nav (aria-controls, aria-expanded false at first)", () => {
    const m = d.getElementById("ck-menu"); expect(m.textContent.trim()).toBe("Menu"); expect(m.getAttribute("aria-controls")).toBe("ck-nav"); expect(m.getAttribute("aria-expanded")).toBe("false");
  });
  test("the old header is gone: no .snav element anywhere in the page or in its styles", () => { expect(d.querySelector(".snav") === null).toBe(true); expect(/class="[^"]*\bsnav\b/.test(HTML)).toBe(false); expect(d.querySelectorAll("header.ck-top").length).toBe(1); expect(d.querySelectorAll("nav").length).toBe(1); });
  test("brand name is in the header and links home", () => { const b = d.querySelector(".ck-brand"); expect(b.getAttribute("href")).toBe("/"); expect(b.textContent).toContain("Snakes and Ladders"); });
});

describe("landing: kit header behaviour (the real brandkit.js)", () => {
  function boot() {
    const win = doc(); const d = win.document; win.matchMedia = () => ({ matches: false });
    const store = new Map<string, string>(); Object.defineProperty(win, "localStorage", { value: { setItem: (k: string, v: string) => store.set(k, v), getItem: (k: string) => store.get(k) ?? null }, configurable: true });
    new Function("window", `with (window) { ${KIT}\n}`).call(win, win);
    return { win, d, store };
  }
  test("Menu opens the nav (class open, aria-expanded true, text Close); a second click closes; Escape closes", () => {
    const { win, d } = boot(); const m = d.getElementById("ck-menu"), n = d.getElementById("ck-nav");
    m.click(); expect(n.classList.contains("open")).toBe(true); expect(m.getAttribute("aria-expanded")).toBe("true"); expect(m.textContent).toBe("Close");
    m.click(); expect(n.classList.contains("open")).toBe(false); expect(m.textContent).toBe("Menu");
    m.click(); d.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape" })); expect(n.classList.contains("open")).toBe(false); expect(m.getAttribute("aria-expanded")).toBe("false");
  });
  test("a theme dot sets data-theme on the page, marks only itself pressed, and remembers the choice", () => {
    const { d, store } = boot(); const dots = [...d.querySelectorAll(".ck-dots button")] as any[];
    dots[1].click(); expect(d.documentElement.getAttribute("data-theme")).toBe("maroon"); expect(dots.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"]); expect(store.get("ct-theme")).toBe("maroon");
    dots[2].click(); expect(d.documentElement.getAttribute("data-theme")).toBe("emerald"); expect(dots.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "false", "true"]);
  });
  test("the Dark/Light button flips the mode both ways and says what it will do next", () => {
    const { d } = boot(); const b = d.querySelector("[data-ck-mode]") as any; expect(b.textContent).toBe("Dark");
    b.click(); expect(d.documentElement.getAttribute("data-mode")).toBe("dark"); expect(b.textContent).toBe("Light"); expect(b.getAttribute("aria-pressed")).toBe("true");
    b.click(); expect(d.documentElement.getAttribute("data-mode")).toBe("light"); expect(b.textContent).toBe("Dark");
  });
  test("storage blocked (private window, cleared data) does not stop the buttons", () => {
    const win = doc(); win.matchMedia = () => ({ matches: false }); Object.defineProperty(win, "localStorage", { get() { throw new Error("blocked"); }, configurable: true });
    new Function("window", `with (window) { ${KIT}\n}`).call(win, win); (win.document.querySelectorAll(".ck-dots button")[1] as any).click(); expect(win.document.documentElement.getAttribute("data-theme")).toBe("maroon");
  });
});

describe("landing: kit footer", () => {
  const d = doc().document;
  test("there is a footer with a Version slot (#relline) at the bottom of the page, after the legal text", () => {
    const f = d.querySelector("footer.ck-foot"); expect(f !== null).toBe(true); expect(f.querySelector("#relline") !== null).toBe(true);
    expect(HTML.indexOf('id="relline"')).toBeGreaterThan(HTML.indexOf('class="ck-legal"'));
    expect(HTML.indexOf("</footer>")).toBeGreaterThan(HTML.indexOf('id="relline"'));
  });
  test("the page loads release-line.js and it comes after the footer", () => { expect(HTML.indexOf("/release-line.js")).toBeGreaterThan(HTML.indexOf('id="relline"')); expect(existsSync(join(PUB, "release-line.js"))).toBe(true); });
  test("the footer's 'This site' list repeats the six menu links", () => {
    const hrefs = [...d.querySelectorAll("footer.ck-foot a")].map((a: any) => a.getAttribute("href"));
    for (const h of ["/#how", "/demo.html", "/organizer-guide.html", "/brochure.html", "/partner.html", "/zc.html"]) expect(hrefs).toContain(h);
  });
  test("the legal links go to this site's own pages (relative paths) and every one of those files exists", () => {
    const legal = ["/terms.html", "/privacy.html", "/subprocessors.html", "/dpa.html", "/refund-policy.html"];
    const hrefs = [...d.querySelectorAll("footer.ck-foot a")].map((a: any) => a.getAttribute("href"));
    for (const h of legal) { expect(hrefs).toContain(h); expect(existsSync(join(PUB, h.slice(1)))).toBe(true); }
  });
  test("every menu and footer link that points into this site has a file behind it (no dead page)", () => {
    const own = [...d.querySelectorAll("#ck-nav a, footer.ck-foot a")].map((a: any) => String(a.getAttribute("href"))).filter((h) => h.startsWith("/") && !h.startsWith("//")).map((h) => h.split("#")[0]!.split("?")[0]!);
    for (const h of own) if (h && h !== "/") expect([h, existsSync(join(PUB, h.slice(1)))]).toEqual([h, true]);
  });
});

describe("landing: the old buy box, hero and games bar still exist", () => {
  const d = doc().document;
  test("hero heading, the buy area and the games bar are present", () => {
    expect(d.querySelectorAll("h1").length).toBeGreaterThanOrEqual(1);
    expect(/id="buy"|class="[^"]*\bbuy/i.test(HTML)).toBe(true);
    expect(HTML.toLowerCase()).toContain("gamesbar");
  });
  test("no horizontal-scroll traps: the viewport meta is set and no element has a fixed width wider than 360px in inline styles", () => {
    expect(/<meta name="viewport" content="[^"]*width=device-width/.test(HTML)).toBe(true);
    for (const m of HTML.matchAll(/style="[^"]*\bwidth:\s*(\d+)px/g)) expect(Number(m[1])).toBeLessThanOrEqual(360);
  });
  test("no inline script or inline event handler (the page's content security policy has none to allow)", () => {
    const inline = [...HTML.matchAll(/<script([^>]*)>([^<]*)<\/script>/g)].filter((m) => !/\bsrc=/.test(m[1]!) && !/application\/ld\+json/.test(m[1]!) && m[2]!.trim() !== "");
    expect(inline.length).toBe(0); expect(/\son(click|load|error)=/i.test(HTML)).toBe(false);
  });
});
