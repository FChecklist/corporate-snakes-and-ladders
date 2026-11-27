// Runs before the static pages (see _routes.json, which lists the page addresses): the old pages.dev address answers 301 to the new address; every other request goes on unchanged.
import { redirectTarget } from "../../apps/edge/src/pages-redirect";
import { legacyPayGate } from "../../apps/edge/src/console-pay";
import { siteHidden } from "../../apps/edge/src/site-hidden";
import { BRAND } from "../../apps/edge/src/brand";

export const onRequest = (ctx: { request: Request; next: () => Promise<Response>; env?: { PAY_VIA_CONSOLE?: string; CONSOLE_ORIGIN?: string; SITE_HIDDEN?: string } }) => {
  const gate = ctx.env ? legacyPayGate(ctx.request, ctx.env as any) : null; // PAY_VIA_CONSOLE = "1": the old pay pages go to the console (off: nothing changes)
  if (gate) return gate;
  const to = redirectTarget(new URL(ctx.request.url), ctx.request.method);
  if (to) return Response.redirect(to, 301);
  return siteHidden(ctx.request, ctx.env, BRAND.name) ?? ctx.next(); // SITE_HIDDEN = "1": the public marketing pages say "coming soon" (off: nothing changes)
};
