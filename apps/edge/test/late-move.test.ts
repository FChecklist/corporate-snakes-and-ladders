// LATE MOVE (owner rule, 2026-10-27): in a game where players throw, a throw counts only if the server receives it before the turn window ends (the server clock decides).
// After that the server refuses it with code "late-move" and a plain message, and records nothing.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HOUR, T, W, call, dev, j, join, one, q, paidGame, reset, restore, roundMs, startIn } from "./param-harness";

beforeEach(() => reset());
afterEach(restore);
const MSG = "Ohooo! 😊 Sorry, you moved after your turn ended. This move cannot be made.";

async function game(play: "presence" | "fate" = "presence") {
  const g = await paidGame({ cap: 10, over: { play, startRound: startIn(2 * HOUR), callSeconds: 20 } });
  const r = await j(await join(g.id, 1));
  const start = (one("SELECT start_round s FROM engagement WHERE id=?", g.id) as any).s as number;
  const open = roundMs(start + 40); // turn 0 opens GRACE_ROUNDS (40) after the start round; the window is 20 seconds
  const send = (turn: number, at: number, over: Record<string, unknown> = {}) => call("POST", `/api/z/${g.id}/throw`, { pid: r.pid, device: dev(1), turn, ...over }, {}, at);
  return { g, pid: r.pid as string, open, send };
}

describe("late move", () => {
  test("a throw sent while the window is open is accepted and recorded", async () => {
    const { g, open, send } = await game();
    const a = await send(0, open + 5_000); expect(a.status).toBe(200); expect((await j(a)).ok).toBe(true);
    expect(q("SELECT k FROM kv WHERE k LIKE ?", `thr/${g.id}/%`).length).toBe(1);
    const list = await j(await call("GET", `/api/z/${g.id}/throws?from=0&to=3`, undefined, {}, open + 30_000));
    expect(list.throws).toEqual([[1, 0]]);
  });
  test("a throw sent after the window closed is refused with code late-move and the plain message; nothing is recorded", async () => {
    const { g, open, send } = await game();
    const r = await send(0, open + 25_000); const b = await j(r);
    expect(r.status).toBe(409); expect(b.code).toBe("late-move"); expect(b.error).toBe(MSG);
    expect(q("SELECT k FROM kv WHERE k LIKE ?", `thr/${g.id}/%`).length).toBe(0);
    const list = await j(await call("GET", `/api/z/${g.id}/throws?from=0&to=3`, undefined, {}, open + 30_000));
    expect(list.throws).toEqual([]);
  });
  test("the boundary is decided by the server clock: one millisecond before the window ends is on time, the closing millisecond is late", async () => {
    const { open, send } = await game();
    expect((await send(0, open + 20_000 - 1)).status).toBe(200);
    const late = await send(0, open + 20_000); expect(late.status).toBe(409); expect((await j(late)).code).toBe("late-move");
    expect((await send(0, open - 1)).status).toBe(409); // not open yet: a different refusal, not late-move
  });
  test("a forged throw (another phone) is refused, and a game with automatic throws takes no throws at all", async () => {
    const { send } = await game();
    expect((await send(0, 0 + 1, { device: dev(2) })).status).toBe(403);
    const f = await game("fate"); expect((await f.send(0, f.open + 5_000)).status).toBe(409);
  });
});
