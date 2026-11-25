// Cloudflare Pages Function: the public AI manual page, https://<site>/ai-manual. It only hands the request to the Worker code (apps/edge/src/worker.ts), which reads the payee record when it answers.
import { handle } from "../../apps/edge/src/worker";

export const onRequest = (ctx: { request: Request; env: any; waitUntil: (p: Promise<unknown>) => void }) =>
  handle(ctx.request, ctx.env, Date.now(), (p) => ctx.waitUntil(p));
