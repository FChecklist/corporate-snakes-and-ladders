// Test helper: calls the real Worker, but first does what a person does on the page: ticks the boxes the action needs (consent.ts) and sends the phone's own device id when joining.
// The server refuses every one of these actions without the ticks (consent.test.ts uses the REAL handle and proves it), so tests written for the shared platform use this wrapper
// instead of repeating `consent: {...}` in hundreds of requests. A request that already carries `consent` (or `device`) is passed on untouched.
// A Co-host key also has to have accepted the role before it can do anything; the wrapper records that tick the first time such a key is used.
import { handle as realHandle, type Env } from "../src/worker";
import { recordConsent } from "../src/consent";
import { TICKS } from "./device";

const NEEDS_TICK = /(\/join|\/publish|\/roster|\/people|\/reuse|\/checkout|\/payments\/test|\/payments\/paytest|\/host\/setup\/accept|\/host\/setup\/mobile|\/host\/setup\/email\/verify|^\/api\/start|\/auth\/verify|\/auth\/link|\/auth\/google)$/;
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

export async function handle(req: Request, env: Env, now?: number): Promise<Response> {
  const path = new URL(req.url).pathname;
  const key = req.headers.get("x-organizer");
  if (key && env.DB) { // a Co-host who has "accepted" before using the console
    const kh = await sha("key|" + key);
    const row = await env.DB.prepare("SELECT kind FROM organizer_key WHERE hash=? AND revoked=0").bind(kh).first<{ kind: string }>().catch(() => null);
    if (row?.kind === "cohost") {
      const subject = "c:" + kh.slice(0, 16);
      if (!(await env.DB.prepare("SELECT 1 AS x FROM consent_log WHERE subject=? AND kind='K5'").bind(subject).first())) await recordConsent(env.DB, "K5", subject, null, now ?? Date.now());
    }
  }
  if (req.method === "POST") {
    const text = await req.clone().text();
    let b: any = null; try { b = JSON.parse(text); } catch { b = null; }
    if (b && typeof b === "object" && !Array.isArray(b)) {
      let c = b, changed = false;
      if (NEEDS_TICK.test(path) && !("consent" in c)) { c = { ...c, consent: TICKS }; changed = true; }
      if (changed) { const headers = new Headers(req.headers); headers.delete("content-length"); return realHandle(new Request(req.url, { method: req.method, headers, body: JSON.stringify(c) }), env, now); }
    }
  }
  return realHandle(req, env, now);
}
export const consentFor = (_kind?: string) => TICKS;
