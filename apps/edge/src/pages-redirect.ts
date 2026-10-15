// The old free address (corporate-snakes-and-ladders.pages.dev) sends every PAGE request to the same path on the new address with a 301.
// What must keep working on the old address is not redirected: /api/* (the central payment service forwards Razorpay webhooks there, and a 301 would break a POST),
// /__*, /version.json and /.well-known/*. Only GET and HEAD are redirected.
export const OLD_HOST = "corporate-snakes-and-ladders.pages.dev";
export const NEW_ORIGIN = "https://snakes.corporatetambola.com";

/** The address to send the browser to, or null when the request must be answered here. */
export function redirectTarget(url: URL, method: string): string | null {
  if (url.hostname !== OLD_HOST) return null;
  if (method !== "GET" && method !== "HEAD") return null;
  const p = url.pathname;
  if (p.startsWith("/api/") || p === "/api" || p.startsWith("/__") || p === "/version.json" || p.startsWith("/.well-known/")) return null;
  return NEW_ORIGIN + p + url.search;
}
