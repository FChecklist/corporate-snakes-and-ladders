// LATE MOVE on the player's page: when the server says "late-move" the plain message is shown, the Throw button stays off for that turn, and the message goes away with the next turn.
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
describe("late move: the player's page", () => {
  test("the runtime remembers why a throw was refused and never retries a late one", () => {
    const rt = read("../../../packages/beacon/src/phone-runtime.ts");
    expect(rt).toContain("lastThrowRefusal");
    expect(rt).toMatch(/code === "late-move"\) this\.pingedTurns\.add\(t\.index\)/);
  });
  test("the page shows the server's message, switches the button off for that turn, and drops the message on the next turn", () => {
    const z = read("../public/z.js");
    expect(z).toMatch(/lr\.code === "late-move"[\s\S]{0,200}THROW\.lateTurn = lr\.turn[\s\S]{0,200}THROW\.note = lr\.message/);
    expect(z).toMatch(/canThrow = [^;]*THROW\.lateTurn !== t\.index/);
    expect(z).toMatch(/if \(THROW\.turn !== t\.index\) \{ THROW\.note = ""/);
  });
  test("the zgame.js bundle carries the runtime change", () => { expect(read("../public/zgame.js")).toContain("lastThrowRefusal"); });
});
