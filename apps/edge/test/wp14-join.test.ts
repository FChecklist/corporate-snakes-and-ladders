// WP-14 (gap plan 2026-10-29), Worker side: SL-05 and the join messages. Each test fails on the code before the change.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { HOUR, create, j, join, organizer, publish, reset, restore, roundMs, startIn, uid } from "./param-harness";

beforeEach(() => reset());
afterEach(restore);

describe("SL-05: a late payment must not tell newcomers the game is running", () => {
  test("an unpaid game whose start time has passed says the organizer has not finished the booking (locked), not 'the game is already running' (closed)", async () => {
    const o = await organizer(), id = uid();
    expect((await create(o.key, id, { cap: 20 })).status).toBe(200);
    expect((await publish(o.key, id)).status).toBe(200);
    const late = await join(id, 2, {}, roundMs(startIn(2 * HOUR)) + 10 * 60_000); // ten minutes after the start time, nobody has paid
    const b = await j(late);
    expect(b.code).toBe("locked");
    expect(late.status).toBe(403);
    expect(String(b.error)).not.toMatch(/already running/i);
  });
});
