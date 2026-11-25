// The guided path (/ai/<key>/go/...) must end in a draft the server accepts. This test plays an outside AI: it opens only links it was given, follows the choices the organizer would pick,
// and at the end reads the saved game back. (The guided path used to build a game from the bingo game's prizes and speeds, which this game refuses.)
import { beforeEach, describe, expect, test } from "bun:test";
import { withDevice } from "./device";
import { handle, type Env } from "../src/worker";
import type { PayEnv } from "../src/pay";
import { makeD1 } from "./d1-sqlite";

const T = Date.UTC(2026, 9, 1, 10, 0, 0); // Thu 1 Oct 2026, 15:30 India time
const ORIGIN = "https://bingo.test";
let env: PayEnv; let raw: ReturnType<typeof makeD1>["raw"];
const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
  handle(new Request("http://x" + path, { method, headers: { "content-type": "application/json", ...headers }, body: withDevice(method, path, body) }), env as Env, T);
const j = async (r: Response) => (await r.json()) as any;
beforeEach(() => { const d = makeD1(); raw = d.raw; env = { DB: d.db, ORGANIZER_SECRET: "plat", RUNNER_KEY: "test-runner-key-test-runner-key-test0000", DAILY_WRITE_BUDGET: "100000", PUBLIC_ORIGIN: ORIGIN, DATA_KEY: "test-data-key" }; });
async function organizer() { const x = await j(await call("POST", "/api/start", { email: "boss@acme.com" }, { "cf-connecting-ip": "1.1.1.1" })); return { key: x.aiKey as string, token: x.token as string, base: `${ORIGIN}/ai/${x.aiKey}` }; }
const open = async (url: string) => { const u = new URL(url); const r = await call("GET", u.pathname + u.search); return { status: r.status, text: await r.text() }; };
type Choice = { n: number; label: string; url: string };
const choicesOf = (t: string): Choice[] => { const out: Choice[] = []; const lines = t.split("\n"); for (let i = 0; i < lines.length; i++) { const m = /^(\d+)\. (.*?)(  \(recommended\))?$/.exec(lines[i]!); const l = /^\s+LINK: (\S+)$/.exec(lines[i + 1] ?? ""); if (m && l) out.push({ n: Number(m[1]), label: m[2]!, url: l[1]! }); } return out; };
const given = new Set<string>();
async function pick(from: string, label: RegExp) {
  const cs = choicesOf(from); for (const c of cs) given.add(c.url);
  const c = cs.find((x) => label.test(x.label)); if (!c) throw new Error(`no choice matching ${label} in:\n${from}`);
  expect(given.has(c.url)).toBe(true); expect(c.url.length).toBeLessThan(250);
  const r = await open(c.url); expect(r.status).toBe(200); return r.text;
}
const FORBIDDEN = /guest|ticket|\bhosts?\b|co-host|participant|engagement|nickname|\b(my|mine|your|yours)\b|\bcards?\b|\bevents?\b|Rajat|Agarwal/i;

