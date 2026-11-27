// Runs before the static pages (see _routes.json, which lists the page addresses): the old pages.dev address answers 301 to the new address; every other request goes on unchanged.
import { redirectTarget } from "../../apps/edge/src/pages-redirect";
import { legacyPayGate } from "../../apps/edge/src/console-pay";

export const onRequest = (ctx: { request: Request; next: () => Promise<Response>; env?: { PAY_VIA_CONSOLE?: string; CONSOLE_ORIGIN?: string } }) => {
  const gate = ctx.env ? legacyPayGate(ctx.request, ctx.env as any) : null; // PAY_VIA_CONSOLE = "1": the old pay pages go to the console (off: nothing changes)
  if (gate) return gate;
  const to = redirectTarget(new URL(ctx.request.url), ctx.request.method);
  return to ? Response.redirect(to, 301) : ctx.next();
};
