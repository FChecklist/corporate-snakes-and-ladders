// Runs before the static pages (see _routes.json, which lists the page addresses): the old pages.dev address answers 301 to the new address; every other request goes on unchanged.
import { redirectTarget } from "../../apps/edge/src/pages-redirect";

export const onRequest = (ctx: { request: Request; next: () => Promise<Response> }) => {
  const to = redirectTarget(new URL(ctx.request.url), ctx.request.method);
  return to ? Response.redirect(to, 301) : ctx.next();
};