describe("the guided path ends in a draft this game accepts", () => {
  test("new game: zone, day, time, occasion, size, how it plays, gifts, extras, read-back, save; then the saved game is read back", async () => {
    const o = await organizer(); given.clear();
    let t = (await open(`${o.base}/go`)).text; expect(t).toMatch(/Start a new game/);
    t = await pick(t, /Start a new game/); t = await pick(t, /India time/); t = await pick(t, /Tomorrow/); t = await pick(t, /4 pm/); t = await pick(t, /Diwali/); t = await pick(t, /Up to 250/);
    expect(t).toMatch(/10 second window/); expect(t).toMatch(/by themselves/); expect(t).toMatch(/employee ID/);
    t = await pick(t, /Looks good/); expect(t).toMatch(/Milestone/);
    t = await pick(t, /Milestone and the first five home/); t = await pick(t, /No lucky draw/);
    expect(t).toMatch(/Nothing has been saved yet/); expect(t).toMatch(/10 second window/); expect(t).toMatch(/Pay now in the console/);
    const review = t; t = await pick(t, /Yes, save/);
    expect(t).toMatch(/The draft is saved/); expect(t).not.toMatch(/I could not save it/);
    const id = /Its code is ([A-Za-z0-9_-]+)\./.exec(t)![1]!;
    const s = await j(await call("GET", `/ai/${o.key}/z/${id}/summary`));
    expect(s.status).toBe("draft"); expect(s.limit).toBe(250); expect(s.callSeconds).toBe(10); expect(s.tickets).toBe(1); expect(s.rounds).toBe(1);
    expect(s.rewards.map((r: any) => `${r.pattern}#${r.ordinal}`)).toEqual(["milestone#1", "finish#1", "finish#2", "finish#3", "finish#4", "finish#5"]);
    for (const text of [review, t]) expect([text.match(FORBIDDEN)?.[0] ?? null]).toEqual([null]); // the words the organizer reads
  });
  test("the other gift bundles and the lucky draw also save", async () => {
    const o = await organizer(); given.clear();
    let t = await pick((await open(`${o.base}/go`)).text, /Start a new game/); t = await pick(t, /India time/); t = await pick(t, /Tomorrow/); t = await pick(t, /4 pm/); t = await pick(t, /Team gathering/); t = await pick(t, /Up to 100/); t = await pick(t, /Looks good/);
    t = await pick(t, /biggest climb and comeback/); t = await pick(t, /Add one lucky draw/); expect(t).toMatch(/lucky draw/i);
    t = await pick(t, /Yes, save/); expect(t).toMatch(/The draft is saved/);
    const id = /Its code is ([A-Za-z0-9_-]+)\./.exec(t)![1]!; const s = await j(await call("GET", `/ai/${o.key}/z/${id}/summary`));
    expect(s.rewards.map((r: any) => r.pattern)).toEqual(["milestone", "finish", "finish", "finish", "finish", "finish", "climb", "comeback"]); expect(s.breaks.map((b: any) => b.kind)).toEqual(["lucky"]);
  });
  test("a bigger board can be chosen, and it is the board of the saved game; the simple gift bundle saves too", async () => {
    const o = await organizer(); given.clear();
    let t = await pick((await open(`${o.base}/go`)).text, /Start a new game/); t = await pick(t, /India time/); t = await pick(t, /Tomorrow/); t = await pick(t, /4 pm/); t = await pick(t, /Holiday party/); t = await pick(t, /Up to 500/);
    t = await pick(t, /Use a board of 144 squares/); expect(t).toMatch(/board of 144 squares/); expect(t).not.toMatch(/the usual one/); t = await pick(t, /Looks good/); t = await pick(t, /Milestone and the first home/); t = await pick(t, /No lucky draw/);
    expect(t).toMatch(/board of 144 squares/); t = await pick(t, /Yes, save/); expect(t).toMatch(/The draft is saved/);
    const id = /Its code is ([A-Za-z0-9_-]+)\./.exec(t)![1]!; const cfg = JSON.parse((raw.prepare("SELECT config FROM engagement WHERE id=?").get(id) as any).config);
    expect(cfg.board).toEqual({ size: 144, snakes: 9, ladders: 9, finish: "exact" }); expect(cfg.rewards.map((r: any) => `${r.pattern}#${r.ordinal}`)).toEqual(["milestone#1", "finish#1"]);
  });
  test("the screens after saving say who does what: publish by the organizer, paying with Pay now, and the AI never pays", async () => {
    const o = await organizer(); given.clear();
    let t = await pick((await open(`${o.base}/go`)).text, /Start a new game/); t = await pick(t, /India time/); t = await pick(t, /Tomorrow/); t = await pick(t, /4 pm/); t = await pick(t, /Corporate gathering/); t = await pick(t, /Up to 100/); t = await pick(t, /Looks good/); t = await pick(t, /Milestone and the first five home/); t = await pick(t, /No lucky draw/); t = await pick(t, /Yes, save/);
    expect(t).toMatch(/Pay now in the console/); expect(t).toMatch(/I never pay/); expect(t).toMatch(/pre-game, winner and closing messages/); expect(t.match(FORBIDDEN)?.[0] ?? null).toBeNull();
    const id = /Its code is ([A-Za-z0-9_-]+)\./.exec(t)![1]!;
    const menu = (await open(`${o.base}/go/game?id=${id}`)).text; expect(menu).toMatch(/Publish \(free\)/); expect(menu.match(FORBIDDEN)?.[0] ?? null).toBeNull(); expect(menu).toMatch(/Delete all player data now/); expect(menu).toMatch(/Add a co-organizer/);
    const helper = (await open(`${o.base}/go/helper?id=${id}`)).text; expect(helper).toMatch(/co-organizer/); expect(helper.match(FORBIDDEN)?.[0] ?? null).toBeNull();
    const links = (await open(`${o.base}/go/links?id=${id}`)).text; expect(links).toMatch(/Console: /); expect(links).not.toMatch(/undefined/); expect(links.match(FORBIDDEN)?.[0] ?? null).toBeNull();
    const hello = (await open(`${o.base}/go`)).text; expect(hello.match(FORBIDDEN)?.[0] ?? null).toBeNull();
    expect(raw.prepare("SELECT COUNT(*) AS c FROM payment").get()).toEqual({ c: 0 });
  });
});
