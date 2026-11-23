// A stand-in for the public beacon's servers: every round has a fixed, known number (the server fetches them to check a reported win, verifywin.ts).
import { createHash } from "node:crypto";
import { QUICKNET } from "../../../packages/beacon/src/index";

/** The stand-in beacon's number for a round: a signature-shaped value (48 bytes) and its hash, as the real beacon gives. */
const h = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
export const sigOf = (round: number): string => h("test-beacon-signature|" + round) + h("test-beacon-more|" + round).slice(0, 32);
export const randomnessOf = (round: number): string => h(Buffer.from(sigOf(round), "hex"));
export const beaconAnswer = (round: number) => ({ round, randomness: randomnessOf(round), signature: sigOf(round) });

/** Rounds asked of the stand-in beacon since it was installed. */
export const asked: number[] = [];
let downNow = false;
/** Makes the stand-in beacon unreachable (true) or reachable again (false). */
export const beaconDown = (v: boolean) => { downNow = v; };
const MARK = Symbol.for("test-beacon");
/** Puts the stand-in beacon in front of whatever fetch the test already has (the payment stand-in etc. keep working). Safe to call again. */
export function installBeacon(): void {
  const prev = globalThis.fetch as any;
  if (prev?.[MARK]) return;
  const f: any = async (url: any, init?: any) => {
    const m = String(url).match(new RegExp(`^https://[^/]+/${QUICKNET.chainHash}/public/(\\d+)$`));
    if (!m) return prev(url, init);
    if (downNow) throw new Error("beacon unreachable");
    asked.push(Number(m[1]));
    return new Response(JSON.stringify(beaconAnswer(Number(m[1]))), { status: 200 });
  };
  f[MARK] = true;
  globalThis.fetch = f;
}

