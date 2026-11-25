// The owner's mobile number shown on a page opens WhatsApp with a ready first line.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const dirs = [join(import.meta.dir, "../public"), join(import.meta.dir, "../../../site")];
const WA = 'href="https://wa.me/919650397480?text=Hi%2C%20I%20am%20interested%20in%20corporate%20games"';

test("every page that shows the owner number links it to wa.me/919650397480 with the ready first line", () => {
  for (const d of dirs) for (const f of readdirSync(d).filter((n) => n.endsWith(".html"))) {
    const h = readFileSync(join(d, f), "utf8");
    if (!/96503 97480/.test(h)) continue;
    expect([f, h.includes(WA), /href="tel:/.test(h)]).toEqual([f, true, false]);
  }
});
