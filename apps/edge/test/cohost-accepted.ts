// Test helper: calls the real Worker, but a Co-host key that has not accepted the role yet (K5, consent.ts) gets its tick recorded first, as the console does when the Co-host ticks the box.
// The server refuses everything else from an unaccepted Co-host key; cohost-accept.test.ts uses the REAL handle and proves it. Older tests that merely USE a Co-host key use this wrapper.
import { handle as realHandle, type Env } from "../src/worker";
import { recordConsent } from "../src/consent";

const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

export async function handle(req: Request, env: Env, now?: number): Promise<Response> {
  const key = req.headers.get("x-organizer");
  if (key && env.DB) {
    const kh = await sha("key|" + key);
    const row = await env.DB.prepare("SELECT kind FROM organizer_key WHERE hash=? AND revoked=0").bind(kh).first<{ kind: string }>().catch(() => null);
    if (row?.kind === "cohost") await recordConsent(env.DB, "K5", "c:" + kh.slice(0, 16), null, now ?? Date.now());
  }
  return realHandle(req, env, now);
}
