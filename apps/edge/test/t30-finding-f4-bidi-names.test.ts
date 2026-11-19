// FINDING F-4 (docs/TEST_FINDINGS.md): cleanName removes zero-width characters but NOT the bidirectional control characters U+202A to U+202E and U+2066 to U+2069,
// so a guest can type a name that displays reversed or hides text in the organizer's list, the winners list and the report. RED on release/snakes-1.4.0: it states the correct behaviour.
import { describe, expect, test } from "bun:test";
import { cleanName } from "../src/people";
describe("F-4: names carry no bidirectional control characters", () => {
  for (const [label, cp] of [["LRE", 0x202a], ["RLE", 0x202b], ["PDF", 0x202c], ["LRO", 0x202d], ["RLO", 0x202e], ["LRI", 0x2066], ["RLI", 0x2067], ["FSI", 0x2068], ["PDI", 0x2069]] as const)
    test(`${label} (U+${cp.toString(16).toUpperCase()}) is removed from a name`, () => { expect(cleanName(`Ash${String.fromCodePoint(cp)}a`)).toBe("Asha"); });
});
