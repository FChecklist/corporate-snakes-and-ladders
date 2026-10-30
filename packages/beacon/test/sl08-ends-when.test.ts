// SL-08 (gap plan 2026-10-29): "Turn 14 of 60 but the game ended at turn ~14". The phone must be told how the game really ends (when N players are home), not only the turn cap.
// The real PhoneRuntime view carries `endPrizes`; the pages (z.js phone, big.js projector) say "ends when N players are home" for race and team games.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { PhoneRuntime } from "../src/phone-runtime";

const viewFor = async (extra: Record<string, unknown>) => {
  const mem = new Map<string, string>();
  const rt = new PhoneRuntime("SL-8", {
    api: async () => ({ cap: 100, startRound: 1_000_000, callSeconds: 20, ...extra }),
    beacon: { fetcher: (async () => ({ ok: false, status: 404, json: async () => ({}) })) as any, mirrors: ["https://a.t"], timeoutMs: 50 },
    mono: () => 0, store: { get: (k: string) => mem.get(k) ?? null, set: (k: string, v: string) => void mem.set(k, v) }, verify: () => true,
  } as any);
  await rt.boot();
  return rt.view();
};

describe("SL-08: the phone knows when the game ends", () => {
  test("the view carries the number of players that end the game: 5 by default, the organizer's choice when set", async () => {
    expect((await viewFor({})).endPrizes).toBe(5);
    expect((await viewFor({ endPrizes: 2 })).endPrizes).toBe(2);
  });
  test("the phone and projector pages show 'ends when N players are home' for race games and never 'Turn x of 60' for them", () => {
    const pub = (f: string) => readFileSync(new URL("../../../apps/web/public/" + f, import.meta.url), "utf8");
    const z = pub("z.js"), big = pub("big.js");
    expect(z).toContain("ends sooner when ${v.kind === \"team\" ? \"the first whole team is\" : v.endPrizes"); // 1.4.1 item 6: the phone chip also names the turn cap and the team rule (behaviour: apps/web/test/audit141-console.test.ts)
    expect(big).toContain("ends sooner when ${v.kind === \"team\" ? \"the first whole team is\" : v.endPrizes"); // 1.4.1 round 2: the projector says the same as the phone (turn cap + team rule)
    expect(z).not.toMatch(/Turn \$\{turnNo\} of \$\{v\.turnCap\}`\}?<\/span>`;\s*\/\/ SL-08/);
    expect(big).not.toMatch(/Turn \$\{Math\.min\(v\.turnsPlayed \+ \(v\.ended \? 0 : 1\), v\.turnCap\)\} of at most \$\{v\.turnCap\}`;/);
  });
});
