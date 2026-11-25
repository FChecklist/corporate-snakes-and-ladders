// Browser side of the sales funnel (built to apps/web/public/funnel.js). Uses the shared core reporter: same-origin endpoint, no cookie, nothing stored on the device,
// Global Privacy Control respected there; Do Not Track is respected here. window.CBFunnel.report("size_chosen", { size: 200 }) is what the pages call.
import { makeReporter, type FunnelEvent } from "../../../vendor/game-core/packages/core/src/funnel";

type Nav = { globalPrivacyControl?: boolean; doNotTrack?: string | null; msDoNotTrack?: string | null; sendBeacon?: (url: string, data: string) => boolean };
/** Do Not Track is treated exactly like Global Privacy Control: nothing is sent. */
export const optedOutOf = (nav: Nav | undefined, win?: { doNotTrack?: string | null }): boolean =>
  nav?.globalPrivacyControl === true || nav?.doNotTrack === "1" || nav?.msDoNotTrack === "1" || win?.doNotTrack === "1";

export const FUNNEL_ENDPOINT = "/api/funnel/e";
/** The page steps that need no click: which event a page reports when it opens. */
export const pageEventFor = (path: string): FunnelEvent | null => {
  const p = path.replace(/\.html$/, "").replace(/\/+$/, "") || "/";
  if (p === "/pay") return "payment_page_reached";
  if (p === "/paylink") return "payment_page_opened";
  if (p === "/" || p === "/index" || p === "/pricing") return "viewed";
  return null;
};

export function start(nav: Nav | undefined, win: { doNotTrack?: string | null; location: { pathname: string } }): { report(e: FunnelEvent, p?: Record<string, unknown>): boolean } {
  const out = optedOutOf(nav, win);
  const r = makeReporter({ endpoint: FUNNEL_ENDPOINT, game: "snakes", nav: out ? { globalPrivacyControl: true } : (nav as any) });
  const api = { report: (e: FunnelEvent, p?: Record<string, unknown>) => { try { return r.report(e, p); } catch { return false; } } };
  const first = pageEventFor(win.location.pathname); if (first) api.report(first);
  return api;
}

if (typeof window !== "undefined" && typeof navigator !== "undefined") (window as any).CBFunnel = start(navigator as unknown as Nav, window as any);
