// Corporate Snakes and Ladders speaks of boards, prizes and players. The guide (apps/web/public/guide.js) was copied from the sister game and still talked about tickets, claims and 'Full House'
// on screens people read (found by the wording review of 2026-10-29). The check-in entries are not on this list: they answer messages of a step this game does not use.
import { describe, expect, setDefaultTimeout, test } from "bun:test";
import { newWorld, openPage } from "./harness";
setDefaultTimeout(30_000);

describe("the guide uses this game's words", () => {
  test("no explanation, step or title talks about tickets, claims or Full House", async () => {
    const w = newWorld({ DATA_KEY: "k" });
    const p = await openPage(w.world, { url: "http://localhost/pricing.html", html: "pricing.html", scripts: ["guide.js"] });
    try {
      const C = p.win.CTG.catalog as { m: string[]; t: string; w: string; d: string[] }[];
      const bad: string[] = [];
      for (const e of C) {
        if (e.m.some((x) => /check-in|check in|4-digit|code shown/i.test(x)) || /check-in|present/i.test(e.t)) continue;
        const text = [e.t, e.w, ...e.d].join(" | ");
        if (/\bticket|\bclaim|full house|housie|tambola|bingo/i.test(text)) bad.push(`${e.t}: ${text.slice(0, 140)}`);
      }
      expect(bad).toEqual([]);
      for (const k of Object.values((p.win.CTG as any).byStatus ?? {}) as any[]) expect(JSON.stringify(k)).not.toMatch(/ticket/i);
    } finally { await p.close(); }
  });
});
