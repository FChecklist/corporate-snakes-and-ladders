// Phones send a device id when they join (one pawn, one device). Older tests do not care which device: they all join from the same one unless they say otherwise.
import { TERMS_VERSION } from "../src/brand";
export const DEVICE = "a".repeat(32);
/** One phone, one pawn: tests that do not say which device joins get a device of their own for each mobile number (the same number twice is the same device). */
export const deviceOf = (phone: unknown): string => (String(phone ?? "").replace(/\D/g, "").slice(-10) + "0".repeat(32)).slice(0, 32);
/** The tick a person gives on every consent box (consent.ts): every box, the current Terms version. */
export const TICKS = { v: TERMS_VERSION, boxes: ["A", "B"] };
/** Paths that need a tick. Tests of everything else behave as a person who always ticks; consent.test.ts sends requests WITHOUT it to prove the server refuses. */
const NEEDS_TICK = /(\/join|\/publish|\/roster|\/people|\/reuse|\/checkout|\/payments\/test|\/payments\/paytest|\/host\/setup\/accept|\/host\/setup\/mobile|\/host\/setup\/email\/verify|^\/api\/start|\/auth\/verify|\/auth\/link|\/auth\/google)$/;
export const withDevice = (method: string, path: string, body: unknown) => {
  let b: any = body;
  if (method === "POST" && /\/join$/.test(path) && b && typeof b === "object" && !("device" in b)) b = { device: deviceOf(b.phone) || DEVICE, ...b };
  if (method === "POST" && NEEDS_TICK.test(path.split("?")[0]!) && (b === undefined || (b && typeof b === "object" && !Array.isArray(b))) && !(b && "consent" in b)) b = { ...(b ?? {}), consent: TICKS };
  return b === undefined ? undefined : typeof b === "string" ? b : JSON.stringify(b);
};
