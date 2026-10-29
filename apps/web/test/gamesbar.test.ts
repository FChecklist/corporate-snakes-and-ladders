// The Corporate Games bar (one shared component; its two files are pinned byte for byte in brand-kit.test.ts): every PUBLIC page loads gamesbar.js (not the play, console, pay, sign-in or report pages);
// the bar shows the six games and the home mark, Snakes and Ladders is current, it mounts right after the page's skip link, and the small CORPORATE line is at least 12.5 px.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const pub = (f: string) => readFileSync(new URL("../public/" + f, import.meta.url), "utf8");
const PUBLIC = ["index", "how-it-works", "about", "contact", "legal", "terms", "privacy", "refund-policy", "dpa", "subprocessors", "partner", "partner-terms", "organizer-guide", "pricing", "brochure", "trust", "404"];
const NOT_PUBLIC = ["z", "zc", "big", "preview", "pay", "paylink", "paytest", "report", "signin", "demo", "owner-visits", "ai-link"];
const GAMES = [["https://housie.corporatetambola.com/", "Corporate Tambola"], ["https://bingo.corporatetambola.com/", "Corporate Bingo"], ["https://tictactoe.corporatetambola.com/", "Corporate Tic Tac Toe"], ["https://snakes.corporatetambola.com/", "Corporate Snakes and Ladders"], ["https://luck.corporatetambola.com/", "Corporate Luck by Chance"], ["https://home.corporatetambola.com/contact", "Corporate Lucky Draw"]];

describe("the Corporate Games bar", () => {
  test("every public page loads it, no play / console / pay page does, and the build ships it", () => {
    for (const p of PUBLIC) expect([p, pub(p + ".html").includes('src="/gamesbar.js?v=2"')]).toEqual([p, true]);
    for (const p of NOT_PUBLIC) expect([p, pub(p + ".html").includes("gamesbar")]).toEqual([p, false]);
    const b = readFileSync(new URL("../../../pages/build.mjs", import.meta.url), "utf8"); expect(b).toContain('"gamesbar.js"'); expect(b).toContain('"gamesbar.css"');
  });
  test("the bar has the home mark and the six games, Snakes and Ladders is current, it sits right after the skip link, the colours and focus are as ordered, and it never links the old hub", async () => {
    const w = new Window({ url: "https://snakes.corporatetambola.com/how-it-works.html" }); const d = w.document;
    d.body.innerHTML = '<a class="ck-skip" href="#main">Skip to the content</a><header>menu</header><main id="main">page</main>'; d.head.innerHTML = "";
    const run = () => new Function("window", "document", "with (window) {" + pub("gamesbar.js") + "}").call(w, w, w.document);
    run();
    const bar = d.querySelector(".cgb")!; const kids = [...d.body.children].map((e: any) => e.tagName + "." + e.className);
    expect(kids[0]).toBe("A.ck-skip"); expect(d.body.children[2]).toBe(bar); // the skip link is still the very first Tab stop; the sprite and the bar come after it
    expect([...bar.querySelectorAll(".cgb-row a")].map((a: any) => [a.href, a.textContent.trim().replace(/\s+/g, " ")])).toEqual(GAMES);
    expect((bar.querySelector("a.cgb-home") as any).href).toBe("https://home.corporatetambola.com/"); expect(bar.querySelector(".cgb-line")!.textContent).toBe("Close group online engagement");
    const cur = [...bar.querySelectorAll(".cgb-row [aria-current]")]; expect(cur.length).toBe(1); expect((cur[0] as any).href).toBe("https://snakes.corporatetambola.com/"); expect((cur[0] as any).getAttribute("aria-current")).toBe("true"); // "true" on the site's other pages, "page" on its front page
    expect(bar.querySelector(".cgb-sheet-title")!.textContent).toBe("Choose a game for your close group");
    expect(d.head.querySelector('link[href^="/gamesbar.css"]')).toBeTruthy();
    run(); expect(d.querySelectorAll(".cgb").length).toBe(1); // loading it twice adds nothing
    const css = pub("gamesbar.css"); expect(css).toContain("#1B1442"); expect(css).toContain("min-height:44px"); expect(css).toContain(":focus-visible"); expect(css).toContain("#FFC93C"); expect(css).toContain("12.5px");
    expect(pub("gamesbar.js") + css).not.toMatch(/games\.corporatetambola\.com|priv[a]te/i);
  });
  test("on its front page the bar marks the link as the page you are on", () => {
    const w = new Window({ url: "https://snakes.corporatetambola.com/" }); const d = w.document; d.body.innerHTML = "<main>x</main>"; d.head.innerHTML = "";
    new Function("window", "document", "with (window) {" + pub("gamesbar.js") + "}").call(w, w, w.document);
    expect((d.querySelector('.cgb-row a[data-game="snakes"]') as any).getAttribute("aria-current")).toBe("page");
  });
});
