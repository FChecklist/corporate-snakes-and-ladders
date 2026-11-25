// Cloudflare Pages Function: the same page at https://<site>/ai-manual.html (the spelling with .html answers the same page).
import { handle } from "../../apps/edge/src/worker";

export const onRequest = (ctx: { request: Request; env: any; waitUntil: (p: Promise<unknown>) => void }) =>
  handle(ctx.request, ctx.env, Date.now(), (p) => ctx.waitUntil(p));
